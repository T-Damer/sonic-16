import {
    AnimState,
    Collider,
    Grounded,
    Hitbox,
    Intent,
    PlayerState,
    PlayerTag,
    Rideable,
    Rider,
    RingPurse,
    Transform,
    Velocity,
    type PlayerStateName,
} from '@/game/components';
import { PHYSICS, PLAYER } from '@/game/config/GameConfig';
import type { CollisionWorld } from '@/game/core/CollisionWorld';
import { System, type Entity, type Query } from '@/game/core/ecs';
import { approach, clamp, sign } from '@/game/core/MathUtils';
import type { EventHub } from '@/game/core/Signal';
import type { Effects } from '@/game/render/fx/Effects';
import type { Renderer3D } from '@/game/render/Renderer3D';
import { spawnProjectile } from '@/game/world/Factories';

type PState = ReturnType<typeof PlayerState.create>;
type TransformData = ReturnType<typeof Transform.create>;
type IntentData = ReturnType<typeof Intent.create>;
type VelocityData = ReturnType<typeof Velocity.create>;
type GroundedData = ReturnType<typeof Grounded.create>;
type ColliderData = ReturnType<typeof Collider.create>;

/** States that run to completion without player control. */
const LOCKED_STATES: ReadonlySet<PlayerStateName> = new Set([
    'climbOut', 'ledgeClimb', 'hurt', 'spikeBlastLand', 'victory', 'cutscene', 'dead',
]);

/**
 * The player finite state machine plus the movement it implies.
 *
 * Reads Intent and last frame's collision results, writes Velocity and the state name.
 * Everything about how the character *feels* lives here and in GameConfig.PHYSICS.
 */
export class PlayerStateSystem extends System {
    private players!: Query;
    private collision!: CollisionWorld;
    private effects!: Effects;
    private events!: EventHub;
    private renderer!: Renderer3D;

    protected init(): void {
        this.players = this.world.query({
            all: [PlayerTag, PlayerState, Intent, Velocity, Transform, Grounded, Collider],
        });
        this.collision = this.world.getResource<CollisionWorld>('collision');
        this.effects = this.world.getResource<Effects>('effects');
        this.events = this.world.getResource<EventHub>('events');
        this.renderer = this.world.getResource<Renderer3D>('renderer');
    }

    update(dt: number): void {
        for (const entity of this.world.view(this.players)) {
            this.updatePlayer(entity, dt);
        }
    }

    private setState(state: PState, next: PlayerStateName): void {
        if (state.name === next) return;
        state.previous = state.name;
        state.name = next;
        state.timer = 0;
    }

    private updatePlayer(entity: Entity, dt: number): void {
        const state = this.world.must(entity, PlayerState);
        const intent = this.world.must(entity, Intent);
        const velocity = this.world.must(entity, Velocity);
        const transform = this.world.must(entity, Transform);
        const grounded = this.world.must(entity, Grounded);
        const collider = this.world.must(entity, Collider);

        state.timer += dt;
        state.controlLock = Math.max(0, state.controlLock - dt);
        state.throwCooldown = Math.max(0, state.throwCooldown - dt);
        state.ledgeCooldown = Math.max(0, state.ledgeCooldown - dt);

        // Coyote time — a few frames of grace after walking off a lip.
        state.coyote = grounded.onGround ? PHYSICS.coyoteTime : Math.max(0, state.coyote - dt);

        if (LOCKED_STATES.has(state.name)) {
            this.updateLockedState(entity, state, velocity, transform, collider, grounded, dt);
            return;
        }

        // Ring throw is available from almost any state.
        if (intent.throwPressed && state.throwCooldown <= 0 && this.canThrow(state.name)) {
            this.throwRing(entity, transform, intent, state);
        }

        switch (state.name) {
            case 'ledgeHang':
                this.updateLedgeHang(state, intent, velocity, transform, collider);
                return;
            case 'riding':
                this.updateRiding(entity, state, intent, velocity);
                return;
            case 'buzzsaw':
                this.updateBuzzsaw(entity, state, velocity, transform, grounded, dt);
                return;
            case 'spikeBlast':
                this.updateSpikeBlast(entity, state, velocity, transform, grounded);
                return;
            case 'buzzsawCharge':
                this.updateBuzzsawCharge(state, intent, velocity, grounded, dt);
                return;
            default:
                break;
        }

        if (grounded.onGround) this.updateGrounded(state, intent, velocity, transform, grounded, dt);
        else this.updateAirborne(entity, state, intent, velocity, transform, dt);
    }

    // ───────────────────────────────────────────────────────────── ground states

