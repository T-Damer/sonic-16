import { Collider, Solid, Transform } from '@/game/components';
import type { Entity, World } from '@/game/core/ecs';

export interface SolidBox {
    entity: Entity;
    /** Edges, precomputed — solids never move. */
    left: number;
    right: number;
    top: number;
    bottom: number;
    oneWay: boolean;
    thin: boolean;
    kind: 'slab' | 'pipe' | 'wall' | 'ledge';
}

export interface SweepResult {
    /** Resolved position along the swept axis. */
    position: number;
    hit: boolean;
    /** The solid we landed on / bumped into. */
    entity: Entity;
    solid: SolidBox | null;
}

/**
 * Static collision broadphase.
 *
 * Level geometry never moves, so the boxes are built once and bucketed into fixed-width
 * columns along X. That turns every query into a scan of two or three small buckets.
 */
export class CollisionWorld {
    private readonly boxes: SolidBox[] = [];
    private readonly buckets = new Map<number, SolidBox[]>();
    private readonly bucketWidth = 8;
    private builtVersion = -1;

    constructor(private readonly world: World) {}

    /** Rebuild from the ECS if the world changed structurally. */
    rebuild(force = false): void {
        if (!force && this.builtVersion === this.world.structuralVersion) return;
        this.builtVersion = this.world.structuralVersion;
        this.boxes.length = 0;
        this.buckets.clear();

        for (const [entity, solid] of this.world.each(Solid)) {
            const transform = this.world.get(entity, Transform);
            const collider = this.world.get(entity, Collider);
            if (!transform || !collider) continue;

            const box: SolidBox = {
                entity,
                left: transform.x + collider.ox - collider.hw,
                right: transform.x + collider.ox + collider.hw,
                bottom: transform.y + collider.oy - collider.hh,
                top: transform.y + collider.oy + collider.hh,
                oneWay: solid.oneWay,
                thin: solid.thin,
                kind: solid.kind,
            };
            this.boxes.push(box);

            const first = Math.floor(box.left / this.bucketWidth);
            const last = Math.floor(box.right / this.bucketWidth);
            for (let b = first; b <= last; b++) {
                const bucket = this.buckets.get(b);
                if (bucket) bucket.push(box);
                else this.buckets.set(b, [box]);
            }
        }
    }

    /** Candidate solids overlapping the X span. */
    private candidates(minX: number, maxX: number): SolidBox[] {
        const first = Math.floor(minX / this.bucketWidth);
        const last = Math.floor(maxX / this.bucketWidth);
        if (first === last) return this.buckets.get(first) ?? [];

        const out: SolidBox[] = [];
        for (let b = first; b <= last; b++) {
            const bucket = this.buckets.get(b);
            if (!bucket) continue;
            for (const box of bucket) {
                if (!out.includes(box)) out.push(box);
            }
        }
        return out;
    }

    /**
     * Resolve horizontal motion. One-way platforms are ignored on this axis so the
     * player never clips against the side of a pipe.
     */
    sweepX(
        cx: number, cy: number, hw: number, hh: number, dx: number,
    ): SweepResult {
        const target = cx + dx;
        if (dx === 0) return { position: cx, hit: false, entity: -1, solid: null };

        const minX = Math.min(cx, target) - hw;
        const maxX = Math.max(cx, target) + hw;
        let resolved = target;
        let hitBox: SolidBox | null = null;

        for (const box of this.candidates(minX, maxX)) {
            if (box.oneWay) continue;
            // vertical overlap required (with a small epsilon so resting on a floor
            // doesn't count as a side collision)
            if (cy + hh <= box.bottom + 0.001 || cy - hh >= box.top - 0.001) continue;

            if (dx > 0 && cx + hw <= box.left + 0.001 && resolved + hw > box.left) {
                resolved = box.left - hw;
                hitBox = box;
            } else if (dx < 0 && cx - hw >= box.right - 0.001 && resolved - hw < box.right) {
                resolved = box.right + hw;
                hitBox = box;
            }
        }

        return { position: resolved, hit: hitBox !== null, entity: hitBox?.entity ?? -1, solid: hitBox };
    }

