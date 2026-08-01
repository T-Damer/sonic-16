import {
    Collider,
    Grounded,
    Intent,
    PlayerState,
    PlayerTag,
    Rider,
    ScatterRing,
    Transform,
    Velocity,
} from '@/game/components';
import { PLAYER } from '@/game/config/GameConfig';
import type { CollisionWorld } from '@/game/core/CollisionWorld';
import { System, type Entity, type Query } from '@/game/core/ecs';
import type { Effects } from '@/game/render/fx/Effects';

/**
 * Swept AABB resolution against static level geometry.
 *
 * X is resolved before Y so running into a wall never launches the actor upward, and
 * the sweep uses the pre-move position as its origin so nothing tunnels at buzzsaw speed.
 */
export class CollisionSystem extends System {
    private bodies!: Query;
    private collision!: CollisionWorld;
    private effects!: Effects;

    /** Position at the start of the step, used as the sweep origin. */
    private readonly previous = new Map<Entity, { x: number; y: number }>();

    protected init(): void {
        this.bodies = this.world.query({ all: [Transform, Velocity, Collider] });
        this.collision = this.world.getResource<CollisionWorld>('collision');
        this.effects = this.world.getResource<Effects>('effects');
    }

    update(dt: number): void {
        this.collision.rebuild();

        for (const entity of this.world.view(this.bodies)) {
            if (this.world.has(entity, Rider)) continue;

            const grounded = this.world.get(entity, Grounded);
            const scatter = this.world.get(entity, ScatterRing);

            // Only things that are meant to collide with geometry do.
            if (!grounded && !scatter) continue;

            if (scatter) this.resolveScatterRing(entity);
            else this.resolveActor(entity, dt);
        }
    }

    // ─────────────────────────────────────────────────────────────────── actors

    private resolveActor(entity: Entity, dt: number): void {
        const transform = this.world.must(entity, Transform);
        const velocity = this.world.must(entity, Velocity);
        const collider = this.world.must(entity, Collider);
        const grounded = this.world.must(entity, Grounded);

        const prev = this.previous.get(entity) ?? { x: transform.x, y: transform.y };

        const hw = collider.hw;
        const hh = collider.hh;
        // Collider centre, derived from the entity origin (which sits at the feet).
        const prevCx = prev.x + collider.ox;
        const prevCy = prev.y + collider.oy;
        const targetCx = transform.x + collider.ox;
        const targetCy = transform.y + collider.oy;

        const wasOnGround = grounded.onGround;
        grounded.onGround = false;
        grounded.touchingWallDir = 0;

        // Crouch + jump drops through one-way platforms.
        const intent = this.world.get(entity, Intent);
        const state = this.world.get(entity, PlayerState);
        const dropThrough =
            !!intent && intent.lookY < 0 && intent.jumpPressed &&
            !!state && state.name !== 'buzzsawCharge';

        // ── X first
        const dx = targetCx - prevCx;
        const sweptX = this.collision.sweepX(prevCx, prevCy, hw, hh, dx);
        let cx = sweptX.position;
        if (sweptX.hit) {
            grounded.touchingWallDir = dx > 0 ? 1 : -1;
            velocity.x = 0;
        }

        // ── then Y, from the X-resolved position
        const dy = targetCy - prevCy;
        const sweptY = this.collision.sweepY(cx, prevCy, hw, hh, dy, dropThrough);
        const cy = sweptY.position;

        if (sweptY.hit) {
            if (dy < 0) {
                grounded.onGround = true;
                grounded.surface = sweptY.entity;
                grounded.surfaceThin = sweptY.solid?.thin ?? false;
                grounded.airTime = 0;

                // landing puff, scaled by impact speed
                if (!wasOnGround && velocity.y < -6) {
                    this.effects.dust(transform.x, transform.y, 0, velocity.y < -14 ? 6 : 3);
                }
            }
            velocity.y = 0;
        }

        if (!grounded.onGround) {
            grounded.airTime += dt;
            grounded.surface = -1;
            grounded.surfaceThin = false;
        }

        transform.x = cx - collider.ox;
        transform.y = cy - collider.oy;

        // ── edge detection for teeter / peek
        this.updateEdgeState(entity, transform, collider, grounded);

        this.previous.set(entity, { x: transform.x, y: transform.y });
    }

    /**
     * Flags whether the actor is standing near the lip of its surface, and which way.
     * Drives the teeter animation and the corner-peek camera.
     */
    private updateEdgeState(
        entity: Entity,
        transform: ReturnType<typeof Transform.create>,
        collider: ReturnType<typeof Collider.create>,
        grounded: ReturnType<typeof Grounded.create>,
    ): void {
        grounded.atEdge = false;
        grounded.edgeDir = 0;

        if (!grounded.onGround || !this.world.has(entity, PlayerTag)) return;

        const cx = transform.x + collider.ox;
        const feetY = transform.y + 0.02;
        const probe = collider.hw + PLAYER.teeterMargin;

        const rightGround = this.collision.groundBelow(cx + probe, feetY, 0.04, 0.35);
        const leftGround = this.collision.groundBelow(cx - probe, feetY, 0.04, 0.35);

        if (!rightGround && leftGround) {
            grounded.atEdge = true;
            grounded.edgeDir = 1;
        } else if (!leftGround && rightGround) {
            grounded.atEdge = true;
            grounded.edgeDir = -1;
        }
    }

    // ───────────────────────────────────────────────────────── scattered rings

    /** Bouncy, non-solid-blocking rings knocked loose by damage. */
    private resolveScatterRing(entity: Entity): void {
        const transform = this.world.must(entity, Transform);
        const velocity = this.world.must(entity, Velocity);
        const collider = this.world.must(entity, Collider);
        const scatter = this.world.must(entity, ScatterRing);

        if (velocity.y >= 0 || scatter.bounces <= 0) return;

        const ground = this.collision.groundBelow(transform.x, transform.y, collider.hw, 0.3);
        if (ground && transform.y - collider.hh <= ground.top) {
            transform.y = ground.top + collider.hh;
            velocity.y = Math.abs(velocity.y) * 0.55;
            velocity.x *= 0.7;
            scatter.bounces--;
        }
    }

    /** Clears cached positions — call when the level reloads or the player teleports. */
    resetTracking(entity?: Entity): void {
        if (entity === undefined) this.previous.clear();
        else this.previous.delete(entity);
    }
}
