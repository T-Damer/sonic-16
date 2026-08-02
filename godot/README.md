# Godot Sonic-16 prototype

This directory contains the engine-native vertical slice. It keeps the world and characters in 3D, but uses a low-oblique orthographic camera, deliberately limited movement plane and retro shading to resemble the surviving Sonic-16 pitch footage.

## Engine

- Godot **4.7.1**
- GDScript
- Compatibility renderer
- Non-threaded Web export
- 320×200 internal viewport, nearest-neighbour scaling

## Online builds

The stable preview router is:

```text
https://t-damer.github.io/sonic-16/game/#/v1/<12-character-commit-sha>
```

Opening `/game/` selects the latest build. The physical Godot export remains under `/game/v1/<sha>/index.html`; the hash router is used as the public application URL so GitHub Pages does not interpret commit IDs as client-side routes.

## Run locally

1. Install Godot 4.7.1.
2. Import `godot/project.godot`.
3. Press **F5**.

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move left/right and in depth | `WASD` / arrows | Left stick / D-pad |
| Jump / climb a ledge | `Space` / `K` | A / Cross |
| Ring Attack | `F` / `J` | X / Square |
| Buzzsaw in mid-air | `E` / `L` | B / Circle |
| Spike Blast in mid-air | `Q` / `I` | Y / Triangle |
| Wall concealment / corner peek | hold `C` near the back wall | Left shoulder |
| Reset | `R` | — |
| Pause | `Esc` / `P` | Start |

## Current gameplay model

- `CharacterBody3D.move_and_slide()` provides collision and slope handling.
- Horizontal movement is intentionally slower and heavier than a conventional Sonic controller.
- The X/Z plane supports foreground/background lane movement from the pitch demo.
- Jumping includes buffering, coyote time, variable height and restrained air steering.
- Automatic ledge probing can enter a hang state; jump/up climbs and down drops.
- Holding against the rear wall reduces movement, hides the player from distant camera detection and enables a peek-oriented camera offset.
- Ring Attack spends one ring and throws a physical projectile.
- Buzzsaw is a short airborne dash with a damaging hit volume.
- Spike Blast briefly suspends the player and emits quills radially.
- Rings are both ammunition and health.

## Enemies and level interactions

- Surveillance cameras hover, scan through line of sight and launch alarm bolts.
- Cameras require two ordinary Ring Attack hits.
- SWATbots patrol and fire; their front plate deflects frontal ring shots.
- Buzzsaw and Spike Blast can destroy the armoured spike barricade.
- The level includes collectible paths, checkpoints, damaging spikes, a moving skiff, an arena and an opening rendezvous door.

## Visual direction

The current pass replaces the steep generic-isometric blockout with the lower camera angle visible in the pitch footage. The environment is an enclosed Robotropolis service corridor rather than a distant city skyline.

The render stack uses:

- original articulated low-poly 3D character and enemy models;
- banded diffuse lighting through `retro_toon.gdshader`;
- teal industrial panels, oxidized ochre flooring, metal conduits, vents and animated extractor fans;
- dynamic directional, spot and point lights with shadows;
- a screen-space palette/dither pass in `retro_post.gdshader`;
- a foreground pipe layer to reproduce the strong framed depth of the original 320×200 screenshots.

No SEGA artwork, sprites or extracted models are redistributed.

## Production asset replacement

The present meshes establish proportions, silhouettes, materials, level metrics and interactions. Production replacements can be imported as GLTF without replacing gameplay code.

Recommended environment sources remain CC0 modular kits such as Kenney Factory Kit, Quaternius Modular Sci-Fi MegaKit or KayKit Prototype Bits. Assemble them through scenes or `GridMap`/`MeshLibrary`; keep collision in dedicated nodes rather than relying on decorative mesh topology.

A finished hero should use a clean skeleton with authored clips driven by `AnimationPlayer` and `AnimationTree`. The current procedural articulated rig is a prototype substitute, not the final character asset.
