# SONIC-16 — AI Asset Generation Pipeline

How we replace handcrafted primitive models with **generated** ones, without losing
the quality gates from [ART_PIPELINE.md](ART_PIPELINE.md). The idea (and the current
industry norm): generate a *2D concept image* with an image model, then lift it to a
*3D mesh* with an image-to-3D model, clean it up, and drop it into the game.

State of the tooling as of mid-2026, from research linked at the bottom.

---

## 1. Tool landscape

### Hosted (fast, best out-of-box quality, per-generation credits)

| Tool | Strength | Notes |
|---|---|---|
| **Tripo AI** | Speed + game-ready topology | ~8 s per model; the go-to for fast prop iteration |
| **Meshy** | Fullest single-tool pipeline | Built-in **auto-rigging + ~500 animation presets**, engine plugins — best for characters |
| **Rodin (Hyper3D)** | Best raw quality | Strong geometry/UV/topology focus — use for hero assets |
| **Kaedim / CSM / Luma** | Alternatives | Similar tier; less relevant for us |

### Local / open source (free, unlimited, needs a GPU)

| Tool | Strength | Notes |
|---|---|---|
| **Hunyuan3D 2.1** (Tencent) | Best texture fidelity | Image → PBR-textured mesh; runs in **ComfyUI** (official template workflow exists) |
| **TRELLIS.2-4B** (Microsoft, Dec 2025) | Production-grade PBR assets | Also a ComfyUI backend; there are ready-made workflows with Hunyuan3D + TRELLIS as swappable backends |
| **Stable Fast 3D** | Speed (<1 s) | Rough but instant — great for blockout/prop drafts |
| **StableProjectorz** | AI *texturing* of existing meshes | Projects Stable Diffusion output onto a mesh; **open-sourced (AGPL) in Jan 2026** |

### Environment-specific

| Tool | Use here |
|---|---|
| **Blockade Labs Skybox AI** | 360° backdrops from text; exports HDRI/mesh; free tier ≈5 gens/month | 
| **SD/FLUX tileable textures** | Wall brick, plating, ground grit — replaces our canvas-drawn textures at higher fidelity |
| **PixelLab / Retro Diffusion** | Style-locked *2D* pixel art — useful for HUD/menu art, not 3D |

### The honest caveat from every 2026 comparison

AI output is production-ready for **props, blockouts and background dressing**, but
**not** for hero assets that need tight topology and clean animation rigs — those
still need a human pass (retopo/decimate, pivot fixes, rig cleanup). Our pixelated
270p presentation is an unusually good match though: it hides exactly the artifacts
(blobby topology, smeared texture detail) that AI meshes suffer from.

---

## 2. Recommended setup for this project

**Two tracks, pick per asset:**

- **Characters (Sonic, Sally, SWATbot)** → **Meshy** (concept image → model →
  auto-rig), because rigging is the expensive step. Export GLB.
  - Budget alternative: any image-to-3D + **Mixamo** auto-rig (free), then the bone
    rename pass below.
- **Props & enemies without limbs (Spyphid, Skiff, monitors, fans, spikes, door)** →
  **Tripo** hosted for speed, or **local ComfyUI + Hunyuan3D 2.1 / TRELLIS.2** if a
  ≥12 GB GPU is available and we want unlimited free iterations.
- **Environment**
  - Backdrops: **Skybox AI** panorama → project onto our backdrop layer (z −14).
  - Surface textures: SD/FLUX tileable generations, downscaled to 64px, replacing
    `TextureFactory` canvases one by one (keep `NearestFilter`).
  - Modular set pieces (pipes, columns, grates): Tripo/Hunyuan from concept images,
    assembled in the level like the current primitives.

**Style lock for concept images** — use the same prompt spine everywhere, e.g.:

> "1994 pre-rendered CGI game asset, chunky rounded forms, [ASSET], 3/4 front view,
> neutral grey background, even studio lighting, saturated primary colours, no
> outline, single object, full body in frame"

The consistent prompt is what keeps generated assets looking like one game — it's
the generation-era equivalent of our palette lock.

---

## 3. The pipeline, step by step

