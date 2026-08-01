import { DEG } from '@/game/core/MathUtils';

/**
 * Keyframe animation clips.
 *
 * A track is a list of keys sorted by normalised time (0..1). Rotations are authored
 * in degrees for readability and converted on load. Position tracks are in world units.
 *
 * Only bones that actually move need tracks — everything else stays at bind pose.
 */

export interface RotKey {
    t: number;
    x?: number;
    y?: number;
    z?: number;
}

export interface PosKey {
    t: number;
    x?: number;
    y?: number;
    z?: number;
}

export interface BoneTrack {
    r?: RotKey[];
    p?: PosKey[];
}

export interface Clip {
    name: string;
    /** Seconds for one full cycle. */
    duration: number;
    loop: boolean;
    tracks: Record<string, BoneTrack>;
    /** Ball form (spin/buzzsaw) instead of the normal body. */
    ball?: boolean;
    /** Clip is a one-shot overlay that returns to locomotion when finished. */
    oneShot?: boolean;
}

const clips = new Map<string, Clip>();

function defineClip(clip: Clip): Clip {
    // convert authored degrees → radians once, at module load
    for (const track of Object.values(clip.tracks)) {
        if (!track.r) continue;
        for (const key of track.r) {
            if (key.x !== undefined) key.x *= DEG;
            if (key.y !== undefined) key.y *= DEG;
            if (key.z !== undefined) key.z *= DEG;
        }
    }
    clips.set(clip.name, clip);
    return clip;
}

export function getClip(name: string): Clip {
    const clip = clips.get(name);
    if (!clip) throw new Error(`Unknown animation clip "${name}"`);
    return clip;
}

export function hasClip(name: string): boolean {
    return clips.has(name);
}

// ══════════════════════════════════════════════════════════ SONIC LOCOMOTION

defineClip({
    name: 'idle',
    duration: 2.4,
    loop: true,
    tracks: {
        hips: { p: [{ t: 0, y: 0 }, { t: 0.5, y: -0.022 }, { t: 1, y: 0 }] },
        torso: { r: [{ t: 0, x: 0 }, { t: 0.5, x: 3 }, { t: 1, x: 0 }] },
        head: { r: [{ t: 0, y: 0, z: 0 }, { t: 0.35, y: -8, z: 2 }, { t: 0.7, y: 6, z: -1 }, { t: 1, y: 0, z: 0 }] },
        armL: { r: [{ t: 0, z: 8, x: 0 }, { t: 0.5, z: 12, x: 4 }, { t: 1, z: 8, x: 0 }] },
        armR: { r: [{ t: 0, z: -8, x: 0 }, { t: 0.5, z: -12, x: 4 }, { t: 1, z: -8, x: 0 }] },
        // occasional foot tap on the back half of the loop
        legR: { r: [{ t: 0, x: 0 }, { t: 0.72, x: 0 }, { t: 0.8, x: -22 }, { t: 0.88, x: 0 }, { t: 1, x: 0 }] },
    },
});

defineClip({
    name: 'walk',
    duration: 0.62,
    loop: true,
    tracks: {
        hips: {
            p: [{ t: 0, y: 0 }, { t: 0.25, y: 0.035 }, { t: 0.5, y: 0 }, { t: 0.75, y: 0.035 }, { t: 1, y: 0 }],
            r: [{ t: 0, y: 6 }, { t: 0.5, y: -6 }, { t: 1, y: 6 }],
        },
        torso: { r: [{ t: 0, x: 6, y: -4 }, { t: 0.5, x: 6, y: 4 }, { t: 1, x: 6, y: -4 }] },
        head: { r: [{ t: 0, x: -4 }, { t: 1, x: -4 }] },
        armL: { r: [{ t: 0, x: -32, z: 6 }, { t: 0.5, x: 30, z: 6 }, { t: 1, x: -32, z: 6 }] },
        armR: { r: [{ t: 0, x: 30, z: -6 }, { t: 0.5, x: -32, z: -6 }, { t: 1, x: 30, z: -6 }] },
        legL: { r: [{ t: 0, x: 34 }, { t: 0.5, x: -30 }, { t: 1, x: 34 }] },
        legR: { r: [{ t: 0, x: -30 }, { t: 0.5, x: 34 }, { t: 1, x: -30 }] },
        footL: { r: [{ t: 0, x: -14 }, { t: 0.5, x: 12 }, { t: 1, x: -14 }] },
        footR: { r: [{ t: 0, x: 12 }, { t: 0.5, x: -14 }, { t: 1, x: 12 }] },
    },
});

