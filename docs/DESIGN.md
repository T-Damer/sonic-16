# SONIC-16 — Game Design Document

> A fan reconstruction of the unreleased **"Sonic 16" / Genesis PM Concept** prototype.
> Sonic the Hedgehog, Sally Acorn, SWATbots, Badniks, rings, and all related marks are
> **owned by SEGA**. This is a non-commercial, local, fan-made technical study. No original
> SEGA assets are shipped — every mesh, texture and animation in this repo is generated
> procedurally at runtime from code.

---

## 1. The Pitch

A **2.5D cinematic platformer**: the world is modelled and lit in *real 3D*, but the camera is
**locked to a fixed near-isometric angle** and gameplay is constrained to a 2D plane. The result
is the pre-rendered "Donkey Kong Country meets Sonic" look of the original concept video —
chunky rendered characters, deep parallax machinery, visible platform tops — with the responsive
feel of a classic Mega Drive platformer.

The tone is *Sonic SatAM*: an industrial sewer/refinery under Robotnik's control, Sonic sneaking
in from below, ending with a rendezvous with Sally Acorn.

---

## 2. Camera & Presentation

| Property | Value |
|---|---|
| Projection | **Orthographic** (no perspective distortion — reads as pre-rendered) |
| Yaw | `+18°` (camera on the +X side — we see the right-hand faces of decks and props) |
| Pitch | `22°` above horizon (platform *tops* are clearly visible, as in the reference frames) |
| Roll | locked to 0 |
| View height | 13.5 world units, letterboxed to viewport aspect |
| Follow | horizontal deadzone + velocity look-ahead, vertical snap-on-ground / lerp-in-air |
| Peek offset | corner-peek pushes the camera up to 4.5u past the corner |

Gameplay lives on the plane `z = 0`. Depth is used purely for looks:

```
z = +2.0   foreground rail / pipe (drawn over the player)
z =  0.0   ← GAMEPLAY PLANE (all collision, all actors)
z = -1.5   platform bodies, spikes, monitors
z = -6.0   wall face (green brick)
z = -9.0   coolers / fans / vent machinery  ← animated
z = -14.0  deep backdrop panels + haze
```

Lighting: one key directional light (shadow-mapped, warm), one cool fill, one rim.
Every actor also gets a cheap **blob shadow** decal so ground contact reads at all times.

---

## 3. Physics & Feel

Custom kinematic controller — **not** a rigid-body engine. Sonic physics depend on precise
control over acceleration curves, and a generic solver destroys that feel.

All constants are authored at "classic" speed then multiplied by **`GAME_SPEED = 1.25`**
(the requested +25%). Time runs on a **fixed 60 Hz timestep** with an accumulator, so behaviour
is frame-rate independent.

| Constant | Base | @1.25× |
|---|---|---|
| Ground acceleration | 0.09 u/f² | 0.113 |
| Friction (no input) | 0.055 | 0.069 |
| Skid deceleration | 0.30 | 0.375 |
| Top speed (walk→run) | 6.0 u/s | 7.5 |
| Buzzsaw dash speed | 11.0 u/s | 13.75 |
| Gravity | 26.0 u/s² | 32.5 |
| Jump impulse | 9.6 u/s | 12.0 |
| Jump release cut | ×0.45 | ×0.45 |
| Terminal fall | 18 u/s | 22.5 |

Quality-of-life: **coyote time** (5 frames), **jump buffering** (6 frames), **variable jump height**,
air-control that preserves momentum, and one-way (drop-through) pipe platforms.

Collision is **AABB in XY only** — every solid is treated as infinite in Z. Swept, axis-separated
(X resolved before Y) so the player never tunnels at buzzsaw speed.

---

## 4. Player Mechanics

### 4.1 Core
- **Run / walk / skid** — speed-driven blend, skid when reversing above threshold.
- **Jump** — variable height, cut on release.
- **Crouch / look up** — shifts the camera target.

### 4.2 Ledge Grab *(reference frame 6)*
While falling with downward velocity, if a solid's top corner is within the grab window
(±0.35u vertical, 0.55u horizontal) and the space above it is clear → **snap to hang**.
- `Up` / `Jump` → climb up (0.45 s scripted mount, collision disabled during)
- `Down` → release and drop
- Hanging is a hard state: gravity off, no horizontal control.

