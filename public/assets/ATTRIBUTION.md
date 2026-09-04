# Asset attribution

All 3D assets in this directory came from public GitHub repositories. Sources
and license evidence are recorded below. Nothing here was authored by this
project.

## Trees and rock formations

`models/trees/pine-large.glb`, `models/trees/pine-small.glb`,
`models/rocks/rock-formation.glb`, `models/rocks/rock-formation-large.glb`,
`models/rocks/stone-formation.glb`

- **Creator:** Kenney (<https://www.kenney.nl/>)
- **Source:** [pmndrs/market-assets](https://github.com/pmndrs/market-assets),
  `files/models/{tree-big,tree-small,formation-rock,formation-large-rock,formation-stone}`
- **License:** each model's `info.json` records `"creator": "kenney"` and
  `"license": 1`. That repository does not document what the numeric license
  ids mean, and kenney.nl was unreachable from the environment these were
  fetched in, so the id was not resolved to a license name. Kenney distributes
  his asset packs as CC0, and the same `license: 1` id is used there for
  Poly Haven and ambientCG assets, which are also CC0 — but treat that as
  inference, not verification. **Confirm the license at kenney.nl before
  shipping commercially.**

Renamed for clarity (`tree-big` → `pine-large`, etc.), and decompressed from
DRACO to plain glTF so the runtime needs no DRACO decoder. Geometry is
otherwise unmodified.

## Grass-and-pine tiles

`models/tiles/grass-pines.glb`, `models/tiles/grass-pines-tall.glb`,
`models/tiles/Textures/colormap.png`

- **Creator:** Kenney (<https://www.kenney.nl/>)
- **Source:** [KenneyNL/Starter-Kit-City-Builder](https://github.com/KenneyNL/Starter-Kit-City-Builder),
  `models/{grass-trees,grass-trees-tall}.glb`
- **License:** CC0. That repository's `README.md` states "Sprites and 3D Models
  _(CC0 licensed)_"; its `LICENSE.md` is MIT and covers the Godot template code
  rather than the art.

These two are 1×1 tiles with several conifers already arranged on a ground
slab, not standalone trees. They are unused by the current scene and kept only
as an option for tile-based layouts. **They reference the external texture
`Textures/colormap.png`** — keep that file next to them or they load untextured.

## Not included

Terrain is generated procedurally in `src/terrain.js` rather than shipped as a
model. The usual sources for free terrain and nature art (kenney.nl, poly.pizza,
quaternius.com, opengameart.org, sketchfab.com, Poly Haven) were all blocked by
the network policy of the environment this was assembled in, so the search was
limited to what is mirrored on GitHub.
