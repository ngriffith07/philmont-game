import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/*
  Conifer models standing in for the cone placeholders.

  Source: Kenney, via pmndrs/market-assets. See public/assets/ATTRIBUTION.md —
  the license there is inferred from the creator rather than confirmed.

  World scale is 1 unit = 10 m, so a 20-35 m ponderosa is 2.0-3.5 units. The
  models are ~0.77 and ~0.70 units tall in their own space, hence the scale
  factors below.
*/

const SPECIES = [
  // `worldH` is the rendered height range in world units, i.e. 26-40 m for
  // mature ponderosa and 18-28 m for the smaller stock. That is a little under
  // the cone placeholders these replaced (which reached 51 m) but keeps the
  // same visual weight on the ridges.
  { url: "/assets/models/trees/pine-large.glb", modelH: 0.767, worldH: [2.6, 4.0] },
  { url: "/assets/models/trees/pine-small.glb", modelH: 0.700, worldH: [1.8, 2.8] },
];

const loader = new GLTFLoader();

/*
  The scene lights for MeshLambertMaterial (a hemisphere light at 0.75 and a
  directional at 1.15, no environment map). glTF ships MeshStandardMaterial,
  whose BRDF is far darker under that little light with no IBL to fill it in —
  the conifers came out near-black. Re-materialise them as Lambert with the
  same base colour so they shade like everything else in the scene.
*/
/*
  The source models ship Kenney's city-kit palette: mint-green foliage on a
  sandy trunk. That reads as decorative next to this scene's earth tones, so
  foliage and bark are recoloured to the palette the cone placeholders used
  (#2f4a2f) and a muted ponderosa bark. Drop RECOLOUR to keep the originals.
*/
const RECOLOUR = true;
const FOLIAGE = new THREE.Color("#2f4a2f");
const BARK = new THREE.Color("#4a3826");

const lambertCache = new Map();
function toLambert(src) {
  if (lambertCache.has(src.uuid)) return lambertCache.get(src.uuid);
  const base = src.color ? src.color.clone() : new THREE.Color(0xffffff);
  if (RECOLOUR) {
    // Foliage is the green-dominant material; everything else is the trunk.
    const isFoliage = base.g > base.r && base.g > base.b;
    base.copy(isFoliage ? FOLIAGE : BARK);
  }
  const mat = new THREE.MeshLambertMaterial({
    color: base,
    map: src.map || null,
    vertexColors: src.vertexColors,
    side: src.side,
    transparent: src.transparent,
    opacity: src.opacity,
  });
  lambertCache.set(src.uuid, mat);
  return mat;
}

/**
 * Flatten a glTF into {geometry, material} pairs with node transforms baked
 * in, so each pair can drive one InstancedMesh. The models carry a foliage
 * and a trunk material, so each species yields two.
 */
function collectParts(scene) {
  const parts = [];
  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    if (!node.isMesh) return;
    const geometry = node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld);
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    parts.push({ geometry, material: toLambert(mats[0]) });
  });
  return parts;
}

/**
 * Build the forest. `placements` is a flat list of {x, y, z, rotation, tall},
 * where `tall` picks the larger species. Returns a Group of InstancedMeshes —
 * one per species per material, so the whole forest is a handful of draws.
 */
export async function buildForest(placements) {
  const loaded = await Promise.all(
    SPECIES.map(async (s) => ({ ...s, parts: collectParts((await loader.loadAsync(s.url)).scene) }))
  );

  const group = new THREE.Group();
  group.name = "forest";

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();

  loaded.forEach((species, si) => {
    const mine = placements.filter((p) => (p.tall ? 0 : 1) === si);
    if (!mine.length) return;

    for (const part of species.parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, mine.length);
      mesh.frustumCulled = false; // instances span the whole map, not the base geometry's bounds
      mine.forEach((p, i) => {
        // p.size is 0..1; map it across the species' height range, then convert
        // the target world height into a scale factor for this model.
        const targetH = species.worldH[0] + (species.worldH[1] - species.worldH[0]) * p.size;
        s.setScalar(targetH / species.modelH);
        q.setFromAxisAngle(axis, p.rotation);
        v.set(p.x, p.y, p.z);
        m.compose(v, q, s);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    }
  });

  return group;
}
