# Sonic 16: migration to Godot 4

## Decision

Use Godot 4.7.1 with GDScript as the primary game project. Keep the earlier Phaser/Three/Solid implementation as a reference until the Godot vertical slice is accepted.

The migration removes the custom engine layer that previously owned basic responsibilities already implemented by Godot: input event lifetime, collision resolution, moving-platform integration, rendering, lighting and scene composition.

## What is replaced

| Existing TypeScript layer | Godot replacement |
| --- | --- |
| Custom ECS and 18-system pipeline | Scene tree, nodes, groups, signals and focused scripts |
| Custom 2D AABB broadphase/sweeps | `CharacterBody3D`, `StaticBody3D`, `AnimatableBody3D`, physics layers |
| Custom DOM/Gamepad snapshot | `InputMap` and `Input` |
| Three.js renderer and shadow-frustum management | Compatibility renderer, native lights, shadows and `WorldEnvironment` |
| Hand-written primitive rig animation runtime | Articulated prototype rig now; `AnimationPlayer`/`AnimationTree` for imported production rigs |
| Plain two-dimensional level schema | Authored scenes and a future modular `GridMap`/`MeshLibrary` |
| Phaser HUD canvas | `CanvasLayer` and `Control` nodes |
| Custom moving-platform carry logic | `AnimatableBody3D` platform velocity integration |

## Reference-driven change of direction

The first Godot spike used a steep generic isometric camera and read more like a modern diorama. The surviving Sonic-16 pitch footage instead shows a low-oblique 2.5D corridor: the game remains a side-scroller, but the floor is wide enough for foreground/background movement.

The current pass therefore uses:

- a much lower orthographic camera pitch and only a slight yaw;
- a 320×200 internal viewport;
- a constrained X/Z movement lane;
- slower acceleration, shorter jumps and more deliberate platforming;
- large articulated 3D silhouettes rather than tiny sprites;
- enclosed Robotropolis machinery rather than an exterior skyline;
- banded lighting, palette quantization and dithering to make real-time 3D resemble authored 16-bit artwork.

## Gameplay parity targets now implemented

- Ring Attack that consumes ring ammunition.
- Buzzsaw as a short airborne damaging dash.
- Spike Blast as a radial airborne projectile burst.
- Foreground/background lane movement.
- Holding against the back wall to reduce detection and peek around a corner.
- Automatic ledge grab, climb and drop.
- Surveillance camera enemies with line-of-sight fire.
- Armoured SWATbots whose front plate deflects ordinary ring shots.
- A Buzzsaw/Spike-Blast breakable barricade.
- Moving skiff platform, checkpoints, arena and rendezvous door.

## Asset policy

- Do not ship ripped SEGA models, sprites, backgrounds, animation clips or audio.
- Keep prototype assets original and replaceable.
- Prefer CC0 modular environment packs and retain their license/readme files.
- Import GLTF directly into Godot and keep transitions in `AnimationTree`; do not recreate another animation runtime.
- Keep gameplay collision in dedicated nodes so decorative assets can be swapped without changing mechanics.

## Next porting order

1. Replace the runtime-built corridor pieces with a selected CC0 industrial GLTF kit and a `MeshLibrary` while preserving current metrics and collision.
2. Replace the articulated prototype hero with a clean rigged model and authored idle/run/jump/hide/hang/Buzzsaw/Spike-Blast clips.
3. Add the skiff grab-bar attachment rather than only riding its upper platform.
4. Expand camera and SWATbot tells, hit reactions and effects.
5. Add a short Sally rendezvous sequence driven by `AnimationPlayer`.
6. Add original audio, impact effects and Web-export size optimization.
