import {
    Collider,
    PlayerState,
    PlayerTag,
    Rideable,
    Rider,
    Transform,
    Velocity,
} from '@/game/components';
import { System, type Entity, type Query } from '@/game/core/ecs';
import { aabbOverlap } from '@/game/core/MathUtils';
import type { Effects } from '@/game/render/fx/Effects';

/**
 * Skiff riding.
 *
 * Catching a grab bar mid-jump attaches the player to the carrier; from then on the
 * player's position is driven entirely by the carrier until they jump off.
 */
export class CarrySystem extends System {
    private players!: Query;
    private rideables!: Query;
    private effects!: Effects;

    protected init(): void {
        this.players = this.world.query({ all: [PlayerTag, Transform, Velocity, Collider, PlayerState] });
        this.rideables = this.world.query({ all: [Rideable, Transform] });
        this.effects = this.world.getResource<Effects>('effects');
    }

    update(): void {
        for (const player of this.world.view(this.players)) {
            const rider = this.world.get(player, Rider);
            if (rider) this.followCarrier(player, rider);
            else this.tryGrab(player);
        }
    }

    /** Position the player under the carrier's grab bar. */
    private followCarrier(player: Entity, rider: ReturnType<typeof Rider.create>): void {
        const carrier = rider.carrier;
        if (carrier < 0 || !this.world.isAlive(carrier)) {
            this.detach(player, rider);
            return;
        }

        const carrierTransform = this.world.get(carrier, Transform);
        const rideable = this.world.get(carrier, Rideable);
        if (!carrierTransform || !rideable) {
            this.detach(player, rider);
            return;
        }

        const transform = this.world.must(player, Transform);
        const velocity = this.world.must(player, Velocity);
        const collider = this.world.must(player, Collider);

        // hang below the bar — the entity origin is at the feet, so drop a full height
        transform.x = carrierTransform.x + rideable.ox + rider.offsetX;
        transform.y = carrierTransform.y + rideable.oy - collider.hh * 2 - 0.1;

        const carrierVel = this.world.get(carrier, Velocity);
        velocity.x = carrierVel?.x ?? 0;
        velocity.y = carrierVel?.y ?? 0;
    }

    /** Overlap the player's body with any unoccupied grab bar. */
    private tryGrab(player: Entity): void {
        const state = this.world.must(player, PlayerState);
        if (state.name !== 'jump' && state.name !== 'fall') return;

        const transform = this.world.must(player, Transform);
        const collider = this.world.must(player, Collider);

        const playerBox = {
            x: transform.x + collider.ox,
            y: transform.y + collider.oy,
            hw: collider.hw,
            hh: collider.hh,
        };

        for (const carrier of this.world.view(this.rideables)) {
            const rideable = this.world.must(carrier, Rideable);
            if (rideable.occupied) continue;

            const carrierTransform = this.world.must(carrier, Transform);
            const barBox = {
                x: carrierTransform.x + rideable.ox,
                y: carrierTransform.y + rideable.oy,
                hw: rideable.hw,
                hh: rideable.hh,
            };

            if (!aabbOverlap(playerBox, barBox)) continue;

            rideable.occupied = true;
            this.world.add(player, Rider, {
                carrier,
                offsetX: 0,
                offsetY: rideable.oy,
                // brief lockout so the grab press doesn't immediately release
                minHoldTime: 0.15,
            });

            state.previous = state.name;
            state.name = 'riding';
            state.timer = 0;
            state.jumpHeld = false;

            const velocity = this.world.must(player, Velocity);
            velocity.x = 0;
            velocity.y = 0;

            this.effects.sparks(barBox.x, barBox.y, 5, 2.5, 0x6ff0ff);
            return;
        }
    }

    private detach(player: Entity, rider: ReturnType<typeof Rider.create>): void {
        if (rider.carrier >= 0 && this.world.isAlive(rider.carrier)) {
            const rideable = this.world.get(rider.carrier, Rideable);
            if (rideable) rideable.occupied = false;
        }
        this.world.remove(player, Rider);
        const state = this.world.get(player, PlayerState);
        if (state && state.name === 'riding') {
            state.previous = state.name;
            state.name = 'fall';
            state.timer = 0;
        }
    }
}
