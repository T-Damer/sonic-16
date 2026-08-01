import { Lifetime, MeshRef } from '@/game/components';
import { System, type Query } from '@/game/core/ecs';

/** Removes entities whose Lifetime has run out (projectiles, loose rings, debris). */
export class LifetimeSystem extends System {
    private timed!: Query;

    protected init(): void {
        this.timed = this.world.query({ all: [Lifetime] });
    }

    update(dt: number): void {
        for (const entity of this.world.view(this.timed)) {
            const lifetime = this.world.must(entity, Lifetime);
            lifetime.remaining -= dt;
            if (lifetime.remaining > 0) continue;

            const meshRef = this.world.get(entity, MeshRef);
            if (meshRef) meshRef.object.visible = false;
            this.world.destroy(entity);
        }
    }
}
