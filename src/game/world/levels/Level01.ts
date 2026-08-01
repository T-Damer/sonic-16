import type { LevelDef } from '@/game/world/LevelSchema';

/**
 * ZONE 1 — "SLUDGE REFINERY"
 *
 * Beat-for-beat reconstruction of the reference footage:
 *
 *  A  ENTRY DECK (top y = 0, x −5…21)
 *     Sewer grate climb-out → rings hovering over dark pit-holes → monitor →
 *     machine columns and wall fans behind.                       [frames 2–3]
 *  ⤷  corner peek off A's right edge reveals the Spyphid below.   [frame 4]
 *  B  MID DECK (top −3, x 21.5…38)
 *     Spyphid ambush — first ring-throw fight — second monitor.   [frame 3]
 *  ⤷  DESCENT SHAFT (x 38…40.5): teeter off B's edge, then down the green
 *     wall via two blue tray ledges (grab → drop → land).         [frames 5–7]
 *  C  LOW DECK (top −10, x 28…62)
 *     Squeeze RIGHT through the passage UNDER the descent wall, then the
 *     three-column spike wall — buzzsaw through.                  [frames 8–9]
 *  ⤷  WIDE PIT (x 62…70): catch the Slipstream Skiff's grab bar; it climbs
 *     as it flies right — jump off onto the arena.                [frame 10]
 *  D  ARENA (top −4, x 70…86)
 *     Two big wall fans flanking the blast door, SWATbot standoff, then the
 *     rendezvous: lights dim, door parts, both walk in.           [frames 11–15]
 */
