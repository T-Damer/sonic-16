import {
    Collider,
    Lifetime,
    Magnetic,
    MeshRef,
    PlayerState,
    PlayerTag,
    Ring,
    RingPurse,
    ScatterRing,
    Transform,
    Velocity,
} from '@/game/components';
import { PLAYER } from '@/game/config/GameConfig';
import { System, type Entity, type Query } from '@/game/core/ecs';
import { damp } from '@/game/core/MathUtils';
import type { EventHub } from '@/game/core/Signal';
import type { Effects } from '@/game/render/fx/Effects';

/**
 * Ring pickup and the physics of rings knocked loose by damage.
 *
 * Rings are health, ammo and score at once, so this is the single place that mutates
 * the purse on collection.
 */
export class RingSystem extends System {
    private rings!: Query;
    private players!: Query;
    private effects!: Effects;
    private events!: EventHub;

    protected init(): void {
        this.rings = this.world.query({ all: [Ring, Transform] });
        this.players = this.world.query({ all: [PlayerTag, Transform, Collider, RingPurse, PlayerState] });
        this.effects = this.world.getResource<Effects>('effects');
        this.events = this.world.getResource<EventHub>('events');
    }

    update(dt: number): void {
        const player = this.firstPlayer();
        if (player < 0) return;

        const playerTransform = this.world.must(player, Transform);
        const playerCollider = this.world.must(player, Collider);
        const purse = this.world.must(player, RingPurse);
        const state = this.world.must(player, PlayerState);

        const canCollect = state.name !== 'dead' && state.name !== 'cutscene';

        // Player's body centre — rings home in on the chest, not the feet.
        const px = playerTransform.x + playerCollider.ox;
        const py = playerTransform.y + playerCollider.oy;

        let collected = 0;

        for (const entity of this.world.view(this.rings)) {
            const ring = this.world.must(entity, Ring);
            if (ring.collected) continue;

            const transform = this.world.must(entity, Transform);
            const scatter = this.world.get(entity, ScatterRing);

            // ── scattered rings: age out, blink, and briefly refuse collection
            if (scatter) {
                scatter.life += dt;
                scatter.collectDelay = Math.max(0, scatter.collectDelay - dt);

                if (scatter.life >= PLAYER.scatterLifetime) {
                    this.despawn(entity);
                    continue;
                }

                // blink out over the last second
                const meshRef = this.world.get(entity, MeshRef);
                if (meshRef && scatter.life > PLAYER.scatterLifetime - 1) {
                    meshRef.object.visible = Math.sin(scatter.life * 30) > -0.3;
                }

                if (scatter.collectDelay > 0) continue;
            }

            const dx = px - transform.x;
            const dy = py - transform.y;
            const distanceSq = dx * dx + dy * dy;

            // ── magnet
            const magnetic = this.world.get(entity, Magnetic);
            if (magnetic && canCollect) {
                const radius = magnetic.radius;
                if (distanceSq < radius * radius && distanceSq > 0.0001) {
                    const distance = Math.sqrt(distanceSq);
                    const pull = (1 - distance / radius) * magnetic.strength;
                    transform.x = damp(transform.x, px, pull, dt);
                    transform.y = damp(transform.y, py, pull, dt);
                }
            }

            // ── pickup
            const pickupRadius = playerCollider.hw + 0.28;
            if (canCollect && distanceSq < pickupRadius * pickupRadius) {
                ring.collected = true;
                purse.rings += ring.value;
                collected += ring.value;
                this.effects.sparks(transform.x, transform.y, 4, 2.5, 0xfff3a8);
                this.despawn(entity);
            }
        }

        if (collected > 0) {
            this.events.emit('ringsChanged', { rings: purse.rings, delta: collected });
        }
    }

    /** Scattered rings drift to a halt so they don't slide forever. */
    private despawn(entity: Entity): void {
        const meshRef = this.world.get(entity, MeshRef);
        if (meshRef) meshRef.object.visible = false;
        this.world.destroy(entity);
    }

    private firstPlayer(): Entity {
        for (const entity of this.world.view(this.players)) return entity;
        return -1;
    }
}

/** Scattered rings lose horizontal energy over time — kept separate for clarity. */
export class ScatterRingSystem extends System {
    private scatter!: Query;

    protected init(): void {
        this.scatter = this.world.query({ all: [ScatterRing, Velocity, Transform] });
    }

    update(dt: number): void {
        for (const entity of this.world.view(this.scatter)) {
            const velocity = this.world.must(entity, Velocity);
            velocity.x = damp(velocity.x, 0, 1.2, dt);

            // Give every scattered ring a hard lifetime as a safety net.
            if (!this.world.has(entity, Lifetime)) {
                this.world.add(entity, Lifetime, { remaining: PLAYER.scatterLifetime + 0.5 });
            }
        }
    }
}
