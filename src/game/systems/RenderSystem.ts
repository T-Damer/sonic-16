import type { Mesh, Object3D } from 'three';
import {
    Animated,
    BlobShadow,
    Collider,
    Health,
    Invulnerable,
    MeshRef,
    PlayerState,
    Transform,
} from '@/game/components';
import type { CollisionWorld } from '@/game/core/CollisionWorld';
import { System, type Entity, type Query } from '@/game/core/ecs';
import { clamp } from '@/game/core/MathUtils';
import type { Effects } from '@/game/render/fx/Effects';
import type { Renderer3D } from '@/game/render/Renderer3D';

/**
 * Pushes ECS state into the three.js scene graph.
 *
 * This is the only system (besides the camera) allowed to touch three.js — everything
 * upstream works purely in numbers.
 */
export class RenderSystem extends System {
    private renderables!: Query;
    private animated!: Query;
    private shadows!: Query;
    private renderer!: Renderer3D;
    private effects!: Effects;
    private collision!: CollisionWorld;

    private elapsed = 0;

    protected init(): void {
        this.renderables = this.world.query({ all: [MeshRef, Transform] });
        this.animated = this.world.query({ all: [Animated, MeshRef] });
        this.shadows = this.world.query({ all: [BlobShadow, Transform] });
        this.renderer = this.world.getResource<Renderer3D>('renderer');
        this.effects = this.world.getResource<Effects>('effects');
        this.collision = this.world.getResource<CollisionWorld>('collision');
    }

    update(dt: number): void {
        this.elapsed += dt;

        this.syncTransforms(dt);
        this.spinProps(dt);
        this.updateBlobShadows();
        this.effects.update(dt);
    }

    // ───────────────────────────────────────────────────────── transforms

    private syncTransforms(dt: number): void {
        const camera = this.renderer.camera;

        for (const entity of this.world.view(this.renderables)) {
            const meshRef = this.world.must(entity, MeshRef);
            const transform = this.world.must(entity, Transform);
            const object = meshRef.object;
            if (!object) continue;

            // ── frustum culling on the X/Y plane, widened by the prop's own size
            if (meshRef.cullable) {
                const visible = camera.isVisible(transform.x, transform.y, meshRef.cullRadius + 4);
                if (object.visible !== visible) object.visible = visible;
                if (!visible) continue;
            }

            // ── position (with optional idle bob for rings and hovering props)
            let y = transform.y;
            if (meshRef.bobAmplitude !== 0) {
                meshRef.bobPhase += dt * meshRef.bobSpeed;
                y += Math.sin(meshRef.bobPhase) * meshRef.bobAmplitude;
            }
            object.position.set(transform.x, y, transform.z);

            // ── continuous spin (rings, projectiles, saw blades)
            if (meshRef.spinX !== 0) object.rotation.x += meshRef.spinX * dt;
            if (meshRef.spinY !== 0) object.rotation.y += meshRef.spinY * dt;
            if (meshRef.spinZ !== 0) object.rotation.z += meshRef.spinZ * dt;

            if (transform.scale !== 1) object.scale.setScalar(transform.scale);

            this.applyDamageFlash(entity, object);
            this.applyInvulnerabilityBlink(entity, object);
        }
    }

    /** White flash on anything that just took a hit. */
    private applyDamageFlash(entity: Entity, object: Object3D): void {
        const health = this.world.get(entity, Health);
        if (!health) return;

        const flashing = health.hitFlash > 0;
        if (!flashing && !object.userData.wasFlashing) return;

        object.userData.wasFlashing = flashing;
        object.traverse((child) => {
            const material = (child as Mesh).material as any;
            if (!material?.emissive) return;
            if (flashing) {
                if (child.userData.baseEmissive === undefined) {
                    child.userData.baseEmissive = material.emissive.getHex();
                }
                material.emissive.setHex(0xffffff);
            } else if (child.userData.baseEmissive !== undefined) {
                material.emissive.setHex(child.userData.baseEmissive);
            }
        });
    }

    /** Blink the player while invulnerable, exactly like the 16-bit originals. */
    private applyInvulnerabilityBlink(entity: Entity, object: Object3D): void {
        const invuln = this.world.get(entity, Invulnerable);
        if (!invuln) return;

        if (invuln.timer <= 0) {
            if (!object.visible) object.visible = true;
            return;
        }

        const state = this.world.get(entity, PlayerState);
        if (state?.name === 'dead') return;

        object.visible = Math.sin(invuln.blinkPhase) > -0.2;
    }

    // ───────────────────────────────────────────────────── prop animation

    /** The background coolers. Different speeds per unit so they never sync up. */
    private spinProps(dt: number): void {
        for (const entity of this.world.view(this.animated)) {
            const animated = this.world.must(entity, Animated);
            const meshRef = this.world.must(entity, MeshRef);
            if (!meshRef.object.visible) continue;

            animated.phase += dt * animated.speed;

            const rotor = meshRef.object.getObjectByName('rotor');
            if (rotor) rotor.rotation.z = animated.phase * 5.5;
        }
    }

    // ──────────────────────────────────────────────────────── blob shadows

    /**
     * A soft decal projected onto the ground under each actor. Cheap, and it makes
     * airborne positions readable in a locked-angle view where the real shadow can
     * fall out of frame.
     */
    private updateBlobShadows(): void {
        const camera = this.renderer.camera;

        for (const entity of this.world.view(this.shadows)) {
            const blob = this.world.must(entity, BlobShadow);
            const transform = this.world.must(entity, Transform);
            const object = blob.object;
            if (!object) continue;

            if (!camera.isVisible(transform.x, transform.y, 10)) {
                object.visible = false;
                continue;
            }

            const collider = this.world.get(entity, Collider);
            const halfWidth = collider?.hw ?? 0.3;
            const ground = this.collision.groundBelow(
                transform.x, transform.y + 0.1, halfWidth * 0.6, blob.maxDrop,
            );

            if (!ground) {
                object.visible = false;
                continue;
            }

            const drop = clamp(transform.y - ground.top, 0, blob.maxDrop);
            const fade = 1 - drop / blob.maxDrop;

            object.visible = true;
            object.position.set(transform.x, ground.top + 0.02, transform.z);
            // shrink and fade with height
            const scale = blob.radius * (0.55 + 0.45 * fade);
            object.scale.setScalar(scale / blob.radius);
            const material = (object as Mesh).material as any;
            if (material) material.opacity = 0.72 * fade * fade;
        }
    }
}