defineClip({
    name: 'run',
    duration: 0.34,
    loop: true,
    tracks: {
        hips: {
            p: [{ t: 0, y: 0.02 }, { t: 0.25, y: 0.075 }, { t: 0.5, y: 0.02 }, { t: 0.75, y: 0.075 }, { t: 1, y: 0.02 }],
            r: [{ t: 0, y: 12 }, { t: 0.5, y: -12 }, { t: 1, y: 12 }],
        },
        torso: { r: [{ t: 0, x: 22, y: -8 }, { t: 0.5, x: 22, y: 8 }, { t: 1, x: 22, y: -8 }] },
        head: { r: [{ t: 0, x: -18 }, { t: 1, x: -18 }] },
        armL: { r: [{ t: 0, x: -72, z: 14 }, { t: 0.5, x: 64, z: 14 }, { t: 1, x: -72, z: 14 }] },
        armR: { r: [{ t: 0, x: 64, z: -14 }, { t: 0.5, x: -72, z: -14 }, { t: 1, x: 64, z: -14 }] },
        legL: { r: [{ t: 0, x: 62 }, { t: 0.25, x: 10 }, { t: 0.5, x: -54 }, { t: 0.75, x: 6 }, { t: 1, x: 62 }] },
        legR: { r: [{ t: 0, x: -54 }, { t: 0.25, x: 6 }, { t: 0.5, x: 62 }, { t: 0.75, x: 10 }, { t: 1, x: -54 }] },
        footL: { r: [{ t: 0, x: -26 }, { t: 0.5, x: 22 }, { t: 1, x: -26 }] },
        footR: { r: [{ t: 0, x: 22 }, { t: 0.5, x: -26 }, { t: 1, x: 22 }] },
    },
});

defineClip({
    name: 'skid',
    duration: 0.4,
    loop: true,
    tracks: {
        hips: { r: [{ t: 0, y: -18 }, { t: 1, y: -18 }], p: [{ t: 0, y: -0.06 }, { t: 1, y: -0.06 }] },
        torso: { r: [{ t: 0, x: -16, y: -14 }, { t: 0.5, x: -20, y: -14 }, { t: 1, x: -16, y: -14 }] },
        head: { r: [{ t: 0, x: 8, y: 14 }, { t: 1, x: 8, y: 14 }] },
        armL: { r: [{ t: 0, x: -48, z: 42 }, { t: 0.5, x: -40, z: 46 }, { t: 1, x: -48, z: 42 }] },
        armR: { r: [{ t: 0, x: -20, z: -52 }, { t: 0.5, x: -26, z: -56 }, { t: 1, x: -20, z: -52 }] },
        legL: { r: [{ t: 0, x: -34 }, { t: 1, x: -34 }] },
        legR: { r: [{ t: 0, x: 18 }, { t: 1, x: 18 }] },
        footL: { r: [{ t: 0, x: 24 }, { t: 1, x: 24 }] },
    },
});

// ══════════════════════════════════════════════════════════ AIRBORNE

defineClip({
    name: 'jump',
    duration: 0.4,
    loop: false,
    tracks: {
        hips: { p: [{ t: 0, y: -0.05 }, { t: 0.3, y: 0.04 }, { t: 1, y: 0.02 }] },
        torso: { r: [{ t: 0, x: -14 }, { t: 0.4, x: 16 }, { t: 1, x: 10 }] },
        head: { r: [{ t: 0, x: 10 }, { t: 1, x: -6 }] },
        armL: { r: [{ t: 0, x: -30, z: 20 }, { t: 0.4, x: -120, z: 26 }, { t: 1, x: -104, z: 24 }] },
        armR: { r: [{ t: 0, x: -30, z: -20 }, { t: 0.4, x: -120, z: -26 }, { t: 1, x: -104, z: -24 }] },
        legL: { r: [{ t: 0, x: 42 }, { t: 0.4, x: -26 }, { t: 1, x: -18 }] },
        legR: { r: [{ t: 0, x: 42 }, { t: 0.4, x: 14 }, { t: 1, x: 22 }] },
    },
});

