# Godot migration prototype

This directory is a vertical slice for rebuilding the Sonic 16 concept with engine-native systems instead of maintaining a custom renderer, ECS, input layer, animation runtime, and collision solver.

## Engine

- Godot **4.7.1**
- GDScript
- Compatibility renderer
- Web export without thread support

## Online builds

Every pushed Godot revision on `main` or `agent/godot-prototype` is exported for Web and published as an immutable GitHub Pages build:

```text
https://t-damer.github.io/sonic-16/game/v1/<12-character-commit-sha>/
```

The build also contains `build.json` with the full commit SHA, source branch, publication time and Actions run URL. Previous commit builds are retained rather than replaced.

The repository must have GitHub Pages configured once to deploy from the `gh-pages` branch at `/ (root)`.

## Run locally

1. Install Godot 4.7.1.
2. Import `godot/project.godot` in the Project Manager.
3. Open `scenes/main.tscn` and press **F6**, or press **F5** to run the project.

Controls:

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move left/right and in depth | `WASD` / arrows | Left stick / D-pad |
| Jump | `Space` / `K` | A / Cross |
| Reset to checkpoint | `R` | — |
| Pause | `Esc` / `P` | Start |

## What this slice demonstrates

- `CharacterBody3D.move_and_slide()` instead of the custom 2D swept-AABB solver.
- A real X/Z movement plane with camera-relative controls.
- `InputMap`-backed keyboard and gamepad input, including coyote time and jump buffering.
- Orthographic fixed-angle camera.
- Dynamic directional and spot lights with shadows.
- `AnimatableBody3D` moving platform for the skiff sequence.
- `Area3D` pickups and hazards.
- A compact level route inspired by the demo: sewer entrance, machinery lanes, descent, low deck, spikes, skiff pit, arena and blast door.
- An original pixel placeholder hero and ally instead of generated primitive character rigs.
- A Robotropolis-inspired industrial skyline made without redistributing SEGA artwork.

## Art replacement path

The built-in blockout geometry is deliberately disposable. Import a modular CC0 pack and assemble the final environment with Godot scenes or GridMap rather than adding more geometry factories.

Suggested sources:

- [Kenney Factory Kit](https://kenney.nl/assets/factory-kit) — CC0 industrial props.
- [Quaternius Modular Sci-Fi MegaKit](https://quaternius.com/packs/ultimatemodularscifi.html) — CC0 modular sci-fi environment.
- [KayKit Prototype Bits](https://github.com/KayKit-Game-Assets/KayKit-Prototype-Bits-1.0) — CC0 GLTF placeholders and a Godot addon.

For characters, use either an original pixel sprite sheet in `AnimatedSprite3D`, or a properly rigged GLTF from Blender and drive it with `AnimationPlayer` + `AnimationTree`. Avoid generated static meshes without clean topology, a stable skeleton, and authored locomotion clips.

## Current scope

This is a migration spike, not feature parity with the old TypeScript implementation. Combat and enemy state machines should be ported only after movement, camera, collision and level composition are approved.
