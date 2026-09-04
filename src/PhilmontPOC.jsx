import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { buildForest } from "./trees.js";

/*
  Philmont Scout Ranch — proof of concept
  World scale: 1 unit = 10 m. +x = east, +z = south, +y = up.
  Origin = Camping Headquarters (Base Camp), ~6,650 ft.
  Positions are derived from the 2017 UTM reference guide, relative to CHQ:
    Tooth of Time   ~ -512 E, +137 S   (9,003 ft)
    Tooth Ridge Cmp ~ -392 E, +128 S   (8,300 ft)
  Terrain is a stylized heightfield, not a DEM — that's the next step.
  Built for Vite + React with a current Three.js release (r150+).
*/

const FT = 0.3048 / 10; // feet -> world units
const M = 0.1;          // metres -> world units (1 unit = 10 m)
const BASE_FT = 6650;
const ftToY = (ft) => (ft - BASE_FT) * FT;
const yToFt = (y) => y / FT + BASE_FT;

// ---------- tiny value noise ----------
function hash(x, z) {
  let h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) {
  let s = 0, amp = 1, f = 1, n = 0;
  for (let i = 0; i < 4; i++) { s += amp * vnoise(x * f, z * f); n += amp; amp *= 0.5; f *= 2.1; }
  return s / n;
}
const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const g = (v, c, w) => Math.exp(-((v - c) * (v - c)) / (w * w));

// ---------- elevation in feet ----------
function elevFt(x, z) {
  // valley floor: gentle rise to the west, prairie to the east
  let e = BASE_FT + Math.max(0, -x) * 1.1 + Math.max(0, x) * 0.15;
  // Tooth of Time Ridge, running roughly east–west just south of the trail corridor
  const ridgeZ = 137 + Math.sin(x * 0.01) * 12;
  const crest =
    7350 +
    650 * smooth(-280, -430, x) +           // east end climbs out of the foothills
    1000 * g(x, -512, 46) +                  // Tooth of Time
    1650 * g(x, -618, 52) +                  // Shaefers Peak
    -300 * smooth(-300, -240, x);            // tapers into the prairie
  const w = 62 + 25 * smooth(-350, -600, x);
  e += Math.max(0, crest - e) * Math.max(g(z, ridgeZ, w), 0.55 * g(z, ridgeZ + 90, 120) * smooth(-250, -450, x));
  // Urraca Mesa to the south, foothills to the north-west
  e += 1300 * smooth(360, 470, z) * smooth(-180, -320, x) * (1 - smooth(560, 640, z));
  e += 900 * g(z, -330, 140) * smooth(-150, -400, x);
  // rolling texture
  e += (fbm(x * 0.012, z * 0.012) - 0.5) * 260 + (fbm(x * 0.05, z * 0.05) - 0.5) * 60;
  // keep base camp flat-ish
  e = e * (1 - g(x, 0, 60) * g(z, 0, 45) * 0.9) + BASE_FT * g(x, 0, 60) * g(z, 0, 45) * 0.9;
  return e;
}
const elevY = (x, z) => ftToY(elevFt(x, z));

// ---------- trail: CHQ -> Tooth Ridge Trail -> Tooth Ridge Camp ----------
const TRAIL_XZ = [
  [0, 0], [-40, 6], [-95, 22], [-150, 45], [-205, 72], [-250, 96],
  [-285, 118], [-312, 152], [-338, 122], [-360, 158], [-380, 135], [-392, 128],
];
const TOOTH = [-512, 137];
const RIDGE_CAMP = [-392, 128];

function makeLabel(text, sub) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 160;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(24,31,26,0.82)";
  ctx.beginPath(); ctx.roundRect(8, 8, 496, 144, 18); ctx.fill();
  ctx.fillStyle = "#f2ead9";
  ctx.font = "600 52px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText(text, 256, 74);
  ctx.font = "34px Georgia, serif";
  ctx.fillStyle = "#c9b98c";
  ctx.fillText(sub, 256, 122);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(24, 7.5, 1);
  return sp;
}