defineClip({
    name: 'fall',
    duration: 0.6,
    loop: true,
    tracks: {
        torso: { r: [{ t: 0, x: -10 }, { t: 0.5, x: -14 }, { t: 1, x: -10 }] },
        head: { r: [{ t: 0, x: 12 }, { t: 1, x: 12 }] },
        armL: { r: [{ t: 0, x: -140, z: 34 }, { t: 0.5, x: -150, z: 38 }, { t: 1, x: -140, z: 34 }] },
        armR: { r: [{ t: 0, x: -140, z: -34 }, { t: 0.5, x: -150, z: -38 }, { t: 1, x: -140, z: -34 }] },
        legL: { r: [{ t: 0, x: -22 }, { t: 0.5, x: -14 }, { t: 1, x: -22 }] },
        legR: { r: [{ t: 0, x: 28 }, { t: 0.5, x: 20 }, { t: 1, x: 28 }] },
    },
});

/** Ball form — used by rolling, the buzzsaw dash and the spike blast descent. */
defineClip({
    name: 'spin',
    duration: 0.12,
    loop: true,
    ball: true,
    tracks: {
        ball: { r: [{ t: 0, z: 0 }, { t: 1, z: -360 }] },
    },
});

// ══════════════════════════════════════════════════════════ SIGNATURE MOVES

defineClip({
    name: 'throwRing',
    duration: 0.28,
    loop: false,
    oneShot: true,
    tracks: {
        torso: { r: [{ t: 0, y: -18 }, { t: 0.45, y: 22 }, { t: 1, y: 0 }] },
        head: { r: [{ t: 0, y: 10 }, { t: 0.45, y: -6 }, { t: 1, y: 0 }] },
        armR: {
            r: [
                { t: 0, x: 40, z: -30 },
                { t: 0.35, x: -150, z: -40 },
                { t: 0.6, x: -40, z: -20 },
                { t: 1, x: 0, z: -8 },
            ],
        },
        armL: { r: [{ t: 0, x: -20, z: 24 }, { t: 0.45, x: 30, z: 18 }, { t: 1, x: 0, z: 8 }] },
    },
});

defineClip({
    name: 'buzzsawCharge',
    duration: 0.3,
    loop: true,
    ball: true,
    tracks: {
        ball: {
            r: [{ t: 0, z: 0 }, { t: 1, z: -720 }],
            p: [{ t: 0, x: 0 }, { t: 0.25, x: -0.035 }, { t: 0.75, x: 0.035 }, { t: 1, x: 0 }],
        },
    },
});

defineClip({
    name: 'spikeBlast',
    duration: 0.3,
    loop: true,
    ball: true,
    tracks: {
        ball: { r: [{ t: 0, z: 0 }, { t: 1, z: -540 }] },
    },
});

defineClip({
    name: 'spikeBlastLand',
    duration: 0.25,
    loop: false,
    oneShot: true,
    tracks: {
        hips: { p: [{ t: 0, y: -0.22 }, { t: 0.5, y: -0.12 }, { t: 1, y: 0 }] },
        torso: { r: [{ t: 0, x: 34 }, { t: 0.5, x: 18 }, { t: 1, x: 0 }] },
        head: { r: [{ t: 0, x: -20 }, { t: 1, x: 0 }] },
        armL: { r: [{ t: 0, x: 40, z: 62 }, { t: 1, x: 0, z: 8 }] },
        armR: { r: [{ t: 0, x: 40, z: -62 }, { t: 1, x: 0, z: -8 }] },
        legL: { r: [{ t: 0, x: 46 }, { t: 1, x: 0 }] },
        legR: { r: [{ t: 0, x: 46 }, { t: 1, x: 0 }] },
    },
});

// ══════════════════════════════════════════════════════════ TRAVERSAL

