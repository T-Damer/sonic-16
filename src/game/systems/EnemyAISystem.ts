import type { Object3D } from 'three';
import {
    AnimState,
    Collider,
    EnemyTag,
    Grounded,
    Health,
    MeshRef,
    PatrolPath,
    PlayerTag,
    Rideable,
    SkiffAI,
    SpyphidAI,
    SwatbotAI,
    Transform,
    Velocity,
} from '@/game/components';
import { COMBAT, PHYSICS } from '@/game/config/GameConfig';
import type { CollisionWorld } from '@/game/core/CollisionWorld';
import { System, type Entity, type Query } from '@/game/core/ecs';
import { approach, clamp, damp } from '@/game/core/MathUtils';
import type { Effects } from '@/game/render/fx/Effects';
import type { SkiffVisual, SpyphidVisual, SwatbotVisual } from '@/game/render/rig/EnemyRigs';
import type { Renderer3D } from '@/game/render/Renderer3D';
import { spawnProjectile } from '@/game/world/Factories';

/**
 * All three enemy brains.
 *
 * Each writes Velocity (or, for patrollers, follows a path) and drives its own visual
 * sub-parts — lens colour, charge orbs, hull banking — so the render system stays dumb.
 */
export class EnemyAISystem extends System {
    private enemies!: Query;
    private playersQuery!: Query;
    private collision!: CollisionWorld;
    private effects!: Effects;
    private renderer!: Renderer3D;

    protected init(): void {
        this.enemies = this.world.query({ all: [EnemyTag, Transform, Velocity] });
        this.playersQuery = this.world.query({ all: [PlayerTag, Transform] });
        this.collision = this.world.getResource<CollisionWorld>('collision');
        this.effects = this.world.getResource<Effects>('effects');
        this.renderer = this.world.getResource<Renderer3D>('renderer');
    }

    private playerPosition(): { x: number; y: number; entity: Entity } | null {
        for (const entity of this.world.view(this.playersQuery)) {
            const transform = this.world.must(entity, Transform);
            return { x: transform.x, y: transform.y, entity };
        }
        return null;
    }

    update(dt: number): void {
        const player = this.playerPosition();

        for (const entity of this.world.view(this.enemies)) {
            const tag = this.world.must(entity, EnemyTag);
            switch (tag.kind) {
                case 'spyphid':
                    this.updateSpyphid(entity, player, dt);
                    break;
                case 'skiff':
                    this.updateSkiff(entity, dt);
                    break;
                case 'swatbot':
                    this.updateSwatbot(entity, player, dt);
                    break;
            }
        }
    }

    // ══════════════════════════════════════════════════════════════ SPYPHID

