# SONIC-16 — Art Pipeline

How models are authored, reviewed and accepted, so quality stays consistent as the
cast grows. The pipeline has a **code half** (`src/game/render/ModelKit.ts`) and a
**review half** (the EXTRAS asset library). Sonic is the reference implementation —
when in doubt, do what `SonicRig.ts` does.

---

## 1. The five stages

```
 1 REFERENCE  →  2 BLOCKOUT  →  3 SILHOUETTE GATE  →  4 COLOUR PASS  →  5 REVIEW
```

### 1 — Reference
Every asset starts from a reference frame of the original footage (the screenshots in
the project brief). Write down, in one line, what the asset must *read as* at gameplay
distance — e.g. Spyphid: "a floating eye with grabber legs". If that one line isn't
obvious from the model later, the model is wrong regardless of its detail.

### 2 — Blockout (ModelKit only)
Build the shape from `ModelKit` primitives — `orb`, `pill`, `limb`, `spike`, `slab`,
`drum` — attached to rig bones. Rules:

- **No raw `new Mesh(...)` in rig files** unless the kit genuinely lacks the shape.
  If it does, add the shape *to the kit* so the next model gets it too.
- Cones sweep with `sweptBack()` / `sweptForward()` — never hand-rolled rotation
  math. (The first Sonic shipped with every quill pointing at the camera because of a
  sign error these helpers now encapsulate.)
- Proportions come from a written sheet (see §3), not eyeballing.

### 3 — Silhouette gate
Open EXTRAS, select the asset, press **`B`**. The model renders flat black on a light
background. **If you can't name the character from the silhouette alone — at every
angle of the turntable — the blockout is not done.** No colour or detail work happens
before this gate passes; detail cannot rescue a bad silhouette at 270p.

### 4 — Colour pass
- Colours come **only** from `PALETTE` (`Materials.ts`) or from `shade()` / `tint()`
  ramps of a palette entry. No ad-hoc hex values in rig files.
- ≤ 3 value steps per hue on one asset. The pixelated buffer flattens anything finer.
- Flat shading is the default (set in `Materials.solidColor`); gradients turn to mush
  at the internal resolution.
- Emissives (`glow`) only for things that are *meant* to be light sources: lenses,
  screens, thrusters, charge orbs.

### 5 — Review in EXTRAS
The library shows exactly what ships (it builds from the same factories). Check:

- turntable at ¾ front, side, ¾ back — no accidental holes or intersections
- `B` silhouette again, now with any added detail
- **every animation clip** (`▲ ▼` cycles them) — a model is only accepted posed,
  never at bind pose; watch for elbows/quills/shoes breaking through the body
- in-game spot check at gameplay distance — details smaller than ~2 screen pixels
  (≈ 0.05u) are noise, remove them

---

## 2. Acceptance checklist

Copy into the PR/commit message for a new or reworked model:

```
[ ] reads as its one-line description at gameplay distance
[ ] silhouette identifiable at all turntable angles (B in EXTRAS)
[ ] ModelKit primitives only; new shapes added to the kit, not inlined
[ ] palette/ramp colours only; ≤3 value steps per hue
[ ] all clips reviewed posed; no interpenetration in extreme keys
[ ] part keys named (materials cache), bones follow the contract below
```

---

## 3. Proportion sheets

Character height unit: Sonic = **1.05u** at bind.

| Asset | Sheet |
|---|---|
| **Sonic** | head r 0.30 (≈ half the height!), torso r 0.21, limbs r ≈ 0.05, gloves r 0.095, shoes 0.4u long. 3 centre quills (28°/52°/74° back-down) + 2 side quills. Eyes are one joined white visor. |
| **Sally** | same skeleton; head r ≈ 0.26, hair mass reads larger than the skull from behind. |
| **SWATbot** | 1.5u tall, chest wider than hips, cannon forearm visibly heavier than the free arm. |
| **Spyphid** | housing r 0.34; the lens is ≥ ⅓ of the front face — the eye is the character. |
| **Skiff** | 2:1 length:width, hull thinner than ⅓ of its width, grab bar clearly separated below. |

---

## 4. Contracts

**Bones** (characters): `hips → body → torso → head / armL / armR`, `body → legL/legR
→ footL/footR`, plus `ball` for spin forms. Keep the names and the whole clip set
(`Clips.ts`) drives any future model — including a real GLTF import — unchanged.

**Named sub-parts** systems reach for: `rotor` (spun by RenderSystem/ModelViewer),
`doorLeft`/`doorRight` (SequenceSystem), plus the typed visuals in `EnemyRigs.ts`
(lens, tentacles, chargeOrbs, grabBar, thrusterGlow).

**Presentation** (don't fight it, design within it): 270p internal buffer, nearest
upscale, flat shading, `NearestFilter` textures at 32–64px, one warm key light +
cool fill, locked ortho camera at yaw 18° / pitch 22°.

---

## 5. Rework backlog

Priority order, pending review verdicts in EXTRAS:

1. ~~Sonic~~ — rebuilt as the pipeline template
2. SWATbot — silhouette OK, needs the proportion sheet applied (heavier cannon arm)
3. Spyphid — lens should dominate more; tentacles thicker at the root
4. Sally — hair mass, vest read
5. Skiff — fine at distance; revisit last

External models (GLTF from asset sites) can replace any of these later via the bone
contract — but they must still pass gates 3–5 like everything else.
