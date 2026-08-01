import {
    BoxGeometry,
    CapsuleGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    Mesh,
    SphereGeometry,
} from 'three';
import { solidColor } from '@/game/render/Materials';

/**
 * ModelKit — the shared vocabulary every character/prop model is built from.
 *
 * This is the code half of docs/ART_PIPELINE.md: rigs compose these primitives with
 * palette-ramp colours instead of ad-hoc meshes and hex values, which is what keeps
 * the cast looking like one game. If a model needs a shape the kit doesn't have,
 * add it HERE so the next model gets it for free.
 */

// ─────────────────────────────────────────────────────────── palette ramps

/** Darken a palette colour by `k` (0..1). Use for undersides and back faces. */
export function shade(color: number, k: number): number {
    return new Color(color).multiplyScalar(1 - k).getHex();
}

/** Lighten a palette colour toward white by `k` (0..1). Use for highlights. */
export function tint(color: number, k: number): number {
    const c = new Color(color);
    c.lerp(new Color(0xffffff), k);
    return c.getHex();
}

// ───────────────────────────────────────────────────────────── primitives

export interface PartOpts {
    pos?: [number, number, number];
    rot?: [number, number, number];
    scale?: [number, number, number];
    cast?: boolean;
}

function finish(mesh: Mesh, opts: PartOpts = {}): Mesh {
    if (opts.pos) mesh.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
    if (opts.rot) mesh.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
    if (opts.scale) mesh.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
    mesh.castShadow = opts.cast ?? true;
    return mesh;
}

/** Sphere. The workhorse for heads, torsos, joints and muzzles. */
export const orb = (key: string, color: number, r: number, opts?: PartOpts): Mesh =>
    finish(new Mesh(new SphereGeometry(r, 14, 12), solidColor(key, color)), opts);

/** Capsule along Y — clean limbs without visible cylinder seams. */
export const pill = (key: string, color: number, r: number, len: number, opts?: PartOpts): Mesh =>
    finish(new Mesh(new CapsuleGeometry(r, len, 3, 10), solidColor(key, color)), opts);

/** Tapered cylinder along Y — limbs that thin toward the extremity. */
export const limb = (
    key: string, color: number, rTop: number, rBottom: number, len: number, opts?: PartOpts,
): Mesh =>
    finish(new Mesh(new CylinderGeometry(rTop, rBottom, len, 10), solidColor(key, color)), opts);

/** Cone along +Y — quills, ears, barbs, tails. */
export const spike = (key: string, color: number, r: number, len: number, opts?: PartOpts): Mesh =>
    finish(new Mesh(new ConeGeometry(r, len, 7), solidColor(key, color)), opts);

/** Box — armour plates, shoes, machinery. */
export const slab = (
    key: string, color: number, w: number, h: number, d: number, opts?: PartOpts,
): Mesh =>
    finish(new Mesh(new BoxGeometry(w, h, d), solidColor(key, color)), opts);

/** Untapered cylinder along Y — cuffs, sockets, drums. */
export const drum = (key: string, color: number, r: number, len: number, opts?: PartOpts): Mesh =>
    finish(new Mesh(new CylinderGeometry(r, r, len, 12), solidColor(key, color)), opts);

// ──────────────────────────────────────────────────────────── orientation

/**
 * Rotation.x that points a +Y cone BACKWARD (−Z) and down by `tiltRad`.
 *
 * Characters face +Z, so quills/tails must sweep toward −Z. (An earlier Sonic
 * had `+π/2 + tilt` here, which pointed every quill forward at the camera —
 * if a cone looks wrong, check its sweep against this helper first.)
 */
export const sweptBack = (tiltRad: number): number => -(Math.PI / 2 + tiltRad);

/** Rotation.x that points a +Y cone FORWARD (+Z) and down by `tiltRad`. */
export const sweptForward = (tiltRad: number): number => Math.PI / 2 + tiltRad;
