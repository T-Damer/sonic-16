/**
 * Plain-data level format.
 *
 * Keeping levels as data (rather than imperative spawn code) means an editor or an
 * exporter for another engine can target the same schema later.
 *
 * Coordinates: +X right, +Y up. Solids are given by their *centre* and half-extents
 * are derived from w/h, matching the AABB collider convention used by the physics.
 */

export type SolidKind = 'slab' | 'pipe' | 'wall' | 'ledge';

export interface SolidDef {
    /** Centre X. */
    x: number;
    /** Centre Y. */
    y: number;
    w: number;
    h: number;
    kind: SolidKind;
    /** Collides only from above (jump up through it). */
    oneWay?: boolean;
    /** Forces the balance-walk state when stood on. */
    thin?: boolean;
}

export type PropKind =
    | 'cooler'
    | 'machineColumn'
    | 'backdrop'
    | 'grate'
    | 'blastDoor'
    | 'hole'
    | 'handle';

export interface PropDef {
    kind: PropKind;
    x: number;
    y: number;
    /** Override the default layer depth. */
    z?: number;
    /** Radius for coolers, width for panels/doors. */
    size?: number;
    height?: number;
    /** Rotor speed multiplier (coolers). Randomised slightly so they never sync. */
    spin?: number;
}

export interface RingDef {
    x: number;
    y: number;
}

/** Convenience generators expanded by the builder. */
export interface RingLineDef {
    type: 'line';
    x: number;
    y: number;
    count: number;
    /** Spacing between rings. */
    step?: number;
    dx?: number;
    dy?: number;
}

export interface RingArcDef {
    type: 'arc';
    x: number;
    y: number;
    count: number;
    radius?: number;
    /** Arc span in degrees, centred on `rotation`. */
    span?: number;
    rotation?: number;
}

export type RingGroup = RingDef | RingLineDef | RingArcDef;

export interface MonitorDef {
    x: number;
    y: number;
    reward?: number;
}

export interface SpikeDef {
    x: number;
    y: number;
    /** Number of adjacent columns. */
    columns?: number;
    height?: number;
    spacing?: number;
}

export type EnemyKind = 'spyphid' | 'skiff' | 'swatbot';

export interface EnemyDef {
    kind: EnemyKind;
    x: number;
    y: number;
    /** Patrol waypoints (skiff, swatbot). Relative to x/y. */
    path?: { x: number; y: number }[];
    speed?: number;
    /** Initial facing. */
    facing?: 1 | -1;
    /** Patrol span for ground units when no explicit path is given. */
    range?: number;
}

export interface CheckpointDef {
    x: number;
    y: number;
}

export interface TriggerDef {
    x: number;
    y: number;
    w: number;
    h: number;
    /** Event name dispatched to the SequenceSystem. */
    event: string;
    once?: boolean;
}

export interface LevelDef {
    name: string;
    subtitle?: string;
    /** Player start. */
    spawn: { x: number; y: number };
    /** Level extents — the camera is clamped to these. */
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
    /** Below this Y the player dies. */
    killPlaneY: number;

    solids: SolidDef[];
    props: PropDef[];
    rings: RingGroup[];
    monitors: MonitorDef[];
    spikes: SpikeDef[];
    enemies: EnemyDef[];
    checkpoints: CheckpointDef[];
    triggers: TriggerDef[];

    /** Where the ally waits during the ending sequence. */
    ally?: { x: number; y: number };
}

/** Expand a ring group into individual ring positions. */
export function expandRings(group: RingGroup): RingDef[] {
    if (!('type' in group)) return [group];

    if (group.type === 'line') {
        const step = group.step ?? 0.75;
        const dx = group.dx ?? 1;
        const dy = group.dy ?? 0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (dx / len) * step;
        const ny = (dy / len) * step;
        const out: RingDef[] = [];
        for (let i = 0; i < group.count; i++) {
            out.push({ x: group.x + nx * i, y: group.y + ny * i });
        }
        return out;
    }

    // arc
    const radius = group.radius ?? 2;
    const span = ((group.span ?? 120) * Math.PI) / 180;
    const rotation = ((group.rotation ?? 90) * Math.PI) / 180;
    const out: RingDef[] = [];
    for (let i = 0; i < group.count; i++) {
        const t = group.count === 1 ? 0.5 : i / (group.count - 1);
        const angle = rotation - span / 2 + span * t;
        out.push({
            x: group.x + Math.cos(angle) * radius,
            y: group.y + Math.sin(angle) * radius,
        });
    }
    return out;
}
