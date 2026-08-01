import { Group, Object3D } from 'three';
import {
    Animated,
    AnimState,
    BlastDoor,
    BlobShadow,
    Breakable,
    Checkpoint,
    Collider,
    DamageOnTouch,
    EnemyTag,
    Grounded,
    Health,
    Hurtbox,
    Intent,
    Invulnerable,
    MeshRef,
    PatrolPath,
    PlayerState,
    PlayerTag,
    Respawn,
    Rideable,
    RigRef,
    RingMonitor,
    RingPurse,
    SequenceActor,
    SkiffAI,
    Solid,
    SpyphidAI,
    SwatbotAI,
    Transform,
    Trigger,
    Velocity,
} from '@/game/components';
import { PLAYER, WORLD } from '@/game/config/GameConfig';
import type { Entity, World } from '@/game/core/ecs';
import { randRange } from '@/game/core/MathUtils';
import { AnimationPlayer } from '@/game/render/rig/AnimationPlayer';
import { createSallyRig } from '@/game/render/rig/SallyRig';
import { createSonicRig } from '@/game/render/rig/SonicRig';
import { createSkiff, createSpyphid, createSwatbot } from '@/game/render/rig/EnemyRigs';
import {
    createBackdropPanel,
    createBlastDoor,
    createBlobShadow,
    createCooler,
    createGroundSlab,
    createHandle,
    createMachineColumn,
    createPipePlatform,
    createPitHole,
    createRingMonitor,
    createSewerGrate,
    createSpikeColumn,
    createWallBlock,
    createWallLedge,
} from '@/game/render/Meshes';
import type { Renderer3D } from '@/game/render/Renderer3D';
import { expandRings, type LevelDef, type SolidDef } from '@/game/world/LevelSchema';
import { spawnRing } from '@/game/world/Factories';

/** Everything the systems need to know about the loaded level. */
export interface LevelRuntime {
    def: LevelDef;
    player: Entity;
    ally: Entity;
    blastDoor: Entity;
    /** Static solids, cached so the collision broadphase doesn't re-query. */
    solids: Entity[];
}

/**
 * Walks a LevelDef and instantiates ECS entities plus their three.js meshes.
 *
 * Visual-only props get a MeshRef with no collider; anything gameplay-relevant gets
 * a Transform + Collider so the systems can reason about it uniformly.
 */
export class LevelBuilder {
    constructor(
        private readonly world: World,
        private readonly renderer: Renderer3D,
    ) {}

    build(def: LevelDef): LevelRuntime {
        const solids = def.solids.map((s) => this.spawnSolid(s));

        for (const prop of def.props) this.spawnProp(prop);
        for (const group of def.rings) {
            for (const ring of expandRings(group)) {
                spawnRing(this.world, this.renderer, ring.x, ring.y);
            }
        }
        for (const monitor of def.monitors) this.spawnMonitor(monitor.x, monitor.y, monitor.reward ?? 10);
        for (const spike of def.spikes) this.spawnSpikes(spike.x, spike.y, spike.columns ?? 1, spike.height ?? 1.5, spike.spacing ?? 0.6);
        for (const enemy of def.enemies) this.spawnEnemy(enemy);
        for (const cp of def.checkpoints) this.spawnCheckpoint(cp.x, cp.y, def.checkpoints.indexOf(cp));
        for (const trigger of def.triggers) this.spawnTrigger(trigger);

        const player = this.spawnPlayer(def.spawn.x, def.spawn.y);
        const ally = def.ally ? this.spawnAlly(def.ally.x, def.ally.y) : -1;
        const blastDoor = this.findBlastDoor();

        return { def, player, ally, blastDoor, solids };
    }

    // ────────────────────────────────────────────────────────────────── solids

    private spawnSolid(def: SolidDef): Entity {
        const entity = this.world.create();
        this.world.add(entity, Transform, { x: def.x, y: def.y, z: 0 });
        this.world.add(entity, Collider, { hw: def.w / 2, hh: def.h / 2, ox: 0, oy: 0 });
        this.world.add(entity, Solid, {
            kind: def.kind,
            oneWay: def.oneWay ?? false,
            thin: def.thin ?? false,
        });

        let object: Group;
        switch (def.kind) {
            case 'pipe':
                object = createPipePlatform(def.w, def.h);
                break;
            case 'wall':
                object = createWallBlock(def.w, def.h);
                break;
            case 'ledge':
                object = createWallLedge(def.w);
                break;
            default:
                object = createGroundSlab(def.w, def.h);
                break;
        }
        object.position.set(def.x, def.y, def.kind === 'wall' ? WORLD.layers.platform + 0.6 : 0);
        this.renderer.world.add(object);
        this.world.add(entity, MeshRef, {
            object,
            cullable: true,
            cullRadius: Math.max(def.w, def.h) / 2,
        });

        return entity;
    }

