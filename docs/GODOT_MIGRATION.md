# Sonic 16: migration to Godot 4

## Decision

Use Godot 4.7.1 with GDScript as the primary game project. Keep the existing Phaser/Three/Solid implementation temporarily as a reference until the Godot vertical slice is accepted.

This is not a renderer swap. It removes the custom engine layer that currently owns basic responsibilities already implemented and tested by a game engine.

## What is replaced

| Existing TypeScript layer | Godot replacement |
| --- | --- |
| Custom ECS and 18-system pipeline | Scene tree, nodes, groups, signals and small component scripts |
| Custom 2D AABB broadphase/sweeps | `CharacterBody3D`, `StaticBody3D`, `AnimatableBody3D`, physics layers |
| Custom DOM/Gamepad input snapshot | `InputMap` and `Input` |
| Three.js renderer and shadow-frustum management | Godot Compatibility renderer, lights, shadows and `WorldEnvironment` |
| Procedural primitive rigs | `AnimatedSprite3D` now; imported GLTF rigs later |
| Hand-written keyframe player | `AnimationPlayer` and `AnimationTree` |
| Plain 2D level schema | Authored scenes and, after importing a modular kit, `GridMap`/`MeshLibrary` |
| Phaser HUD canvas | `CanvasLayer` and `Control` nodes |
| Custom moving-platform carry logic | `AnimatableBody3D` platform velocity integration |

## Why not another browser-first JavaScript engine

Babylon.js and PlayCanvas would improve rendering and asset import, but the project would still need to own the character controller, gameplay state composition, collision conventions, animation state integration and editor workflow. Godot removes more of the handwritten foundation while still exporting to WebAssembly/WebGL 2.

GDScript is intentional: Godot 4 C# projects do not currently export to the web. The Compatibility renderer and a non-threaded web preset provide the least demanding deployment path.

## Prototype acceptance criteria

Before porting combat or cutscenes, approve these items in `godot/`:

1. Movement reads correctly in screen space and supports useful depth movement.
2. Jump is deterministic on keyboard and gamepad, including coyote time and buffering.
3. The camera angle resembles the reference without hiding platform edges.
4. Native collision feels stable on ramps, obstacles and the moving skiff.
5. The lighting and Robotropolis silhouette give enough depth at the low internal resolution.
6. Pixel characters are readable at gameplay scale.

## Asset policy

- Do not ship ripped SEGA models, animation clips, backgrounds or sprites.
- Prefer CC0 modular environment packs and retain their license/readme files.
- For the hero and ally, use original fan-made pixel art during prototyping.
- Move to 3D only when a model has clean topology, a reusable skeleton and authored idle/run/jump/fall clips.
- Import GLTF directly into Godot and keep animation transitions in `AnimationTree`; do not recreate a second animation runtime.

## Next porting order

1. Replace runtime blockout helpers with a GridMap and a selected CC0 industrial kit.
2. Add a camera-drone enemy as a small scene with `Area3D` detection and `AnimationPlayer` tells.
3. Add Ring Attack as a reusable projectile scene.
4. Add Buzzsaw and Spike Blast as states in the player controller.
5. Recreate the skiff grab/ride interaction using joints or a dedicated attachment point.
6. Build the blast-door rendezvous with `AnimationPlayer` and a short cutscene state.
7. Add audio and web export automation.
