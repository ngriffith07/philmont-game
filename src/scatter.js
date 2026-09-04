import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

/**
 * Flatten a loaded glTF into {geometry, material} pairs with the node
 * transforms baked in, so each pair can drive one InstancedMesh.
 */
function collectParts(scene) {
  const parts = [];
  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    if (!node.isMesh) return;
    const geometry = node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld);
    parts.push({ geometry, material: node.material });
  });
  return parts;
}

export async function loadParts(url) {
  const gltf = await loader.loadAsync(url);
  return collectParts(gltf.scene);
}

/**
 * Half the larger horizontal footprint of a model, in model units. Used to
 * seat wide models into a slope so their downhill edge does not hang in air.
 */
export function footprintRadius(parts) {
  const box = new THREE.Box3();
  for (const part of parts) {
    part.geometry.computeBoundingBox();
    box.union(part.geometry.boundingBox);
  }
  const size = box.getSize(new THREE.Vector3());
  return Math.max(size.x, size.z) / 2;
}

/**
 * Deterministic PRNG so a given seed always lays out the same forest.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Place `placements` ({position, scale, rotation}) as instanced copies of the
 * parts, one InstancedMesh per material.
 */
export function instance(parts, placements) {
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();

  for (const part of parts) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
    mesh.castShadow = true;
    placements.forEach((p, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation);
      s.setScalar(p.scale);
      m.compose(p.position, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }
  return group;
}

/**
 * Sample terrain for spots that suit a given species: within an elevation
 * band and not on ground too steep to hold soil.
 */
export function scatterOnTerrain({
  height, size, count, minY, maxY, maxSlope = 0.45,
  scaleRange = [1, 1], rng, margin = 0.72, footprint = 0,
}) {
  const placements = [];
  const half = (size / 2) * margin;
  const eps = size / 400;
  let guard = 0;

  while (placements.length < count && guard++ < count * 60) {
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    const y = height(x, z);
    if (y < minY || y > maxY) continue;

    // Central-difference slope from the height field itself.
    const dx = (height(x + eps, z) - height(x - eps, z)) / (2 * eps);
    const dz = (height(x, z + eps) - height(x, z - eps)) / (2 * eps);
    if (Math.hypot(dx, dz) > maxSlope) continue;

    const scale = THREE.MathUtils.lerp(scaleRange[0], scaleRange[1], rng());

    // A model with a flat base standing on a slope leaves its downhill edge
    // hanging. Drop it by roughly the rise across its own footprint so the
    // base ends up buried instead.
    const sink = footprint * scale * Math.hypot(dx, dz);

    placements.push({
      position: new THREE.Vector3(x, y - sink, z),
      rotation: rng() * Math.PI * 2,
      scale,
    });
  }
  return placements;
}
