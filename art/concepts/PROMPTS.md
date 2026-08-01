# Concept Prompt Pack

Paste these into your image generator (FLUX / Midjourney / SDXL), then feed the
result to Meshy/Tripo — or skip the image entirely: both tools also accept the
**text-to-3D** one-liners directly.

The SVG/PNG cards in this folder are style reference and a working fallback input.

## Shared style spine (prepend to every image prompt)

> 1994 pre-rendered CGI game asset render, chunky rounded toy-like forms, saturated
> primary colours, soft studio lighting, single object centered on a plain light-grey
> background, 3/4 front view, full object in frame, no text, no watermark, no outline

Negative (where supported): `photo, realistic fur, background scenery, clutter, text, multiple objects, cropped`

---

## Characters & enemies

**sonic** — image: *…spine…* + "cartoon blue hedgehog hero character, huge head with
joined white eye visor and green pupils, tan muzzle and belly, six swept-back blue
head quills, thin arms with big white gloves, oversized red sneakers with white strap"
· text-to-3D: "chunky cartoon blue hedgehog character, big head, swept-back quills,
white gloves, red sneakers, T-pose"

**sally** — image: *…spine…* + "cartoon ground-squirrel princess, warm brown fur,
cream muzzle and belly, auburn chin-length hair and large curved auburn tail, open
blue sleeveless vest, tall indigo boots" · text-to-3D: "cartoon brown squirrel girl
character, auburn hair and big tail, blue vest, indigo boots, T-pose"

**swatbot** — image: *…spine…* + "boxy grey security robot trooper, narrow glowing
red visor, riveted chest plate with vents, round shoulder pads, right forearm is an
oversized energy cannon with three glowing yellow charge orbs, sturdy legs" ·
text-to-3D: "boxy grey robot soldier with red visor and arm cannon, T-pose"

**spyphid** — image: *…spine…* + "floating spherical purple surveillance drone, one
enormous cyan camera lens filling the front, dark armoured cap with rivets, four
segmented dark tentacle arms with silver claws hanging below, small red warning light
on top" · text-to-3D: "purple sphere drone with one huge cyan eye lens and four
hanging claw tentacles"

**skiff** — image: *…spine…* + "flat magenta hover-craft, wide lozenge hull with
pointed nose, dark cowling and tail fin, pink intake stripe along the flank, two
cyan thruster pods underneath, a silver horizontal grab bar suspended on struts
below the hull" · text-to-3D: "flat magenta hover skiff vehicle with underside grab
bar and cyan thrusters"

## Props

**spike-column** — *…spine…* + "hazard pillar: three golden spiked drums stacked on
a white pipe post, steel barbs radiating outward, gold cone on top"

**ring-monitor** — *…spine…* + "retro game item monitor: grey rounded box on a short
dark post, large green CRT screen showing a golden ring icon"

**cooler-fan** — *…spine…* + "industrial wall extractor fan: circular pale-blue rim
in a riveted dark-blue square panel, four broad pitched blades, round hub"

**blast-door** — *…spine…* + "industrial blast door: tall tapered green frame, two
grey riveted panels meeting in a vertical zigzag seam, yellow-black hazard chevrons
at the base, warning light on top"

---

## Return path (unchanged)

Generated GLB → `public/assets/models/` → one entry in `manifest.json` → review in
EXTRAS (IMPORTED category, silhouette gate `B`) → swap into gameplay.
Details: [docs/ASSET_GEN_PIPELINE.md](../../docs/ASSET_GEN_PIPELINE.md).