/** Hanging from a ledge by both hands. */
defineClip({
    name: 'ledgeHang',
    duration: 1.8,
    loop: true,
    tracks: {
        hips: { p: [{ t: 0, y: 0 }, { t: 0.5, y: -0.03 }, { t: 1, y: 0 }] },
        torso: { r: [{ t: 0, x: -6 }, { t: 0.5, x: -3 }, { t: 1, x: -6 }] },
        head: { r: [{ t: 0, x: 16 }, { t: 0.5, x: 12 }, { t: 1, x: 16 }] },
        armL: { r: [{ t: 0, x: -168, z: 12 }, { t: 1, x: -168, z: 12 }] },
        armR: { r: [{ t: 0, x: -168, z: -12 }, { t: 1, x: -168, z: -12 }] },
        legL: { r: [{ t: 0, x: -14 }, { t: 0.5, x: -6 }, { t: 1, x: -14 }] },
        legR: { r: [{ t: 0, x: 10 }, { t: 0.5, x: 18 }, { t: 1, x: 10 }] },
    },
});

/** Mount from the hang up onto the ledge. */
defineClip({
    name: 'ledgeClimb',
    duration: 0.45,
    loop: false,
    tracks: {
        hips: { p: [{ t: 0, y: 0 }, { t: 0.5, y: 0.18 }, { t: 1, y: 0 }] },
        torso: { r: [{ t: 0, x: -10 }, { t: 0.4, x: 46 }, { t: 0.75, x: 22 }, { t: 1, x: 0 }] },
        head: { r: [{ t: 0, x: 18 }, { t: 0.5, x: -16 }, { t: 1, x: 0 }] },
        armL: { r: [{ t: 0, x: -168, z: 12 }, { t: 0.45, x: -96, z: 30 }, { t: 1, x: 0, z: 8 }] },
        armR: { r: [{ t: 0, x: -168, z: -12 }, { t: 0.45, x: -60, z: -24 }, { t: 1, x: 0, z: -8 }] },
        legL: { r: [{ t: 0, x: -14 }, { t: 0.5, x: 76 }, { t: 1, x: 0 }] },
        legR: { r: [{ t: 0, x: 10 }, { t: 0.5, x: 44 }, { t: 1, x: 0 }] },
    },
});

/** Teetering on the lip of a platform. */
defineClip({
    name: 'teeter',
    duration: 0.9,
    loop: true,
    tracks: {
        hips: { r: [{ t: 0, z: 4 }, { t: 0.5, z: -4 }, { t: 1, z: 4 }], p: [{ t: 0, x: 0.02 }, { t: 0.5, x: -0.02 }, { t: 1, x: 0.02 }] },
        torso: { r: [{ t: 0, z: 8, x: 10 }, { t: 0.5, z: -8, x: 4 }, { t: 1, z: 8, x: 10 }] },
        head: { r: [{ t: 0, x: 18, z: -6 }, { t: 0.5, x: 14, z: 6 }, { t: 1, x: 18, z: -6 }] },
        armL: { r: [{ t: 0, x: -60, z: 68 }, { t: 0.5, x: -84, z: 52 }, { t: 1, x: -60, z: 68 }] },
        armR: { r: [{ t: 0, x: -84, z: -52 }, { t: 0.5, x: -60, z: -68 }, { t: 1, x: -84, z: -52 }] },
        legL: { r: [{ t: 0, x: -8 }, { t: 1, x: -8 }] },
        legR: { r: [{ t: 0, x: 14 }, { t: 1, x: 14 }] },
    },
});

/** Balance walk along a thin pipe. */
defineClip({
    name: 'tightrope',
    duration: 1.1,
    loop: true,
    tracks: {
        hips: { r: [{ t: 0, z: 3 }, { t: 0.5, z: -3 }, { t: 1, z: 3 }] },
        torso: { r: [{ t: 0, z: 5, x: 4 }, { t: 0.5, z: -5, x: 4 }, { t: 1, z: 5, x: 4 }] },
        head: { r: [{ t: 0, x: 8, z: -3 }, { t: 0.5, x: 8, z: 3 }, { t: 1, x: 8, z: -3 }] },
        armL: { r: [{ t: 0, z: 86, x: -6 }, { t: 0.5, z: 80, x: 6 }, { t: 1, z: 86, x: -6 }] },
        armR: { r: [{ t: 0, z: -80, x: 6 }, { t: 0.5, z: -86, x: -6 }, { t: 1, z: -80, x: 6 }] },
        legL: { r: [{ t: 0, x: 12 }, { t: 0.5, x: -10 }, { t: 1, x: 12 }] },
        legR: { r: [{ t: 0, x: -10 }, { t: 0.5, x: 12 }, { t: 1, x: -10 }] },
    },
});

