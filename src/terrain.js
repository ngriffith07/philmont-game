import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

const MEADOW = new THREE.Color(0x6f8f4a);
const FOREST = new THREE.Color(0x4a6b3c);
const ROCK   = new THREE.Color(0x8b8378);
const SCREE  = new THREE.Color(0xa8a196);
const SNOW   = new THREE.Color(0xe6edf2);

/**
 * Fractal Brownian motion over ImprovedNoise. Returns roughly [-1, 1].
 */
function fbm(noise, x, z, octaves = 5) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise.noise(x * freq, z * freq, 0) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return sum / norm;
}

/**
 * Height field for the high country: broad ridges with a sharper summit mass
 * on one side, so there is somewhere to hike up to.
 */
export function makeHeightField({ size, amplitude, seed = 0 }) {
  const noise = new ImprovedNoise();
  const o = seed * 13.37;
  return (x, z) => {
    const u = (x / size) * 2.2 + o;
    const v = (z / size) * 2.2 + o;
    const base = fbm(noise, u, v) * 0.5 + 0.5;
    // Ridged term picks out spines rather than blobs.
    const ridge = 1 - Math.abs(fbm(noise, u * 1.9 + 4.1, v * 1.9 - 2.7, 4));
    // Push elevation up toward one corner to seat a summit.
    const d = Math.hypot(x / size + 0.28, z / size + 0.22);
    const massif = Math.max(0, 1 - d * 1.55) ** 2;
    const h = base * 0.45 + ridge * ridge * 0.3 + massif * 0.75;

    // Ease the height field down toward the rim so the plane's hard edge sits
    // low and out of the way instead of ending in a cliff against the sky.
    const rim = Math.max(Math.abs(x), Math.abs(z)) / (size / 2);
    const falloff = 1 - THREE.MathUtils.smoothstep(rim, 0.62, 1);

    return (h - 0.32) * amplitude * falloff - (1 - falloff) * amplitude * 0.06;
  };
}

/**
 * Flat-shaded terrain mesh, vertex-coloured by elevation and slope so it reads
 * as meadow / timber / talus / snow without any textures.
 */
export function buildTerrain({ size = 400, segments = 220, amplitude = 90, seed = 0 } = {}) {
  const height = makeHeightField({ size, amplitude, seed });

  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  }

  // Flat shading needs unindexed geometry; do it before computing normals so
  // each triangle gets its own facet normal.
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();

  const p = flat.attributes.position;
  const n = flat.attributes.normal;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();

  const treeline = amplitude * 0.42;
  const snowline = amplitude * 0.62;

  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const slope = 1 - n.getY(i); // 0 flat, ~1 vertical

    if (y < treeline) {
      c.copy(MEADOW).lerp(FOREST, THREE.MathUtils.smoothstep(y, 0, treeline));
    } else if (y < snowline) {
      c.copy(FOREST).lerp(ROCK, THREE.MathUtils.smoothstep(y, treeline, snowline));
    } else {
      c.copy(ROCK).lerp(SNOW, THREE.MathUtils.smoothstep(y, snowline, amplitude * 0.85));
    }
    // Steep faces are bare rock regardless of elevation.
    c.lerp(SCREE, THREE.MathUtils.smoothstep(slope, 0.35, 0.75));

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(
    flat,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  );
  mesh.receiveShadow = true;
  mesh.name = 'terrain';

  return { mesh, height, size, amplitude, treeline };
}
