import type { Object3D } from 'three';
import { defineComponent, defineTag } from '@/game/core/ecs';
import type { Entity } from '@/game/core/ecs';
import { NULL_ENTITY } from '@/game/core/ecs';
import type { AnimationPlayer } from '@/game/render/rig/AnimationPlayer';
import type { Rig } from '@/game/render/rig/Rig';

// ─────────────────────────────────────────────────────────────── spatial

export const Transform = defineComponent('Transform', () => ({
    x: 0,
    y: 0,
    z: 0,
    /** Facing: +1 right, -1 left. Drives the rig's Y rotation. */
    facing: 1 as 1 | -1,
    /** Extra visual rotation (lean, spin) in radians. */
    roll: 0,
    scale: 1,
}));

export const Velocity = defineComponent('Velocity', () => ({ x: 0, y: 0 }));

export const Collider = defineComponent('Collider', () => ({
    hw: 0.5,
    hh: 0.5,
    /** Offset from Transform origin (origin sits at the feet for actors). */
    ox: 0,
    oy: 0.5,
}));

/** Static level geometry. */
export const Solid = defineComponent('Solid', () => ({
    kind: 'slab' as 'slab' | 'pipe' | 'wall' | 'ledge',
    /** Only collides from above; player can jump up through it. */
    oneWay: false,
    /** Forces the balance-walk state when stood on. */
    thin: false,
}));

export const Grounded = defineComponent('Grounded', () => ({
    onGround: false,
    /** Seconds since we last touched the ground (for coyote time). */
    airTime: 0,
    /** Entity of the surface we're standing on, if any. */
    surface: NULL_ENTITY as Entity,
    surfaceThin: false,
    touchingWallDir: 0,
    /** true when the collider centre is past the surface lip. */
    atEdge: false,
    edgeDir: 0,
}));

// ─────────────────────────────────────────────────────────────── player

export const PlayerTag = defineTag('PlayerTag');

export type PlayerStateName =
    | 'idle' | 'walk' | 'run' | 'skid' | 'crouch' | 'lookUp' | 'peek'
    | 'jump' | 'fall' | 'teeter' | 'tightrope'
    | 'ledgeHang' | 'ledgeClimb'
    | 'buzzsawCharge' | 'buzzsaw' | 'spikeBlast' | 'spikeBlastLand'
    | 'throwRing' | 'hurt' | 'dead'
    | 'climbOut' | 'riding' | 'victory' | 'cutscene';

export const PlayerState = defineComponent('PlayerState', () => ({
    name: 'idle' as PlayerStateName,
    previous: 'idle' as PlayerStateName,
    /** Seconds spent in the current state. */
    timer: 0,
    /** Blocks the state machine from changing state (scripted moves). */
    locked: false,
    /** Seconds of horizontal control lockout (knockback). */
    controlLock: 0,
    coyote: 0,
    jumpHeld: false,
    buzzsawCharge: 0,
    throwCooldown: 0,
    ledgeCooldown: 0,
    /** Ledge we're hanging from. */
    ledgeEntity: NULL_ENTITY as Entity,
    ledgeX: 0,
    ledgeY: 0,
    /** Corner-peek strength 0..1 for the camera. */
    peekAmount: 0,
    peekDir: 0,
}));

/** Per-frame distilled input. Systems read this, never the device. */
export const Intent = defineComponent('Intent', () => ({
    moveX: 0,
    lookY: 0,
    jumpPressed: false,
    jumpHeld: false,
    throwPressed: false,
    peekHeld: false,
    /** Set by SequenceSystem to drive scripted walking. */
    scripted: false,
}));

export const RingPurse = defineComponent('RingPurse', () => ({ rings: 0 }));

export const Invulnerable = defineComponent('Invulnerable', () => ({
    timer: 0,
    blinkPhase: 0,
}));

export const Respawn = defineComponent('Respawn', () => ({
    x: 0,
    y: 0,
    checkpointIndex: 0,
}));

// ─────────────────────────────────────────────────────────────── combat

export const Health = defineComponent('Health', () => ({
    hp: 1,
    maxHp: 1,
    /** Damage taken from the front is ignored (SWATbot chest plate). */
    frontArmoured: false,
    hitFlash: 0,
}));

/** Something that can be damaged. Box is relative to Transform. */
export const Hurtbox = defineComponent('Hurtbox', () => ({
    hw: 0.4,
    hh: 0.4,
    ox: 0,
    oy: 0.4,
    /** Bitmask of teams this hurtbox belongs to. */
    team: 0 as 0 | 1, // 0 = player, 1 = enemy
}));

/** Something that deals damage on overlap. */
export const Hitbox = defineComponent('Hitbox', () => ({
    hw: 0.4,
    hh: 0.4,
    ox: 0,
    oy: 0.4,
    damage: 1,
    team: 1 as 0 | 1,
    /** Consumed on first hit. */
    once: false,
    /** Destroys spike columns and other `breakOnlyByAttack` geometry. */
    heavy: false,
    active: true,
    /** Entities already hit (prevents multi-hits from one swing). */
    hitList: [] as Entity[],
}));

export const DamageOnTouch = defineComponent('DamageOnTouch', () => ({
    damage: 1,
    /** Knockback direction: 0 = away from centre, ±1 = fixed. */
    pushDir: 0,
}));