    /**
     * Resolve vertical motion.
     * @param dropThrough  ignore one-way platforms entirely (crouch + jump to drop)
     */
    sweepY(
        cx: number, cy: number, hw: number, hh: number, dy: number, dropThrough = false,
    ): SweepResult {
        const target = cy + dy;
        if (dy === 0) return { position: cy, hit: false, entity: -1, solid: null };

        let resolved = target;
        let hitBox: SolidBox | null = null;

        for (const box of this.candidates(cx - hw, cx + hw)) {
            if (box.oneWay && (dropThrough || dy > 0)) continue;
            if (cx + hw <= box.left + 0.001 || cx - hw >= box.right - 0.001) continue;

            if (dy < 0) {
                // falling — land on top
                if (cy - hh >= box.top - 0.02 && resolved - hh < box.top) {
                    resolved = box.top + hh;
                    hitBox = box;
                }
            } else if (!box.oneWay) {
                // rising — bonk the underside
                if (cy + hh <= box.bottom + 0.001 && resolved + hh > box.bottom) {
                    resolved = box.bottom - hh;
                    hitBox = box;
                }
            }
        }

        return { position: resolved, hit: hitBox !== null, entity: hitBox?.entity ?? -1, solid: hitBox };
    }

    /** The solid directly under a point, within `maxDistance`. */
    groundBelow(cx: number, cy: number, hw: number, maxDistance: number): SolidBox | null {
        let best: SolidBox | null = null;
        for (const box of this.candidates(cx - hw, cx + hw)) {
            if (cx + hw <= box.left + 0.001 || cx - hw >= box.right - 0.001) continue;
            if (box.top > cy + 0.02) continue;
            if (cy - box.top > maxDistance) continue;
            if (!best || box.top > best.top) best = box;
        }
        return best;
    }

    /** Is an AABB overlapping any solid? Used to check ledge-climb clearance. */
    overlapsSolid(cx: number, cy: number, hw: number, hh: number, includeOneWay = false): boolean {
        for (const box of this.candidates(cx - hw, cx + hw)) {
            if (box.oneWay && !includeOneWay) continue;
            if (
                cx + hw > box.left && cx - hw < box.right &&
                cy + hh > box.bottom && cy - hh < box.top
            ) return true;
        }
        return false;
    }

    /**
     * Find a grabbable ledge lip near a falling actor.
     *
     * @param dir  facing direction; we only grab ledges we're moving toward
     * @returns the lip's corner, or null
     */
    findLedge(
        cx: number, cy: number, hw: number, hh: number, dir: number,
        reachX: number, windowY: number,
    ): { x: number; y: number; box: SolidBox } | null {
        // The hands are at the top of the collider, offset in the facing direction.
        const handY = cy + hh;
        const probeX = cx + dir * (hw + reachX);

        let best: { x: number; y: number; box: SolidBox } | null = null;
        for (const box of this.candidates(Math.min(cx, probeX) - hw, Math.max(cx, probeX) + hw)) {
            if (box.oneWay || box.thin) continue;

            // the lip we'd grab is the corner on the side we're approaching from
            const lipX = dir > 0 ? box.left : box.right;

            // must be ahead of us and within reach
            const distance = (lipX - cx) * dir;
            if (distance < 0 || distance > hw + reachX) continue;

            // hands must be level with the top face
            if (Math.abs(handY - box.top) > windowY) continue;

            // there must be room to hang: nothing occupying the space above the lip
            const standX = lipX + dir * (hw + 0.02);
            if (this.overlapsSolid(standX, box.top + hh + 0.05, hw * 0.9, hh * 0.9)) continue;

            if (!best || box.top > best.y) best = { x: lipX, y: box.top, box };
        }
        return best;
    }

    /** All solids, for debug rendering. */
    get allBoxes(): readonly SolidBox[] {
        return this.boxes;
    }
}