    private updateGrounded(
        state: PState,
        intent: IntentData,
        velocity: VelocityData,
        transform: TransformData,
        grounded: GroundedData,
        dt: number,
    ): void {
        const moveX = intent.moveX;
        const speed = Math.abs(velocity.x);
        const onThin = grounded.surfaceThin;
        const topSpeed = onThin ? PHYSICS.topSpeed * PHYSICS.thinSpeedFactor : PHYSICS.topSpeed;

        if (intent.jumpPressed) {
            if (intent.lookY < 0) {
                // crouch + jump begins the buzzsaw rev
                this.setState(state, 'buzzsawCharge');
                state.buzzsawCharge = 0;
                velocity.x *= 0.4;
                return;
            }
            this.jump(state, velocity, transform);
            return;
        }

        // ── horizontal movement
        if (moveX !== 0) {
            const reversing = sign(moveX) !== sign(velocity.x) && speed > PHYSICS.walkThreshold;
            if (reversing) {
                velocity.x = approach(velocity.x, 0, PHYSICS.skidDecel * dt);
                if (state.name !== 'skid') this.setState(state, 'skid');
                if (state.timer > 0.08) {
                    this.effects.dust(transform.x, transform.y, sign(velocity.x), 2);
                    state.timer = 0;
                }
                transform.facing = moveX > 0 ? 1 : -1;
                return;
            }
            velocity.x = approach(velocity.x, moveX * topSpeed, PHYSICS.accel * dt);
            transform.facing = moveX > 0 ? 1 : -1;
        } else {
            velocity.x = approach(velocity.x, 0, PHYSICS.friction * dt);
        }

        const newSpeed = Math.abs(velocity.x);

        // ── standing still: peek / crouch / look up / teeter
        if (newSpeed <= PHYSICS.walkThreshold && moveX === 0) {
            if (intent.peekHeld && grounded.atEdge) {
                this.setState(state, 'peek');
                state.peekDir = grounded.edgeDir || transform.facing;
                state.peekAmount = clamp(state.peekAmount + dt * 2.5, 0, 1);
                transform.facing = state.peekDir >= 0 ? 1 : -1;
                return;
            }
            state.peekAmount = Math.max(0, state.peekAmount - dt * 3.5);

            if (intent.lookY < 0) this.setState(state, 'crouch');
            else if (intent.lookY > 0) this.setState(state, 'lookUp');
            else if (grounded.atEdge) {
                this.setState(state, 'teeter');
                transform.facing = grounded.edgeDir >= 0 ? 1 : -1;
            } else this.setState(state, 'idle');
            return;
        }

        state.peekAmount = Math.max(0, state.peekAmount - dt * 3.5);

        if (onThin) this.setState(state, 'tightrope');
        else if (newSpeed >= PHYSICS.runThreshold) this.setState(state, 'run');
        else this.setState(state, 'walk');
    }

    private jump(state: PState, velocity: VelocityData, transform: TransformData): void {
        velocity.y = PHYSICS.jumpSpeed;
        state.jumpHeld = true;
        state.coyote = 0;
        this.setState(state, 'jump');
        this.effects.dust(transform.x, transform.y, 0, 3);
    }

    // ──────────────────────────────────────────────────────────────── air states

    private updateAirborne(
        entity: Entity,
        state: PState,
        intent: IntentData,
        velocity: VelocityData,
        transform: TransformData,
        dt: number,
    ): void {
        if (intent.jumpPressed && state.coyote > 0) {
            this.jump(state, velocity, transform);
            return;
        }

        // variable jump height — cut the rise when the button is released
        if (state.jumpHeld && !intent.jumpHeld && velocity.y > 0) {
            velocity.y *= PHYSICS.jumpCutMultiplier;
            state.jumpHeld = false;
        }

        // spike blast: slam straight down
        if (intent.lookY < 0 && velocity.y < PHYSICS.jumpSpeed * 0.5) {
            this.setState(state, 'spikeBlast');
            velocity.x = 0;
            velocity.y = -PHYSICS.spikeBlastSpeed;
            this.addHitbox(entity, { hw: 0.42, hh: 0.42, oy: 0.4, damage: 1, heavy: true });
            return;
        }

        // air control that preserves momentum
        if (intent.moveX !== 0) {
            const target = intent.moveX * PHYSICS.topSpeed;
            if (Math.abs(velocity.x) < Math.abs(target) || sign(velocity.x) !== sign(target)) {
                velocity.x = approach(velocity.x, target, PHYSICS.airAccel * dt);
            }
            transform.facing = intent.moveX > 0 ? 1 : -1;
        } else {
            velocity.x = approach(velocity.x, 0, PHYSICS.airDrag * dt);
        }

        this.setState(state, velocity.y > 0 ? 'jump' : 'fall');
    }

    // ─────────────────────────────────────────────────────────────── special moves

