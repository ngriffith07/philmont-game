import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildTerrain } from './terrain.js';
import { loadParts, instance, scatterOnTerrain, mulberry32, footprintRadius } from './scatter.js';

const SEED = 7;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9dc3e0);
scene.fog = new THREE.Fog(0x9dc3e0, 260, 620);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 1400);
camera.position.set(150, 110, 190);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-20, 20, -10);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

// Late-morning sun, high and to the southeast.
scene.add(new THREE.HemisphereLight(0xbcd8ef, 0x4a5340, 1.35));
const sun = new THREE.DirectionalLight(0xfff2dc, 2.3);
sun.position.set(160, 210, 90);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 700;
const extent = 260;
Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent });
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun);

const terrain = buildTerrain({ size: 460, segments: 240, amplitude: 95, seed: SEED });
scene.add(terrain.mesh);

const rng = mulberry32(SEED);

const [pineLarge, pineSmall, rockA, rockB, stone] = await Promise.all([
  loadParts('/assets/models/trees/pine-large.glb'),
  loadParts('/assets/models/trees/pine-small.glb'),
  loadParts('/assets/models/rocks/rock-formation.glb'),
  loadParts('/assets/models/rocks/rock-formation-large.glb'),
  loadParts('/assets/models/rocks/stone-formation.glb'),
]);

const { height, size, treeline } = terrain;

// Mature timber through the middle elevations.
scene.add(instance(pineLarge, scatterOnTerrain({
  height, size, rng, count: 1400,
  minY: -4, maxY: treeline, maxSlope: 0.55, scaleRange: [11, 19],
})));

// Smaller stock lower down and out toward the meadows.
scene.add(instance(pineSmall, scatterOnTerrain({
  height, size, rng, count: 900,
  minY: -8, maxY: treeline * 0.8, maxSlope: 0.4, scaleRange: [8, 14],
})));

// Outcrops stay in and just below the timber. Above the treeline the ground
// reads as talus and snow on its own; isolated spires up there only look like
// they are hovering, because intervening ridges hide their bases.
scene.add(instance(rockA, scatterOnTerrain({
  height, size, rng, count: 55,
  minY: treeline * 0.35, maxY: treeline * 0.95, maxSlope: 0.45,
  scaleRange: [4, 8], footprint: footprintRadius(rockA),
})));
scene.add(instance(rockB, scatterOnTerrain({
  height, size, rng, count: 30,
  minY: treeline * 0.5, maxY: treeline, maxSlope: 0.45,
  scaleRange: [5, 9], footprint: footprintRadius(rockB),
})));
scene.add(instance(stone, scatterOnTerrain({
  height, size, rng, count: 120,
  minY: -10, maxY: treeline, maxSlope: 0.5,
  scaleRange: [3, 7], footprint: footprintRadius(stone),
})));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});


