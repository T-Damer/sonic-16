import {
    AnimState,
    Breakable,
    Collider,
    DamageOnTouch,
    EnemyTag,
    Grounded,
    Health,
    Hitbox,
    Hurtbox,
    Invulnerable,
    MeshRef,
    PlayerState,
    PlayerTag,
    Rideable,
    Rider,
    RingPurse,
    SwatbotAI,
    Transform,
    Velocity,
} from '@/game/components';
import { COMBAT, DEBUG, PHYSICS, PLAYER } from '@/game/config/GameConfig';
import { System, type Entity, type Query } from '@/game/core/ecs';
import { aabbOverlap, clamp, sign, type AABB } from '@/game/core/MathUtils';
import type { EventHub } from '@/game/core/Signal';
import type { Effects } from '@/game/render/fx/Effects';
import type { Renderer3D } from '@/game/render/Renderer3D';
import { DEBRIS_COLORS, spawnScatterRing } from '@/game/world/Factories';

/**
 * Damage resolution.
 *
 * Three interactions, in priority order:
 *   1. attack hitboxes vs. hurtboxes (player attacks, enemy melee)
 *   2. stomping — landing on an enemy from above
 *   3. contact damage — walking into an enemy or a spike
 */
export class CombatSystem extends System {
    private hitboxes!: Query;
    private hurtboxes!: Query;
    private players!: Query;
    private touchers!: Query;

    private effects!: Effects;
    private events!: EventHub;
    private renderer!: Renderer3D;

    protected init(): void {
        this.hitboxes = this.world.query({ all: [Hitbox, Transform] });
        this.hurtboxes = this.world.query({ all: [Hurtbox, Transform, Health] });
        this.players = this.world.query({ all: [PlayerTag, Transform, Collider, PlayerState] });
        this.touchers = this.world.query({ all: [DamageOnTouch, Transform, Collider] });

        this.effects = this.world.getResource<Effects>('effects');
        this.events = this.world.getResource<EventHub>('events');
        this.renderer = this.world.getResource<Renderer3D>('renderer');
    }

    update(dt: number): void {
        this.tickTimers(dt);
        this.resolveHitboxes();
        this.resolveStomps();
        this.resolveContactDamage();
    }

    private tickTimers(dt: number): void {
        for (const [, invuln] of this.world.each(Invulnerable)) {
            if (invuln.timer > 0) {
                invuln.timer = Math.max(0, invuln.timer - dt);
                invuln.blinkPhase += dt * 22;
            }
        }
        for (const [, health] of this.world.each(Health)) {
            if (health.hitFlash > 0) health.hitFlash = Math.max(0, health.hitFlash - dt);
        }
    }

    private boxOf(entity: Entity, box: { hw: number; hh: number; ox: number; oy: number }): AABB {
        const transform = this.world.must(entity, Transform);
        return {
            x: transform.x + box.ox,
            y: transform.y + box.oy,
            hw: box.hw,
            hh: box.hh,
        };
    }

    // ───────────────────────────────────────────────────────────── attack boxes

