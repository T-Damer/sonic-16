# SONIC-16

A non-commercial fan-made technical study of the unreleased **Sonic 16 / Genesis PM Concept**.

## Current direction

The active prototype is built in **Godot 4.7.1** under [`godot/`](godot/). The earlier Phaser/Three/Solid implementation remains in [`src/`](src/) as a reference, but it is no longer the gameplay foundation.

The current Godot pass is based on the surviving pitch footage rather than on conventional high-speed Sonic physics: a slower, more deliberate character, a widened foreground/background movement lane, large SatAM-like silhouettes, wall concealment, ledge interaction and combat abilities built around rings and quills.

**[Open the latest Godot Web preview](https://t-damer.github.io/sonic-16/game/)**

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move left/right and in depth | `WASD` / arrows | Left stick / D-pad |
| Jump / climb a ledge | `Space` / `K` | A / Cross |
| Ring Attack | `F` / `J` | X / Square |
| Buzzsaw while airborne | `E` / `L` | B / Circle |
| Spike Blast while airborne | `Q` / `I` | Y / Triangle |
| Hold against the back wall | `C` | Left shoulder |
| Reset to checkpoint | `R` | — |
| Pause | `Esc` / `P` | Start |

Rings function as both health and ammunition. Ring Attack consumes one ring; taking damage drops several rings. Surveillance cameras take two ring hits, while a SWATbot can deflect a frontal ring shot. Buzzsaw and Spike Blast can break the armoured spike barricade.

## What is implemented in the Godot slice

- Native `CharacterBody3D`, `StaticBody3D`, `AnimatableBody3D` and `Area3D` gameplay instead of the custom browser physics stack.
- Slower acceleration, shorter jumps and limited air steering closer to the pitch demo.
- Real movement in depth, wall concealment/peek camera bias and automatic ledge grabbing.
- Ring Attack, Buzzsaw and radial Spike Blast.
- Original articulated low-poly 3D hero, surveillance-camera and SWATbot models.
- Camera enemies that scan and shoot; patrolling armoured SWATbots with directional defence.
- A moving skiff, checkpoints, collectible ring/ammunition routes, hazards and an opening blast door.
- A low-oblique orthographic camera modeled after the 320×200 pitch framing rather than a steep modern isometric camera.
- Detailed Robotropolis corridor geometry with machinery panels, vents, fans, conduits, hazard strips and layered foreground piping.
- Banded 3D materials, dynamic lights and shadows, palette quantization, dithering and subtle scanlines.
- Versioned Web exports through `/game/#/v1/<commit>` while retaining prior builds.

## Run locally

1. Install Godot 4.7.1.
2. Import [`godot/project.godot`](godot/project.godot) in the Project Manager.
3. Press **F5**.

The Web preset uses the Compatibility renderer without thread support.

## Art pipeline

The current meshes and materials are original prototype assets assembled with Godot-native geometry, so the game stays fully three-dimensional and dynamically lit. They are no longer flat blockout cubes, but they are still replaceable production placeholders.

The next asset pass should import a modular CC0 industrial GLTF kit through Godot scenes or `GridMap`/`MeshLibrary`, while retaining the current collision, interaction and shader layer. A finished character should use a clean reusable skeleton and authored clips through `AnimationPlayer` and `AnimationTree`; the present articulated model establishes proportions and state readability without redistributing SEGA artwork.

See [`docs/GODOT_MIGRATION.md`](docs/GODOT_MIGRATION.md) for the architectural migration notes.

## Legacy browser prototype

```bash
npm install
npm run dev
```

Then open <http://localhost:8080>.

> **Legal note:** Sonic the Hedgehog, Sally Acorn, SWATbots, Badniks, rings and related marks are owned by SEGA. This repository does not redistribute SEGA game assets; its models, shaders and environment assets are original to this technical study.
