import type { Object3D } from 'three';
import { AnimationPlayer } from '@/game/render/rig/AnimationPlayer';
import { createSkiff, createSpyphid, createSwatbot } from '@/game/render/rig/EnemyRigs';
import { createSallyRig } from '@/game/render/rig/SallyRig';
import { createSonicRig } from '@/game/render/rig/SonicRig';
import {
    createBlastDoor,
    createCooler,
    createGroundSlab,
    createMachineColumn,
    createPipePlatform,
    createRing,
    createRingMonitor,
    createSewerGrate,
    createSpikeColumn,
    createWallBlock,
} from '@/game/render/Meshes';

/**
 * The EXTRAS asset library: one entry per model in the build.
 *
 * Procedural assets are generated at call time, so the viewer always shows exactly
 * what the game ships. Generated GLB assets (docs/ASSET_GEN_PIPELINE.md) join the
 * same catalog at runtime under the IMPORTED category via GltfLibrary.
 */

export type AssetCategory = 'CHARACTERS' | 'ENEMIES' | 'PICKUPS' | 'PROPS' | 'IMPORTED';

/**
 * Uniform clip-playback interface for the viewer — backed by our keyframe
 * AnimationPlayer for procedural rigs, or a three.js AnimationMixer for GLBs.
 */
export interface ClipDriver {
    clips: string[];
    play(name: string): void;
    update(dt: number): void;
}

export interface BuiltAsset {
    object: Object3D;
    driver?: ClipDriver;
}

export interface AssetEntry {
    id: string;
    name: string;
    category: AssetCategory;
    description: string;
    build: () => BuiltAsset;
}

import type { Rig } from '@/game/render/rig/Rig';

/** Wrap a procedural rig in a ClipDriver; one-shots replay after a short beat. */
function rigDriver(rig: Rig, initial: string, clips: string[]): ClipDriver {
    const player = new AnimationPlayer(rig, initial);
    let pendingRestart: string | null = null;
    let wait = 0;

    player.onFinished = (name) => {
        pendingRestart = name;
        wait = 0.25;
    };

    return {
        clips,
        play(name) {
            pendingRestart = null;
            player.play(name, { restart: true });
        },
        update(dt) {
            if (pendingRestart) {
                wait -= dt;
                if (wait <= 0) {
                    player.play(pendingRestart, { restart: true });
                    pendingRestart = null;
                }
            }
            player.update(dt);
        },
    };
}

export const ASSET_CATALOG: AssetEntry[] = [
    // ─────────────────────────────────────────────────────────── characters
    {
        id: 'sonic',
        name: 'SONIC',
        category: 'CHARACTERS',
        description: 'The player rig — 10 bones, 21 keyframe clips, ball form for the buzzsaw.',
        build: () => {
            const rig = createSonicRig();
            return {
                object: rig.root,
                driver: rigDriver(rig, 'idle', [
                    'idle', 'walk', 'run', 'skid', 'jump', 'fall', 'spin',
                    'buzzsawCharge', 'throwRing', 'spikeBlastLand',
                    'ledgeHang', 'ledgeClimb', 'teeter', 'tightrope', 'peek',
                    'climbOut', 'hang', 'crouch', 'lookUp', 'hurt', 'victory',
                ]),
            };
        },
    },
    {
        id: 'sally',
        name: 'SALLY ACORN',
        category: 'CHARACTERS',
        description: 'The ally waiting at the blast door for the level-end rendezvous.',
        build: () => {
            const rig = createSallyRig();
            return {
                object: rig.root,
                driver: rigDriver(rig, 'sallyIdle', ['sallyIdle', 'sallyWalk']),
            };
        },
    },

    // ────────────────────────────────────────────────────────────── enemies
    {
        id: 'spyphid',
        name: 'SPYPHID',
        category: 'ENEMIES',
        description: 'Flying camera badnik. Hovers, sweeps a scan cone, dives when it locks on.',
        build: () => {
            const visual = createSpyphid();
            // The scan cone is gameplay telegraphing; it just clutters the turntable.
            visual.scanCone.visible = false;
            visual.group.position.y = 1.1;
            return { object: visual.group };
        },
    },
    {
        id: 'skiff',
        name: 'SLIPSTREAM SKIFF',
        category: 'ENEMIES',
        description: 'Patrolling hover-craft. The bar under the hull is grabbable mid-jump.',
        build: () => {
            const visual = createSkiff();
            visual.group.position.y = 1.1;
            return { object: visual.group };
        },
    },
    {
        id: 'swatbot',
        name: 'SWATBOT',
        category: 'ENEMIES',
        description: 'Armoured trooper with an arm cannon. Chest plate deflects ring throws.',
        build: () => {
            const visual = createSwatbot();
            return {
                object: visual.rig.root,
                driver: rigDriver(visual.rig, 'swatPatrol', ['swatPatrol', 'swatAim', 'swatStunned']),
            };
        },
    },

    // ────────────────────────────────────────────────────────────── pickups
    {
        id: 'ring',
        name: 'RING',
        category: 'PICKUPS',
        description: 'Health, ammo and score in one. Spins on Y in the world.',
        build: () => ({ object: createRing() }),
    },
    {
        id: 'monitor',
        name: 'RING MONITOR',
        category: 'PICKUPS',
        description: 'Breakable box on a post. The green screen pays out +10 rings.',
        build: () => ({ object: createRingMonitor() }),
    },

    // ──────────────────────────────────────────────────────────────── props
    {
        id: 'slab',
        name: 'GROUND SLAB',
        category: 'PROPS',
        description: 'Walkable deck: gravel top, teal plating, green pipe rail on the lip.',
        build: () => ({ object: createGroundSlab(6, 1.5) }),
    },
    {
        id: 'pipe',
        name: 'PIPE PLATFORM',
        category: 'PROPS',
        description: 'One-way platform. Thin variants force the tightrope balance walk.',
        build: () => ({ object: createPipePlatform(5, 0.34) }),
    },
    {
        id: 'wall',
        name: 'WALL BLOCK',
        category: 'PROPS',
        description: 'Green brick barrier with a capstone lip for clean ledge grabs.',
        build: () => ({ object: createWallBlock(3, 3) }),
    },
    {
        id: 'cooler',
        name: 'COOLER FAN',
        category: 'PROPS',
        description: 'Background extractor fan. Every rotor spins at its own speed.',
        build: () => ({ object: createCooler(1.4) }),
    },
    {
        id: 'machineColumn',
        name: 'MACHINE COLUMN',
        category: 'PROPS',
        description: 'Background dressing: riveted column with readouts and a lit hatch.',
        build: () => ({ object: createMachineColumn(1.5, 5) }),
    },
    {
        id: 'grate',
        name: 'SEWER GRATE',
        category: 'PROPS',
        description: 'The level-start hatch Sonic climbs out of, lid flipped open.',
        build: () => ({ object: createSewerGrate(1.9) }),
    },
    {
        id: 'spikes',
        name: 'SPIKE COLUMN',
        category: 'PROPS',
        description: 'Barbed hazard. Only the buzzsaw or a spike blast can shatter it.',
        build: () => ({ object: createSpikeColumn(1.6) }),
    },
    {
        id: 'blastDoor',
        name: 'BLAST DOOR',
        category: 'PROPS',
        description: 'The level-end door. Its two panels part for the ending sequence.',
        build: () => ({ object: createBlastDoor(3.2, 4.2) }),
    },
];