    // ───────────────────────────────────────────────────────────────── props

    private spawnProp(def: { kind: string; x: number; y: number; z?: number; size?: number; height?: number; spin?: number }): void {
        const entity = this.world.create();
        let object: Object3D;
        let z = def.z ?? WORLD.layers.machinery;

        switch (def.kind) {
            case 'cooler': {
                object = createCooler(def.size ?? 1.4);
                this.world.add(entity, Animated, { speed: def.spin ?? 1, phase: randRange(0, Math.PI * 2) });
                break;
            }
            case 'machineColumn':
                object = createMachineColumn(def.size ?? 1.4, def.height ?? 5);
                break;
            case 'backdrop':
                object = createBackdropPanel(def.size ?? 40, def.height ?? 26);
                z = def.z ?? WORLD.layers.backdrop;
                break;
            case 'grate':
                object = createSewerGrate(def.size ?? 1.8);
                z = def.z ?? 0;
                break;
            case 'hole':
                // sits on a deck's top face, pushed toward the visible front
                object = createPitHole(def.size ?? 1.1);
                z = def.z ?? 0.55;
                break;
            case 'handle':
                object = createHandle();
                z = def.z ?? 0;
                break;
            case 'blastDoor': {
                const door = createBlastDoor(def.size ?? 3.2, def.height ?? 4.2);
                object = door;
                z = def.z ?? WORLD.layers.wall + 1.4;
                // The door sits on the floor, so lift it by half its height.
                door.position.y = (def.height ?? 4.2) / 2;
                this.world.add(entity, BlastDoor, {
                    leftPanel: door.getObjectByName('doorLeft')!,
                    rightPanel: door.getObjectByName('doorRight')!,
                });
                break;
            }
            default:
                return;
        }

        const holder = new Group();
        holder.add(object);
        holder.position.set(def.x, def.y, z);
        this.renderer.world.add(holder);

        this.world.add(entity, Transform, { x: def.x, y: def.y, z });
        this.world.add(entity, MeshRef, {
            object: holder,
            // Backdrop strips span the whole act; culling them causes visible pop-in.
            cullable: def.kind !== 'backdrop',
            cullRadius: Math.max(def.size ?? 2, def.height ?? 2) / 2 + 1,
        });
    }

    private findBlastDoor(): Entity {
        for (const [entity] of this.world.each(BlastDoor)) return entity;
        return -1;
    }

    // ──────────────────────────────────────────────────────────── collectibles

    private spawnMonitor(x: number, y: number, reward: number): Entity {
        const entity = this.world.create();
        this.world.add(entity, Transform, { x, y, z: 0 });
        this.world.add(entity, Collider, { hw: 0.36, hh: 0.34, ox: 0, oy: 0.76 });
        this.world.add(entity, RingMonitor, { reward });
        this.world.add(entity, Breakable, { kind: 'monitor', requiresHeavy: false, reward });
        this.world.add(entity, Health, { hp: 1, maxHp: 1 });
        this.world.add(entity, Hurtbox, { hw: 0.36, hh: 0.34, ox: 0, oy: 0.76, team: 1 });

        const object = createRingMonitor();
        object.position.set(x, y, 0);
        this.renderer.world.add(object);
        this.world.add(entity, MeshRef, { object });

        return entity;
    }

    private spawnSpikes(x: number, y: number, columns: number, height: number, spacing: number): void {
        for (let i = 0; i < columns; i++) {
            const cx = x + (i - (columns - 1) / 2) * spacing;
            const entity = this.world.create();
            this.world.add(entity, Transform, { x: cx, y, z: 0 });
            this.world.add(entity, Collider, { hw: 0.3, hh: height / 2, ox: 0, oy: height / 2 });
            this.world.add(entity, Breakable, { kind: 'spikes', requiresHeavy: true });
            this.world.add(entity, Health, { hp: 1, maxHp: 1 });
            this.world.add(entity, Hurtbox, { hw: 0.3, hh: height / 2, ox: 0, oy: height / 2, team: 1 });
            this.world.add(entity, DamageOnTouch, { damage: 1, pushDir: 0 });

            const object = createSpikeColumn(height);
            object.position.set(cx, y, 0);
            this.renderer.world.add(object);
            this.world.add(entity, MeshRef, { object });
        }
    }

