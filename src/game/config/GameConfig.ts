/**
 * Central tunables. Nothing gameplay-magic should live inside a system.
 *
 * Physics constants are authored at "classic Mega Drive" pacing and then scaled by
 * GAME_SPEED so the whole simulation can be sped up/slowed down from one knob.
 */

/** Requested +25% pace. All velocities/accelerations and dt are scaled by this. */
export const GAME_SPEED = 1.25;

/** Fixed simulation step (seconds). */
export const FIXED_DT = 1 / 60;

/** Max catch-up steps per frame, so a stalled tab doesn't spiral. */
export const MAX_STEPS = 5;

/** Scale a per-second value into game pace. */
const s = (v: number) => v * GAME_SPEED;
/** Scale a per-second-squared value into game pace. */
const s2 = (v: number) => v * GAME_SPEED * GAME_SPEED;

export const PHYSICS = {
    gravity: s2(26.0),
    terminalFall: s(22.0),

    /** Ground movement */
    accel: s2(30.0),
    friction: s2(18.0),
    skidDecel: s2(90.0),
    topSpeed: s(6.0),
    runThreshold: s(3.6),
    walkThreshold: s(0.35),

    /** Air movement — slightly floatier control, momentum preserved */
    airAccel: s2(24.0),
    airDrag: s2(1.2),

    /** Jump */
    jumpSpeed: s(9.6),
    jumpCutMultiplier: 0.45,
    coyoteTime: 5 / 60,
    jumpBuffer: 6 / 60,

    /** Buzzsaw dash */
    buzzsawSpeed: s(11.0),
    buzzsawMinCharge: 0.25,
    buzzsawMaxCharge: 1.0,
    buzzsawDuration: 0.55,
    buzzsawChargeRate: 1.0,

    /** Spike blast (ground pound) */
    spikeBlastSpeed: s(20.0),
    spikeBlastRadius: 2.6,
    spikeBlastRecovery: 0.25,

    /** Tightrope / thin surface */
    thinSpeedFactor: 0.45,

    /** Hurt knockback */
    hurtKnockbackX: s(4.2),
    hurtKnockbackY: s(5.4),
    hurtControlLock: 0.35,
    invulnDuration: 1.2,
} as const;

export const PLAYER = {
    /** Collider half-extents (a 0.55 x 1.0 capsule-ish box). */
    halfWidth: 0.275,
    halfHeight: 0.5,
    crouchHalfHeight: 0.32,

    /** Ledge grab probe window */
    ledgeGrabReachX: 0.55,
    ledgeGrabWindowY: 0.35,
    ledgeClimbDuration: 0.45,
    ledgeGrabCooldown: 0.25,

    /** Corner peek */
    peekRange: 1.2,
    peekCameraOffset: 4.5,
    peekLean: 0.35,

    /** Edge teeter: how far past the lip the centre must be */
    teeterMargin: 0.12,

    /** Rings */
    startingRings: 0,
    ringLossFraction: 0.4,
    ringLossMin: 5,
    ringLossMax: 20,
    ringMagnetRadius: 1.1,
    scatterRecollectDelay: 0.65,
    scatterLifetime: 4.0,

    /** Ring throw */
    throwCost: 1,
    throwSpeed: s(12.0),
    throwGravityScale: 0.35,
    throwCooldown: 0.22,
    throwLifetime: 2.4,
    throwUpBias: s(3.0),
} as const;

export const CAMERA = {
    /**
     * Locked isometric orientation (degrees).
     *
     * Positive yaw puts the camera on the +X side, so we see the RIGHT faces of
     * decks and props — matching the reference footage. The old -16/12 was far too
     * subtle to read as isometric; 18/22 shows platform tops and side faces clearly.
     */
    yaw: 18,
    pitch: 22,
    /** Orthographic view height in world units. */
    viewHeight: 13.5,
    /** Distance along the view axis — only affects near/far clipping for ortho. */
    distance: 60,

    deadzoneX: 1.1,
    lookAheadX: 1.9,
    lookAheadSpeedRef: s(7.5),
    followLerpX: 9.0,
    followLerpYGround: 8.0,
    followLerpYAir: 3.0,
    lookUpOffset: 2.2,
    crouchOffset: -1.6,
    peekLerp: 4.0,
    shakeDecay: 6.0,
} as const;

/**
 * Pixelation.
 *
 * The 3D scene is rendered into a small backing store and stretched to the viewport
 * with nearest-neighbour filtering, so we get genuine chunky pixels rather than a
 * post-process approximation. 224 lines is the Mega Drive's NTSC height.
 */
export const PIXEL = {
    enabled: true,
    /** Internal render height in pixels. Lower = chunkier. */
    internalHeight: 270,
    /** Clamp the internal width so ultra-wide windows don't blow up the buffer. */
    maxInternalWidth: 640,
    /** Snap the scene to a virtual pixel grid to kill sub-pixel shimmer. */
    snapToGrid: true,
    /** Shadow map size — small keeps shadow edges chunky to match. */
    shadowMapSize: 1024,
} as const;

export const WORLD = {
    /** Depth (z) of each visual layer. Gameplay is always z = 0. */
    layers: {
        foreground: 2.0,
        gameplay: 0.0,
        platform: -1.5,
        wall: -6.0,
        machinery: -9.0,
        backdrop: -14.0,
    },
    /**
     * Fog distances are measured FROM THE CAMERA, which sits CAMERA.distance away
     * from the play plane. Anchoring them to that distance keeps the gameplay layer
     * crisp while the wall/machinery/backdrop layers fade progressively.
     * (Absolute values here once sat entirely inside fogFar and fogged out the
     * whole world to a flat colour — the infamous "nothing renders" bug.)
     */
    fogNear: CAMERA.distance + 4,
    fogFar: CAMERA.distance + 30,
} as const;

export const COMBAT = {
    stompBounce: s(8.2),
    enemyContactDamage: 1,
    swatbotBoltSpeed: s(9.0),
    swatbotChargeTime: 0.75,
    swatbotFireCooldown: 1.6,
    swatbotSightRange: 9.0,
    swatbotStunDuration: 1.2,
    spyphidSightRange: 7.5,
    spyphidDiveSpeed: s(8.5),
    spyphidTellTime: 0.4,
    spyphidHoverAmplitude: 0.28,
} as const;

/** Debug switches — flipped from the console via `window.SONIC16_DEBUG`. */
export const DEBUG = {
    showColliders: false,
    showProbes: false,
    freeCamera: false,
    invincible: false,
};
