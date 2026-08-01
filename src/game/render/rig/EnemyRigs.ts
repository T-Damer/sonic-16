import {
    BoxGeometry,
    ConeGeometry,
    CylinderGeometry,
    Group,
    Mesh,
    SphereGeometry,
    TorusGeometry,
    type Object3D,
} from 'three';
import { PALETTE, glow, metal, solidColor } from '@/game/render/Materials';
import { Rig, type BoneSpec } from '@/game/render/rig/Rig';

function mesh(geometry: any, material: any, pos: [number, number, number] = [0, 0, 0]): Mesh {
    const m = new Mesh(geometry, material);
    m.position.set(pos[0], pos[1], pos[2]);
    m.castShadow = true;
    return m;
}

// ═══════════════════════════════════════════════════════ SPYPHID (camera badnik)

export interface SpyphidVisual {
    group: Group;
    /** Lens material tinted red when the badnik locks on. */
    lens: Mesh;
    /** Tentacle cluster — curls when diving. */
    tentacles: Group;
    scanCone: Mesh;
}

/**
 * Spyphid — Robotnik's ocular surveillance drone.
 * A floating lens housing with four grabber tentacles and a visible scan cone.
 */
export function createSpyphid(): SpyphidVisual {
    const group = new Group();

    // main housing
    const shell = mesh(new SphereGeometry(0.34, 14, 12), solidColor('spyBody', PALETTE.spyphidBody));
    shell.scale.set(1.0, 0.88, 1.0);
    group.add(shell);

    // armoured cap
    const cap = mesh(
        new SphereGeometry(0.35, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
        solidColor('spyDark', PALETTE.spyphidDark),
        [0, 0.03, 0],
    );
    group.add(cap);

    // lens barrel pointing forward (+Z is the badnik's facing)
    const barrel = mesh(
        new CylinderGeometry(0.17, 0.2, 0.22, 12),
        metal('spyBarrel', 0x6c5590),
        [0, 0, 0.28],
    );
    barrel.rotation.x = Math.PI / 2;
    group.add(barrel);

    const lensRing = mesh(
        new TorusGeometry(0.17, 0.035, 6, 16),
        metal('spyLensRing', 0xb9a5d8),
        [0, 0, 0.39],
    );
    group.add(lensRing);

    const lens = mesh(
        new SphereGeometry(0.15, 12, 10),
        glow('spyLens', PALETTE.spyphidLens, 1),
        [0, 0, 0.4],
    );
    lens.scale.set(1, 1, 0.55);
    lens.castShadow = false;
    group.add(lens);

    // hover thruster glow underneath
    const thruster = mesh(
        new ConeGeometry(0.13, 0.26, 10),
        glow('spyThruster', 0x7fe4ff, 0.45),
        [0, -0.32, 0],
    );
    thruster.rotation.x = Math.PI;
    thruster.castShadow = false;
    group.add(thruster);

    // four grabber tentacles
    const tentacles = new Group();
    tentacles.position.y = -0.2;
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const arm = new Group();
        arm.position.set(Math.cos(angle) * 0.19, 0, Math.sin(angle) * 0.19);
        arm.rotation.z = -Math.cos(angle) * 0.5;
        arm.rotation.x = Math.sin(angle) * 0.5;

        const upper = mesh(
            new CylinderGeometry(0.045, 0.032, 0.24, 6),
            solidColor('spyDark', PALETTE.spyphidDark),
            [0, -0.12, 0],
        );
        arm.add(upper);

        const claw = mesh(
            new ConeGeometry(0.05, 0.16, 5),
            metal('spyClaw', 0xd8cfe8),
            [0, -0.3, 0],
        );
        claw.rotation.x = Math.PI;
        arm.add(claw);

        tentacles.add(arm);
    }
    group.add(tentacles);

    // scan cone — a translucent wedge that sweeps in front of the lens
    const scanCone = new Mesh(
        new ConeGeometry(1.5, 4.5, 12, 1, true),
        glow('spyScan', 0x8ff2ff, 0.12),
    );
    scanCone.rotation.x = -Math.PI / 2;
    scanCone.position.z = 2.4;
    scanCone.castShadow = false;
    group.add(scanCone);

    return { group, lens, tentacles, scanCone };
}

// ═══════════════════════════════════════════════════════ SLIPSTREAM SKIFF