/** Leaning past a corner to scout ahead. */
defineClip({
    name: 'peek',
    duration: 0.8,
    loop: true,
    tracks: {
        hips: { p: [{ t: 0, x: 0.06 }, { t: 0.5, x: 0.08 }, { t: 1, x: 0.06 }] },
        torso: { r: [{ t: 0, y: 26, x: 12 }, { t: 0.5, y: 30, x: 14 }, { t: 1, y: 26, x: 12 }] },
        head: { r: [{ t: 0, y: 24, x: 4 }, { t: 0.5, y: 28, x: 2 }, { t: 1, y: 24, x: 4 }] },
        armL: { r: [{ t: 0, x: -46, z: 34 }, { t: 1, x: -46, z: 34 }] },
        armR: { r: [{ t: 0, x: -14, z: -28 }, { t: 0.5, x: -18, z: -30 }, { t: 1, x: -14, z: -28 }] },
        legL: { r: [{ t: 0, x: 14 }, { t: 1, x: 14 }] },
        legR: { r: [{ t: 0, x: -12 }, { t: 1, x: -12 }] },
    },
});

/** Climbing out of the sewer grate — the level's opening shot. */
defineClip({
    name: 'climbOut',
    duration: 1.6,
    loop: false,
    tracks: {
        hips: {
            p: [
                { t: 0, y: -0.95 },
                { t: 0.35, y: -0.5 },
                { t: 0.62, y: -0.06 },
                { t: 0.82, y: 0.06 },
                { t: 1, y: 0 },
            ],
        },
        torso: { r: [{ t: 0, x: 30 }, { t: 0.4, x: 44 }, { t: 0.7, x: 20 }, { t: 1, x: 0 }] },
        head: { r: [{ t: 0, x: -26, y: -14 }, { t: 0.5, x: -18, y: 8 }, { t: 1, x: 0, y: 0 }] },
        armL: {
            r: [
                { t: 0, x: -158, z: 40 },
                { t: 0.35, x: -120, z: 46 },
                { t: 0.7, x: -40, z: 22 },
                { t: 1, x: 0, z: 8 },
            ],
        },
        armR: {
            r: [
                { t: 0, x: -158, z: -40 },
                { t: 0.35, x: -128, z: -46 },
                { t: 0.7, x: -34, z: -20 },
                { t: 1, x: 0, z: -8 },
            ],
        },
        legL: { r: [{ t: 0, x: -30 }, { t: 0.55, x: 84 }, { t: 0.8, x: 20 }, { t: 1, x: 0 }] },
        legR: { r: [{ t: 0, x: -18 }, { t: 0.6, x: 52 }, { t: 0.85, x: 12 }, { t: 1, x: 0 }] },
    },
});

/** Hanging from a skiff's grab bar. */
defineClip({
    name: 'hang',
    duration: 1.4,
    loop: true,
    tracks: {
        hips: { p: [{ t: 0, y: 0 }, { t: 0.5, y: -0.04 }, { t: 1, y: 0 }], r: [{ t: 0, z: 3 }, { t: 0.5, z: -3 }, { t: 1, z: 3 }] },
        torso: { r: [{ t: 0, x: -4, z: 2 }, { t: 0.5, x: -2, z: -2 }, { t: 1, x: -4, z: 2 }] },
        head: { r: [{ t: 0, x: 6 }, { t: 1, x: 6 }] },
        armL: { r: [{ t: 0, x: -172, z: 8 }, { t: 1, x: -172, z: 8 }] },
        armR: { r: [{ t: 0, x: -172, z: -8 }, { t: 1, x: -172, z: -8 }] },
        legL: { r: [{ t: 0, x: -16 }, { t: 0.5, x: -8 }, { t: 1, x: -16 }] },
        legR: { r: [{ t: 0, x: 12 }, { t: 0.5, x: 20 }, { t: 1, x: 12 }] },
    },
});

// ══════════════════════════════════════════════════════════ REACTIONS