```
 1 PROMPT      image model (FLUX/SDXL/Midjourney) → concept image, style-locked
 2 LIFT        image-to-3D (Meshy/Tripo hosted, or Hunyuan3D/TRELLIS local)
 3 CLEAN       Blender: decimate to budget, recentre pivot to FEET, +Z forward,
               real-world scale (Sonic = 1.05u tall), name parts
 4 RIG (chars) Meshy auto-rig or Mixamo → rename bones to our contract (below)
 5 EXPORT      GLB (embedded textures), textures ≤512px — the game pixelates anyway
 6 DROP IN     public/assets/models/<file>.glb + entry in manifest.json
 7 REVIEW      EXTRAS → the asset appears under IMPORTED → silhouette gate (B),
               turntable, clip sweep — same acceptance checklist as handmade models
```

The engine applies `NearestFilter` to every imported texture automatically when
pixelation is on, so generated assets get the house look without manual work.

### Budgets

| Asset class | Triangles | Texture |
|---|---|---|
| Character | ≤ 6k | 256–512px |
| Enemy / vehicle | ≤ 4k | 256px |
| Prop | ≤ 1.5k | 128–256px |
| Backdrop piece | ≤ 800 | 256px |

### Bone rename map (Mixamo → our contract)

| Mixamo | Ours |
|---|---|
| `mixamorig:Hips` | `hips` |
| `mixamorig:Spine`/`Spine1` | `body` / `torso` |
| `mixamorig:Head` | `head` |
| `mixamorig:LeftArm` / `RightArm` | `armL` / `armR` |
| `mixamorig:LeftUpLeg` / `RightUpLeg` | `legL` / `legR` |
| `mixamorig:LeftFoot` / `RightFoot` | `footL` / `footR` |

Once renamed, our entire keyframe clip set (`Clips.ts`) drives the imported model —
that was the point of the bone contract. GLBs that ship their *own* animations also
work: the EXTRAS viewer plays embedded clips through a three.js AnimationMixer.

---

## 4. Drop-in format

`public/assets/models/manifest.json`:

```json
{
    "models": [
        {
            "id": "sonic-gen-v1",
            "name": "Sonic (generated)",
            "file": "sonic-gen-v1.glb",
            "description": "Meshy lift of concept v3, decimated to 5.8k tris",
            "scale": 1.0
        }
    ]
}
```

Anything listed appears in **EXTRAS under the IMPORTED category** next to the
procedural assets, with the same turntable, silhouette gate and clip playback —
generated assets pass the exact same review as handmade ones. Swapping a reviewed
model into gameplay is then a per-asset decision (bone contract for characters,
`MeshRef` factory swap for props).

---

## Sources

- [Best image-to-3D models on HuggingFace, 2026](https://trellis2.app/blog/best-image-to-3d-models-huggingface)
- [ComfyUI Hunyuan3D-2 official examples](https://docs.comfy.org/tutorials/3d/hunyuan3D-2)
- [Hunyuan3D 2.1 ComfyUI workflow](https://www.runcomfy.com/comfyui-workflows/hunyuan3d-2-1-comfyui-workflow-professional-3d-asset-creation)
- [Image-to-3D ComfyUI workflow (Hunyuan3D-2 + TRELLIS 2 backends)](https://github.com/Alex92908/image-to-3d-comfyui)
- [Best AI tools for 3D game assets, 2026 (Meshy blog)](https://www.meshy.ai/blog/best-ai-tools-for-3d-game-assets)
- [Generative 3D tools compared: Meshy, Rodin, Tripo, CSM (StraySpark, Apr 2026)](https://www.strayspark.studio/blog/generative-3d-tools-comparison-meshy-rodin-tripo-csm-2026)
- [Tripo vs Meshy vs Rodin vs Kaedim (Ideas With Wings)](https://medium.com/ideas-with-wings/best-image-to-3d-tools-7eea7b05eb11)
- [Best AI game asset generators, 2026 (3DAI Studio)](https://www.3daistudio.com/blog/best-ai-game-asset-generators-2026)
- [AI pixel-art-for-games pipeline guide, 2026](https://gamineai.com/blog/how-to-make-pixel-art-with-ai-for-games)
- [Blockade Labs Skybox AI](https://www.toolmage.com/en/tool/skybox-ai/)
- [StableProjectorz (open source since Jan 2026)](https://stableprojectorz.com/)