    private resolveHitboxes(): void {
        for (const attacker of this.world.view(this.hitboxes)) {
            const hitbox = this.world.must(attacker, Hitbox);
            if (!hitbox.active) continue;

            const attackerTransform = this.world.must(attacker, Transform);
            const attackBox = this.boxOf(attacker, hitbox);

            for (const target of this.world.view(this.hurtboxes)) {
                if (target === attacker) continue;

                const hurtbox = this.world.must(target, Hurtbox);
                if (hurtbox.team === hitbox.team) continue;
                if (hitbox.hitList.includes(target)) continue;

                const targetBox = this.boxOf(target, hurtbox);
                if (!aabbOverlap(attackBox, targetBox)) continue;

                // ── breakables may require a heavy attack (buzzsaw / spike blast)
                const breakable = this.world.get(target, Breakable);
                if (breakable?.requiresHeavy && !hitbox.heavy) continue;

                // ── SWATbot chest armour deflects frontal ring throws
                const health = this.world.must(target, Health);
                if (health.frontArmoured && !hitbox.heavy) {
                    const targetTransform = this.world.must(target, Transform);
                    const fromFront = sign(attackerTransform.x - targetTransform.x) === targetTransform.facing;
                    if (fromFront) {
                        hitbox.hitList.push(target);
                        this.effects.sparks(targetBox.x, targetBox.y, 5, 3, 0xcfe8ff);
                        this.renderer.camera.addShake(0.12);
                        continue;
                    }
                }

                hitbox.hitList.push(target);
                this.applyDamage(target, hitbox.damage, attackerTransform.x, hitbox.heavy);

                if (hitbox.once) {
                    hitbox.active = false;
                    break;
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────── stomps

    /** Landing on an enemy's head bounces the player and destroys it. */
    private resolveStomps(): void {
        for (const player of this.world.view(this.players)) {
            if (this.world.has(player, Rider)) continue;

            const state = this.world.must(player, PlayerState);
            if (state.name !== 'jump' && state.name !== 'fall') continue;

            const velocity = this.world.get(player, Velocity);
            if (!velocity || velocity.y > -0.5) continue;

            const transform = this.world.must(player, Transform);
            const collider = this.world.must(player, Collider);
            const feetBox: AABB = {
                x: transform.x + collider.ox,
                y: transform.y + 0.12,
                hw: collider.hw * 0.9,
                hh: 0.18,
            };

            for (const target of this.world.view(this.hurtboxes)) {
                if (!this.world.has(target, EnemyTag) && !this.world.has(target, Breakable)) continue;

                const hurtbox = this.world.must(target, Hurtbox);
                if (hurtbox.team === 0) continue;

                const targetTransform = this.world.must(target, Transform);
                const targetBox = this.boxOf(target, hurtbox);

                // must come down onto the upper half of the target
                if (transform.y < targetBox.y) continue;
                if (!aabbOverlap(feetBox, targetBox)) continue;

                // Spikes are never stompable — that's what makes them a wall.
                const breakable = this.world.get(target, Breakable);
                if (breakable?.requiresHeavy) continue;

                this.applyDamage(target, 1, targetTransform.x, false);
                velocity.y = COMBAT.stompBounce;
                state.previous = state.name;
                state.name = 'jump';
                state.timer = 0;
                state.jumpHeld = true;
                this.renderer.camera.addShake(0.2);
                break;
            }
        }
    }

    // ──────────────────────────────────────────────────────────── contact damage

    private resolveContactDamage(): void {
        for (const player of this.world.view(this.players)) {
            const invuln = this.world.get(player, Invulnerable);
            if (invuln && invuln.timer > 0) continue;
            if (DEBUG.invincible) continue;

            const state = this.world.must(player, PlayerState);
            if (state.name === 'dead' || state.name === 'hurt' || state.name === 'cutscene') continue;
            // While attacking, the player wins contested overlaps.
            if (state.name === 'buzzsaw' || state.name === 'spikeBlast') continue;

            const transform = this.world.must(player, Transform);
            const collider = this.world.must(player, Collider);
            const playerBox = this.boxOf(player, collider);

            for (const source of this.world.view(this.touchers)) {
                const health = this.world.get(source, Health);
                if (health && health.hp <= 0) continue;

                const sourceCollider = this.world.must(source, Collider);
                const sourceBox = this.boxOf(source, sourceCollider);
                if (!aabbOverlap(playerBox, sourceBox)) continue;

                const touch = this.world.must(source, DamageOnTouch);
                const dir = touch.pushDir !== 0
                    ? touch.pushDir
                    : sign(transform.x - sourceBox.x) || -transform.facing;

                this.hurtPlayer(player, dir);
                break;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────── damage

    /**
     * Public entry point for other systems (projectiles, scripted events) so every
     * damage source runs through the same armour and destruction rules.
     */
    damageTarget(target: Entity, amount: number, fromX: number, heavy = false): void {
        this.applyDamage(target, amount, fromX, heavy);
    }

    /** Damage a non-player target: enemies, monitors, spike columns. */
    private applyDamage(target: Entity, amount: number, fromX: number, heavy: boolean): void {
        const health = this.world.get(target, Health);
        if (!health || health.hp <= 0) return;

        health.hp -= amount;
        health.hitFlash = 0.12;

        const transform = this.world.must(target, Transform);

        // A heavy blast stuns surviving SWATbots rather than killing them.
        if (health.hp > 0) {
            if (heavy && this.world.has(target, SwatbotAI)) {
                const ai = this.world.must(target, SwatbotAI);
                ai.state = 'stunned';
                ai.timer = 0;
            }
            this.effects.sparks(transform.x, transform.y + 0.5, 6, 3.5, 0xffd8a0);
            this.renderer.camera.addShake(0.15);
            return;
        }

        this.destroy(target, transform.x, transform.y, fromX);
    }

    private destroy(target: Entity, x: number, y: number, fromX: number): void {
        const breakable = this.world.get(target, Breakable);
        const enemy = this.world.get(target, EnemyTag);

        if (breakable) {
            this.effects.debris(x, y + 0.4, DEBRIS_COLORS[breakable.kind], breakable.kind === 'spikes' ? 12 : 9);
            this.effects.sparks(x, y + 0.5, 8, 4);

            if (breakable.kind === 'monitor') {
                const reward = breakable.reward || 10;
                this.grantRings(reward, x, y);
                this.events.emit('monitorBroken', { x, y });
            } else {
                this.events.emit('spikesBroken', { x, y });
            }
        } else if (enemy) {
            this.effects.sparks(x, y + 0.3, 14, 6, 0xffe08a);
            this.effects.debris(x, y + 0.3, 0x9aa2ab, 8);
            this.events.emit('enemyDestroyed', { entity: target, kind: enemy.kind, x, y });

            // a destroyed skiff drops its rider
            const rider = this.findRiderOf(target);
            if (rider >= 0) this.world.remove(rider, Rider);
        }

        void fromX;
        this.renderer.camera.addShake(0.35);

        // hide immediately; the entity is culled at the end of the frame
        const meshRef = this.world.get(target, MeshRef);
        if (meshRef) meshRef.object.visible = false;
        this.world.destroy(target);
    }

    private findRiderOf(carrier: Entity): Entity {
        for (const [entity, rider] of this.world.each(Rider)) {
            if (rider.carrier === carrier) return entity;
        }
        return -1;
    }

    private grantRings(amount: number, x: number, y: number): void {
        for (const player of this.world.view(this.players)) {
            const purse = this.world.get(player, RingPurse);
            if (!purse) continue;
            purse.rings += amount;
            this.events.emit('ringsChanged', { rings: purse.rings, delta: amount });
        }
        this.effects.sparks(x, y + 0.7, 10, 4, 0xffd23f);
    }

    // ────────────────────────────────────────────────────────────── player hurt

    /** The player takes a hit: scatter a portion of the rings, or die at zero. */
    hurtPlayer(player: Entity, pushDir: number): void {
        const state = this.world.must(player, PlayerState);
        const purse = this.world.get(player, RingPurse);
        const transform = this.world.must(player, Transform);
        const velocity = this.world.get(player, Velocity);
        const invuln = this.world.get(player, Invulnerable);

        const rings = purse?.rings ?? 0;

        if (rings <= 0) {
            this.killPlayer(player);
            return;
        }

        // lose a portion, scattered as re-collectable rings
        const lost = clamp(
            Math.round(rings * PLAYER.ringLossFraction),
            Math.min(PLAYER.ringLossMin, rings),
            PLAYER.ringLossMax,
        );
        purse!.rings = Math.max(0, rings - lost);

        const scatterCount = Math.min(lost, 16);
        for (let i = 0; i < scatterCount; i++) {
            spawnScatterRing(this.world, this.renderer, transform.x, transform.y + 0.5, i, scatterCount);
        }

        state.previous = state.name;
        state.name = 'hurt';
        state.timer = 0;
        state.controlLock = PHYSICS.hurtControlLock;
        state.buzzsawCharge = 0;

        if (velocity) {
            velocity.x = pushDir * PHYSICS.hurtKnockbackX;
            velocity.y = PHYSICS.hurtKnockbackY;
        }

        // drop any ride, freeing the grab bar
        if (this.world.has(player, Rider)) {
            const rider = this.world.must(player, Rider);
            const rideable = this.world.get(rider.carrier, Rideable);
            if (rideable) rideable.occupied = false;
            this.world.remove(player, Rider);
        }
        this.world.remove(player, Hitbox);

        if (invuln) invuln.timer = PHYSICS.invulnDuration;

        const grounded = this.world.get(player, Grounded);
        if (grounded) grounded.onGround = false;

        const anim = this.world.get(player, AnimState);
        if (anim) anim.overlay = null;

        this.effects.ringBurst(transform.x, transform.y, Math.min(10, lost));
        this.renderer.camera.addShake(0.5);
        this.events.emit('playerHurt', { rings: purse!.rings });
        this.events.emit('ringsChanged', { rings: purse!.rings, delta: -lost });
    }

    killPlayer(player: Entity): void {
        const state = this.world.must(player, PlayerState);
        if (state.name === 'dead') return;

        const transform = this.world.must(player, Transform);
        const velocity = this.world.get(player, Velocity);

        state.previous = state.name;
        state.name = 'dead';
        state.timer = 0;
        state.locked = true;

        if (velocity) {
            velocity.x = 0;
            velocity.y = PHYSICS.jumpSpeed * 0.8;
        }

        this.world.remove(player, Hitbox);
        this.world.remove(player, Rider);

        this.effects.sparks(transform.x, transform.y + 0.5, 14, 5, 0xff9a6a);
        this.renderer.camera.addShake(0.8);
        this.events.emit('playerDied', {});
    }
}