defineClip({
    name: 'hurt',
    duration: 0.5,
    loop: false,
    tracks: {
        hips: { r: [{ t: 0, z: -14 }, { t: 0.5, z: -8 }, { t: 1, z: -10 }] },
        torso: { r: [{ t: 0, x: -34, z: -10 }, { t: 0.4, x: -20, z: -6 }, { t: 1, x: -26, z: -8 }] },
        head: { r: [{ t: 0, x: 30 }, { t: 0.4, x: 20 }, { t: 1, x: 24 }] },
        armL: { r: [{ t: 0, x: -128, z: 56 }, { t: 0.5, x: -110, z: 48 }, { t: 1, x: -118, z: 52 }] },
        armR: { r: [{ t: 0, x: -128, z: -56 }, { t: 0.5, x: -110, z: -48 }, { t: 1, x: -118, z: -52 }] },
        legL: { r: [{ t: 0, x: -34 }, { t: 0.5, x: -24 }, { t: 1, x: -28 }] },
        legR: { r: [{ t: 0, x: 40 }, { t: 0.5, x: 30 }, { t: 1, x: 34 }] },
    },
});

defineClip({
    name: 'crouch',
    duration: 0.5,
    loop: true,
    tracks: {
        hips: { p: [{ t: 0, y: -0.28 }, { t: 0.5, y: -0.3 }, { t: 1, y: -0.28 }] },
        torso: { r: [{ t: 0, x: 34 }, { t: 0.5, x: 36 }, { t: 1, x: 34 }] },
        head: { r: [{ t: 0, x: -22 }, { t: 1, x: -22 }] },
        armL: { r: [{ t: 0, x: 24, z: 30 }, { t: 1, x: 24, z: 30 }] },
        armR: { r: [{ t: 0, x: 24, z: -30 }, { t: 1, x: 24, z: -30 }] },
        legL: { r: [{ t: 0, x: 62 }, { t: 1, x: 62 }] },
        legR: { r: [{ t: 0, x: 62 }, { t: 1, x: 62 }] },
        footL: { r: [{ t: 0, x: -40 }, { t: 1, x: -40 }] },
        footR: { r: [{ t: 0, x: -40 }, { t: 1, x: -40 }] },
    },
});

defineClip({
    name: 'lookUp',
    duration: 1.0,
    loop: true,
    tracks: {
        torso: { r: [{ t: 0, x: -12 }, { t: 0.5, x: -14 }, { t: 1, x: -12 }] },
        head: { r: [{ t: 0, x: 34 }, { t: 0.5, x: 36 }, { t: 1, x: 34 }] },
        armL: { r: [{ t: 0, z: 14, x: 8 }, { t: 1, z: 14, x: 8 }] },
        armR: { r: [{ t: 0, z: -14, x: 8 }, { t: 1, z: -14, x: 8 }] },
    },
});

defineClip({
    name: 'victory',
    duration: 1.6,
    loop: true,
    tracks: {
        hips: { p: [{ t: 0, y: 0 }, { t: 0.5, y: -0.03 }, { t: 1, y: 0 }] },
        torso: { r: [{ t: 0, x: -6, y: 10 }, { t: 0.5, x: -3, y: 6 }, { t: 1, x: -6, y: 10 }] },
        head: { r: [{ t: 0, x: 8, y: -8 }, { t: 0.5, x: 6, y: -4 }, { t: 1, x: 8, y: -8 }] },
        armL: { r: [{ t: 0, x: -30, z: 20 }, { t: 0.5, x: -24, z: 24 }, { t: 1, x: -30, z: 20 }] },
        armR: { r: [{ t: 0, x: -150, z: -30 }, { t: 0.5, x: -160, z: -24 }, { t: 1, x: -150, z: -30 }] },
    },
});

// ══════════════════════════════════════════════════════════ ENEMY CLIPS