    /**
     * Hovers on a sine, sweeping a scan cone. When the player enters the cone it
     * flashes its lens (the tell), then dives at where they were and retreats.
     */
    private updateSpyphid(entity: Entity, player: { x: number; y: number } | null, dt: number): void {
        const ai = this.world.get(entity, SpyphidAI);
        const transform = this.world.get(entity, Transform);
        const velocity = this.world.get(entity, Velocity);
        const meshRef = this.world.get(entity, MeshRef);
        if (!ai || !transform || !velocity) return;

        ai.timer += dt;
        ai.bobPhase += dt * 2.4;

        const visual = meshRef?.object.userData.spyphid as SpyphidVisual | undefined;

        switch (ai.state) {
            case 'hover': {
                // drift back toward the patrol anchor, bobbing
                const targetY = ai.homeY + Math.sin(ai.bobPhase) * COMBAT.spyphidHoverAmplitude;
                velocity.x = damp(velocity.x, (ai.homeX - transform.x) * 1.6, 4, dt);
                velocity.y = damp(velocity.y, (targetY - transform.y) * 4.5, 8, dt);

                // sweep the scan cone
                ai.scanAngle += ai.scanDir * dt * 0.9;
                if (Math.abs(ai.scanAngle) > 0.6) ai.scanDir *= -1;

                if (player && this.spyphidSeesPlayer(transform, ai, player)) {
                    ai.state = 'alert';
                    ai.timer = 0;
                    ai.targetX = player.x;
                    ai.targetY = player.y + 0.5;
                }
                break;
            }

            case 'alert': {
                velocity.x = damp(velocity.x, 0, 10, dt);
                velocity.y = damp(velocity.y, 0.6, 6, dt);

                // lens strobes red as the tell
                if (visual) {
                    const flash = Math.sin(ai.timer * 40) > 0;
                    (visual.lens.material as any).color.setHex(flash ? 0xff3b30 : 0xff8a80);
                }

                if (ai.timer >= COMBAT.spyphidTellTime) {
                    ai.state = 'dive';
                    ai.timer = 0;
                    const dx = ai.targetX - transform.x;
                    const dy = ai.targetY - transform.y;
                    const len = Math.hypot(dx, dy) || 1;
                    velocity.x = (dx / len) * COMBAT.spyphidDiveSpeed;
                    velocity.y = (dy / len) * COMBAT.spyphidDiveSpeed;
                    this.effects.sparks(transform.x, transform.y - 0.3, 4, 3, 0x8ff2ff);
                }
                break;
            }

            case 'dive': {
                // tentacles curl in during the dive
                if (visual) visual.tentacles.rotation.x = Math.min(0.7, visual.tentacles.rotation.x + dt * 3);

                if (ai.timer >= 0.55 || this.collision.overlapsSolid(transform.x, transform.y, 0.3, 0.3, true)) {
                    ai.state = 'recover';
                    ai.timer = 0;
                }
                break;
            }

            case 'recover': {
                velocity.x = damp(velocity.x, (ai.homeX - transform.x) * 2.2, 5, dt);
                velocity.y = damp(velocity.y, (ai.homeY - transform.y) * 2.8, 5, dt);
                if (visual) visual.tentacles.rotation.x = damp(visual.tentacles.rotation.x, 0, 5, dt);

                if (ai.timer >= 1.1) {
                    ai.state = 'hover';
                    ai.timer = 0;
                    if (visual) (visual.lens.material as any).color.setHex(0x2ee0ff);
                }
                break;
            }
        }

        // face the direction of travel, and aim the scan cone
        if (Math.abs(velocity.x) > 0.15) transform.facing = velocity.x > 0 ? 1 : -1;
        if (visual) {
            visual.group.rotation.y = transform.facing > 0 ? 0 : Math.PI;
            visual.scanCone.visible = ai.state === 'hover';
            visual.scanCone.rotation.z = ai.scanAngle;
        }
    }

    private spyphidSeesPlayer(
        transform: ReturnType<typeof Transform.create>,
        ai: ReturnType<typeof SpyphidAI.create>,
        player: { x: number; y: number },
    ): boolean {
        const dx = player.x - transform.x;
        const dy = player.y + 0.5 - transform.y;
        const distance = Math.hypot(dx, dy);
        if (distance > COMBAT.spyphidSightRange) return false;

        // the cone points along facing, biased downward, and sweeps with scanAngle
        const coneDir = Math.atan2(-1, transform.facing * 0.35) + ai.scanAngle;
        const toPlayer = Math.atan2(dy, dx);
        let delta = toPlayer - coneDir;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        return Math.abs(delta) < 0.85;
    }

    // ══════════════════════════════════════════════════════════════════ SKIFF

