import { ConeGeometry, CylinderGeometry, Mesh, SphereGeometry, type Object3D } from 'three';
import { DEG } from '@/game/core/MathUtils';
import { PALETTE, glow, solidColor } from '@/game/render/Materials';
import { drum, limb, orb, slab, spike, sweptBack, tint } from '@/game/render/ModelKit';
import { Rig, type BoneSpec } from '@/game/render/rig/Rig';

/**
 * The player character, built from ModelKit primitives per docs/ART_PIPELINE.md.
 *
 * Proportion sheet (character is ~1.05u tall at bind):
 *   head    r 0.30  — nearly half the height; the head IS the character
 *   torso   r 0.21  — small, tucked under the head
 *   limbs   thin (r ≈ 0.05) with oversized gloves (r 0.095) and long shoes (0.4u)
 *   quills  3 centre + 2 side, all swept BACK (−Z) and down
 *
 * Swap-in contract for a future GLTF model: keep these bone names and the whole
 * clip set drives it unchanged.
 */

const BONES: BoneSpec[] = [
    { name: 'hips', position: [0, 0.5, 0] },
    { name: 'body', parent: 'hips' },
    { name: 'torso', parent: 'body', position: [0, 0.05, 0] },
    { name: 'head', parent: 'torso', position: [0, 0.3, 0] },
    { name: 'armL', parent: 'torso', position: [-0.2, 0.16, 0] },
    { name: 'armR', parent: 'torso', position: [0.2, 0.16, 0] },
    { name: 'legL', parent: 'body', position: [-0.1, -0.14, 0] },
    { name: 'legR', parent: 'body', position: [0.1, -0.14, 0] },
    { name: 'footL', parent: 'legL', position: [0, -0.22, 0] },
    { name: 'footR', parent: 'legR', position: [0, -0.22, 0] },
    { name: 'ball', parent: 'hips' },
];

function buildHead(): Object3D[] {
    const parts: Object3D[] = [];

    // skull — big, slightly squashed
    parts.push(orb('sonicSkin', PALETTE.sonicBlue, 0.3, {
        pos: [0, 0.06, -0.01],
        scale: [1, 0.96, 0.94],
    }));

    // joined eye visor — the classic single white mass, not two separate eyes
    parts.push(orb('sonicEye', PALETTE.eyeWhite, 0.135, {
        pos: [0, 0.115, 0.175],
        scale: [1.4, 1.05, 0.6],
    }));
    for (const side of [-1, 1] as const) {
        parts.push(orb('sonicPupil', PALETTE.pupil, 0.042, {
            pos: [side * 0.077, 0.1, 0.288],
            scale: [0.72, 1.4, 0.5],
        }));
    }

    // muzzle — two overlapping skin spheres read better than one flat ellipse
    for (const side of [-1, 1] as const) {
        parts.push(orb('sonicMuzzle', PALETTE.skin, 0.118, {
            pos: [side * 0.05, -0.05, 0.19],
            scale: [1.02, 0.82, 1],
        }));
    }
    parts.push(orb('sonicNose', PALETTE.nose, 0.052, {
        pos: [0, 0.005, 0.328],
        scale: [1.25, 0.8, 1],
    }));

    // centre quill row — swept BACK and progressively further down
    const centreQuills: [number, number, number, number][] = [
        //  y      z     tilt°  length
        [0.15, -0.19, 28, 0.5],
        [0.02, -0.25, 52, 0.52],
        [-0.11, -0.26, 74, 0.46],
    ];
    for (const [y, z, tilt, length] of centreQuills) {
        parts.push(spike('sonicQuill', PALETTE.sonicBlue, 0.105, length, {
            pos: [0, y, z],
            rot: [sweptBack(tilt * DEG), 0, 0],
            scale: [0.85, 1, 0.6],
        }));
    }
    // side quills — smaller, fanned outward
    for (const side of [-1, 1] as const) {
        parts.push(spike('sonicQuill', PALETTE.sonicBlue, 0.07, 0.34, {
            pos: [side * 0.115, 0.06, -0.17],
            rot: [sweptBack(40 * DEG), side * 0.28, 0],
            scale: [0.85, 1, 0.6],
        }));
    }

    // ears — up and slightly out, with skin inners
    for (const side of [-1, 1] as const) {
        parts.push(spike('sonicQuill', PALETTE.sonicBlue, 0.075, 0.18, {
            pos: [side * 0.175, 0.27, -0.04],
            rot: [-0.18, 0, side * -0.35],
        }));
        parts.push(spike('sonicEarInner', PALETTE.skin, 0.042, 0.1, {
            pos: [side * 0.168, 0.265, -0.01],
            rot: [-0.18, 0, side * -0.35],
        }));
    }

    return parts;
}

