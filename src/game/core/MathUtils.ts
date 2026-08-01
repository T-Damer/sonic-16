export const clamp = (v: number, min: number, max: number): number =>
    v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Frame-rate independent exponential smoothing. */
export const damp = (a: number, b: number, rate: number, dt: number): number =>
    lerp(a, b, 1 - Math.exp(-rate * dt));

export const sign = (v: number): number => (v > 0 ? 1 : v < 0 ? -1 : 0);

export const approach = (current: number, target: number, delta: number): number => {
    if (current < target) return Math.min(current + delta, target);
    if (current > target) return Math.max(current - delta, target);
    return target;
};

export const DEG = Math.PI / 180;

export interface AABB {
    x: number; // centre
    y: number; // centre
    hw: number; // half width
    hh: number; // half height
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
    return (
        Math.abs(a.x - b.x) < a.hw + b.hw &&
        Math.abs(a.y - b.y) < a.hh + b.hh
    );
}

export function pointInAabb(px: number, py: number, b: AABB): boolean {
    return (
        px >= b.x - b.hw && px <= b.x + b.hw &&
        py >= b.y - b.hh && py <= b.y + b.hh
    );
}

export function circleAabbOverlap(cx: number, cy: number, r: number, b: AABB): boolean {
    const nx = clamp(cx, b.x - b.hw, b.x + b.hw);
    const ny = clamp(cy, b.y - b.hh, b.y + b.hh);
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
}

/** Deterministic-ish small random helpers (no seeding needed for cosmetics). */
export const randRange = (min: number, max: number): number => min + Math.random() * (max - min);
export const randSign = (): number => (Math.random() < 0.5 ? -1 : 1);