    private updateBuzzsawCharge(
        state: PState,
        intent: IntentData,
        velocity: VelocityData,
        grounded: GroundedData,
        dt: number,
    ): void {
        velocity.x = approach(velocity.x, 0, PHYSICS.friction * 2 * dt);
        state.buzzsawCharge = Math.min(
            PHYSICS.buzzsawMaxCharge,
            state.buzzsawCharge + PHYSICS.buzzsawChargeRate * dt,
        );

        if (!grounded.onGround) {
            this.setState(state, 'fall');
            return;
        }

        if (!intent.jumpHeld) {
            this.setState(state, state.buzzsawCharge >= PHYSICS.buzzsawMinCharge ? 'buzzsaw' : 'idle');
        }
    }

    private updateBuzzsaw(
        entity: Entity,
        state: PState,
        velocity: VelocityData,
        transform: TransformData,
        grounded: GroundedData,
        dt: number,
    ): void {
        const power = clamp(state.buzzsawCharge / PHYSICS.buzzsawMaxCharge, 0.4, 1);
        velocity.x = transform.facing * PHYSICS.buzzsawSpeed * power;

        if (!this.world.has(entity, Hitbox)) {
            this.addHitbox(entity, { hw: 0.5, hh: 0.42, oy: 0.38, damage: 1, heavy: true });
        }

        this.effects.sparks(transform.x, transform.y + 0.2, 1, 2.2, 0xbfe0ff);

        const duration = PHYSICS.buzzsawDuration * (0.6 + 0.4 * power);
        const blockedByWall = grounded.touchingWallDir !== 0 && grounded.touchingWallDir === transform.facing;

        if (state.timer >= duration || blockedByWall) {
            this.world.remove(entity, Hitbox);
            state.buzzsawCharge = 0;
            velocity.x *= 0.45;
            this.setState(state, grounded.onGround ? 'idle' : 'fall');
        }

        void dt;
    }

    private updateSpikeBlast(
        entity: Entity,
        state: PState,
        velocity: VelocityData,
        transform: TransformData,
        grounded: GroundedData,
    ): void {
        velocity.x = 0;
        velocity.y = -PHYSICS.spikeBlastSpeed;

        if (!grounded.onGround) return;

        this.setState(state, 'spikeBlastLand');
        state.controlLock = PHYSICS.spikeBlastRecovery;

        // shockwave: a cosmetic ring plus a brief wide heavy hitbox
        this.effects.shockwave(transform.x, transform.y, PHYSICS.spikeBlastRadius);
        this.effects.dust(transform.x, transform.y, 1, 6);
        this.effects.dust(transform.x, transform.y, -1, 6);
        this.addHitbox(entity, {
            hw: PHYSICS.spikeBlastRadius,
            hh: 0.7,
            oy: 0.5,
            damage: 1,
            heavy: true,
        });
        this.events.emit('cameraShake', { amount: 0.7 });
        this.renderer.camera.addShake(0.7);
    }

    // ──────────────────────────────────────────────────────────────── ledge & ride

    private updateLedgeHang(
        state: PState,
        intent: IntentData,
        velocity: VelocityData,
        transform: TransformData,
        collider: ColliderData,
    ): void {
        velocity.x = 0;
        velocity.y = 0;

        // pin to the lip
        transform.x = state.ledgeX - transform.facing * (collider.hw + 0.02);
        transform.y = state.ledgeY - collider.hh * 2 + 0.06;

        if (intent.lookY > 0 || intent.jumpPressed) {
            const targetX = state.ledgeX + transform.facing * (collider.hw + 0.06);
            const clear = !this.collision.overlapsSolid(
                targetX, state.ledgeY + collider.hh, collider.hw * 0.92, collider.hh * 0.92,
            );
            if (clear) {
                this.setState(state, 'ledgeClimb');
                state.locked = true;
                return;
            }
        }

        if (intent.lookY < 0) {
            this.setState(state, 'fall');
            state.ledgeCooldown = PLAYER.ledgeGrabCooldown;
            state.ledgeEntity = -1;
            transform.x -= transform.facing * 0.08;
        }
    }

    private updateRiding(entity: Entity, state: PState, intent: IntentData, velocity: VelocityData): void {
        const rider = this.world.get(entity, Rider);
        if (!rider || rider.carrier < 0 || !this.world.isAlive(rider.carrier)) {
            this.releaseRide(entity, rider?.carrier ?? -1);
            this.setState(state, 'fall');
            return;
        }

        rider.minHoldTime = Math.max(0, rider.minHoldTime - PHYSICS.coyoteTime);

        if (intent.jumpPressed && rider.minHoldTime <= 0) {
            const carrierVel = this.world.get(rider.carrier, Velocity);
            velocity.x = (carrierVel?.x ?? 0) + intent.moveX * PHYSICS.topSpeed * 0.6;
            velocity.y = PHYSICS.jumpSpeed * 0.95 + Math.max(0, carrierVel?.y ?? 0);

            this.releaseRide(entity, rider.carrier);
            this.setState(state, 'jump');
            state.jumpHeld = true;
        }
    }

