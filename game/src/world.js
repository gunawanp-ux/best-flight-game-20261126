// Awan Courier — world.js. Builds the island, sky, airport and ring course.
// All art is procedural and original: a seeded heightfield island, a runway
// strip with markings, drifting clouds, storm cells and golden target rings.
import * as THREE from 'three';
import { WORLD, PALETTE } from './config.js';

// ---- deterministic RNG + value noise (seeded, so every level is stable) ----
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

function fbm(x, z, seed, octaves) {
  let v = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise(x * freq, z * freq, seed + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return v / norm;
}

// Runway: a strip along +Z on the south-west flats, heading 0 (due north).
export const RUNWAY = {
  x: -260,
  z: 560,
  heading: 0,
  length: 300,
  width: 26,
  y: 2.4,
};

export class World {
  constructor(scene, level) {
    this.scene = scene;
    this.level = level;
    this.rng = mulberry32(level.seed);
    this.group = new THREE.Group();
    scene.add(this.group);
    this.clouds = [];
    this.storms = [];
    this.rings = [];
    this.time = 0;
    this.buildSky();
    this.buildTerrain();
    this.buildWater();
    this.buildAirport();
    this.buildVegetation();
    this.buildClouds();
    this.buildCourse();
  }

  // Height of the island at world (x, z). Shared by the mesh and by flight
  // collision, so the plane can never sink below the visible ground.
  heightAt(x, z) {
    const r = Math.hypot(x, z);
    const fall = Math.max(0, 1 - Math.pow(r / 1350, 2.2));
    if (fall <= 0) return -6;
    const base = fbm(x * 0.0016 + 7.3, z * 0.0016 + 2.9, this.level.seed, 4);
    const ridge = Math.abs(fbm(x * 0.0035 + 1.7, z * 0.0035 + 8.4, this.level.seed + 55, 3));
    let h = (base * 0.55 + 0.45) * 34 * this.level.mountainScale * fall
      + Math.pow(ridge, 2.4) * 105 * this.level.mountainScale * fall
      - 4;
    // Flatten a pad under the runway so landings are fair: full flatten
    // over the whole strip, blending out over 70 m beyond its edges.
    const ex = Math.max(0, Math.abs(x - RUNWAY.x) - RUNWAY.width / 2);
    const ez = Math.max(0, Math.abs(z - RUNWAY.z) - RUNWAY.length / 2);
    const dPad = Math.hypot(ex, ez);
    if (dPad < 70) {
      const w = 1 - smooth(dPad / 70);
      h = h * (1 - w) + RUNWAY.y * w;
    }
    return h;
  }

  buildSky() {
    // Gradient sky dome (canvas texture on an inside-out sphere).
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#2f7fc9');
    grad.addColorStop(0.55, '#7db8e2');
    grad.addColorStop(0.78, '#cfe8f5');
    grad.addColorStop(1, '#eef6fa');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(4200, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
    );
    this.group.add(dome);

    // Sun: bright disc + glow sprite high in the sky.
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(90, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }),
    );
    sun.position.set(1500, 1250, -2600);
    sun.lookAt(0, 0, 0);
    this.group.add(sun);

    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a7a3a, 1.2);
    this.group.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff2d0, 2.2);
    dir.position.set(900, 1400, 600);
    this.group.add(dir);
    this.scene.fog = new THREE.Fog(WORLD.fogColor, WORLD.fogNear, WORLD.fogFar);
  }

  buildTerrain() {
    const size = WORLD.size;
    const seg = WORLD.segments;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    const grass = new THREE.Color(PALETTE.grass);
    const grassDark = new THREE.Color(PALETTE.grassDark);
    const sand = new THREE.Color(PALETTE.sand);
    const rock = new THREE.Color(PALETTE.rock);
    const snow = new THREE.Color(PALETTE.snow);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this.heightAt(x, z);
      pos.setY(i, h);
      const n = fbm(x * 0.01 + 3, z * 0.01 + 9, this.level.seed + 7, 2);
      if (h < 3.5) col.copy(sand);
      else if (h < 26) col.copy(grass).lerp(grassDark, Math.max(0, n) * 0.7);
      else if (h < 62) col.copy(grassDark).lerp(rock, (h - 26) / 36);
      else if (h < 105) col.copy(rock);
      else col.copy(rock).lerp(snow, Math.min(1, (h - 105) / 25));
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    this.group.add(mesh);
    this.terrain = mesh;
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(9000, 9000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ color: WORLD.seaColor, transparent: true, opacity: 0.94 });
    const water = new THREE.Mesh(geo, mat);
    water.position.y = WORLD.waterLevel;
    this.group.add(water);
    // A lighter shallow ring hugging the shore (a flat ring mesh just above sea).
    const shore = new THREE.Mesh(
      new THREE.RingGeometry(1180, 1420, 48),
      new THREE.MeshBasicMaterial({ color: 0x7fc4d8, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
    );
    shore.rotation.x = -Math.PI / 2;
    shore.position.y = 0.4;
    this.group.add(shore);
  }

  buildAirport() {
    const g = this.group;
    const y = RUNWAY.y;
    // Asphalt strip.
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(RUNWAY.width, RUNWAY.length),
      new THREE.MeshLambertMaterial({ color: PALETTE.runway }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(RUNWAY.x, y + 0.15, RUNWAY.z);
    g.add(strip);
    // Centreline dashes + threshold bars.
    const markMat = new THREE.MeshBasicMaterial({ color: PALETTE.runwayMark });
    for (let dz = -RUNWAY.length / 2 + 18; dz < RUNWAY.length / 2 - 10; dz += 26) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 12), markMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(RUNWAY.x, y + 0.3, RUNWAY.z + dz);
      g.add(dash);
    }
    for (const end of [-1, 1]) {
      for (let k = -2; k <= 2; k++) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 14), markMat);
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(RUNWAY.x + k * 4.6, y + 0.3, RUNWAY.z + end * (RUNWAY.length / 2 - 10));
        g.add(bar);
      }
    }
    // Runway edge lights: small glowing posts.
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
    for (let dz = -RUNWAY.length / 2 + 6; dz <= RUNWAY.length / 2 - 6; dz += 30) {
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), lightMat);
        post.position.set(RUNWAY.x + side * (RUNWAY.width / 2 + 2), y + 1, RUNWAY.z + dz);
        g.add(post);
      }
    }
    // Hangar + control tower + windsock beside the strip.
    const hangar = new THREE.Mesh(
      new THREE.BoxGeometry(34, 12, 24),
      new THREE.MeshLambertMaterial({ color: 0xe8e2d2 }),
    );
    hangar.position.set(RUNWAY.x + 42, y + 6, RUNWAY.z - 60);
    g.add(hangar);
    const hangarRoof = new THREE.Mesh(
      new THREE.ConeGeometry(24, 8, 4),
      new THREE.MeshLambertMaterial({ color: 0x0f8a8a }),
    );
    hangarRoof.rotation.y = Math.PI / 4;
    hangarRoof.scale.set(1.45, 1, 1);
    hangarRoof.position.set(RUNWAY.x + 42, y + 16, RUNWAY.z - 60);
    g.add(hangarRoof);
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 4, 26, 10),
      new THREE.MeshLambertMaterial({ color: 0xf2ede0 }),
    );
    tower.position.set(RUNWAY.x + 44, y + 13, RUNWAY.z + 40);
    g.add(tower);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(9, 5, 9),
      new THREE.MeshLambertMaterial({ color: 0x2a5a8a }),
    );
    cab.position.set(RUNWAY.x + 44, y + 27.5, RUNWAY.z + 40);
    g.add(cab);
    // Windsock: pole + orange cone pointing into the wind.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 12, 8),
      new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
    );
    pole.position.set(RUNWAY.x - 22, y + 6, RUNWAY.z + 120);
    g.add(pole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 6, 10),
      new THREE.MeshLambertMaterial({ color: 0xff7a1a }),
    );
    sock.rotation.z = Math.PI / 2 - 0.35;
    sock.position.set(RUNWAY.x - 19, y + 11, RUNWAY.z + 120);
    g.add(sock);
  }

  buildVegetation() {
    const rng = this.rng;
    const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.treeTrunk });
    const topMat = new THREE.MeshLambertMaterial({ color: PALETTE.treeTop });
    const trunkGeo = new THREE.CylinderGeometry(0.7, 1.1, 5, 6);
    const topGeo = new THREE.ConeGeometry(4.2, 11, 8);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 220);
    const tops = new THREE.InstancedMesh(topGeo, topMat, 220);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let placed = 0;
    let guard = 0;
    while (placed < 220 && guard++ < 4000) {
      const x = (rng() * 2 - 1) * 1150;
      const z = (rng() * 2 - 1) * 1150;
      const h = this.heightAt(x, z);
      if (h < 4 || h > 55) continue;
      if (Math.abs(x - RUNWAY.x) < 90 && Math.abs(z - RUNWAY.z) < 210) continue;
      const sc = 0.8 + rng() * 0.9;
      m.compose(new THREE.Vector3(x, h + 2.5 * sc, z), q, new THREE.Vector3(sc, sc, sc));
      trunks.setMatrixAt(placed, m);
      m.compose(new THREE.Vector3(x, h + (5 + 5.5) * sc, z), q, new THREE.Vector3(sc, sc, sc));
      tops.setMatrixAt(placed, m);
      placed++;
    }
    trunks.count = placed;
    tops.count = placed;
    this.group.add(trunks);
    this.group.add(tops);
    // A little village of houses near the airport.
    const wallMat = new THREE.MeshLambertMaterial({ color: PALETTE.houseWall });
    const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.houseRoof });
    for (let i = 0; i < 10; i++) {
      const x = RUNWAY.x + 90 + rng() * 130;
      const z = RUNWAY.z - 160 + rng() * 320;
      const h = this.heightAt(x, z);
      if (h < 3) continue;
      const house = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 10), wallMat);
      walls.position.y = 3.5;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(9.5, 5, 4), roofMat);
      roof.position.y = 9.5;
      roof.rotation.y = Math.PI / 4;
      house.add(walls);
      house.add(roof);
      house.position.set(x, h, z);
      house.rotation.y = rng() * Math.PI;
      this.group.add(house);
    }
  }

  makeCloudBlob(x, y, z, scale, color, opacity) {
    const grp = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({
      color, transparent: true, opacity,
      emissive: color === PALETTE.storm ? 0x1a1d20 : 0x8a8a8a,
    });
    const puffs = 3 + Math.floor(this.rng() * 3);
    for (let i = 0; i < puffs; i++) {
      const r = (9 + this.rng() * 10) * scale;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      puff.position.set((this.rng() - 0.5) * 26 * scale, (this.rng() - 0.5) * 5 * scale, (this.rng() - 0.5) * 14 * scale);
      puff.scale.y = 0.55;
      grp.add(puff);
    }
    grp.position.set(x, y, z);
    grp.userData.drift = 1.5 + this.rng() * 2.5;
    this.group.add(grp);
    return grp;
  }

  buildClouds() {
    const rng = this.rng;
    for (let i = 0; i < this.level.clouds; i++) {
      const a = rng() * Math.PI * 2;
      const r = 250 + rng() * 1050;
      const c = this.makeCloudBlob(Math.cos(a) * r, 150 + rng() * 130, Math.sin(a) * r, 1.4 + rng() * 1.2, PALETTE.cloudWhite, 0.92);
      this.clouds.push(c);
    }
    // Storm cells: dark, tall, sitting on the course at flight height.
    for (let i = 0; i < this.level.stormClouds; i++) {
      const a = rng() * Math.PI * 2;
      const r = 300 + rng() * 800;
      const c = this.makeCloudBlob(Math.cos(a) * r, 70 + rng() * 60, Math.sin(a) * r, 2.0 + rng() * 0.8, PALETTE.storm, 0.96);
      c.userData.radius = 34;
      this.storms.push(c);
    }
  }

  buildCourse() {
    // A winding sightseeing route: out from the runway, around the island,
    // over the ridge, back to a final approach. Ring heights stay in the
    // 45–130 m band so terrain and storms matter but the route stays flyable.
    const rng = mulberry32(this.level.seed * 7 + 5);
    const n = this.level.rings;
    const pts = [];
    const start = new THREE.Vector3(RUNWAY.x, RUNWAY.y + 55, RUNWAY.z + RUNWAY.length / 2 + 60);
    pts.push(start);
    const cx = 0;
    const cz = 0;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const ang = -0.4 + t * Math.PI * 1.55 + (rng() - 0.5) * 0.35;
      const rad = 420 + Math.sin(t * Math.PI) * 420 + rng() * 120;
      const x = cx + Math.sin(ang) * rad;
      const z = cz + Math.cos(ang) * rad * 0.9;
      const ground = Math.max(0, this.heightAt(x, z));
      const y = Math.max(48, ground + 34 + rng() * 46);
      pts.push(new THREE.Vector3(x, y, z));
    }
    // Final approach ring: low over the runway threshold, on the centreline.
    pts.push(new THREE.Vector3(RUNWAY.x, RUNWAY.y + 26, RUNWAY.z - RUNWAY.length / 2 - 150));
    this.coursePoints = pts;

    const ringGeo = new THREE.TorusGeometry(15, 1.4, 12, 40);
    const beamGeo = new THREE.CylinderGeometry(1.1, 1.1, 220, 8, 1, true);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const grp = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({
        color: PALETTE.ring,
        emissive: 0xa86e00,
      });
      const torus = new THREE.Mesh(ringGeo, mat);
      grp.add(torus);
      // A soft vertical beam so the next ring is visible from far away.
      const beamMat = new THREE.MeshBasicMaterial({
        color: PALETTE.ringGlow, transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 0;
      grp.add(beam);
      grp.position.copy(p);
      // Face the ring toward the previous point so you fly through it.
      const prev = pts[Math.max(0, i - 1)];
      grp.lookAt(prev.x, prev.y, prev.z);
      grp.userData.baseY = p.y;
      grp.userData.phase = rng() * Math.PI * 2;
      grp.userData.taken = false;
      this.group.add(grp);
      this.rings.push(grp);
    }
  }

  update(dt) {
    this.time += dt;
    for (const c of this.clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 1400) c.position.x = -1400;
    }
    for (const s of this.storms) {
      s.position.x += s.userData.drift * 0.6 * dt;
      if (s.position.x > 1400) s.position.x = -1400;
    }
    for (const r of this.rings) {
      if (r.userData.taken) continue;
      r.position.y = r.userData.baseY + Math.sin(this.time * 0.9 + r.userData.phase) * 2.5;
      r.rotation.z += dt * 0.15;
    }
  }
}