export const LEVEL_01: LevelDef = {
    name: 'SLUDGE REFINERY',
    subtitle: 'ZONE 1 · ACT 1',

    spawn: { x: 1, y: 0.05 },
    bounds: { minX: -5, maxX: 86, minY: -18, maxY: 12 },
    killPlaneY: -15,

    // ───────────────────────────────────────────────────────────── collision
    solids: [
        // A — entry deck
        { x: 8, y: -0.9, w: 26, h: 1.8, kind: 'slab' },
        { x: -5, y: 2, w: 1.2, h: 8, kind: 'wall' },

        // B — mid deck, one storey down
        { x: 29.75, y: -3.9, w: 16.5, h: 1.8, kind: 'slab' },

        // descent wall: green brick, bottom at −8 so the passage under it works
        { x: 42.5, y: -2, w: 4, h: 12, kind: 'wall' },

        // the two blue tray ledges bolted to the wall's left face
        { x: 39.4, y: -5.2, w: 1.7, h: 0.28, kind: 'ledge' },
        { x: 39.6, y: -7.6, w: 1.7, h: 0.28, kind: 'ledge' },

        // C — low deck with the under-wall passage and the spike wall
        { x: 45, y: -10.9, w: 34, h: 1.8, kind: 'slab' },

        // D — arena deck across the pit
        { x: 78, y: -4.9, w: 16, h: 1.8, kind: 'slab' },
        { x: 86, y: -1, w: 1.2, h: 8, kind: 'wall' },
    ],

    // ───────────────────────────────────────────────────────── set dressing
    props: [
        // deep backdrop strips, following the decks down
        { kind: 'backdrop', x: 8, y: 3, size: 34, height: 28 },
        { kind: 'backdrop', x: 36, y: -1, size: 34, height: 28 },
        { kind: 'backdrop', x: 58, y: -6, size: 30, height: 26 },
        { kind: 'backdrop', x: 78, y: -1, size: 26, height: 26 },

        // the grate Sonic climbs out of
        { kind: 'grate', x: 1, y: 0, size: 1.9 },

        // dark pit-holes on the deck tops, rings hovering above them (frame 2)
        { kind: 'hole', x: 6, y: 0 },
        { kind: 'hole', x: 9, y: 0 },
        { kind: 'hole', x: 12, y: 0 },
        { kind: 'hole', x: 26, y: -3 },
        { kind: 'hole', x: 31.5, y: -3 },

        // handles on the descent wall face (frames 5–6)
        { kind: 'handle', x: 40.2, y: -4.3 },
        { kind: 'handle', x: 40.2, y: -6.7 },

        // background fans — different radii and speeds so they never sync
        { kind: 'cooler', x: 3, y: 3.1, size: 1.5, spin: 1.0 },
        { kind: 'cooler', x: 10, y: 2.7, size: 1.2, spin: -1.3 },
        { kind: 'cooler', x: 17, y: 3.3, size: 1.6, spin: 0.8 },
        { kind: 'cooler', x: 24, y: 0.3, size: 1.3, spin: 1.2 },
        { kind: 'cooler', x: 31, y: 0.5, size: 1.5, spin: -0.9 },
        // the big fan beside the descent shaft (frame 5)
        { kind: 'cooler', x: 37.5, y: -4.6, size: 1.8, spin: 1.05 },
        { kind: 'cooler', x: 33, y: -6.9, size: 1.4, spin: -1.15 },
        { kind: 'cooler', x: 49, y: -6.6, size: 1.5, spin: 0.9 },
        { kind: 'cooler', x: 56, y: -6.9, size: 1.3, spin: 1.3 },
        // the arena pair flanking the blast door (frames 11–15)
        { kind: 'cooler', x: 73, y: -0.8, size: 1.9, spin: 0.85, z: -4.2 },
        { kind: 'cooler', x: 83, y: -0.8, size: 1.9, spin: -1.0, z: -4.2 },

        // machinery columns with the blue-lit hatches (frames 2–3)
        { kind: 'machineColumn', x: 5, y: 1.5, size: 1.4, height: 4.8 },
        { kind: 'machineColumn', x: 13, y: 1.3, size: 1.3, height: 4.4 },
        { kind: 'machineColumn', x: 19, y: 1.1, size: 1.5, height: 5.0 },
        { kind: 'machineColumn', x: 28, y: -1.5, size: 1.4, height: 4.6 },
        { kind: 'machineColumn', x: 34, y: -1.3, size: 1.3, height: 4.2 },
        { kind: 'machineColumn', x: 52, y: -7.9, size: 1.5, height: 4.4 },
        { kind: 'machineColumn', x: 59, y: -8.1, size: 1.3, height: 4.0 },

        // the level-end blast door, centred between the arena fans
        { kind: 'blastDoor', x: 78, y: -4, size: 3.4, height: 4.4 },
    ],

    // ───────────────────────────────────────────────────────── collectibles
    rings: [
        // one ring floating over each entry-deck hole (frame 2)
        { x: 6, y: 0.62 },
        { x: 9, y: 0.62 },
        { x: 12, y: 0.62 },
        { type: 'line', x: 14.5, y: 0.55, count: 4, step: 0.8 },
        // B deck
        { type: 'arc', x: 26, y: -2.4, count: 5, radius: 1.6, span: 130, rotation: 90 },
        { type: 'line', x: 32.5, y: -2.45, count: 4, step: 0.8 },
        // one at each descent ledge
        { x: 39.4, y: -4.4 },
        { x: 39.6, y: -6.8 },
        // through the under-wall passage
        { type: 'line', x: 41, y: -9.4, count: 4, step: 0.85 },
        // past the spike wall
        { type: 'line', x: 49.5, y: -9.4, count: 5, step: 0.85 },
        { type: 'arc', x: 56, y: -9.6, count: 5, radius: 1.5, span: 120, rotation: 90 },
        // strung diagonally along the skiff's climb
        { type: 'line', x: 63.5, y: -5.6, count: 6, step: 1.0, dx: 1, dy: 0.5 },
        // arena
        { type: 'line', x: 72, y: -3.45, count: 4, step: 0.8 },
    ],

    monitors: [
        { x: 16, y: 0 },
        { x: 33, y: -3 },
        { x: 58, y: -10 },
        { x: 81.5, y: -4 },
    ],

    // ───────────────────────────────────────────────────────────── hazards
    spikes: [
        // the wall of three spike columns just past the passage (frames 8–9)
        { x: 47.6, y: -10, columns: 3, height: 1.9, spacing: 0.66 },
    ],

    // ───────────────────────────────────────────────────────────── enemies
    enemies: [
        // beat 4 — revealed by peeking off the entry deck's corner
        { kind: 'spyphid', x: 27, y: -1, facing: -1 },
        // a scout hovering over the wide pit
        { kind: 'spyphid', x: 58.5, y: -7.6, facing: -1 },
        // beat 8 — grab the bar and ride the climb across the pit
        {
            kind: 'skiff',
            x: 63.5,
            y: -7.0,
            speed: 2.6,
            path: [
                { x: 0, y: 0 },
                { x: 5.8, y: 3.2 },
            ],
        },
        // beat 9 — the standoff in front of the door
        { kind: 'swatbot', x: 72.5, y: -4, facing: -1, range: 1.8, speed: 1.5 },
    ],

    checkpoints: [
        { x: 1, y: 0 },
        { x: 23, y: -3 },
        { x: 45.5, y: -10 },
        { x: 71, y: -4 },
    ],

    // ───────────────────────────────────────────────────────────── scripting
    triggers: [
        { x: 19.5, y: 1.4, w: 3, h: 3, event: 'hint:peek' },
        { x: 24, y: -1.6, w: 3, h: 3.4, event: 'hint:throw' },
        { x: 42.5, y: -8.9, w: 3.5, h: 2, event: 'hint:buzzsaw' },
        { x: 60.5, y: -8.4, w: 2.5, h: 3.4, event: 'hint:skiff' },
        { x: 74.5, y: -2.6, w: 2.5, h: 4, event: 'ending' },
    ],

    ally: { x: 77.2, y: -4 },
};
