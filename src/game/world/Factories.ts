import { Group, Mesh, SphereGeometry } from 'three';
import {
    Collider,
    Lifetime,
    Magnetic,
    MeshRef,
    Projectile,
    Ring,
    ScatterRing,
    Transform,
    Velocity,
} from '@/game/components';
import { PLAYER } from '@/game/config/GameConfig';
import type { Entity, World } from '@/game/core/ecs';
import { randRange } from '@/game/core/MathUtils';
import { PALETTE, glow } from '@/game/render/Materials';
import { createRing } from '@/game/render/Meshes';
import type { Renderer3D } from '@/game/render/Renderer3D';

/** Spawn a static collectable ring. */
export function spawnRing(world: World, renderer: Renderer3D, x: number, y: number): Entity {
    const entity = world.create();
    world.add(entity, Transform, { x, y, z: 0 });
    world.add(entity, Ring, { value: 1, spinPhase: randRange(0, Math.PI * 2) });
    world.add(entity, Magnetic, { radius: PLAYER.ringMagnetRadius });

    const object = createRing();
    object.position.set(x, y, 0);
    renderer.world.add(object);
    world.add(entity, MeshRef, {
        object,
        spinY: 3.4,
        baseY: y,
        bobAmplitude: 0.06,
        bobSpeed: 2.2,
        bobPhase: randRange(0, Math.PI * 2),
    });

    return entity;
}

/**
 * A ring knocked loose by damage: physical, bouncy, briefly un-collectable so the
 * player can't instantly vacuum it back up.
 */
export function spawnScatterRing(
    world: World,
    renderer: Renderer3D,
    x: number,
    y: number,
    index: number,
    total: number,
): Entity {
    const entity = world.create();
    world.add(entity, Transform, { x, y, z: 0 });
    world.add(entity, Ring, { value: 1, spinPhase: randRange(0, Math.PI * 2) });
    world.add(entity, ScatterRing, {
        life: 0,
        collectDelay: PLAYER.scatterRecollectDelay,
        bounces: 3,
    });
    world.add(entity, Collider, { hw: 0.16, hh: 0.16, ox: 0, oy: 0 });

    // fan the rings out in the classic alternating arc
    const angle = (Math.PI / (total + 1)) * (index + 1) + randRange(-0.15, 0.15);
    const speed = randRange(4.5, 7.5);
    const side = index % 2 === 0 ? 1 : -1;
    world.add(entity, Velocity, {
        x: Math.cos(angle) * speed * side,
        y: Math.abs(Math.sin(angle)) * speed + 2,
    });

    const object = createRing();
    object.position.set(x, y, 0);
    object.scale.setScalar(0.85);
    renderer.world.add(object);
    world.add(entity, MeshRef, { object, spinY: 8, cullable: false });

    return entity;
}

/** A thrown ring or an enemy energy bolt. */
export function spawnProjectile(
    world: World,
    renderer: Renderer3D,
    opts: {
        x: number;
        y: number;
        vx: number;
        vy: number;
        kind: 'ring' | 'bolt';
        team: 0 | 1;
        owner: Entity;
        damage?: number;
    },
): Entity {
    const entity = world.create();
    world.add(entity, Transform, { x: opts.x, y: opts.y, z: 0 });
    world.add(entity, Velocity, { x: opts.vx, y: opts.vy });
    world.add(entity, Collider, { hw: 0.18, hh: 0.18, ox: 0, oy: 0 });
    world.add(entity, Projectile, {
        kind: opts.kind,
        team: opts.team,
        owner: opts.owner,
        damage: opts.damage ?? 1,
        gravityScale: opts.kind === 'ring' ? PLAYER.throwGravityScale : 0,
        bouncesLeft: opts.kind === 'ring' ? 1 : 0,
    });
    world.add(entity, Lifetime, { remaining: opts.kind === 'ring' ? PLAYER.throwLifetime : 3.0 });

    let object: Group | Mesh;
    if (opts.kind === 'ring') {
        object = createRing();
        object.scale.setScalar(0.8);
    } else {
        object = new Mesh(new SphereGeometry(0.16, 10, 8), glow('bolt', 0xfff2a0, 1));
        object.scale.set(1.9, 0.85, 0.85);
    }
    object.position.set(opts.x, opts.y, 0);
    renderer.world.add(object);
    world.add(entity, MeshRef, {
        object,
        spinY: opts.kind === 'ring' ? 16 : 0,
        spinZ: opts.kind === 'bolt' ? 22 : 0,
        cullable: false,
    });

    return entity;
}

/** Colour used for a breakable's debris. */
export const DEBRIS_COLORS = {
    spikes: PALETTE.spikeGold,
    monitor: 0xc9d2d8,
} as const;