export interface SkiffVisual {
    group: Group;
    /** Hull tilts on the roll axis as it banks. */
    hull: Group;
    grabBar: Mesh;
    thrusterGlow: Mesh;
}

/**
 * Slipstream Skiff — a flat magenta hover-craft with a grab bar underneath.
 * Primarily a vehicle: catch the bar mid-jump and ride it across the gap.
 */
export function createSkiff(): SkiffVisual {
    const group = new Group();
    const hull = new Group();
    group.add(hull);

    // main flattened body
    const body = mesh(new SphereGeometry(0.95, 16, 10), solidColor('skiffHull', PALETTE.skiffHull));
    body.scale.set(1.0, 0.26, 0.5);
    hull.add(body);

    // upper cowling
    const cowl = mesh(
        new SphereGeometry(0.42, 12, 8),
        solidColor('skiffHullDark', PALETTE.skiffHullDark),
        [-0.1, 0.13, 0],
    );
    cowl.scale.set(1.1, 0.5, 0.75);
    hull.add(cowl);

    // nose fin
    const nose = mesh(
        new ConeGeometry(0.2, 0.55, 8),
        solidColor('skiffHull', PALETTE.skiffHull),
        [1.05, 0.0, 0],
    );
    nose.rotation.z = -Math.PI / 2;
    nose.scale.set(1, 1, 0.5);
    hull.add(nose);

    // tail stabiliser
    const tail = mesh(
        new BoxGeometry(0.36, 0.28, 0.08),
        solidColor('skiffHullDark', PALETTE.skiffHullDark),
        [-0.85, 0.16, 0],
    );
    tail.rotation.z = 0.35;
    hull.add(tail);

    // intake stripe
    const stripe = mesh(
        new BoxGeometry(1.3, 0.05, 0.42),
        glow('skiffStripe', 0xffa8d4, 0.9),
        [0, 0.1, 0.16],
    );
    hull.add(stripe);

    // underside thruster glow
    const thrusterGlow = mesh(
        new CylinderGeometry(0.5, 0.32, 0.1, 14),
        glow('skiffGlow', PALETTE.skiffGlow, 0.5),
        [0, -0.24, 0],
    );
    thrusterGlow.scale.set(1.5, 1, 0.7);
    thrusterGlow.castShadow = false;
    hull.add(thrusterGlow);

    // the grab bar the player hangs from
    const grabBar = mesh(
        new CylinderGeometry(0.055, 0.055, 1.1, 8),
        metal('skiffBar', 0xd9dee3),
        [0, -0.42, 0],
    );
    grabBar.rotation.z = Math.PI / 2;
    hull.add(grabBar);

    for (const side of [-1, 1] as const) {
        const strut = mesh(
            new CylinderGeometry(0.035, 0.035, 0.24, 6),
            metal('skiffStrut', 0x9aa2ab),
            [side * 0.5, -0.32, 0],
        );
        hull.add(strut);
    }

    return { group, hull, grabBar, thrusterGlow };
}

// ═══════════════════════════════════════════════════════ SWATBOT

const SWAT_BONES: BoneSpec[] = [
    { name: 'hips', position: [0, 0.72, 0] },
    { name: 'body', parent: 'hips' },
    { name: 'torso', parent: 'body', position: [0, 0.1, 0] },
    { name: 'head', parent: 'torso', position: [0, 0.36, 0] },
    { name: 'armL', parent: 'torso', position: [-0.26, 0.2, 0] },
    { name: 'armR', parent: 'torso', position: [0.26, 0.2, 0] },
    { name: 'legL', parent: 'body', position: [-0.13, -0.16, 0] },
    { name: 'legR', parent: 'body', position: [0.13, -0.16, 0] },
    { name: 'footL', parent: 'legL', position: [0, -0.3, 0] },
    { name: 'footR', parent: 'legR', position: [0, -0.3, 0] },
];

export interface SwatbotVisual {
    rig: Rig;
    visor: Mesh;
    /** Three orbs that light up while the cannon charges. */
    chargeOrbs: Mesh[];
    /** Muzzle point of the arm cannon, in cannon-local space. */
    muzzle: Object3D;
}

