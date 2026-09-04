# philmont-game

A three.js hiking game set in the Philmont high country. Right now the
repository contains a terrain-and-forest scene: procedurally generated
mountain terrain with a low-poly conifer forest scattered across it.

![Preview](docs/preview.png)

## Running it

```sh
npm install
npm run dev
```

Drag to orbit, scroll to zoom.

## Layout

| Path | What it is |
| --- | --- |
| `src/terrain.js` | Height field and the flat-shaded, vertex-coloured terrain mesh |
| `src/scatter.js` | glTF loading, instancing, and terrain-aware placement |
| `src/main.js` | Scene, lighting, and the forest/outcrop composition |
| `public/assets/models/` | Third-party models — see `public/assets/ATTRIBUTION.md` |

## Terrain

The terrain is generated, not modelled. `makeHeightField` sums fBm and ridged
noise over three.js's `ImprovedNoise` and adds a corner massif so there is a
summit to climb, then eases the field down toward the rim so the plane's edge
sits low instead of ending in a cliff. `buildTerrain` displaces a
`PlaneGeometry`, converts it to non-indexed geometry for flat shading, and
colours vertices by elevation and slope — meadow, timber, talus, snow — so no
ground textures are needed.

The same height function drives placement, so props and ground always agree.

## Scattering

`scatterOnTerrain` rejection-samples positions inside an elevation band,
skips ground too steep to hold soil, and sinks each model by roughly the rise
across its own footprint — without that, a wide flat-bottomed rock standing on
a slope leaves its downhill edge hanging in the air. Placements are then drawn
with one `InstancedMesh` per material, so the ~2,400 trees cost a handful of
draw calls. A seeded PRNG keeps a given seed reproducible.

Outcrops are deliberately kept at or below the treeline. Placed higher they are
still correctly seated, but intervening ridges hide their bases and they read
as though they are hovering.

## Assets

Models are third-party. Provenance and license evidence — including one
license that is inferred rather than confirmed — are recorded in
[`public/assets/ATTRIBUTION.md`](public/assets/ATTRIBUTION.md). Read it before
shipping anything commercially.
