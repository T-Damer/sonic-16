import { Group, Mesh, Object3D, Sprite, SpriteMaterial } from 'three';
import { randRange, randSign } from '@/game/core/MathUtils';
import { PALETTE, sparkMaterial } from '@/game/render/Materials';
import { createDebris, createShockwave } from '@/game/render/Meshes';

interface Particle {
    object: Object3D;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
    gravity: number;
    spin: number;
    /** Scale growth per second (shockwaves). */
    grow: number;
    fade: boolean;
}

/**
 * Pooled cosmetic particles. Purely visual — nothing here feeds back into gameplay,
 * so it lives outside the ECS and updates on the render clock.
 */
export class Effects {
    private readonly active: Particle[] = [];
    private readonly sparkPool: Sprite[] = [];
    private readonly debrisPool = new Map<number, Mesh[]>();
    private readonly shockPool: Mesh[] = [];

    constructor(private readonly root: Group) {}

    // ────────────────────────────────────────────────────────────── acquire/release

    private acquireSpark(): Sprite {
        const pooled = this.sparkPool.pop();
        if (pooled) return pooled;
        const mat = (sparkMaterial() as any).clone() as SpriteMaterial;
        return new Sprite(mat);
    }

    private acquireDebris(color: number): Mesh {
        const pool = this.debrisPool.get(color);
        const pooled = pool?.pop();
        if (pooled) return pooled;
        return createDebris(color, 0.14);
    }

    private acquireShock(): Mesh {
        return this.shockPool.pop() ?? createShockwave();
    }

    private release(p: Particle): void {
        p.object.removeFromParent();
        if ((p.object as Sprite).isSprite) {
            this.sparkPool.push(p.object as Sprite);
        } else if (p.object.userData.debrisColor !== undefined) {
            const color = p.object.userData.debrisColor as number;
            const pool = this.debrisPool.get(color) ?? [];
            pool.push(p.object as Mesh);
            this.debrisPool.set(color, pool);
        } else if (p.object.userData.shockwave) {
            this.shockPool.push(p.object as Mesh);
        }
    }

    // ───────────────────────────────────────────────────────────────────── emitters

    /** Bright sparks — hits, ring collection, thruster pops. */
    sparks(x: number, y: number, count = 8, spread = 4, color: number = PALETTE.ringGoldLight): void {
        for (let i = 0; i < count; i++) {
            const sprite = this.acquireSpark();
            (sprite.material as SpriteMaterial).color.setHex(color);
            (sprite.material as SpriteMaterial).opacity = 1;
            const scale = randRange(0.14, 0.3);
            sprite.scale.set(scale, scale, 1);
            sprite.position.set(x, y, randRange(-0.3, 0.5));
            this.root.add(sprite);

            const angle = randRange(0, Math.PI * 2);
            const speed = randRange(1, spread);
            this.active.push({
                object: sprite,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed + 1.5,
                vz: randRange(-0.6, 0.6),
                life: 0,
                maxLife: randRange(0.28, 0.6),
                gravity: 9,
                spin: 0,
                grow: -0.25,
                fade: true,
            });
        }
    }

    /** Chunky debris — spike columns and monitors shattering. */
    debris(x: number, y: number, color: number, count = 10): void {
        for (let i = 0; i < count; i++) {
            const chunk = this.acquireDebris(color);
            chunk.userData.debrisColor = color;
            const scale = randRange(0.6, 1.5);
            chunk.scale.setScalar(scale);
            chunk.position.set(x + randRange(-0.3, 0.3), y + randRange(-0.2, 0.8), randRange(-0.4, 0.4));
            chunk.rotation.set(randRange(0, 3), randRange(0, 3), randRange(0, 3));
            this.root.add(chunk);

            this.active.push({
                object: chunk,
                vx: randRange(1.5, 5.5) * randSign(),
                vy: randRange(2.5, 7),
                vz: randRange(-1, 1),
                life: 0,
                maxLife: randRange(0.8, 1.4),
                gravity: 18,
                spin: randRange(4, 14) * randSign(),
                grow: 0,
                fade: false,
            });
        }
    }

    /** Ground-level expanding ring — the spike blast shockwave. */
    shockwave(x: number, y: number, maxRadius: number): void {
        const ring = this.acquireShock();
        ring.userData.shockwave = true;
        ring.position.set(x, y + 0.06, 0);
        ring.scale.setScalar(0.6);
        (ring.material as any).opacity = 0.9;
        this.root.add(ring);

        this.active.push({
            object: ring,
            vx: 0,
            vy: 0,
            vz: 0,
            life: 0,
            maxLife: 0.45,
            gravity: 0,
            spin: 0,
            grow: maxRadius * 3.2,
            fade: true,
        });
    }

    /** Puff of dust on landing / skidding. */
    dust(x: number, y: number, dir: number, count = 5): void {
        for (let i = 0; i < count; i++) {
            const sprite = this.acquireSpark();
            (sprite.material as SpriteMaterial).color.setHex(0xd9c48a);
            (sprite.material as SpriteMaterial).opacity = 0.75;
            const scale = randRange(0.18, 0.36);
            sprite.scale.set(scale, scale, 1);
            sprite.position.set(x - dir * 0.2, y + 0.08, randRange(-0.2, 0.4));
            this.root.add(sprite);

            this.active.push({
                object: sprite,
                vx: -dir * randRange(0.6, 2.4),
                vy: randRange(0.4, 1.8),
                vz: randRange(-0.4, 0.4),
                life: 0,
                maxLife: randRange(0.25, 0.5),
                gravity: 2.5,
                spin: 0,
                grow: 0.9,
                fade: true,
            });
        }
    }

    /** Ring-loss burst when the player is hit. */
    ringBurst(x: number, y: number, count = 10): void {
        this.sparks(x, y + 0.4, count, 6, PALETTE.ringGold);
    }

    update(dt: number): void {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const p = this.active[i];
            p.life += dt;
            if (p.life >= p.maxLife) {
                this.release(p);
                this.active.splice(i, 1);
                continue;
            }

            p.vy -= p.gravity * dt;
            p.object.position.x += p.vx * dt;
            p.object.position.y += p.vy * dt;
            p.object.position.z += p.vz * dt;

            if (p.spin !== 0) {
                p.object.rotation.x += p.spin * dt;
                p.object.rotation.y += p.spin * 0.7 * dt;
            }

            if (p.grow !== 0) {
                const s = Math.max(0.01, p.object.scale.x + p.grow * dt);
                if ((p.object as Sprite).isSprite) p.object.scale.set(s, s, 1);
                else p.object.scale.setScalar(s);
            }

            if (p.fade) {
                const mat = (p.object as any).material;
                if (mat) {
                    mat.transparent = true;
                    mat.opacity = 1 - p.life / p.maxLife;
                }
            }
        }
    }

    clear(): void {
        for (const p of this.active) this.release(p);
        this.active.length = 0;
    }
}
