import {
    Collider,
    Grounded,
    Intent,
    PlayerState,
    PlayerTag,
    Rider,
    Transform,
    Velocity,
} from '@/game/components';
import { PLAYER } from '@/game/config/GameConfig';
import type { CollisionWorld } from '@/game/core/CollisionWorld';
import { System, type Query } from '@/game/core/ecs';
import type { Effects } from '@/game/render/fx/Effects';

/**
 * Ledge grabbing.
 *
 * Runs after collision so it sees the resolved position. If a falling player's hands
 * line up with a solid's top corner in the direction they're moving, and there's room
 * to hang, we snap into the hang state.
 */
export class LedgeSystem extends System {
    private players!: Query;
    private collision!: CollisionWorld;
    private effects!: Effects;

    protected init(): void {
        this.players = this.world.query({
            all: [PlayerTag, PlayerState, Transform, Velocity, Collider, Grounded, Intent],
        });
        this.collision = this.world.getResource<CollisionWorld>('collision');
        this.effects = this.world.getResource<Effects>('effects');
    }

    update(): void {
        for (const entity of this.world.view(this.players)) {
            const state = this.world.must(entity, PlayerState);

            // Only grabbable while genuinely falling and free.
            if (state.name !== 'fall' && state.name !== 'jump') continue;
            if (state.ledgeCooldown > 0) continue;
            if (this.world.has(entity, Rider)) continue;

            const velocity = this.world.must(entity, Velocity);
            if (velocity.y > 0.5) continue; // still rising

            const transform = this.world.must(entity, Transform);
            const collider = this.world.must(entity, Collider);
            const intent = this.world.must(entity, Intent);

            // Grab toward the direction of travel, falling back to facing.
            const dir = intent.moveX !== 0 ? Math.sign(intent.moveX) : transform.facing;

            const cx = transform.x + collider.ox;
            const cy = transform.y + collider.oy;

            const ledge = this.collision.findLedge(
                cx, cy, collider.hw, collider.hh, dir,
                PLAYER.ledgeGrabReachX, PLAYER.ledgeGrabWindowY,
            );
            if (!ledge) continue;

            // ── snap into the hang
            state.previous = state.name;
            state.name = 'ledgeHang';
            state.timer = 0;
            state.ledgeEntity = ledge.box.entity;
            state.ledgeX = ledge.x;
            state.ledgeY = ledge.y;
            state.jumpHeld = false;

            transform.facing = dir >= 0 ? 1 : -1;
            transform.x = ledge.x - transform.facing * (collider.hw + 0.02);
            transform.y = ledge.y - collider.hh * 2 + 0.06;

            velocity.x = 0;
            velocity.y = 0;

            this.effects.dust(ledge.x, ledge.y, transform.facing, 3);
        }
    }
}
