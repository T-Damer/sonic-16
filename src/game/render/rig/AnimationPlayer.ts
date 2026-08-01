import { Euler, Quaternion } from 'three';
import { clamp } from '@/game/core/MathUtils';
import { getClip, hasClip, type BoneTrack, type Clip, type PosKey, type RotKey } from '@/game/render/rig/Clips';
import type { Rig } from '@/game/render/rig/Rig';

/** Sample a track at normalised time, filling gaps with `fallback`. */
function sample(keys: RotKey[] | PosKey[], t: number, out: { x: number; y: number; z: number }, fallback: number): void {
    out.x = fallback;
    out.y = fallback;
    out.z = fallback;
    if (keys.length === 0) return;

    let a = keys[0];
    let b = keys[keys.length - 1];
    if (t <= a.t) {
        b = a;
    } else if (t >= b.t) {
        a = b;
    } else {
        for (let i = 0; i < keys.length - 1; i++) {
            if (t >= keys[i].t && t <= keys[i + 1].t) {
                a = keys[i];
                b = keys[i + 1];
                break;
            }
        }
    }

    const span = b.t - a.t;
    const k = span > 1e-6 ? (t - a.t) / span : 0;
    out.x = (a.x ?? fallback) + ((b.x ?? fallback) - (a.x ?? fallback)) * k;
    out.y = (a.y ?? fallback) + ((b.y ?? fallback) - (a.y ?? fallback)) * k;
    out.z = (a.z ?? fallback) + ((b.z ?? fallback) - (a.z ?? fallback)) * k;
}

const scratchA = { x: 0, y: 0, z: 0 };
const scratchB = { x: 0, y: 0, z: 0 };
const qA = new Quaternion();
const qB = new Quaternion();
const eA = new Euler();

/**
 * Plays keyframe clips onto a Rig with cross-fading and one-shot overlays.
 *
 * Blending is done per-bone: the outgoing clip's pose and the incoming clip's pose are
 * sampled independently and slerped, which is cheap and good enough for stylised motion.
 */
export class AnimationPlayer {
    private current: Clip;
    private currentTime = 0;
    private currentRate = 1;

    private previous: Clip | null = null;
    private previousTime = 0;
    private blend = 1;
    private blendDuration = 0.12;

    /** One-shot layered on top (ring throw during a run, etc). */
    private overlay: Clip | null = null;
    private overlayTime = 0;
    private overlayWeight = 0;

    /** Fires once when a non-looping clip reaches its end. */
    onFinished: ((clipName: string) => void) | null = null;
    private finishedFired = false;

    constructor(private readonly rig: Rig, initial = 'idle') {
        this.current = getClip(initial);
    }

    get clipName(): string {
        return this.current.name;
    }

    get overlayName(): string | null {
        return this.overlay?.name ?? null;
    }

    get normalizedTime(): number {
        return this.current.duration > 0 ? this.currentTime / this.current.duration : 0;
    }

    /** Switch the base locomotion clip. No-op if already playing it. */
    play(name: string, options: { fade?: number; rate?: number; restart?: boolean } = {}): void {
        if (!hasClip(name)) return;
        this.currentRate = options.rate ?? 1;

        if (this.current.name === name && !options.restart) return;

        this.previous = this.current;
        this.previousTime = this.currentTime;
        this.blendDuration = options.fade ?? 0.12;
        this.blend = this.blendDuration > 0 ? 0 : 1;

        this.current = getClip(name);
        this.currentTime = 0;
        this.finishedFired = false;
    }

    setRate(rate: number): void {
        this.currentRate = rate;
    }

    /** Layer a one-shot on top of the current locomotion (e.g. throwing while running). */
    playOverlay(name: string): void {
        if (!hasClip(name)) return;
        this.overlay = getClip(name);
        this.overlayTime = 0;
        this.overlayWeight = 0;
    }

    clearOverlay(): void {
        this.overlay = null;
        this.overlayWeight = 0;
    }