### 4.3 Corner Peek *(reference frame 4)*
When standing within 1.2u of a ledge edge or wall corner and holding **Peek** (`Q`) or
`Up`/`Down` while idle, Sonic leans past the corner and the camera slides ahead to reveal
what's coming. Purely a scouting tool — but it's how the level teaches you the Spyphid ambush.

### 4.4 Edge Teeter *(reference frame 5)*
Standing with the AABB centre beyond a platform lip → teeter animation, movement still allowed.

### 4.5 Tightrope / Thin Surface *(reference frame 7)*
Solids flagged `thin` (the exposed pipe rails) force a balance walk: top speed is capped to 45 %,
arms out, a wobble that increases the longer you stand still.

### 4.6 Ring Throw *(reference frame 3)*
Costs **1 ring**. Fires a spinning ring projectile on a shallow arc (gravity ×0.35), 1 damage,
bounces once off solids, despawns after 2.4 s or on hit. Aim biases up when holding `Up`.
This is the primary answer to flying enemies.

### 4.7 Buzzsaw *(spin attack)*
Hold `Down` + `Jump` to charge (visible rev, 0.25–1.0 s), release to launch a horizontal
**saw-blade dash**. Shreds enemies, **breaks spike columns**, and is the only way through
certain barriers. Costs no rings, but you're locked into the dash for its duration.

### 4.8 Spike Blast *(ground pound)*
Airborne + `Down` → slam. On impact: radial shockwave (2.6u) that **shatters spike clusters**,
stuns SWATbots for 1.2 s, and pops nearby rings loose.

### 4.9 Skiff Riding *(reference frame 10)*
Flying skiffs have a **grab bar** under the hull. Touch it while airborne → Sonic hangs from it
and inherits the skiff's motion along its patrol path. `Jump` releases with an added boost.
Used to cross the level's one un-jumpable pit.

---

## 5. Health — Rings

Rings are simultaneously **health, ammo and score**.

- Taking a hit at ≥1 ring: lose **40 % of current rings (min 5, max 20)**, scattered as bouncing
  physical rings that are re-collectable for 4 s. 1.2 s of invulnerability + blink.
- Taking a hit at 0 rings: **death** → respawn at the last checkpoint with 0 rings.
- Falling in a pit: instant death regardless of rings (rings are kept at 0 on respawn).
- Ring monitors give **+10**.

---

## 6. Enemies

### 6.1 Spyphid — flying camera badnik *(reference frame 3)*
A hovering ocular drone with four grabber tentacles and a scan-cone.
- **Idle**: bobs on a sine, sweeping its scan cone.
- **Alert**: player enters the cone → 0.4 s tell (lens flashes red), then
- **Dive**: lunges at the player's last position, then retreats to hover height.
- 1 HP. Killed by ring throw, buzzsaw, spike-blast shockwave or a jump-on-head.

### 6.2 Slipstream Skiff — rideable hover-craft *(reference frame 10)*
Flat magenta hull on a fixed patrol path (ping-pong or loop).
- Non-aggressive; it's a *vehicle* first, obstacle second.
- Underside **grab bar** = rideable. 2 HP if you'd rather destroy it (it drops and explodes).
- Passenger inherits full velocity — jumping off at the apex of its path is the intended route.

### 6.3 SWATbot — humanoid trooper *(reference frames 11–12)*
Robotnik's infantry. Grey armoured biped with an arm cannon.
- **Patrol**: walks its span, turns at edges/walls.
- **Spot**: sees the player within 9u in facing direction → stops, plants feet.
- **Charge**: three charge orbs travel up the cannon (0.75 s tell — exactly the reference frame).
- **Fire**: energy bolt, 1 damage, travels flat at 9 u/s.
- 2 HP. **Front-armoured**: ring throws bounce off the chest plate — you must jump over,
  buzzsaw through, or spike-blast to stun it first.

---

## 7. Obstacles & Hazards

| Hazard | Behaviour |
|---|---|
| **Bottomless pit** | Below `killPlaneY` → death → respawn at last checkpoint |
| **Spike column** *(frames 8–9)* | Contact = damage. 1 HP but **immune to normal contact** — only buzzsaw dash or spike-blast destroys it. Shatters into debris. |
| **Crusher / vent gust** | (stretch) periodic push volumes near the coolers |

## 8. Environment Props