function buildTorso(): Object3D[] {
    return [
        orb('sonicSkin', PALETTE.sonicBlue, 0.21, {
            pos: [0, 0.02, 0],
            scale: [1, 1.08, 0.9],
        }),
        // tan belly patch
        orb('sonicBelly', PALETTE.skin, 0.15, {
            pos: [0, -0.02, 0.09],
            scale: [1, 1.1, 0.62],
        }),
        // stub tail, swept back-down
        spike('sonicQuill', PALETTE.sonicBlue, 0.06, 0.16, {
            pos: [0, -0.16, -0.16],
            rot: [sweptBack(65 * DEG), 0, 0],
        }),
    ];
}

function buildArm(): Object3D[] {
    return [
        limb('sonicArm', PALETTE.sonicBlue, 0.048, 0.042, 0.24, { pos: [0, -0.12, 0] }),
        drum('sonicCuff', PALETTE.glove, 0.062, 0.05, { pos: [0, -0.225, 0] }),
        orb('sonicGlove', PALETTE.glove, 0.095, { pos: [0, -0.27, 0] }),
    ];
}

function buildLeg(): Object3D[] {
    return [
        limb('sonicLeg', PALETTE.sonicBlue, 0.052, 0.046, 0.22, { pos: [0, -0.11, 0] }),
    ];
}

function buildFoot(): Object3D[] {
    return [
        // shoe body, toe and heel — long and rounded, the classic silhouette
        slab('sonicShoe', PALETTE.shoeRed, 0.17, 0.13, 0.3, { pos: [0, -0.05, 0.05] }),
        orb('sonicShoe', PALETTE.shoeRed, 0.1, {
            pos: [0, -0.045, 0.21],
            scale: [0.95, 0.85, 1.05],
        }),
        orb('sonicShoe', PALETTE.shoeRed, 0.075, { pos: [0, -0.05, -0.07] }),
        // white strap across the instep
        slab('sonicStrap', PALETTE.shoeStripe, 0.185, 0.05, 0.1, { pos: [0, -0.02, 0.07] }),
        // buff sole running the full length
        slab('sonicSole', 0xe8d8b0, 0.18, 0.05, 0.38, { pos: [0, -0.12, 0.07] }),
        // sock cuff
        drum('sonicSock', PALETTE.glove, 0.075, 0.06, { pos: [0, 0.02, 0] }),
    ];
}

/** The spin/buzzsaw form: a bladed ball. */
function buildBall(): Object3D[] {
    const parts: Object3D[] = [];

    const core = new Mesh(
        new SphereGeometry(0.34, 14, 12),
        solidColor('sonicBall', PALETTE.sonicBlueDark),
    );
    core.castShadow = true;
    parts.push(core);

    // saw teeth around the XY plane — this is what reads as the "buzzsaw"
    for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const tooth = new Mesh(
            new ConeGeometry(0.075, 0.19, 4),
            solidColor('sonicSaw', PALETTE.sonicBlue),
        );
        tooth.position.set(Math.cos(angle) * 0.36, Math.sin(angle) * 0.36, 0);
        tooth.rotation.z = angle - Math.PI / 2;
        tooth.castShadow = true;
        parts.push(tooth);
    }

    // motion-blur disc
    const blur = new Mesh(
        new CylinderGeometry(0.42, 0.42, 0.02, 20),
        glow('sawBlur', tint(PALETTE.sonicBlue, 0.4), 0.28),
    );
    blur.rotation.x = Math.PI / 2;
    parts.push(blur);

    return parts;
}

export function createSonicRig(): Rig {
    const rig = new Rig(BONES);

    rig.attach('torso', ...buildTorso());
    rig.attach('head', ...buildHead());
    rig.attach('armL', ...buildArm());
    rig.attach('armR', ...buildArm());
    rig.attach('legL', ...buildLeg());
    rig.attach('legR', ...buildLeg());
    rig.attach('footL', ...buildFoot());
    rig.attach('footR', ...buildFoot());
    rig.attach('ball', ...buildBall());

    rig.setBallMode(false);
    return rig;
}
