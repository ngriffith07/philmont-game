# Philmont — browser 3D proof of concept

Base Camp (Camping Headquarters) and the Tooth Ridge Trail to Tooth Ridge Camp,
built with Vite + React + Three.js.

![Preview](docs/preview.png)

```bash
npm install
npm run dev
```

In a GitHub Codespace, open the forwarded port that Vite prints.

- **Overview** — drag to orbit, scroll to zoom
- **Walk** — click the view to capture the mouse, W A S D to move, Shift to run, Esc to release
- **Hike the trail** — auto-hike from headquarters to Tooth Ridge Camp

Scale: 1 world unit = 10 m. Camp and landmark positions come from Philmont's
2017 UTM & Elevation Reference Guide. Terrain is a stylized heightfield
(`elevFt()` in `src/PhilmontPOC.jsx`); replacing it with a USGS 3DEP heightmap
is the next step.

## Layout

| Path | What it is |
| --- | --- |
| `src/PhilmontPOC.jsx` | Terrain, landmarks, trail, camps, controls, HUD |
| `src/trees.js` | Loads the conifer models and instances the forest |
| `public/assets/models/` | Third-party models — see `public/assets/ATTRIBUTION.md` |

## The forest

`src/trees.js` replaces the `ConeGeometry` placeholders with Kenney's low-poly
conifers. Placement is unchanged — same hash stream, same elevation-band
density, same base-camp exclusion — so the forest sits exactly where the cones
did. Two species are drawn as one `InstancedMesh` per material, so 7,000 trees
cost four draw calls (about 3.9M triangles).

Two adjustments were needed to make real models fit the scene:

- **Shading.** glTF ships `MeshStandardMaterial`, which is much darker than
  `MeshLambertMaterial` under this scene's lights with no environment map — the
  trees came out near-black. They are re-materialised as Lambert so they shade
  like everything else.
- **Colour.** The models carry Kenney's city-kit palette (mint foliage, sandy
  trunk), which reads as decorative here. Foliage and bark are recoloured to the
  cone placeholders' `#2f4a2f` and a muted ponderosa bark. Set `RECOLOUR = false`
  in `src/trees.js` to keep the originals.

## Known issue: base camp scale

The tent cities and camp buildings are sized as though 1 unit = 1 m, not 10 m.
`tentGeo` is a `ConeGeometry(0.75, 0.9, 4)` — a 15 m wide, 9 m tall tent — and
the rows are spaced 24 m apart. From the ground in Walk mode they read as
pyramids. This predates the forest work and is left as-is because fixing it
means re-deciding the camp's footprint. Dividing the tent and building
dimensions by roughly 10 is the likely fix.

## Assets

Models are third-party. Provenance and license evidence — including one
license that is inferred rather than confirmed — are recorded in
[`public/assets/ATTRIBUTION.md`](public/assets/ATTRIBUTION.md). Read it before
shipping anything commercially.
