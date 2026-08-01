import {
    Breakable,
    Collider,
    Health,
    Hurtbox,
    Invulnerable,
    MeshRef,
    PlayerState,
    PlayerTag,
    Projectile,
    Transform,
    Velocity,
} from '@/game/components';
import { DEBUG } from '@/game/config/GameConfig';
import type { CollisionWorld } from '@/game/core/CollisionWorld';
import { System, type Entity, type Query } from '@/game/core/ecs';
import { aabbOverlap, sign, type AABB } from '@/game/core/MathUtils';
import type { Effects } from '@/game/render/fx/Effects';
import type { CombatSystem } from '@/game/systems/CombatSystem';

/**
 * Thrown rings and enemy energy bolts.
 *
 * Rings arc and bounce once off geometry; bolts fly flat and pop on first contact.
 * Damage is routed through CombatSystem so armour and breakable rules stay in one place.
 */
export class ProjectileSystem extends System {
    private projectiles!: Query;
    private targets!: Query;
    private players!: Query;
    private collision!: CollisionWorld;
    private effects!: Effects;

    protected init(): void {
        this.projectiles = this.world.query({ all: [Projectile, Transform, Velocity, Collider] });
        this.targets = this.world.query({ all: [Hurtbox, Transform, Health] });
        this.players = this.world.query({ all: [PlayerTag, Transform, Collider, PlayerState] });
        this.collision = this.world.getResource<CollisionWorld>('collision');
        this.effects = this.world.getResource<Effects>('effects');
    }

    update(): void {
        const combat = this.world.tryResource<CombatSystem>('combatSystem');

        for (const entity of this.world.view(this.projectiles)) {
            const projectile = this.world.must(entity, Projectile);
            const transform = this.world.must(entity, Transform);
            const velocity = this.world.must(entity, Velocity);
            const collider = this.world.must(entity, Collider);

            const box: AABB = { x: transform.x, y: transform.y, hw: collider.hw, hh: collider.hh };

            // ── level geometry
            if (this.collision.overlapsSolid(transform.x, transform.y, collider.hw, collider.hh)) {
                if (projectile.bouncesLeft > 0) {
                    projectile.bouncesLeft--;
                    if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
                        velocity.x *= -0.55;
                        transform.x += sign(velocity.x) * 0.14;
                    } else {
                        velocity.y = Math.abs(velocity.y) * 0.55;
                        transform.y += 0.14;
                    }
                    this.effects.sparks(transform.x, transform.y, 3, 2);
                } else {
                    this.pop(entity, transform.x, transform.y);
                    continue;
                }
            }

            // ── enemy bolts vs. the player
            if (projectile.team === 1 && combat && this.hitPlayer(entity, box, velocity.x, combat)) continue;

            // ── player rings vs. enemies and breakables
            if (projectile.team === 0 && combat && this.hitEnemy(entity, projectile, box, combat)) continue;
        }
    }

    private hitPlayer(entity: Entity, box: AABB, vx: number, combat: CombatSystem): boolean {
        for (const player of this.world.view(this.players)) {
            const invuln = this.world.get(player, Invulnerable);
            if ((invuln && invuln.timer > 0) || DEBUG.invincible) continue;

            const state = this.world.must(player, PlayerState);
            if (state.name === 'dead' || state.name === 'hurt' || state.name === 'cutscene') continue;

            const collider = this.world.must(player, Collider);
            const transform = this.world.must(player, Transform);
            const playerBox: AABB = {
                x: transform.x + collider.ox,
                y: transform.y + collider.oy,
                hw: collider.hw,
                hh: collider.hh,
            };
            if (!aabbOverlap(box, playerBox)) continue;

            combat.hurtPlayer(player, sign(vx) || 1);
            this.pop(entity, box.x, box.y);
            return true;
        }
        return false;
    }

    private hitEnemy(
        entity: Entity,
        projectile: ReturnType<typeof Projectile.create>,
        box: AABB,
        combat: CombatSystem,
    ): boolean {
        for (const target of this.world.view(this.targets)) {
            if (target === projectile.owner) continue;

            const hurtbox = this.world.must(target, Hurtbox);
            if (hurtbox.team === projectile.team) continue;

            const targetTransform = this.world.must(target, Transform);
            const targetBox: AABB = {
                x: targetTransform.x + hurtbox.ox,
                y: targetTransform.y + hurtbox.oy,
                hw: hurtbox.hw,
                hh: hurtbox.hh,
            };
            if (!aabbOverlap(box, targetBox)) continue;

            // A thrown ring is a light attack: it can't shatter heavy geometry…
            const breakable = this.world.get(target, Breakable);
            if (breakable?.requiresHeavy) {
                this.effects.sparks(box.x, box.y, 4, 3, 0xcfe8ff);
                this.pop(entity, box.x, box.y);
                return true;
            }

            // …and it deflects off a SWATbot's chest plate.
            const health = this.world.get(target, Health);
            if (health?.frontArmoured) {
                const fromFront = sign(box.x - targetTransform.x) === targetTransform.facing;
                if (fromFront) {
                    this.effects.sparks(box.x, box.y, 5, 3, 0xcfe8ff);
                    this.pop(entity, box.x, box.y);
                    return true;
                }
            }

            combat.damageTarget(target, projectile.damage, box.x, false);
            this.pop(entity, targetBox.x, targetBox.y);
            return true;
        }
        return false;
    }

    private pop(entity: Entity, x: number, y: number): void {
        this.effects.sparks(x, y, 5, 3);
        const meshRef = this.world.get(entity, MeshRef);
        if (meshRef) meshRef.object.visible = false;
        this.world.destroy(entity);
    }
}