    private releaseRide(entity: Entity, carrier: Entity): void {
        this.world.remove(entity, Rider);
        if (carrier >= 0 && this.world.isAlive(carrier)) {
            const rideable = this.world.get(carrier, Rideable);
            if (rideable) rideable.occupied = false;
        }
    }

    // ─────────────────────────────────────────────────────────────── locked states

    private updateLockedState(
        entity: Entity,
        state: PState,
        velocity: VelocityData,
        transform: TransformData,
        collider: ColliderData,
        grounded: GroundedData,
        dt: number,
    ): void {
        switch (state.name) {
            case 'climbOut': {
                velocity.x = 0;
                velocity.y = 0;
                if (state.timer >= 1.6) {
                    state.locked = false;
                    this.setState(state, 'idle');
                }
                break;
            }

            case 'ledgeClimb': {
                velocity.x = 0;
                velocity.y = 0;
                const progress = clamp(state.timer / PLAYER.ledgeClimbDuration, 0, 1);
                const startX = state.ledgeX - transform.facing * (collider.hw + 0.02);
                const endX = state.ledgeX + transform.facing * (collider.hw + 0.08);
                const startY = state.ledgeY - collider.hh * 2 + 0.06;

                // rise first, then step across the lip
                transform.y = startY + (state.ledgeY - startY) * Math.min(1, progress / 0.7);
                transform.x = startX + (endX - startX) * clamp((progress - 0.45) / 0.55, 0, 1);

                if (progress >= 1) {
                    state.locked = false;
                    state.ledgeEntity = -1;
                    state.ledgeCooldown = PLAYER.ledgeGrabCooldown;
                    this.setState(state, 'idle');
                }
                break;
            }

            case 'hurt': {
                velocity.x = approach(velocity.x, 0, PHYSICS.friction * 0.5 * dt);
                if (state.controlLock <= 0 && grounded.onGround) this.setState(state, 'idle');
                break;
            }

            case 'spikeBlastLand': {
                velocity.x = 0;
                if (state.timer >= PHYSICS.spikeBlastRecovery) {
                    this.world.remove(entity, Hitbox);
                    this.setState(state, 'idle');
                }
                break;
            }

            case 'dead': {
                velocity.x = 0;
                break;
            }

            default:
                break;
        }
    }

    // ───────────────────────────────────────────────────────────────────── helpers

    private canThrow(state: PlayerStateName): boolean {
        return (
            state !== 'ledgeHang' && state !== 'ledgeClimb' &&
            state !== 'buzzsaw' && state !== 'spikeBlast' &&
            state !== 'hurt' && state !== 'dead' &&
            state !== 'climbOut' && state !== 'cutscene'
        );
    }

    private throwRing(entity: Entity, transform: TransformData, intent: IntentData, state: PState): void {
        const purse = this.world.get(entity, RingPurse);
        if (!purse || purse.rings < PLAYER.throwCost) return;

        purse.rings -= PLAYER.throwCost;
        state.throwCooldown = PLAYER.throwCooldown;

        spawnProjectile(this.world, this.renderer, {
            x: transform.x + transform.facing * 0.35,
            y: transform.y + 0.55,
            vx: transform.facing * PLAYER.throwSpeed,
            vy: intent.lookY > 0 ? PLAYER.throwUpBias * 1.8 : PLAYER.throwUpBias,
            kind: 'ring',
            team: 0,
            owner: entity,
        });

        const anim = this.world.get(entity, AnimState);
        if (anim) anim.overlay = 'throwRing';

        this.events.emit('ringsChanged', { rings: purse.rings, delta: -PLAYER.throwCost });
        this.effects.sparks(transform.x + transform.facing * 0.4, transform.y + 0.55, 3, 2);
    }

    /** Attach (or refresh) the player's attack hitbox. */
    private addHitbox(
        entity: Entity,
        opts: { hw: number; hh: number; oy: number; damage: number; heavy: boolean },
    ): void {
        const data = {
            hw: opts.hw,
            hh: opts.hh,
            ox: 0,
            oy: opts.oy,
            damage: opts.damage,
            team: 0 as const,
            once: false,
            heavy: opts.heavy,
            active: true,
            hitList: [] as Entity[],
        };
        const existing = this.world.get(entity, Hitbox);
        if (existing) Object.assign(existing, data);
        else this.world.add(entity, Hitbox, data);
    }
}
