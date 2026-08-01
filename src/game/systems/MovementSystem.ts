import { Grounded, PlayerState, Projectile, Rider, ScatterRing, Transform, Velocity } from '@/game/components';
import { PHYSICS } from '@/game/config/GameConfig';
import { System, type Query } from '@/game/core/ecs';

/**
 * Applies gravity and integrates velocity into position.
 *
 * Runs before collision, which then pushes anything back out of geometry. Entities
 * that drive their own motion opt out: riders are carried, flying enemies fly, and a
 * ledge-hanging player is pinned by the state machine.
 */
export class MovementSystem extends System {
    private movers!: Query;

    protected init(): void {
        this.movers = this.world.query({ all: [Transform, Velocity] });
    }

    update(dt: number): void {
        for (const entity of this.world.view(this.movers)) {
            // Riders are moved by their carrier in CarrySystem.
            if (this.world.has(entity, Rider)) continue;

            const state = this.world.get(entity, PlayerState);
            if (state && (state.name === 'ledgeHang' || state.name === 'ledgeClimb')) continue;

            const transform = this.world.must(entity, Transform);
            const velocity = this.world.must(entity, Velocity);

            // ── gravity: only things that are meant to fall
            const projectile = this.world.get(entity, Projectile);
            if (projectile) {
                if (projectile.gravityScale !== 0) {
                    velocity.y -= PHYSICS.gravity * projectile.gravityScale * dt;
                }
            } else if (this.world.has(entity, Grounded) || this.world.has(entity, ScatterRing)) {
                velocity.y -= PHYSICS.gravity * dt;
                if (velocity.y < -PHYSICS.terminalFall) velocity.y = -PHYSICS.terminalFall;
            }
            // Flying enemies (spyphid, skiff) have no Grounded component and steer
            // their own Y, so they are deliberately untouched here.

            transform.x += velocity.x * dt;
            transform.y += velocity.y * dt;
        }
    }
}