    // ─────────────────────────────────────────────────────────────── enemies

    private spawnEnemy(def: { kind: string; x: number; y: number; path?: { x: number; y: number }[]; speed?: number; facing?: 1 | -1; range?: number }): void {
        switch (def.kind) {
            case 'spyphid':
                this.spawnSpyphid(def.x, def.y, def.facing ?? -1);
                break;
            case 'skiff':
                this.spawnSkiff(def.x, def.y, def.path ?? [{ x: 0, y: 0 }, { x: 8, y: 0 }], def.speed ?? 3);
                break;
            case 'swatbot':
                this.spawnSwatbot(def.x, def.y, def.facing ?? -1, def.range ?? 4, def.speed ?? 1.6);
                break;
        }
    }

    private spawnSpyphid(x: number, y: number, facing: 1 | -1): Entity {
        const entity = this.world.create();
        this.world.add(entity, Transform, { x, y, z: 0, facing });
        this.world.add(entity, Velocity, {});
        this.world.add(entity, Collider, { hw: 0.34, hh: 0.34, ox: 0, oy: 0 });
        this.world.add(entity, EnemyTag, { kind: 'spyphid' });
        this.world.add(entity, Health, { hp: 1, maxHp: 1 });
        this.world.add(entity, Hurtbox, { hw: 0.38, hh: 0.38, ox: 0, oy: 0, team: 1 });
        this.world.add(entity, DamageOnTouch, { damage: 1 });
        this.world.add(entity, SpyphidAI, {
            homeX: x,
            homeY: y,
            bobPhase: randRange(0, Math.PI * 2),
            scanAngle: 0,
            scanDir: 1,
        });

        const visual = createSpyphid();
        visual.group.position.set(x, y, 0);
        this.renderer.actors.add(visual.group);
        this.world.add(entity, MeshRef, { object: visual.group, baseY: y });
        this.world.add(entity, BlobShadow, {
            radius: 0.38,
            object: this.attachShadow(0.38),
        });

        // stash the sub-parts the AI system animates
        visual.group.userData.spyphid = visual;
        return entity;
    }

    private spawnSkiff(x: number, y: number, path: { x: number; y: number }[], speed: number): Entity {
        const entity = this.world.create();
        this.world.add(entity, Transform, { x, y, z: 0, facing: 1 });
        this.world.add(entity, Velocity, {});
        this.world.add(entity, Collider, { hw: 1.0, hh: 0.3, ox: 0, oy: 0 });
        this.world.add(entity, EnemyTag, { kind: 'skiff' });
        this.world.add(entity, Health, { hp: 2, maxHp: 2 });
        this.world.add(entity, Hurtbox, { hw: 0.95, hh: 0.3, ox: 0, oy: 0.05, team: 1 });
        this.world.add(entity, SkiffAI, {});
        this.world.add(entity, Rideable, { ox: 0, oy: -0.42, hw: 0.9, hh: 0.4 });
        this.world.add(entity, PatrolPath, {
            points: path.map((p) => ({ x: x + p.x, y: y + p.y })),
            speed,
            mode: 'pingpong',
            waitAtPoint: 0.35,
        });

        const visual = createSkiff();
        visual.group.position.set(x, y, 0);
        this.renderer.actors.add(visual.group);
        visual.group.userData.skiff = visual;
        this.world.add(entity, MeshRef, { object: visual.group, baseY: y });
        this.world.add(entity, BlobShadow, { radius: 0.9, object: this.attachShadow(0.9) });

        return entity;
    }

