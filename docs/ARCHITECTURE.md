# SONIC-16 — Architecture

## Stack

| Layer | Tech | Why |
|---|---|---|
| Shell | **SolidJS + Vite** | already in the template; just mounts the canvas host |
| Game framework | **Phaser 3.90** | scene stack, input, audio, and a very good 2D UI/HUD layer |
| 3D renderer | **three.js 0.170** | the actual world: meshes, lights, shadow maps, ortho camera |
| Simulation | **custom ECS** (`src/game/core/ecs`) | data-oriented, no coupling between gameplay and rendering |
| Physics | **custom kinematic AABB** | Sonic feel is impossible with a generic rigid-body solver |

### Two canvases, one game

`#game-container` stacks two absolutely-positioned canvases:

```
 z-index 1   Phaser canvas   (transparent) — menu, HUD, pause, prompts, fades
 z-index 0   three.js canvas               — the 3D world
```

`GameScene` owns the `Renderer3D`, appends its canvas behind Phaser's, and forwards Phaser's
`scale.resize` events. When the menu is up, the 3D canvas is hidden.

---

## ECS

A sparse-set ECS with bitmask signatures and cached queries.

```
core/ecs/
  Component.ts   defineComponent<T>(name, factory) → ComponentType<T>
  World.ts       entity lifecycle, component stores, query cache, deferred destroy
  Query.ts       signature-matched entity list, invalidated on structural change
  System.ts      abstract System { init(); update(dt) }  +  SystemPipeline
```

- **Entity** = `number` (index + generation packed is overkill here; plain id + alive flag).
- **Component store** = `Map<Entity, T>` per type — trivially debuggable, fast enough for
  the few hundred entities a level holds.
- **Signature** = `Uint32Array` bitset per entity. Queries hold `all` / `none` masks and a
  cached entity array, rebuilt lazily when `structuralVersion` changes.
- Destruction is **deferred** to the end of the frame so systems can iterate safely.

### Component catalogue (`components/index.ts`)

| Group | Components |
|---|---|
| Spatial | `Transform`, `Velocity`, `Collider`, `Grounded`, `Solid`, `OneWay`, `ThinSurface` |
| Player | `PlayerTag`, `PlayerState`, `Intent`, `RingPurse`, `Invulnerable`, `Respawn` |
| Combat | `Health`, `Hurtbox`, `Hitbox`, `Projectile`, `DamageOnTouch`, `Breakable` |
| Enemy | `EnemyTag`, `SpyphidAI`, `SkiffAI`, `SwatbotAI`, `PatrolPath`, `Rideable`, `Rider` |
| Pickups | `Ring`, `RingMonitor`, `Magnetic`, `ScatterRing` |
| Render | `MeshRef`, `RigRef`, `AnimState`, `BlobShadow`, `Billboard` |
| Flow | `Lifetime`, `Checkpoint`, `Trigger`, `SequenceActor`, `CameraTarget` |

### System pipeline (fixed 60 Hz, order matters)

```
 1  InputSystem          raw keys/pad → Intent
 2  SequenceSystem       scripted beats may override Intent (intro, ending)
 3  PlayerStateSystem    FSM: Intent + context → PlayerState (+ state entry effects)
 4  EnemyAISystem        Spyphid / Skiff / SWATbot brains → Velocity
 5  CarrySystem          riders inherit carrier velocity
 6  MovementSystem       integrate acceleration → velocity → position
 7  CollisionSystem      swept AABB vs solids, X then Y; sets Grounded / wall flags
 8  LedgeSystem          ledge-grab / teeter / tightrope / peek probes
 9  CombatSystem         hitbox↔hurtbox overlap, damage, knockback, i-frames
10  ProjectileSystem     rings & bolts: arc, bounce, expire
11  RingSystem           magnet, collect, scatter physics
12  HazardSystem         spikes, kill plane, respawn
13  LifetimeSystem       timed despawn
14  AnimationSystem      PlayerState/AI state → clip selection → rig pose
15  CameraSystem         follow, look-ahead, peek offset, shake
16  RenderSystem         Transform → three.js Object3D, blob shadows, culling
17  HudSystem            emits ring/timer/prompt changes over EventBus → Phaser HUD
```

Fixed timestep with accumulator, `dt` scaled by `GAME_SPEED` (1.25). Max 5 catch-up steps.

---

## Rendering

```
render/
  Renderer3D.ts     WebGLRenderer, scene graph, lights, shadow map, resize, fog
  IsoCamera.ts      OrthographicCamera locked to yaw/pitch, follow + peek + shake
  Materials.ts      shared material cache (toon-ish MeshLambert/Standard)
  TextureFactory.ts CanvasTexture generators: brick, plating, grate, noise, screen
  Meshes.ts         prop factories: slab, pipe, wall, cooler, spikes, ring, monitor, door
  fx/Particles.ts   pooled sparks, debris, shockwave rings, ring-burst
  fx/Shadows.ts     blob-shadow decal pool
  rig/
    Rig.ts             bone hierarchy (named Object3D), bind pose, pose application
    Clips.ts           keyframe clip DSL + all 16 clips
    AnimationPlayer.ts clip playback, cross-fade, one-shot → return
    SonicRig.ts        procedural Sonic (spheres/cones/boxes, no external assets)
    SallyRig.ts        procedural Sally Acorn
    EnemyRigs.ts       Spyphid, Skiff, SWATbot
```

**No external art.** Every texture is drawn into a `<canvas>` at boot; every character is
assembled from three.js primitives. This keeps the project offline-capable and free of
third-party sprite rips.

---

## Level data

`world/LevelSchema.ts` defines a plain-data level format; `world/levels/Level01.ts` is the
authored data; `world/LevelBuilder.ts` walks it and spawns ECS entities + meshes.

```ts
{
  name, bounds, killPlaneY, spawn, checkpoints,
  solids:   [{ x, y, w, h, kind: 'slab'|'pipe'|'wall', oneWay?, thin? }],
  props:    [{ kind: 'cooler'|'grate'|'door'|'panel', x, y, z, scale?, spin? }],
  rings:    [{ x, y }] | { line: {...} } | { arc: {...} },
  monitors: [{ x, y, kind: 'ring' }],
  spikes:   [{ x, y, columns }],
  enemies:  [{ kind: 'spyphid'|'skiff'|'swatbot', x, y, path? }],
  triggers: [{ x, y, w, h, event }]
}
```

Because it's data, a level editor or a Godot exporter can target the same schema later.

---

## Scenes (Phaser)

| Scene | Role |
|---|---|
| `BootScene` | builds procedural textures/fonts, then → Menu |
| `MenuScene` | Mania-style main menu (2D) |
| `OptionsScene` / `ControlsScene` | sub-menus |
| `GameScene` | owns `World` + `Renderer3D`, runs the pipeline |
| `HudScene` | rings / timer / prompts, listens on `EventBus` |
| `PauseScene` | overlay |

---

## Conventions

- World units: **1 unit ≈ 1 metre**; Sonic is 1.0u tall, ground slabs are 1.5u thick.
- +X right, +Y up, +Z toward camera. Gameplay plane `z = 0`.
- All tunables live in `config/GameConfig.ts` — nothing magic inside systems.
- Systems never touch three.js directly except `RenderSystem` and `CameraSystem`.