export const Breakable = defineComponent('Breakable', () => ({
    kind: 'spikes' as 'spikes' | 'monitor',
    /** Only `heavy` hitboxes (buzzsaw / spike-blast) can break it. */
    requiresHeavy: false,
    reward: 0,
}));

export const Projectile = defineComponent('Projectile', () => ({
    kind: 'ring' as 'ring' | 'bolt',
    damage: 1,
    team: 0 as 0 | 1,
    gravityScale: 0,
    bouncesLeft: 0,
    owner: NULL_ENTITY as Entity,
}));

// ─────────────────────────────────────────────────────────────── enemies

export const EnemyTag = defineComponent('EnemyTag', () => ({
    kind: 'spyphid' as 'spyphid' | 'skiff' | 'swatbot',
}));

export const PatrolPath = defineComponent('PatrolPath', () => ({
    points: [] as { x: number; y: number }[],
    index: 0,
    dir: 1,
    speed: 2,
    mode: 'pingpong' as 'pingpong' | 'loop',
    waitTimer: 0,
    waitAtPoint: 0,
}));

export const SpyphidAI = defineComponent('SpyphidAI', () => ({
    state: 'hover' as 'hover' | 'alert' | 'dive' | 'recover',
    timer: 0,
    homeX: 0,
    homeY: 0,
    bobPhase: 0,
    targetX: 0,
    targetY: 0,
    scanAngle: 0,
    scanDir: 1,
}));

export const SkiffAI = defineComponent('SkiffAI', () => ({
    /** Rider entity, or NULL_ENTITY. */
    rider: NULL_ENTITY as Entity,
    grabCooldown: 0,
    tilt: 0,
}));

export const SwatbotAI = defineComponent('SwatbotAI', () => ({
    state: 'patrol' as 'patrol' | 'spot' | 'charge' | 'fire' | 'stunned',
    timer: 0,
    cooldown: 0,
    chargeOrbs: 0,
}));

/** Marks an entity that a player can hang from (skiff grab bar). */
export const Rideable = defineComponent('Rideable', () => ({
    /** Grab bar offset from the entity origin. */
    ox: 0,
    oy: -0.45,
    hw: 0.9,
    hh: 0.35,
    occupied: false,
}));

/** The player while riding something. */
export const Rider = defineComponent('Rider', () => ({
    carrier: NULL_ENTITY as Entity,
    offsetX: 0,
    offsetY: 0,
    minHoldTime: 0,
}));

// ─────────────────────────────────────────────────────────────── pickups

export const Ring = defineComponent('Ring', () => ({
    value: 1,
    spinPhase: 0,
    collected: false,
}));

/** A ring knocked loose by damage: physical, bouncy, briefly un-collectable. */
export const ScatterRing = defineComponent('ScatterRing', () => ({
    life: 0,
    collectDelay: 0,
    bounces: 0,
}));

export const RingMonitor = defineComponent('RingMonitor', () => ({
    reward: 10,
    broken: false,
}));

export const Magnetic = defineComponent('Magnetic', () => ({
    radius: 1.1,
    strength: 14,
}));

// ─────────────────────────────────────────────────────────────── rendering

/** Links an entity to its three.js node. */
export const MeshRef = defineComponent('MeshRef', () => ({
    object: null as unknown as Object3D,
    /** Continuous spin applied every frame (coolers, rings, saws). */
    spinX: 0,
    spinY: 0,
    spinZ: 0,
    /** Hide when off-screen. */
    cullable: true,
    /** Half-extent of the visual, so wide props aren't culled while still on screen. */
    cullRadius: 2,
    baseY: 0,
    bobAmplitude: 0,
    bobSpeed: 0,
    bobPhase: 0,
}));

export const RigRef = defineComponent('RigRef', () => ({
    rig: null as unknown as Rig,
    player: null as unknown as AnimationPlayer,
}));

export const AnimState = defineComponent('AnimState', () => ({
    clip: 'idle',
    /** Playback rate multiplier — locomotion clips scale with speed. */
    rate: 1,
    /** One-shot clip that returns to the locomotion clip when done. */
    overlay: null as string | null,
    overlayTime: 0,
}));

export const BlobShadow = defineComponent('BlobShadow', () => ({
    radius: 0.42,
    maxDrop: 6,
    object: null as unknown as Object3D,
}));

// ─────────────────────────────────────────────────────────────── flow

export const Lifetime = defineComponent('Lifetime', () => ({ remaining: 1 }));

export const Checkpoint = defineComponent('Checkpoint', () => ({
    index: 0,
    activated: false,
    radius: 1.2,
}));

export const Trigger = defineComponent('Trigger', () => ({
    hw: 1,
    hh: 2,
    event: '',
    once: true,
    fired: false,
}));

/** An entity participating in a scripted sequence. */
export const SequenceActor = defineComponent('SequenceActor', () => ({
    role: '' as string,
}));

export const CameraTarget = defineComponent('CameraTarget', () => ({
    priority: 0,
    offsetX: 0,
    offsetY: 0,
}));

/** Marks props whose only job is to animate (fan blades etc). */
export const Animated = defineComponent('Animated', () => ({
    phase: 0,
    speed: 1,
}));

/** The level-end blast door. */
export const BlastDoor = defineComponent('BlastDoor', () => ({
    open: 0,
    opening: false,
    leftPanel: null as unknown as Object3D,
    rightPanel: null as unknown as Object3D,
}));