    update(dt: number): void {
        // ── advance timelines
        this.currentTime += dt * this.currentRate;
        if (this.current.loop) {
            this.currentTime %= this.current.duration;
        } else if (this.currentTime >= this.current.duration) {
            this.currentTime = this.current.duration;
            if (!this.finishedFired) {
                this.finishedFired = true;
                this.onFinished?.(this.current.name);
            }
        }

        if (this.previous) {
            this.previousTime += dt;
            if (this.previous.loop) this.previousTime %= this.previous.duration;
            this.blend = Math.min(1, this.blend + dt / Math.max(0.001, this.blendDuration));
            if (this.blend >= 1) this.previous = null;
        }

        if (this.overlay) {
            this.overlayTime += dt;
            const d = this.overlay.duration;
            // ease in over the first 20%, out over the last 25%
            const t = this.overlayTime / d;
            this.overlayWeight = t < 0.2 ? t / 0.2 : t > 0.75 ? Math.max(0, (1 - t) / 0.25) : 1;
            if (this.overlayTime >= d) this.clearOverlay();
        }

        this.applyPose();
    }

    private applyPose(): void {
        this.rig.resetPose();

        const ball = this.overlay?.ball ?? this.current.ball ?? false;
        this.rig.setBallMode(ball);

        const tCur = this.current.duration > 0 ? clamp(this.currentTime / this.current.duration, 0, 1) : 0;
        const tPrev = this.previous && this.previous.duration > 0
            ? clamp(this.previousTime / this.previous.duration, 0, 1)
            : 0;
        const tOver = this.overlay && this.overlay.duration > 0
            ? clamp(this.overlayTime / this.overlay.duration, 0, 1)
            : 0;

        // Union of every bone touched by any active clip.
        const bones = new Set<string>();
        for (const key of Object.keys(this.current.tracks)) bones.add(key);
        if (this.previous) for (const key of Object.keys(this.previous.tracks)) bones.add(key);
        if (this.overlay) for (const key of Object.keys(this.overlay.tracks)) bones.add(key);

        for (const boneName of bones) {
            const bone = this.rig.bones.get(boneName);
            if (!bone) continue;

            const curTrack: BoneTrack | undefined = this.current.tracks[boneName];
            const prevTrack: BoneTrack | undefined = this.previous?.tracks[boneName];

            // ── rotation: blend previous → current
            if (curTrack?.r || prevTrack?.r) {
                sample(curTrack?.r ?? [], tCur, scratchA, 0);
                eA.set(scratchA.x, scratchA.y, scratchA.z);
                qA.setFromEuler(eA);

                if (prevTrack?.r && this.blend < 1) {
                    sample(prevTrack.r, tPrev, scratchB, 0);
                    eA.set(scratchB.x, scratchB.y, scratchB.z);
                    qB.setFromEuler(eA);
                    qA.slerpQuaternions(qB, qA, this.blend);
                } else if (!curTrack?.r && this.blend < 1) {
                    // fading out of a clip that animated this bone toward bind pose
                    qB.identity();
                    qA.slerpQuaternions(qB, qA, this.blend);
                }

                bone.quaternion.copy(qA);
            }

            // ── position: additive offset on top of bind pose
            const bind = this.rig.bindPose(boneName);
            if ((curTrack?.p || prevTrack?.p) && bind) {
                sample(curTrack?.p ?? [], tCur, scratchA, 0);
                let px = scratchA.x;
                let py = scratchA.y;
                let pz = scratchA.z;

                if (prevTrack?.p && this.blend < 1) {
                    sample(prevTrack.p, tPrev, scratchB, 0);
                    px = scratchB.x + (px - scratchB.x) * this.blend;
                    py = scratchB.y + (py - scratchB.y) * this.blend;
                    pz = scratchB.z + (pz - scratchB.z) * this.blend;
                }

                bone.position.set(bind.position[0] + px, bind.position[1] + py, bind.position[2] + pz);
            }

            // ── overlay: blended in on top of everything
            const overTrack: BoneTrack | undefined = this.overlay?.tracks[boneName];
            if (overTrack && this.overlayWeight > 0) {
                if (overTrack.r) {
                    sample(overTrack.r, tOver, scratchA, 0);
                    eA.set(scratchA.x, scratchA.y, scratchA.z);
                    qB.setFromEuler(eA);
                    bone.quaternion.slerp(qB, this.overlayWeight);
                }
                if (overTrack.p && bind) {
                    sample(overTrack.p, tOver, scratchA, 0);
                    bone.position.set(
                        bone.position.x + scratchA.x * this.overlayWeight,
                        bone.position.y + scratchA.y * this.overlayWeight,
                        bone.position.z + scratchA.z * this.overlayWeight,
                    );
                }
            }
        }
    }
}