export default function PhilmontPOC() {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const [mode, setMode] = useState("overview");
  const [hud, setHud] = useState({ ft: BASE_FT, miles: 0, near: "Camping Headquarters" });
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    let disposed = false;
    const mount = mountRef.current;
    const W = mount.clientWidth, H = mount.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#b9d3e6");
    scene.fog = new THREE.Fog("#c4d6e3", 250, 1100);
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 3000);

    scene.add(new THREE.HemisphereLight("#dfe9f3", "#6b5a3e", 0.75));
    const sun = new THREE.DirectionalLight("#fff3dc", 1.15);
    sun.position.set(-300, 400, 200);
    scene.add(sun);

    // ---------- terrain ----------
    const TW = 1500, TD = 1200, SX = 300, SZ = 240;
    const geo = new THREE.PlaneGeometry(TW, TD, SX, SZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cPrairie = new THREE.Color("#b8a86a"), cSage = new THREE.Color("#8a9a5b"),
      cPine = new THREE.Color("#3f5a3a"), cRock = new THREE.Color("#8c7f70"), cScree = new THREE.Color("#a79d90");
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) - 250, z = pos.getZ(i) + 60; // shift so base camp isn't at the edge
      pos.setX(i, x); pos.setZ(i, z);
      const ft = elevFt(x, z);
      pos.setY(i, ftToY(ft));
      // slope estimate for rock exposure
      const dx = elevFt(x + 4, z) - ft, dz = elevFt(x, z + 4) - ft;
      const slope = Math.sqrt(dx * dx + dz * dz) / 40;
      const t = smooth(6700, 7500, ft);
      tmp.copy(cPrairie).lerp(cSage, t).lerp(cPine, smooth(7300, 8200, ft));
      tmp.lerp(cRock, smooth(0.45, 1.0, slope));
      tmp.lerp(cScree, smooth(8700, 9300, ft) * 0.6);
      const n = (fbm(x * 0.09, z * 0.09) - 0.5) * 0.12;
      tmp.offsetHSL(0, 0, n);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    scene.add(terrain);

    // ---------- Tooth of Time monolith ----------
    const toothY = elevY(TOOTH[0], TOOTH[1]);
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(11, 15, 9),
      new THREE.MeshLambertMaterial({ color: "#8f8072" })
    );
    tooth.position.set(TOOTH[0], toothY + 5.5, TOOTH[1]);
    tooth.rotation.set(0.12, 0.4, -0.08);
    scene.add(tooth);
    const toothLabel = makeLabel("Tooth of Time", "9,003 ft");
    toothLabel.position.set(TOOTH[0], toothY + 20, TOOTH[1]);
    scene.add(toothLabel);

    // ---------- trees ----------
    // Same hash stream and density bands as the cone placeholder these
    // replaced; only the geometry changed, so the forest now loads async.
    const treeCount = 7000;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const treeSpots = [];
    let tries = 0;
    while (treeSpots.length < treeCount && tries < treeCount * 16) {
      tries++;
      const x = -250 + (hash(tries, 3) - 0.5) * TW, z = 60 + (hash(7, tries) - 0.5) * TD;
      const ft = elevFt(x, z);
      const dens = smooth(7050, 7700, ft) * (1 - smooth(9000, 9400, ft)) * (fbm(x * 0.03, z * 0.03) > 0.42 ? 1 : 0.15);
      if (hash(tries, 11) > dens) continue;
      if (Math.abs(x) < 70 && Math.abs(z) < 55) continue; // keep base camp clear
      treeSpots.push({
        x, z, y: ftToY(ft) - 0.05,
        rotation: hash(tries, 29) * Math.PI * 2,
        size: hash(13, tries),
        // mature timber lower down, scrubbier stock toward the upper limit
        tall: hash(tries, 5) > 0.30 + 0.55 * smooth(7700, 8900, ft),
      });
    }
    let forest = null;
    buildForest(treeSpots).then((g) => {
      if (disposed) return;
      forest = g;
      scene.add(g);
    });

    // ---------- trail ----------
    const pts = TRAIL_XZ.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.6);
    const sampled = curve.getPoints(600).map((p) => new THREE.Vector3(p.x, elevY(p.x, p.z) + 0.25, p.z));
    const trailCurve = new THREE.CatmullRomCurve3(sampled, false);
    const trailLen = trailCurve.getLength(); // units; 1 unit = 10 m
    const trail = new THREE.Mesh(
      new THREE.TubeGeometry(trailCurve, 600, 0.55, 6, false),
      new THREE.MeshLambertMaterial({ color: "#a86f3f" })
    );
    scene.add(trail);

    // ---------- base camp ----------
    // Everything here is authored in metres and converted, because the camp was
    // originally built as though 1 unit = 1 m: the tents came out 15 m across
    // and 9 m tall, spaced 24 m apart, and read as pyramids from the ground.
    const camp = new THREE.Group();
    const box = (wM, hM, dM, col, x, z, ry = 0) => {
      const h = hM * M;
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(wM * M, h, dM * M),
        new THREE.MeshLambertMaterial({ color: col })
      );
      m.position.set(x, elevY(x, z) + h / 2, z);
      m.rotation.y = ry;
      camp.add(m);
      return m;
    };
    box(25, 6, 15, "#c9b28e", 4, -6);         // Welcome Center pavilion
    box(50, 9, 26, "#a8845c", 22, 4);         // Camper dining hall
    box(46, 7, 16, "#9d8b73", 20, 18, 0.3);   // Services (L-shaped, simplified)
    box(20, 6, 18, "#d6cdb6", -6, 14);        // Health Lodge
    box(26, 6, 18, "#b78d5c", 8, 24);         // Tooth of Time Traders
    // flagpole — 12 m mast, 3 m flag
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * M, 0.15 * M, 12 * M, 6), new THREE.MeshLambertMaterial({ color: "#eee" }));
    pole.position.set(2, elevY(2, -2) + 6 * M, -2); camp.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.0 * M, 1.9 * M), new THREE.MeshLambertMaterial({ color: "#b3272d", side: THREE.DoubleSide }));
    flag.position.set(2 + 1.6 * M, elevY(2, -2) + 10.5 * M, -2); camp.add(flag);
    // tent cities: Trailbound / Homebound
    // Wall tents on platforms: a 3.2 m square footprint, 2.4 m to the ridge.
    // A 4-segment cone inscribes its square base in `radius`, hence the /sqrt(2).
    const TENT_SIDE = 3.2, TENT_H = 2.4;
    const tentGeo = new THREE.ConeGeometry((TENT_SIDE / Math.SQRT2) * M, TENT_H * M, 4);
    tentGeo.translate(0, (TENT_H / 2) * M, 0); tentGeo.rotateY(Math.PI / 4);
    const tents = new THREE.InstancedMesh(tentGeo, new THREE.MeshLambertMaterial({ color: "#c9bf9c" }), 420);
    let ti = 0;
    // Take a centre rather than a corner, so shrinking the spacing leaves each
    // city where it already sat instead of collapsing it toward its origin.
    const TENT_DX = 5.5 * M, TENT_DZ = 6.5 * M;
    const tentCity = (cx, cz, rows, cols) => {
      const x0 = cx - ((cols - 1) * TENT_DX) / 2;
      const z0 = cz - ((rows - 1) * TENT_DZ) / 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = x0 + c * TENT_DX, z = z0 + r * TENT_DZ;
        m4.compose(new THREE.Vector3(x, elevY(x, z), z), q, new THREE.Vector3(1, 1, 1));
        tents.setMatrixAt(ti++, m4);
      }
    };
    tentCity(-20, -15.7, 12, 16);  // Trailbound
    tentCity(-20, 40.3, 12, 16);   // Homebound
    tents.count = ti; camp.add(tents);
    scene.add(camp);
    const chqLabel = makeLabel("Camping Headquarters", "Base Camp · 6,650 ft");
    chqLabel.position.set(0, elevY(0, 0) + 9, 0); scene.add(chqLabel);

    // ---------- Tooth Ridge Camp ----------
    const rc = new THREE.Group();
    const rcY = elevY(RIDGE_CAMP[0], RIDGE_CAMP[1]);
    for (let i = 0; i < 5; i++) {
      const t = new THREE.Mesh(tentGeo, new THREE.MeshLambertMaterial({ color: "#d9c7a0" }));
      const x = RIDGE_CAMP[0] + Math.cos(i * 1.3) * 3.2, z = RIDGE_CAMP[1] + Math.sin(i * 1.3) * 3.2;
      t.position.set(x, elevY(x, z), z); rc.add(t);
    }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.15 * M, 2.0 * M, 0.15 * M), new THREE.MeshLambertMaterial({ color: "#5a3f28" }));
    sign.position.set(RIDGE_CAMP[0], rcY + 1.0 * M, RIDGE_CAMP[1] + 4); rc.add(sign);
    scene.add(rc);
    const rcLabel = makeLabel("Tooth Ridge Camp", "Trail camp · 8,300 ft");
    rcLabel.position.set(RIDGE_CAMP[0], rcY + 8, RIDGE_CAMP[1]); scene.add(rcLabel);

    // ---------- controls ----------
    const st = stateRef.current;
    st.keys = {};
    st.hikeT = 0; st.miles = 0;
    st.pos = new THREE.Vector3(6, elevY(6, 8) + 0.18, 8);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.target.set(-190, elevY(-190, 70) + 20, 70);
    orbit.minDistance = 60; orbit.maxDistance = 1200;
    orbit.maxPolarAngle = 1.45; orbit.enableDamping = true;
    camera.position.set(-190 + 520 * Math.sin(0.95) * Math.cos(2.4), orbit.target.y + 520 * Math.cos(0.95), 70 + 520 * Math.sin(0.95) * Math.sin(2.4));
    orbit.update();
    st.orbit = orbit;

    const lock = new PointerLockControls(camera, renderer.domElement);
    st.lock = lock; st.camera = camera;
    const onClick = () => { if (modeRef.current === "walk" && !lock.isLocked) lock.lock(); };
    renderer.domElement.addEventListener("click", onClick);

    const onKey = (e) => { st.keys[e.key.toLowerCase()] = e.type === "keydown"; if (["w","a","s","d"].includes(e.key.toLowerCase())) e.preventDefault(); };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    let last = performance.now(), hudTick = 0;
    let raf;

    const nearestName = (p) => {
      const dT = Math.hypot(p.x - TOOTH[0], p.z - TOOTH[1]);
      const dR = Math.hypot(p.x - RIDGE_CAMP[0], p.z - RIDGE_CAMP[1]);
      const dB = Math.hypot(p.x, p.z);
      if (dB < 80) return "Camping Headquarters";
      if (dR < 40) return "Tooth Ridge Camp";
      if (dT < 60) return "Tooth of Time";
      return "Tooth Ridge Trail";
    };

    const animate = (now) => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const m = modeRef.current;

      orbit.enabled = m === "overview";
      if (m === "overview") {
        orbit.update();
        st.pos.copy(orbit.target);
      } else if (m === "walk") {
        const run = st.keys["shift"] ? 2.2 : 1;
        const sp = 1.6 * run * dt; // 16 m/s at walk — brisk, this is a game
        if (st.keys["w"] || st.keys["arrowup"]) lock.moveForward(sp);
        if (st.keys["s"] || st.keys["arrowdown"]) lock.moveForward(-sp);
        if (st.keys["a"] || st.keys["arrowleft"]) lock.moveRight(-sp);
        if (st.keys["d"] || st.keys["arrowright"]) lock.moveRight(sp);
        camera.position.y = elevY(camera.position.x, camera.position.z) + 0.18;
        st.pos.copy(camera.position);
      } else if (m === "hike") {
        st.hikeT = Math.min(1, st.hikeT + (dt * 2.4) / trailLen);
        const p = trailCurve.getPointAt(st.hikeT);
        const ahead = trailCurve.getPointAt(Math.min(1, st.hikeT + 0.012));
        camera.position.set(p.x, p.y + 0.5, p.z);
        camera.lookAt(ahead.x, ahead.y + 0.3, ahead.z);
        st.pos.copy(camera.position);
        st.miles = (st.hikeT * trailLen * 10) / 1609.34;
        if (st.hikeT >= 1) setMode("walk");
      }

      hudTick += dt;
      if (hudTick > 0.15) {
        hudTick = 0;
        const p = st.pos;
        setHud({ ft: Math.round(yToFt(elevY(p.x, p.z))), miles: st.miles, near: nearestName(p) });
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey);
      orbit.dispose(); lock.dispose();
      window.removeEventListener("resize", onResize);
      renderer.dispose(); geo.dispose();
      forest?.traverse((n) => { if (n.isInstancedMesh) { n.geometry.dispose(); n.dispose(); } });
      mount.removeChild(renderer.domElement);
    };
  }, []);

  const goOverview = () => { stateRef.current.lock?.unlock(); setMode("overview"); };
  const startHike = () => { stateRef.current.lock?.unlock(); stateRef.current.hikeT = 0; stateRef.current.miles = 0; setMode("hike"); };
  const startWalk = () => {
    const st = stateRef.current;
    if (mode !== "walk") {
      st.pos.set(6, elevY(6, 8) + 0.18, 8);
      st.camera.position.copy(st.pos);
      st.camera.lookAt(-60, st.pos.y + 4, 20); // face the ridge
      st.miles = 0;
    }
    setMode("walk");
  };

  const btn = (active) => ({
    background: active ? "#f2ead9" : "rgba(242,234,217,0.12)",
    color: active ? "#1f2a22" : "#f2ead9",
    border: "1px solid rgba(242,234,217,0.45)",
    padding: "8px 14px", borderRadius: 6, cursor: "pointer",
    font: "500 14px Georgia, serif", letterSpacing: 0.2,
  });

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", minHeight: 520, background: "#b9d3e6", overflow: "hidden", fontFamily: "Georgia, 'Iowan Old Style', serif" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0, cursor: "grab" }} />

      <div style={{ position: "absolute", top: 16, left: 16, color: "#f2ead9", background: "rgba(24,31,26,0.78)", padding: "14px 18px", borderRadius: 10, maxWidth: 320, lineHeight: 1.35 }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Philmont Scout Ranch</div>
        <div style={{ fontSize: 14, color: "#c9b98c", marginBottom: 10 }}>Base Camp to Tooth Ridge Camp · proof of concept</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btn(mode === "overview")} onClick={goOverview}>Overview</button>
          <button style={btn(mode === "walk")} onClick={startWalk}>Walk</button>
          <button style={btn(mode === "hike")} onClick={startHike}>Hike the trail</button>
        </div>
        <div style={{ fontSize: 13, marginTop: 10, color: "#d8cfb8" }}>
          {mode === "overview" && "Drag to orbit, scroll to zoom. The brown line is the Tooth Ridge Trail."}
          {mode === "walk" && "Click the view to capture the mouse, then W A S D to move and hold Shift to run. Esc releases the mouse."}
          {mode === "hike" && "Auto-hiking west from headquarters up onto Tooth Ridge."}
        </div>
      </div>

      <div style={{ position: "absolute", right: 16, bottom: 16, color: "#f2ead9", background: "rgba(24,31,26,0.78)", padding: "12px 16px", borderRadius: 10, textAlign: "right", lineHeight: 1.3 }}>
        <div style={{ fontSize: 13, color: "#c9b98c" }}>Nearest</div>
        <div style={{ fontSize: 17 }}>{hud.near}</div>
        <div style={{ fontSize: 13, color: "#c9b98c", marginTop: 8 }}>Elevation</div>
        <div style={{ fontSize: 28, fontWeight: 600 }}>{hud.ft.toLocaleString()} ft</div>
        {mode === "hike" && (
          <>
            <div style={{ fontSize: 13, color: "#c9b98c", marginTop: 8 }}>Hiked</div>
            <div style={{ fontSize: 17 }}>{hud.miles.toFixed(1)} mi</div>
          </>
        )}
      </div>
    </div>
  );
}
