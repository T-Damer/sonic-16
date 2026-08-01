# SONIC-16

A fan-made reconstruction of the unreleased **"Sonic 16" / Genesis PM Concept** prototype.

The world is modelled and lit in **real 3D** (three.js), but the camera is **locked to a fixed
near-isometric angle** and gameplay is constrained to a 2D plane — reproducing the
pre-rendered "diorama" look of the original concept footage with the responsive feel of a
16-bit platformer.

> **Legal note.** Sonic the Hedgehog, Sally Acorn, SWATbots, Badniks, rings and all related
> marks are **owned by SEGA**. This is a non-commercial, local, fan-made technical study.
> **No SEGA assets are used or redistributed** — every mesh, texture and animation in this
> repository is generated procedurally from code at runtime.

---

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:8080>.

```bash
npm run build
```

Output lands in `dist/` and is fully static.

---

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | `←` `→` / `A` `D` | Left stick / D-pad |
| Look up / Crouch | `↑` `↓` / `W` `S` | Left stick |
| Jump | `Space` / `K` | A |
| Throw ring | `J` / `F` | X |
| **Buzzsaw** | hold `↓` + `Space`, then release | hold Down + A |
| **Spike blast** | `↓` in mid-air | Down in mid-air |
| **Corner peek** | hold `Q` at an edge | LB |
| Ledge grab | automatic while falling | — |
| Climb up / drop | `↑` / `↓` while hanging | — |
| Ride a skiff | jump into its grab bar | — |
| Pause | `Esc` / `P` | Start |

---

## What's implemented

**Mechanics** — ledge grab + climb, corner peek (with camera push-ahead), edge teeter,
tightrope balance on thin pipes, ring collect, ring throw, buzzsaw charge-dash, spike-blast
ground pound, skiff riding, stomping, one-way platforms, coyote time, jump buffering,
variable jump height.

**Enemies**
- **Spyphid** — flying camera badnik. Hovers, sweeps a scan cone, flashes its lens as a tell,
  then dives. Killed by ring throw, buzzsaw, blast shockwave or a stomp.
- **Slipstream Skiff** — flat hover-craft on a patrol path with a grab bar underneath. Ride it
  across the wide pit, or destroy it (2 HP).
- **SWATbot** — armoured biped. Patrols, spots you, charges three orbs up its cannon, fires.
  **Front-armoured**: ring throws deflect off the chest plate, so go over it or through it.

**Hazards** — bottomless pits (respawn at the last checkpoint), spike columns that only a
buzzsaw or spike blast can break.

**Collectibles** — rings (health + ammo + score) and ring monitors (+10).

**Health** — rings are your health. A hit costs 40 % of your current rings (min 5, max 20),
scattered as re-collectable bouncing rings, plus 1.2 s of invulnerability. A hit at zero
rings kills you.

**Level 1 — "Sludge Refinery"** reproduces the ten beats of the reference footage end to end,
from the sewer climb-out to the blast-door rendezvous with the ally.

---

## Architecture

| Layer | Tech |
|---|---|
| Shell | SolidJS + Vite |
| Framework | Phaser 3.90 — scenes, input, 2D menus/HUD |
| 3D renderer | three.js 0.170 — meshes, lights, shadow maps, ortho camera |
| Simulation | **custom ECS** (`src/game/core/ecs`) |
| Physics | **custom kinematic AABB** — a rigid-body solver would ruin the feel |

Two stacked canvases: three.js renders the world at `z-index: 0`, Phaser runs transparent at
`z-index: 1` for menus, HUD and fades.

The ECS runs a **fixed 60 Hz** pipeline of 18 systems; `dt` is scaled by
`GAME_SPEED = 1.25` so the whole simulation runs 25 % faster than classic pacing, from a
single knob in `src/game/config/GameConfig.ts`.

```
src/game/
  config/      GameConfig (every tunable), Controls
  core/        ecs/, CollisionWorld, InputState, Signal, MathUtils
  components/  the full component catalogue
  systems/     18 systems, run in dependency order
  render/      Renderer3D, IsoCamera, Materials, Meshes, TextureFactory
    rig/       Rig, Clips (16 keyframe clips), AnimationPlayer, character rigs
    fx/        pooled particles
  world/       LevelSchema, LevelBuilder, Factories, levels/Level01
  ui/          ManiaTheme — the vector-drawn menu language
  scenes/      Boot, Menu, Controls, Game, Hud, Pause
```

Full detail in **[docs/DESIGN.md](docs/DESIGN.md)** and **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Tuning it

Almost everything worth changing lives in `src/game/config/GameConfig.ts`:

- `GAME_SPEED` — global pace multiplier (currently `1.25`)
- `PHYSICS` — acceleration, friction, jump, buzzsaw, spike blast
- `PLAYER` — collider size, ledge-grab window, ring economy, throw arc
- `CAMERA` — **`yaw` / `pitch` set the locked isometric angle**, plus follow and look-ahead
- `COMBAT` — enemy ranges, tells, cooldowns

Levels are plain data (`src/game/world/levels/Level01.ts`) against the schema in
`LevelSchema.ts`, so an editor or an exporter for another engine can target the same format.

---

## Art pipeline

There is no art pipeline yet — deliberately, at this stage:

- **Textures** are drawn into `<canvas>` at boot (`render/TextureFactory.ts`): brick, plating,
  gravel, grate, monitor screen, blob shadow, sparks.
- **Characters** are assembled from three.js primitives (`render/rig/*Rig.ts`) onto a named
  bone hierarchy.
- **Animation** is 16 hand-authored keyframe clips (`render/rig/Clips.ts`) with cross-fading
  and one-shot overlays.

To swap in real models later, keep the bone names (`hips`, `torso`, `head`, `armL/R`,
`legL/R`, `footL/R`, `ball`) and the existing clip set will drive them unchanged.

---

## Known gaps

- No audio yet.
- Only Act 1 exists.
- Options and Extras menu entries are stubs.
- Enemy variety is the three types from the reference footage.
