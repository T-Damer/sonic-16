import {
    BoxGeometry,
    ConeGeometry,
    CylinderGeometry,
    Mesh,
    SphereGeometry,
    type Object3D,
} from 'three';
import { PALETTE, solidColor } from '@/game/render/Materials';
import { Rig, type BoneSpec } from '@/game/render/rig/Rig';

/**
 * The ally who meets the player at the level-end door.
 *
 * Shares the player's bone naming so the same clip format works, minus the ball form.
 */

const BONES: BoneSpec[] = [
    { name: 'hips', position: [0, 0.52, 0] },
    { name: 'body', parent: 'hips' },
    { name: 'torso', parent: 'body', position: [0, 0.06, 0] },
    { name: 'head', parent: 'torso', position: [0, 0.3, 0] },
    { name: 'armL', parent: 'torso', position: [-0.18, 0.16, 0] },
    { name: 'armR', parent: 'torso', position: [0.18, 0.16, 0] },
    { name: 'legL', parent: 'body', position: [-0.09, -0.14, 0] },
    { name: 'legR', parent: 'body', position: [0.09, -0.14, 0] },
    { name: 'footL', parent: 'legL', position: [0, -0.22, 0] },
    { name: 'footR', parent: 'legR', position: [0, -0.22, 0] },
];

function mesh(geometry: any, material: any, pos: [number, number, number] = [0, 0, 0]): Mesh {
    const m = new Mesh(geometry, material);
    m.position.set(pos[0], pos[1], pos[2]);
    m.castShadow = true;
    return m;
}

function buildTorso(): Object3D[] {
    const parts: Object3D[] = [];

    const chest = mesh(new SphereGeometry(0.21, 12, 10), solidColor('sallyFur', PALETTE.sallyFur));
    chest.scale.set(0.95, 1.05, 0.85);
    parts.push(chest);

    // open blue vest
    const vest = mesh(
        new CylinderGeometry(0.22, 0.2, 0.3, 12, 1, true),
        solidColor('sallyVest', PALETTE.sallyVest),
        [0, 0.02, -0.02],
    );
    parts.push(vest);

    const collar = mesh(
        new CylinderGeometry(0.13, 0.16, 0.05, 12),
        solidColor('sallyVest', PALETTE.sallyVest),
        [0, 0.18, 0],
    );
    parts.push(collar);

    // chipmunk tail
    const tail = mesh(
        new SphereGeometry(0.13, 10, 8),
        solidColor('sallyHair', PALETTE.sallyHair),
        [0, -0.02, -0.26],
    );
    tail.scale.set(0.7, 1.5, 0.7);
    tail.rotation.x = -0.5;
    parts.push(tail);

    return parts;
}

function buildHead(): Object3D[] {
    const parts: Object3D[] = [];

    const skull = mesh(new SphereGeometry(0.2, 12, 10), solidColor('sallyFur', PALETTE.sallyFur));
    skull.scale.set(1, 0.98, 0.95);
    parts.push(skull);

    const muzzle = mesh(
        new SphereGeometry(0.1, 10, 8),
        solidColor('sallyMuzzle', 0xf0d3a8),
        [0, -0.05, 0.15],
    );
    muzzle.scale.set(1.05, 0.8, 1.0);
    parts.push(muzzle);

    const nose = mesh(
        new SphereGeometry(0.032, 8, 8),
        solidColor('sonicNose', PALETTE.nose),
        [0, -0.02, 0.24],
    );
    parts.push(nose);

    for (const side of [-1, 1] as const) {
        const eye = mesh(
            new SphereGeometry(0.062, 10, 10),
            solidColor('sonicEye', PALETTE.eyeWhite),
            [side * 0.055, 0.06, 0.15],
        );
        eye.scale.set(0.8, 1.1, 0.7);
        parts.push(eye);

        const pupil = mesh(
            new SphereGeometry(0.028, 8, 8),
            solidColor('sallyPupil', 0x2b4d7a),
            [side * 0.058, 0.05, 0.19],
        );
        parts.push(pupil);

        // rounded ears
        const ear = mesh(
            new SphereGeometry(0.062, 8, 8),
            solidColor('sallyFur', PALETTE.sallyFur),
            [side * 0.15, 0.17, -0.02],
        );
        ear.scale.set(0.6, 1, 0.9);
        parts.push(ear);
    }

    // auburn hair — swept back mass plus a fringe
    const hair = mesh(
        new SphereGeometry(0.215, 12, 10),
        solidColor('sallyHair', PALETTE.sallyHair),
        [0, 0.03, -0.06],
    );
    hair.scale.set(1.04, 1.0, 1.15);
    parts.push(hair);

    const fringe = mesh(
        new SphereGeometry(0.14, 10, 8),
        solidColor('sallyHair', PALETTE.sallyHair),
        [0, 0.14, 0.1],
    );
    fringe.scale.set(1.2, 0.6, 0.9);
    parts.push(fringe);

    for (const side of [-1, 1] as const) {
        const lock = mesh(
            new ConeGeometry(0.075, 0.3, 6),
            solidColor('sallyHair', PALETTE.sallyHair),
            [side * 0.17, -0.05, -0.1],
        );
        lock.rotation.x = 0.25;
        lock.rotation.z = side * 0.2;
        parts.push(lock);
    }

    return parts;
}

function buildArm(): Object3D[] {
    return [
        mesh(new CylinderGeometry(0.042, 0.038, 0.22, 8), solidColor('sallyFur', PALETTE.sallyFur), [0, -0.11, 0]),
        mesh(new SphereGeometry(0.065, 8, 8), solidColor('sonicGlove', PALETTE.glove), [0, -0.24, 0]),
    ];
}

function buildLeg(): Object3D[] {
    return [
        mesh(new CylinderGeometry(0.05, 0.045, 0.22, 8), solidColor('sallyFur', PALETTE.sallyFur), [0, -0.11, 0]),
    ];
}

function buildFoot(): Object3D[] {
    return [
        mesh(new BoxGeometry(0.12, 0.16, 0.22), solidColor('sallyBoot', PALETTE.sallyBoot), [0, -0.06, 0.03]),
        mesh(new SphereGeometry(0.062, 8, 8), solidColor('sallyBoot', PALETTE.sallyBoot), [0, -0.06, 0.13]),
        mesh(new CylinderGeometry(0.068, 0.068, 0.06, 8), solidColor('sallyBootCuff', 0x5a4ec0), [0, 0.04, 0]),
    ];
}

export function createSallyRig(): Rig {
    const rig = new Rig(BONES);
    rig.attach('torso', ...buildTorso());
    rig.attach('head', ...buildHead());
    rig.attach('armL', ...buildArm());
    rig.attach('armR', ...buildArm());
    rig.attach('legL', ...buildLeg());
    rig.attach('legR', ...buildLeg());
    rig.attach('footL', ...buildFoot());
    rig.attach('footR', ...buildFoot());
    return rig;
}
