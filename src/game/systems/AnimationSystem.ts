import {
    AnimState,
    EnemyTag,
    PlayerState,
    PlayerTag,
    RigRef,
    Transform,
    Velocity,
    type PlayerStateName,
} from '@/game/components';
import { PHYSICS } from '@/game/config/GameConfig';
import { System, type Entity, type Query } from '@/game/core/ecs';
import { clamp } from '@/game/core/MathUtils';
import { hasClip } from '@/game/render/rig/Clips';

/** Player state → animation clip. Locomotion clips get a speed-scaled playback rate. */
const STATE_CLIPS: Record<PlayerStateName, string> = {
    idle: 'idle',
    walk: 'walk',
    run: 'run',
    skid: 'skid',
    crouch: 'crouch',
    lookUp: 'lookUp',
    peek: 'peek',
    jump: 'jump',
    fall: 'fall',
    teeter: 'teeter',
    tightrope: 'tightrope',
    ledgeHang: 'ledgeHang',
    ledgeClimb: 'ledgeClimb',
    buzzsawCharge: 'buzzsawCharge',
    buzzsaw: 'spin',
    spikeBlast: 'spikeBlast',
    spikeBlastLand: 'spikeBlastLand',
    throwRing: 'throwRing',
    hurt: 'hurt',
    dead: 'hurt',
    climbOut: 'climbOut',
    riding: 'hang',
    victory: 'victory',
    cutscene: 'idle',
};

/**
 * Drives every rig's AnimationPlayer.
 *
 * Systems only ever set a *state*; picking the clip, the blend time and the playback
 * rate happens here so animation choices stay out of the gameplay logic.
 */
export class AnimationSystem extends System {
    private rigs!: Query;

    protected init(): void {
        this.rigs = this.world.query({ all: [RigRef, AnimState, Transform] });
    }

    update(dt: number): void {
        for (const entity of this.world.view(this.rigs)) {
            const rigRef = this.world.must(entity, RigRef);
            const anim = this.world.must(entity, AnimState);
            const transform = this.world.must(entity, Transform);

            if (this.world.has(entity, PlayerTag)) this.updatePlayerClip(entity, anim);
            else if (this.world.has(entity, EnemyTag)) this.updateEnemyClip(anim);

            const player = rigRef.player;
            player.play(anim.clip, { fade: this.fadeFor(anim.clip), rate: anim.rate });

            // one-shot overlays (ring throw) are requested by setting AnimState.overlay
            if (anim.overlay && anim.overlay !== player.overlayName) {
                player.playOverlay(anim.overlay);
                anim.overlay = null;
            }

            player.update(dt);

            // face the direction of travel; the rig models look down +Z
            const targetYaw = transform.facing > 0 ? 0 : Math.PI;
            rigRef.rig.root.rotation.y = targetYaw;
            rigRef.rig.root.rotation.z = transform.roll;
        }
    }

    private fadeFor(clip: string): number {
        // snappy transitions for reactions, softer for locomotion
        switch (clip) {
            case 'hurt':
            case 'spin':
            case 'spikeBlast':
            case 'ledgeHang':
                return 0.05;
            case 'run':
            case 'walk':
            case 'idle':
                return 0.14;
            default:
                return 0.1;
        }
    }

    private updatePlayerClip(entity: Entity, anim: ReturnType<typeof AnimState.create>): void {
        const state = this.world.get(entity, PlayerState);
        const velocity = this.world.get(entity, Velocity);
        if (!state) return;

        const clip = STATE_CLIPS[state.name] ?? 'idle';
        anim.clip = hasClip(clip) ? clip : 'idle';

        // Scale locomotion playback with actual speed so footfalls track the ground.
        const speed = Math.abs(velocity?.x ?? 0);
        switch (state.name) {
            case 'walk':
                anim.rate = clamp(speed / (PHYSICS.topSpeed * 0.45), 0.65, 1.7);
                break;
            case 'run':
                anim.rate = clamp(speed / PHYSICS.topSpeed, 0.8, 1.9);
                break;
            case 'tightrope':
                anim.rate = clamp(0.6 + speed / PHYSICS.topSpeed, 0.6, 1.5);
                break;
            case 'buzzsaw':
                anim.rate = 2.4;
                break;
            case 'buzzsawCharge':
                anim.rate = 1 + state.buzzsawCharge * 2.2;
                break;
            default:
                anim.rate = 1;
        }
    }

    private updateEnemyClip(anim: ReturnType<typeof AnimState.create>): void {
        // SWATbot clips are chosen by the AI directly; nothing else needs rate scaling.
        anim.rate = 1;
    }
}
