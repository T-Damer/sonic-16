# SONIC-16

A non-commercial fan-made technical study of the unreleased **Sonic 16 / Genesis PM Concept**.

## Current direction

The playable prototype is being migrated to **Godot 4.7.1**. The new vertical slice lives in [`godot/`](godot/) and uses engine-native systems instead of maintaining a custom renderer, ECS, input layer, animation runtime and collision solver.

The earlier Phaser/Three/Solid implementation remains in [`src/`](src/) as a reference while movement, camera, collision, level composition and the visual direction are evaluated.

See [`docs/GODOT_MIGRATION.md`](docs/GODOT_MIGRATION.md) for the migration decision and porting order.

## Run the Godot prototype

1. Install Godot 4.7.1.
2. Import [`godot/project.godot`](godot/project.godot) in the Project Manager.
3. Press **F5**.

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move left/right and in depth | `WASD` / arrows | Left stick / D-pad |
| Jump | `Space` / `K` | A / Cross |
| Reset to checkpoint | `R` | — |
| Pause | `Esc` / `P` | Start |

The Web export preset is intentionally configured for the Compatibility renderer without thread support.

## What the migration slice contains

- Native `CharacterBody3D` movement and collision.
- Camera-relative movement on a real X/Z plane rather than a visual-only isometric angle.
- Reliable keyboard and gamepad jump input with coyote time, buffering and variable jump height.
- A locked orthographic camera with look-ahead and low-resolution pixel snapping.
- Native `Area3D` pickups and hazards.
- An `AnimatableBody3D` skiff platform and blast-door panels.
- Dynamic directional, fill and spot lighting with shadows and fog.
- A compact route inspired by the reference demo: sewer entrance, machinery lanes, descent, low deck, spikes, skiff crossing, arena and rendezvous door.
- An original Robotropolis-inspired industrial skyline.
- Original pixel placeholder characters rendered through `AnimatedSprite3D`.

This is a foundation prototype, not feature parity with the earlier implementation. Combat, Ring Attack, Buzzsaw, Spike Blast, enemy behavior and the final cutscene should be ported only after the movement and level direction are accepted.

## Legacy browser prototype

```bash
npm install
npm run dev
```

Then open <http://localhost:8080>.

The legacy implementation uses Phaser 3, Three.js, SolidJS, a custom ECS and a custom two-dimensional swept-AABB collision layer. It contains more gameplay experiments, but its basic engine responsibilities are no longer the intended foundation.

## Art pipeline

The current Godot environment is a disposable blockout. The next art pass should use a modular CC0 GLTF environment pack assembled through scenes or `GridMap`/`MeshLibrary`, rather than adding more procedural geometry factories.

Characters should remain original pixel art during early prototyping, or move to a properly rigged GLTF model with clean topology and authored animation clips. Imported character animation belongs in Godot's `AnimationPlayer` and `AnimationTree`.

> **Legal note:** Sonic the Hedgehog, Sally Acorn, SWATbots, Badniks, rings and related marks are owned by SEGA. This repository does not redistribute SEGA game assets; the placeholder art and environment are original to this technical study.