    /** Follows its patrol path, banking into the turns. Carries a rider if one grabs on. */
    private updateSkiff(entity: Entity, dt: number): void {
        const ai = this.world.get(entity, SkiffAI);
        const transform = this.world.get(entity, Transform);
        const velocity = this.world.get(entity, Velocity);
        const meshRef = this.world.get(entity, MeshRef);
        if (!ai || !transform || !velocity) return;

        ai.grabCooldown = Math.max(0, ai.grabCooldown - dt);
        this.followPath(entity, transform, velocity, dt);

        const visual = meshRef?.object.userData.skiff as SkiffVisual | undefined;
        if (visual) {
            // bank into vertical motion and yaw to face travel
            ai.tilt = damp(ai.tilt, clamp(velocity.y * 0.12, -0.35, 0.35), 5, dt);
            visual.hull.rotation.z = ai.tilt;
            visual.group.rotation.y = velocity.x >= 0 ? 0 : Math.PI;

            const glow = visual.thrusterGlow.material as any;
            glow.opacity = 0.35 + Math.abs(Math.sin(performance.now() * 0.006)) * 0.25;
        }

        if (Math.abs(velocity.x) > 0.1) transform.facing = velocity.x > 0 ? 1 : -1;
    }

    // ═══════════════════════════════════════════════════════════════ SWATBOT