- **Ground slabs** — yellow-ochre top, teal-green side plating, green pipe rail along the front edge.
- **Pipe platforms** — white/blue cylinders lying along X, **one-way** (jump up through them).
- **Walls** — green brick, procedurally textured, block movement.
- **Coolers / fans** — background machinery, 4-blade rotors on continuous spin (different speeds
  per unit so they never sync — this is what makes the backdrop feel alive).
- **Sewer grate** — the level-start prop Sonic climbs out of.
- **Blast door** — the level-end prop, two panels that part for the Sally sequence.

## 9. Collectibles

- **Ring** — spinning torus, gold emissive, 1.1u magnet radius, +1.
- **Ring monitor** *(frame 3)* — box on a post with a green screen. Break by any attack or by
  landing on it → +10 rings, screen shatters, box collapses.

---

## 10. Level 1 — "Sludge Refinery"

Beat-for-beat reconstruction of the reference footage:

| # | Beat | Reference |
|---|---|---|
| 1 | **Sewer rise** — Sonic climbs out of a floor grate (scripted, 1.6 s), first rings ahead. | frame 2 |
| 2 | **Ring run** — flat ground, coolers spinning behind, a ring line and the first monitor. | frame 2 |
| 3 | **Corner peek** — a wall corner; the game hints `Q`. Peeking reveals the Spyphid. | frame 4 |
| 4 | **Spyphid ambush** — first ring-throw combat encounter. | frame 3 |
| 5 | **Edge & drop** — teeter on the lip, ledge-grab down onto a pipe. | frames 5, 6 |
| 6 | **Tightrope** — balance walk along the thin pipe rail over a pit. | frame 7 |
| 7 | **Spike wall** — a 3-column spike cluster; taught here that buzzsaw breaks them. | frames 8, 9 |
| 8 | **Skiff crossing** — ride a Slipstream Skiff over the wide pit. | frame 10 |
| 9 | **SWATbot standoff** — armoured trooper, charge-and-fire duel. | frames 11, 12 |
| 10 | **Sally rendezvous** — the blast door; Sally Acorn waits. On arrival the lights dim, the door parts, both walk into the dark hallway, fade out → **LEVEL COMPLETE**. | frames 13–15 |

Checkpoints at beats 1, 5, 8, 9.

---

## 11. Animation Set

All clips are **procedural keyframe poses** on a bone hierarchy (no sprite sheets, no GLTF).
Each is authored as rotation/position tracks with linear interpolation and configurable loop.

| Clip | Notes | Reference |
|---|---|---|
| `idle` | breathing, occasional foot-tap | — |
| `walk` | 0.62 s loop | — |
| `run` | 0.34 s loop, big arm swing, lean forward | — |
| `climbOut` | one-shot mount from the sewer grate | frame 2 |
| `peek` | lean forward, hand on corner | frame 4 |
| `teeter` | wobble on the ledge lip, arms windmilling | frame 5 |
| `ledgeHang` / `ledgeClimb` | hang pose + one-shot mount | frame 6 |
| `tightrope` | arms out, narrow stance, sway | frame 7 |
| `hurt` | knockback recoil, rings burst | frame 8 |
| `jump` / `fall` | tuck on rise, reach on descent | frame 9 |
| `spin` | ball form (used by buzzsaw + roll) | — |
| `throwRing` | 0.28 s overarm one-shot, blends over locomotion | frame 3 |
| `spikeBlast` | tuck → slam → recover | — |
| `hang` | skiff-riding hang pose | frame 10 |
| `victory` | level-end pose for the Sally scene | frame 13 |

---

## 12. Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | `←` `→` / `A` `D` | Left stick / D-pad |
| Look up / Crouch | `↑` `↓` / `W` `S` | Left stick |
| Jump | `Space` / `K` | A |
| Throw ring | `J` / `F` | X |
| Buzzsaw | hold `↓` + `Space`, release | hold Down + A |
| Spike blast | `↓` in mid-air | Down in mid-air |
| Corner peek | hold `Q` | LB |
| Pause | `Esc` / `P` | Start |

---

## 13. Menu

Sonic Mania styled, drawn entirely with Phaser 2D vector graphics over the 3D layer:
rotating concentric arc background in SEGA yellow, chevron banner with a rainbow underline,
a left preview panel with a starfield and the character line-up, and right-hand angled black
option bars that slide and highlight. `BACK` / `CONFIRM` button prompts pinned to the corners.

Entries: **START GAME · TIME ATTACK · OPTIONS · CONTROLS · EXTRAS**