    private spawnSwatbot(x: number, y: number, facing: 1 | -1, range: number, speed: number): Entity {
        const entity = this.world.create();
        this.world.add(entity, Transform, { x, y, z: 0, facing });
        this.world.add(entity, Velocity, {});
        this.world.add(entity, Collider, { hw: 0.32, hh: 0.62, ox: 0, oy: 0.62 });
        this.world.add(entity, Grounded, {});
        this.world.add(entity, EnemyTag, { kind: 'swatbot' });
        this.world.add(entity, Health, { hp: 2, maxHp: 2, frontArmoured: true });
        this.world.add(entity, Hurtbox, { hw: 0.34, hh: 0.62, ox: 0, oy: 0.62, team: 1 });
        this.world.add(entity, DamageOnTouch, { damage: 1 });
        this.world.add(entity, SwatbotAI, {});
        this.world.add(entity, PatrolPath, {
            points: [
                { x: x - range, y },
                { x: x + range, y },
            ],
            speed,
            mode: 'pingpong',
            waitAtPoint: 0.6,
        });

        const visual = createSwatbot();
        visual.rig.root.position.set(x, y, 0);
        this.renderer.actors.add(visual.rig.root);
        visual.rig.root.userData.swatbot = visual;

        this.world.add(entity, MeshRef, { object: visual.rig.root });
        this.world.add(entity, RigRef, {
            rig: visual.rig,
            player: new AnimationPlayer(visual.rig, 'swatPatrol'),
        });
        this.world.add(entity, AnimState, { clip: 'swatPatrol' });
        this.world.add(entity, BlobShadow, { radius: 0.42, object: this.attachShadow(0.42) });

        return entity;
    }

    // ─────────────────────────────────────────────────────────── player & ally

    private spawnPlayer(x: number, y: number): Entity {
        const entity = this.world.create();
        this.world.add(entity, Transform, { x, y, z: 0, facing: 1 });
        this.world.add(entity, Velocity, {});
        this.world.add(entity, Collider, {
            hw: PLAYER.halfWidth,
            hh: PLAYER.halfHeight,
            ox: 0,
            oy: PLAYER.halfHeight,
        });
        this.world.add(entity, Grounded, {});
        this.world.add(entity, PlayerTag);
        this.world.add(entity, PlayerState, { name: 'climbOut', locked: true });
        this.world.add(entity, Intent, {});
        this.world.add(entity, RingPurse, { rings: PLAYER.startingRings });
        this.world.add(entity, Invulnerable, { timer: 0 });
        this.world.add(entity, Respawn, { x, y, checkpointIndex: 0 });
        this.world.add(entity, Health, { hp: 1, maxHp: 1 });
        this.world.add(entity, Hurtbox, {
            hw: PLAYER.halfWidth,
            hh: PLAYER.halfHeight,
            ox: 0,
            oy: PLAYER.halfHeight,
            team: 0,
        });

        const rig = createSonicRig();
        rig.root.position.set(x, y, 0);
        this.renderer.actors.add(rig.root);

        this.world.add(entity, MeshRef, { object: rig.root, cullable: false });
        this.world.add(entity, RigRef, { rig, player: new AnimationPlayer(rig, 'climbOut') });
        this.world.add(entity, AnimState, { clip: 'climbOut' });
        this.world.add(entity, BlobShadow, { radius: 0.4, object: this.attachShadow(0.4) });

        return entity;
    }

    private spawnAlly(x: number, y: number): Entity {
        const entity = this.world.create();
        this.world.add(entity, Transform, { x, y, z: 0, facing: -1 });
        this.world.add(entity, Velocity, {});
        this.world.add(entity, SequenceActor, { role: 'ally' });

        const rig = createSallyRig();
        rig.root.position.set(x, y, 0);
        rig.root.rotation.y = -Math.PI / 2;
        this.renderer.actors.add(rig.root);

        this.world.add(entity, MeshRef, { object: rig.root, cullable: true });
        this.world.add(entity, RigRef, { rig, player: new AnimationPlayer(rig, 'sallyIdle') });
        this.world.add(entity, AnimState, { clip: 'sallyIdle' });
        this.world.add(entity, BlobShadow, { radius: 0.38, object: this.attachShadow(0.38) });

        return entity;
    }

    // ───────────────────────────────────────────────────────────── flow markers

    private spawnCheckpoint(x: number, y: number, index: number): Entity {
        const entity = this.world.create();
        this.world.add(entity, Transform, { x, y, z: 0 });
        this.world.add(entity, Checkpoint, { index, radius: 1.4 });
        return entity;
    }

    private spawnTrigger(def: { x: number; y: number; w: number; h: number; event: string; once?: boolean }): Entity {
        const entity = this.world.create();
        this.world.add(entity, Transform, { x: def.x, y: def.y, z: 0 });
        this.world.add(entity, Trigger, {
            hw: def.w / 2,
            hh: def.h / 2,
            event: def.event,
            once: def.once ?? true,
        });
        return entity;
    }

    private attachShadow(radius: number): Object3D {
        const shadow = createBlobShadow(radius);
        this.renderer.effects.add(shadow);
        return shadow;
    }
}