    /**
     * Patrols, spots the player in front of it, then plants and charges its cannon.
     * The three charge orbs travelling up the barrel are the player's cue to move.
     */
    private updateSwatbot(entity: Entity, player: { x: number; y: number } | null, dt: number): void {
        const ai = this.world.get(entity, SwatbotAI);
        const transform = this.world.get(entity, Transform);
        const velocity = this.world.get(entity, Velocity);
        const meshRef = this.world.get(entity, MeshRef);
        const anim = this.world.get(entity, AnimState);
        if (!ai || !transform || !velocity) return;

        ai.timer += dt;
        ai.cooldown = Math.max(0, ai.cooldown - dt);

        const visual = meshRef?.object.userData.swatbot as SwatbotVisual | undefined;

        const distance = player ? player.x - transform.x : Infinity;
        const inFront = player ? Math.sign(distance) === transform.facing : false;
        const inRange = player
            ? Math.abs(distance) < COMBAT.swatbotSightRange && Math.abs(player.y - transform.y) < 2.6
            : false;

        switch (ai.state) {
            case 'patrol': {
                this.followPath(entity, transform, velocity, dt);
                if (anim) anim.clip = 'swatPatrol';
                if (visual) this.setChargeOrbs(visual, 0);

                if (player && inRange && inFront && ai.cooldown <= 0) {
                    ai.state = 'spot';
                    ai.timer = 0;
                    velocity.x = 0;
                }
                break;
            }

            case 'spot': {
                velocity.x = approach(velocity.x, 0, PHYSICS.friction * dt);
                if (anim) anim.clip = 'swatAim';
                if (ai.timer >= 0.25) {
                    ai.state = 'charge';
                    ai.timer = 0;
                    ai.chargeOrbs = 0;
                }
                break;
            }

            case 'charge': {
                velocity.x = 0;
                if (anim) anim.clip = 'swatAim';

                const progress = ai.timer / COMBAT.swatbotChargeTime;
                const orbs = Math.min(3, Math.floor(progress * 3) + 1);
                if (visual) this.setChargeOrbs(visual, orbs);

                if (ai.timer >= COMBAT.swatbotChargeTime) {
                    ai.state = 'fire';
                    ai.timer = 0;
                }
                break;
            }

            case 'fire': {
                if (visual) this.setChargeOrbs(visual, 0);
                this.fireBolt(entity, transform);
                ai.state = 'patrol';
                ai.cooldown = COMBAT.swatbotFireCooldown;
                ai.timer = 0;
                break;
            }

            case 'stunned': {
                velocity.x = approach(velocity.x, 0, PHYSICS.friction * 2 * dt);
                if (anim) anim.clip = 'swatStunned';
                if (visual) this.setChargeOrbs(visual, 0);
                if (ai.timer >= COMBAT.swatbotStunDuration) {
                    ai.state = 'patrol';
                    ai.timer = 0;
                    ai.cooldown = 0.5;
                }
                break;
            }
        }

        if (meshRef) meshRef.object.rotation.y = transform.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    private setChargeOrbs(visual: SwatbotVisual, count: number): void {
        for (let i = 0; i < visual.chargeOrbs.length; i++) {
            visual.chargeOrbs[i].visible = i < count;
        }
    }

    private fireBolt(entity: Entity, transform: ReturnType<typeof Transform.create>): void {
        const y = transform.y + 0.72;
        const x = transform.x + transform.facing * 0.55;
        spawnProjectile(this.world, this.renderer, {
            x,
            y,
            vx: transform.facing * COMBAT.swatbotBoltSpeed,
            vy: 0,
            kind: 'bolt',
            team: 1,
            owner: entity,
        });
        this.effects.sparks(x, y, 5, 3, 0xfff2a0);
    }

    /** Stun a SWATbot — called by CombatSystem when a spike blast lands nearby. */
    stun(entity: Entity): void {
        const ai = this.world.get(entity, SwatbotAI);
        if (!ai || ai.state === 'stunned') return;
        ai.state = 'stunned';
        ai.timer = 0;
    }

    // ═══════════════════════════════════════════════════════════ shared: paths

    /** Move an entity along its PatrolPath, ping-ponging or looping at the ends. */
    private followPath(
        entity: Entity,
        transform: ReturnType<typeof Transform.create>,
        velocity: ReturnType<typeof Velocity.create>,
        dt: number,
    ): void {
        const path = this.world.get(entity, PatrolPath);
        if (!path || path.points.length < 2) {
            velocity.x = 0;
            return;
        }

        if (path.waitTimer > 0) {
            path.waitTimer -= dt;
            velocity.x = approach(velocity.x, 0, PHYSICS.friction * dt);
            // flyers ease to a stop; ground units keep their gravity-driven Y
            if (!this.world.has(entity, Grounded)) velocity.y = approach(velocity.y, 0, 6 * dt);
            return;
        }

        const target = path.points[path.index];
        const dx = target.x - transform.x;
        const dy = target.y - transform.y;
        const isGroundUnit = this.world.has(entity, Grounded);
        const distance = isGroundUnit ? Math.abs(dx) : Math.hypot(dx, dy);

        if (distance < 0.15) {
            // arrived — pick the next waypoint
            if (path.mode === 'loop') {
                path.index = (path.index + 1) % path.points.length;
            } else {
                if (path.index + path.dir >= path.points.length || path.index + path.dir < 0) {
                    path.dir *= -1;
                }
                path.index += path.dir;
            }
            path.waitTimer = path.waitAtPoint;
            return;
        }

        if (isGroundUnit) {
            const dir = Math.sign(dx);
            velocity.x = dir * path.speed;
            transform.facing = dir >= 0 ? 1 : -1;

            // turn around at a ledge rather than walking off
            const collider = this.world.get(entity, Collider);
            if (collider) {
                const ahead = transform.x + dir * (collider.hw + 0.25);
                if (!this.collision.groundBelow(ahead, transform.y + 0.05, 0.05, 0.5)) {
                    path.dir *= -1;
                    path.index = clamp(path.index + path.dir, 0, path.points.length - 1);
                    velocity.x = 0;
                }
            }
        } else {
            const len = Math.hypot(dx, dy) || 1;
            velocity.x = (dx / len) * path.speed;
            velocity.y = (dy / len) * path.speed;
        }
    }

    /** Skiff riders are attached here so the grab window matches the AI's motion. */
    tryGrabRide(rider: Entity, carrier: Entity): boolean {
        const rideable = this.world.get(carrier, Rideable);
        const ai = this.world.get(carrier, SkiffAI);
        if (!rideable || rideable.occupied || (ai && ai.grabCooldown > 0)) return false;

        const health = this.world.get(carrier, Health);
        if (health && health.hp <= 0) return false;

        rideable.occupied = true;
        if (ai) ai.rider = rider;
        return true;
    }

    /** Exposed so RenderSystem can find a skiff's visual sub-parts. */
    static visualOf<T>(object: Object3D, key: string): T | undefined {
        return object.userData[key] as T | undefined;
    }
}
