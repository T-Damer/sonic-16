import {
    AnimState,
    Checkpoint,
    Collider,
    Grounded,
    Hitbox,
    Invulnerable,
    PlayerState,
    PlayerTag,
    Respawn,
    Rider,
    RingPurse,
    Transform,
    Velocity,
} from '@/game/components';
import { System, type Entity, type Query } from '@/game/core/ecs';
import type { EventHub } from '@/game/core/Signal';
import type { Renderer3D } from '@/game/render/Renderer3D';
import type { LevelRuntime } from '@/game/world/LevelBuilder';
import type { CombatSystem } from '@/game/systems/CombatSystem';

/** How long the death animation plays before the respawn. */
const DEATH_DURATION = 1.35;

/**
 * The kill plane, checkpoints and respawning.
 *
 * Falling into a pit is always fatal regardless of rings — that's what makes the
 * tightrope and skiff crossings tense rather than merely expensive.
 */
export class HazardSystem extends System {
    private players!: Query;
    private checkpoints!: Query;
    private events!: EventHub;
    private renderer!: Renderer3D;
    private level!: LevelRuntime;

    protected init(): void {
        this.players = this.world.query({
            all: [PlayerTag, Transform, PlayerState, Velocity, Collider],
        });
        this.checkpoints = this.world.query({ all: [Checkpoint, Transform] });
        this.events = this.world.getResource<EventHub>('events');
        this.renderer = this.world.getResource<Renderer3D>('renderer');
        this.level = this.world.getResource<LevelRuntime>('level');
    }

    update(dt: number): void {
        const combat = this.world.tryResource<CombatSystem>('combatSystem');

        for (const entity of this.world.view(this.players)) {
            const transform = this.world.must(entity, Transform);
            const state = this.world.must(entity, PlayerState);

            // ── kill plane
            if (state.name !== 'dead' && transform.y < this.level.def.killPlaneY) {
                combat?.killPlayer(entity);
            }

            // ── keep the player inside the level bounds
            const bounds = this.level.def.bounds;
            const collider = this.world.must(entity, Collider);
            if (transform.x < bounds.minX + collider.hw) {
                transform.x = bounds.minX + collider.hw;
                const velocity = this.world.must(entity, Velocity);
                if (velocity.x < 0) velocity.x = 0;
            } else if (transform.x > bounds.maxX - collider.hw) {
                transform.x = bounds.maxX - collider.hw;
                const velocity = this.world.must(entity, Velocity);
                if (velocity.x > 0) velocity.x = 0;
            }

            // ── death → respawn (state.timer is advanced by PlayerStateSystem)
            if (state.name === 'dead') {
                if (state.timer >= DEATH_DURATION) this.respawn(entity);
                continue;
            }

            this.updateCheckpoints(entity, transform);
        }

        void dt;
    }

    private updateCheckpoints(player: Entity, transform: ReturnType<typeof Transform.create>): void {
        const respawn = this.world.get(player, Respawn);
        if (!respawn) return;

        for (const entity of this.world.view(this.checkpoints)) {
            const checkpoint = this.world.must(entity, Checkpoint);
            if (checkpoint.activated || checkpoint.index <= respawn.checkpointIndex) continue;

            const checkpointTransform = this.world.must(entity, Transform);
            if (Math.abs(transform.x - checkpointTransform.x) > checkpoint.radius) continue;
            if (Math.abs(transform.y - checkpointTransform.y) > 2.5) continue;

            checkpoint.activated = true;
            respawn.x = checkpointTransform.x;
            respawn.y = checkpointTransform.y;
            respawn.checkpointIndex = checkpoint.index;
            this.events.emit('checkpointReached', { index: checkpoint.index });
        }
    }

    private respawn(player: Entity): void {
        const respawn = this.world.get(player, Respawn);
        const transform = this.world.must(player, Transform);
        const velocity = this.world.must(player, Velocity);
        const state = this.world.must(player, PlayerState);
        const grounded = this.world.get(player, Grounded);
        const purse = this.world.get(player, RingPurse);
        const invuln = this.world.get(player, Invulnerable);
        const anim = this.world.get(player, AnimState);

        transform.x = respawn?.x ?? this.level.def.spawn.x;
        transform.y = respawn?.y ?? this.level.def.spawn.y;
        transform.facing = 1;

        velocity.x = 0;
        velocity.y = 0;

        state.previous = 'dead';
        state.name = 'idle';
        state.timer = 0;
        state.locked = false;
        state.controlLock = 0;
        state.buzzsawCharge = 0;
        state.peekAmount = 0;
        state.ledgeEntity = -1;

        if (grounded) {
            grounded.onGround = false;
            grounded.airTime = 0;
            grounded.atEdge = false;
        }
        if (purse) {
            purse.rings = 0;
            this.events.emit('ringsChanged', { rings: 0, delta: 0 });
        }
        if (invuln) invuln.timer = 1.0;
        if (anim) {
            anim.clip = 'idle';
            anim.overlay = null;
        }

        this.world.remove(player, Hitbox);
        this.world.remove(player, Rider);

        // Reset the collision system's swept-motion origin, or the respawn teleport
        // would be treated as one enormous move and sweep through the whole level.
        const collisionSystem = this.world.tryResource<{ resetTracking(e?: Entity): void }>('collisionSystem');
        collisionSystem?.resetTracking(player);

        this.renderer.camera.snapTo(transform.x, transform.y + 1.4);
        this.events.emit('playerRespawned', { x: transform.x, y: transform.y });
    }
}