defineClip({
    name: 'swatPatrol',
    duration: 0.8,
    loop: true,
    tracks: {
        hips: { p: [{ t: 0, y: 0 }, { t: 0.25, y: 0.05 }, { t: 0.5, y: 0 }, { t: 0.75, y: 0.05 }, { t: 1, y: 0 }] },
        torso: { r: [{ t: 0, y: -5 }, { t: 0.5, y: 5 }, { t: 1, y: -5 }] },
        armL: { r: [{ t: 0, x: -26 }, { t: 0.5, x: 24 }, { t: 1, x: -26 }] },
        armR: { r: [{ t: 0, x: 24 }, { t: 0.5, x: -26 }, { t: 1, x: 24 }] },
        legL: { r: [{ t: 0, x: 28 }, { t: 0.5, x: -24 }, { t: 1, x: 28 }] },
        legR: { r: [{ t: 0, x: -24 }, { t: 0.5, x: 28 }, { t: 1, x: -24 }] },
    },
});

defineClip({
    name: 'swatAim',
    duration: 1.0,
    loop: true,
    tracks: {
        hips: { r: [{ t: 0, y: -8 }, { t: 1, y: -8 }] },
        torso: { r: [{ t: 0, y: 12, x: 4 }, { t: 0.5, y: 12, x: 2 }, { t: 1, y: 12, x: 4 }] },
        armR: { r: [{ t: 0, x: -88, z: -8 }, { t: 0.5, x: -90, z: -8 }, { t: 1, x: -88, z: -8 }] },
        armL: { r: [{ t: 0, x: -40, z: 26 }, { t: 1, x: -40, z: 26 }] },
        legL: { r: [{ t: 0, x: -18 }, { t: 1, x: -18 }] },
        legR: { r: [{ t: 0, x: 20 }, { t: 1, x: 20 }] },
    },
});

defineClip({
    name: 'swatStunned',
    duration: 0.35,
    loop: true,
    tracks: {
        hips: { r: [{ t: 0, z: 8 }, { t: 0.5, z: -8 }, { t: 1, z: 8 }], p: [{ t: 0, y: -0.1 }, { t: 1, y: -0.1 }] },
        torso: { r: [{ t: 0, x: 20, z: -6 }, { t: 0.5, x: 24, z: 6 }, { t: 1, x: 20, z: -6 }] },
        head: { r: [{ t: 0, z: 14 }, { t: 0.5, z: -14 }, { t: 1, z: 14 }] },
        armL: { r: [{ t: 0, x: -20, z: 44 }, { t: 1, x: -20, z: 44 }] },
        armR: { r: [{ t: 0, x: -20, z: -44 }, { t: 1, x: -20, z: -44 }] },
    },
});

/** Sally waiting at the blast door. */
defineClip({
    name: 'sallyIdle',
    duration: 2.8,
    loop: true,
    tracks: {
        hips: { p: [{ t: 0, y: 0 }, { t: 0.5, y: -0.018 }, { t: 1, y: 0 }] },
        torso: { r: [{ t: 0, x: 2, y: -4 }, { t: 0.5, x: 4, y: 2 }, { t: 1, x: 2, y: -4 }] },
        head: { r: [{ t: 0, y: -6 }, { t: 0.4, y: 8 }, { t: 1, y: -6 }] },
        armL: { r: [{ t: 0, z: 10 }, { t: 0.5, z: 13 }, { t: 1, z: 10 }] },
        armR: { r: [{ t: 0, z: -10 }, { t: 0.5, z: -13 }, { t: 1, z: -10 }] },
    },
});

defineClip({
    name: 'sallyWalk',
    duration: 0.7,
    loop: true,
    tracks: {
        hips: { p: [{ t: 0, y: 0 }, { t: 0.25, y: 0.03 }, { t: 0.5, y: 0 }, { t: 0.75, y: 0.03 }, { t: 1, y: 0 }] },
        torso: { r: [{ t: 0, y: -5 }, { t: 0.5, y: 5 }, { t: 1, y: -5 }] },
        armL: { r: [{ t: 0, x: -28, z: 8 }, { t: 0.5, x: 26, z: 8 }, { t: 1, x: -28, z: 8 }] },
        armR: { r: [{ t: 0, x: 26, z: -8 }, { t: 0.5, x: -28, z: -8 }, { t: 1, x: 26, z: -8 }] },
        legL: { r: [{ t: 0, x: 30 }, { t: 0.5, x: -26 }, { t: 1, x: 30 }] },
        legR: { r: [{ t: 0, x: -26 }, { t: 0.5, x: 30 }, { t: 1, x: -26 }] },
    },
});

export const CLIP_NAMES = Array.from(clips.keys());