/** SWATbot — Robotnik's armoured infantry unit with a shoulder-fed arm cannon. */
export function createSwatbot(): SwatbotVisual {
    const rig = new Rig(SWAT_BONES);

    // ── torso: boxy armoured chest with a front plate
    const chest = mesh(new BoxGeometry(0.52, 0.5, 0.34), metal('swatChest', PALETTE.swatGrey, 0.5));
    const plate = mesh(
        new BoxGeometry(0.44, 0.34, 0.08),
        metal('swatPlate', 0xa7b1bd, 0.35),
        [0, 0.02, 0.2],
    );
    const collar = mesh(
        new BoxGeometry(0.44, 0.1, 0.3),
        metal('swatDark', PALETTE.swatDark, 0.6),
        [0, 0.28, 0],
    );
    const waist = mesh(
        new CylinderGeometry(0.2, 0.22, 0.18, 10),
        metal('swatDark', PALETTE.swatDark, 0.6),
        [0, -0.3, 0],
    );
    rig.attach('torso', chest, plate, collar, waist);

    // ── head: narrow visor slab
    const skull = mesh(new BoxGeometry(0.3, 0.28, 0.3), metal('swatChest', PALETTE.swatGrey, 0.5));
    const dome = mesh(
        new SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        metal('swatChest', PALETTE.swatGrey, 0.5),
        [0, 0.13, 0],
    );
    const visor = mesh(
        new BoxGeometry(0.26, 0.07, 0.04),
        glow('swatVisor', PALETTE.swatVisor, 1),
        [0, 0.02, 0.16],
    );
    visor.castShadow = false;
    const jaw = mesh(
        new BoxGeometry(0.22, 0.08, 0.24),
        metal('swatDark', PALETTE.swatDark, 0.6),
        [0, -0.16, 0.02],
    );
    rig.attach('head', skull, dome, visor, jaw);

    // ── left arm: plain manipulator
    const armLUpper = mesh(
        new CylinderGeometry(0.075, 0.065, 0.3, 8),
        metal('swatLimb', 0x7d8794, 0.55),
        [0, -0.15, 0],
    );
    const armLHand = mesh(
        new BoxGeometry(0.13, 0.14, 0.13),
        metal('swatDark', PALETTE.swatDark, 0.6),
        [0, -0.34, 0],
    );
    rig.attach('armL', armLUpper, armLHand);

    // ── right arm: the cannon
    const armRUpper = mesh(
        new CylinderGeometry(0.075, 0.065, 0.26, 8),
        metal('swatLimb', 0x7d8794, 0.55),
        [0, -0.13, 0],
    );
    const cannonBody = mesh(
        new CylinderGeometry(0.11, 0.13, 0.42, 10),
        metal('swatCannon', 0x66707d, 0.45),
        [0, -0.4, 0.02],
    );
    const cannonMouth = mesh(
        new CylinderGeometry(0.13, 0.1, 0.12, 10),
        metal('swatDark', PALETTE.swatDark, 0.5),
        [0, -0.62, 0.02],
    );

    const muzzle = new Group();
    muzzle.position.set(0, -0.7, 0.02);

    // charge orbs travelling up the barrel — the tell from the reference frames
    const chargeOrbs: Mesh[] = [];
    for (let i = 0; i < 3; i++) {
        const orb = mesh(
            new SphereGeometry(0.062, 8, 8),
            glow('swatCharge', 0xfff6b0, 0.95),
            [0, -0.3 - i * 0.14, 0.02],
        );
        orb.castShadow = false;
        orb.visible = false;
        chargeOrbs.push(orb);
    }
    rig.attach('armR', armRUpper, cannonBody, cannonMouth, muzzle, ...chargeOrbs);

    // ── legs
    for (const bone of ['legL', 'legR'] as const) {
        const thigh = mesh(
            new CylinderGeometry(0.085, 0.075, 0.34, 8),
            metal('swatLimb', 0x7d8794, 0.55),
            [0, -0.17, 0],
        );
        const knee = mesh(
            new SphereGeometry(0.085, 8, 8),
            metal('swatDark', PALETTE.swatDark, 0.6),
            [0, -0.32, 0],
        );
        rig.attach(bone, thigh, knee);
    }
    for (const bone of ['footL', 'footR'] as const) {
        const boot = mesh(
            new BoxGeometry(0.17, 0.14, 0.3),
            metal('swatDark', PALETTE.swatDark, 0.6),
            [0, -0.06, 0.04],
        );
        rig.attach(bone, boot);
    }

    return { rig, visor, chargeOrbs, muzzle };
}
