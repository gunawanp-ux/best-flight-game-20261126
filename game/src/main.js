// Awan Courier — Island Run. main.js: renderer, flight model, collisions,
// levels, scoring and the screenshot presets (?shot=start|play|end|landing).
// Plays fully offline from static files; no network request is made.
import * as THREE from 'three';
import { LEVELS, FLIGHT } from './config.js';
import { World, RUNWAY } from './world.js';
import { buildPlane } from './plane.js';
import { HUD } from './hud.js';
import { Input } from './input.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const SEED_PARAM = Number(params.get('seed') || '1');

// ---- renderer / scene ----
const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 9000);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const hud = new HUD(document.getElementById('hud'));
const input = new Input();
input.attach();

// ---- game state ----
const G = {
  screen: 'title', // title | playing | paused | levelComplete | gameOver | missionComplete
  levelIndex: 0,
  score: 0,
  bestScore: 0,
  ringsGot: 0,
  combo: 0,
  timeLeft: 0,
  hull: FLIGHT.hullMax,
  throttle: 0.55,
  speed: 0,
  heading: 0,
  pitch: 0,
  roll: 0, // visual bank, rad
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  targetRing: 0,
  stormCooldown: 0,
  shake: 0,
  levelBonus: 0,
  nextLevelName: '',
  gameOverTitle: 'MISSION FAILED',
  gameOverLine: '',
  landed: false,
  autoPilot: false,
  camOrbit: 0,
};

let world = null;
let plane = null;
let prop = null;
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();

function loadLevel(index, keepScore) {
  if (world) {
    scene.remove(world.group);
    world.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) if (m.map) m.map.dispose();
      }
    });
  }
  const level = LEVELS[index];
  G.levelIndex = index;
  world = new World(scene, level);
  if (!plane) {
    const built = buildPlane();
    plane = built.group;
    prop = built.prop;
    scene.add(plane);
  }
  G.targetRing = 0;
  G.ringsGot = 0;
  G.combo = 0;
  G.timeLeft = level.timeLimit;
  G.hull = FLIGHT.hullMax;
  G.throttle = 0.55;
  G.speed = 0;
  G.heading = RUNWAY.heading;
  G.pitch = 0;
  G.roll = 0;
  G.stormCooldown = 0;
  G.shake = 0;
  G.landed = false;
  // Park at the south end of the runway, nose pointing north (+Z) down the strip.
  const spawnZ = RUNWAY.z - RUNWAY.length / 2 + 30;
  G.pos.set(RUNWAY.x, world.heightAt(RUNWAY.x, spawnZ) + 2.2, spawnZ);
  G.vel.set(0, 0, 0);
  if (!keepScore) G.score = 0;
  hud.clearMessages();
  updatePlaneTransform(0);
}

function startLevel() {
  G.screen = 'playing';
  hud.pushMessage(`${LEVELS[G.levelIndex].name} — fly the rings!`, '#ffd34d');
}

function updatePlaneTransform(dt) {
  plane.position.copy(G.pos);
  plane.rotation.set(0, 0, 0);
  plane.rotateY(G.heading);
  plane.rotateX(-G.pitch);
  plane.rotateZ(G.roll);
  if (prop) prop.rotation.z += dt * (18 + G.throttle * 42);
}

function crash(reason) {
  G.hull -= reason === 'ground' ? FLIGHT.groundHitDamage : FLIGHT.stormDamage;
  G.shake = 0.9;
  if (G.hull <= 0) {
    G.hull = 0;
    gameOver(reason === 'ground' ? 'CRASHED' : 'TORN APART BY THE STORM',
      reason === 'ground'
        ? 'The island wins this round. Watch the peaks — and the water.'
        : 'The storm cells chewed the hull apart. Give them a wide berth.');
    return;
  }
  hud.pushMessage(reason === 'ground' ? 'HULL HIT! Careful!' : 'STORM DAMAGE!', '#ff5a4d');
  // Bounce clear of the ground so one hit is not an instant death spiral.
  G.pitch = 0.35;
  G.speed *= 0.62;
  G.pos.y = Math.max(G.pos.y, world.heightAt(G.pos.x, G.pos.z) + 6);
}

function gameOver(title, line) {
  G.screen = 'gameOver';
  G.gameOverTitle = title;
  G.gameOverLine = line;
  G.bestScore = Math.max(G.bestScore, G.score);
}

function levelComplete() {
  const timeBonus = Math.round(G.timeLeft) * 10;
  G.levelBonus = timeBonus + 500;
  G.score += G.levelBonus;
  G.bestScore = Math.max(G.bestScore, G.score);
  G.nextLevelName = G.levelIndex + 1 < LEVELS.length ? LEVELS[G.levelIndex + 1].name : '';
  G.screen = 'levelComplete';
}

function missionComplete() {
  G.screen = 'missionComplete';
  G.bestScore = Math.max(G.bestScore, G.score);
}

// ---- flight update ----
function updateFlight(dt) {
  const level = LEVELS[G.levelIndex];
  const now = performance.now();
  let ax = input.axes(now);

  // Autopilot (screenshot preset + attract mode): steer toward the target.
  if (G.autoPilot) ax = autoPilotAxes();

  // Throttle and speed.
  G.throttle = Math.max(0.15, Math.min(1, G.throttle + ax.throttle * dt * 0.5));
  const cruise = FLIGHT.minSpeed + (FLIGHT.maxSpeed - FLIGHT.minSpeed) * G.throttle;
  const targetSpeed = cruise + (ax.boost ? FLIGHT.boostAdd : 0);
  G.speed += (targetSpeed - G.speed) * Math.min(1, dt * 0.9);
  // Climbing bleeds speed a little; diving gains a little.
  G.speed -= Math.sin(G.pitch) * 6 * dt;

  // Banking turns the plane; pitch is eased toward the input.
  const bankTarget = -ax.roll * FLIGHT.maxBank;
  G.roll += (bankTarget - G.roll) * Math.min(1, dt * 4.5);
  G.heading += -G.roll * FLIGHT.turnRate * dt * (0.55 + G.speed / 120);
  const pitchTarget = ax.pitch * FLIGHT.maxPitch;
  G.pitch += (pitchTarget - G.pitch) * Math.min(1, dt * 3.2);

  // Move.
  const fwd = new THREE.Vector3(
    Math.sin(G.heading) * Math.cos(G.pitch),
    Math.sin(G.pitch),
    Math.cos(G.heading) * Math.cos(G.pitch),
  );
  G.pos.addScaledVector(fwd, G.speed * dt);
  G.vel.copy(fwd).multiplyScalar(G.speed);

  // Keep the plane inside the world.
  const rr = Math.hypot(G.pos.x, G.pos.z);
  if (rr > 1500) {
    const s = 1500 / rr;
    G.pos.x *= s;
    G.pos.z *= s;
    G.heading += Math.PI;
    hud.pushMessage('Turn back — open sea ahead!', '#9fc6dd');
  }
  G.pos.y = Math.max(G.pos.y, 1.2);

  // Timer.
  G.timeLeft -= dt;
  if (G.timeLeft <= 0) {
    G.timeLeft = 0;
    gameOver('OUT OF TIME', 'The mail run window closed. Rings add +3s each — grab them!');
    return;
  }
  G.stormCooldown = Math.max(0, G.stormCooldown - dt);
  G.shake = Math.max(0, G.shake - dt * 1.4);

  // Terrain / water collision.
  const ground = world.heightAt(G.pos.x, G.pos.z);
  if (G.pos.y < ground + 2.2) {
    if (tryLand()) return;
    crash('ground');
    if (G.screen !== 'playing') return;
  }

  // Storm cells.
  for (const s of world.storms) {
    if (G.stormCooldown > 0) break;
    if (G.pos.distanceTo(s.position) < (s.userData.radius || 34)) {
      G.stormCooldown = 1.2;
      G.speed *= 0.94;
      crash('storm');
      if (G.screen !== 'playing') return;
      break;
    }
  }

  // Rings.
  const ring = world.rings[G.targetRing];
  if (ring && !ring.userData.taken) {
    const d = G.pos.distanceTo(ring.position);
    if (d < FLIGHT.ringRadius + 2) {
      ring.userData.taken = true;
      ring.visible = false;
      G.ringsGot++;
      G.combo = Math.min(8, G.combo + 1);
      const pts = FLIGHT.ringScore * G.combo;
      G.score += pts;
      G.timeLeft += FLIGHT.ringTimeBonus;
      hud.pushMessage(`RING! +${pts}  •  +${FLIGHT.ringTimeBonus}s`, '#ffd34d');
      if (G.targetRing < world.rings.length - 1) G.targetRing++;
    }
  }
  updatePlaneTransform(dt);
}

// Landing: on the strip, slow, level, roughly aligned with the runway.
function tryLand() {
  const dx = Math.abs(G.pos.x - RUNWAY.x);
  const dz = Math.abs(G.pos.z - RUNWAY.z);
  const aligned = Math.abs(Math.sin(G.heading)) < 0.45;
  const allRings = G.ringsGot >= world.rings.length;
  if (dx < RUNWAY.width / 2 + 4 && dz < RUNWAY.length / 2 + 6
    && G.speed < FLIGHT.landingSpeedMax && Math.abs(G.pitch) < 0.3 && aligned) {
    if (!allRings) {
      hud.pushMessage(`Land after the rings — ${world.rings.length - G.ringsGot} to go!`, '#ffd34d');
      G.pos.y = world.heightAt(G.pos.x, G.pos.z) + 2.4;
      G.pitch = 0;
      G.speed *= 0.5;
      return true; // rolled out on the strip, still playing
    }
    G.landed = true;
    G.pos.y = world.heightAt(G.pos.x, G.pos.z) + 2.2;
    G.speed = 0;
    updatePlaneTransform(0);
    if (G.levelIndex + 1 < LEVELS.length) levelComplete();
    else {
      G.score += Math.round(G.timeLeft) * 10 + 500;
      missionComplete();
    }
    return true;
  }
  return false;
}

function autoPilotAxes() {
  // Steer toward the current ring (or the runway once rings are done).
  let target;
  const ring = world.rings[G.targetRing];
  if (ring && !ring.userData.taken) {
    target = ring.position;
  } else {
    // Final approach: hold a safe height above the local ground until the
    // plane is actually over the flat strip, then descend to just below
    // the touchdown trigger so tryLand catches it while it is level.
    // Aim past the strip's centre at its far end, so the plane never
    // flies through its own target mid-descent and turns away.
    const groundBelow = world.heightAt(G.pos.x, G.pos.z);
    const overStrip = Math.abs(G.pos.x - RUNWAY.x) < 30
      && Math.abs(G.pos.z - RUNWAY.z) < RUNWAY.length / 2 - 10;
    // Aim below the touchdown trigger so the plane crosses it briskly
    // instead of asymptoting above it and flying off the strip's end.
    const ty = overStrip
      ? RUNWAY.y - 2.0
      : Math.max(RUNWAY.y + 32, groundBelow + 26);
    target = new THREE.Vector3(RUNWAY.x, ty, RUNWAY.z + 120);
  }
  const dx = target.x - G.pos.x;
  const dz = target.z - G.pos.z;
  const wantHeading = Math.atan2(dx, dz);
  let dh = wantHeading - G.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const altErr = target.y - G.pos.y;
  return {
    roll: Math.max(-1, Math.min(1, dh * 1.6)),
    pitch: Math.max(-0.7, Math.min(0.7, altErr * 0.016)),
    throttle: 0,
    boost: false,
  };
}

// ---- camera ----
function updateCamera(dt) {
  const t = performance.now() / 1000;
  if (G.screen === 'title' || G.screen === 'levelComplete' || G.screen === 'missionComplete') {
    // Slow orbit around the parked plane, looking north along the runway
    // strip so the strip, the plane and the island all read in the frame.
    G.camOrbit += dt * 0.12;
    const r = 30;
    camPos.set(
      G.pos.x + Math.sin(G.camOrbit) * r,
      G.pos.y + 12 + Math.sin(t * 0.3) * 1.5,
      G.pos.z + Math.cos(G.camOrbit) * r,
    );
    camLook.copy(G.pos).add(new THREE.Vector3(0, 2, 60));
  } else {
    // Chase camera: behind and above, looking ahead of the nose.
    const back = new THREE.Vector3(-Math.sin(G.heading), 0, -Math.cos(G.heading));
    const desired = G.pos.clone()
      .addScaledVector(back, 15)
      .add(new THREE.Vector3(0, 5.2 - G.pitch * 4, 0));
    camPos.lerp(desired, Math.min(1, dt * 5));
    camLook.copy(G.pos).addScaledVector(
      new THREE.Vector3(Math.sin(G.heading), 0, Math.cos(G.heading)), 26,
    ).add(new THREE.Vector3(0, G.pitch * 14, 0));
  }
  if (G.shake > 0) {
    const s = G.shake * 0.9;
    camPos.x += (Math.random() - 0.5) * s;
    camPos.y += (Math.random() - 0.5) * s;
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  camera.fov = 62 + Math.max(0, (G.speed - 70)) * 0.25 + (input.axes(performance.now()).boost ? 4 : 0);
  camera.updateProjectionMatrix();
}

// ---- HUD state ----
function hudState() {
  const level = LEVELS[G.levelIndex];
  let target = null;
  const ring = world.rings[G.targetRing];
  if (G.screen === 'playing' || G.screen === 'paused') {
    if (ring && !ring.userData.taken) {
      target = { kind: 'ring', index: G.targetRing, dist: G.pos.distanceTo(ring.position), angle: 0 };
    } else {
      target = { kind: 'runway', index: -1, dist: Math.hypot(G.pos.x - RUNWAY.x, G.pos.z - RUNWAY.z), angle: 0 };
    }
    // Screen-space steering angle: rotate the world direction into the
    // camera frame (camera looks along the plane heading).
    const tp = ring && !ring.userData.taken ? ring.position : new THREE.Vector3(RUNWAY.x, RUNWAY.y + 10, RUNWAY.z);
    const dx = tp.x - G.pos.x;
    const dz = tp.z - G.pos.z;
    const worldAng = Math.atan2(dx, dz);
    let rel = worldAng - G.heading;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    target.angle = -rel;
  }
  const allRings = G.ringsGot >= world.rings.length;
  return {
    screen: G.screen,
    score: G.score,
    bestScore: G.bestScore,
    ringsGot: G.ringsGot,
    ringsTotal: world.rings.length,
    combo: G.combo,
    timeLeft: G.timeLeft,
    hull: G.hull,
    throttle: G.throttle,
    boost: input.axes(performance.now()).boost,
    speed: G.speed,
    altitude: Math.max(0, G.pos.y - world.heightAt(G.pos.x, G.pos.z)),
    heading: G.heading,
    pitch: G.pitch,
    roll: G.roll,
    levelName: level.name,
    levelSub: level.sub,
    levelIndex: G.levelIndex,
    briefing: level.briefing,
    nextLevelName: G.nextLevelName,
    levelBonus: G.levelBonus,
    gameOverTitle: G.gameOverTitle,
    gameOverLine: G.gameOverLine,
    target,
    landingHint: allRings && G.screen === 'playing'
      ? 'ALL RINGS! Land on the runway — slow and level'
      : '',
  };
}

// ---- input actions ----
input.onAction = (action) => {
  if (action === 'start') {
    if (G.screen === 'title') startLevel();
    else if (G.screen === 'paused') G.screen = 'playing';
    else if (G.screen === 'levelComplete') {
      loadLevel(G.levelIndex + 1, true);
      startLevel();
    } else if (G.screen === 'gameOver' || G.screen === 'missionComplete') {
      loadLevel(0, false);
      startLevel();
    }
  } else if (action === 'restart') {
    if (G.screen !== 'title') {
      loadLevel(G.levelIndex, false);
      startLevel();
    }
  } else if (action === 'pause') {
    if (G.screen === 'playing') G.screen = 'paused';
    else if (G.screen === 'paused') G.screen = 'playing';
  }
};

// ---- screenshot presets (?shot=...) ----
function applyShotPreset() {
  if (!SHOT) return;
  if (SHOT === 'start') {
    loadLevel(0, false);
    G.screen = 'title';
    G.camOrbit = 0.9; // frame the parked plane with the island behind it
    return;
  }
  if (SHOT === 'play' || SHOT === 'landing' || SHOT === 'end') {
    const levelIdx = SHOT === 'end' ? 0 : 0;
    loadLevel(levelIdx, false);
    G.autoPilot = true;
    G.screen = 'playing';
    if (SHOT === 'play') {
      // Mid-course: a few rings in, banking toward the next one.
      G.targetRing = 4;
      for (let i = 0; i < 4; i++) {
        world.rings[i].userData.taken = true;
        world.rings[i].visible = false;
      }
      G.ringsGot = 4;
      G.combo = 3;
      G.score = 900;
      const p = world.coursePoints[4];
      G.pos.set(p.x - 90, p.y + 8, p.z + 60);
      G.heading = Math.atan2(world.coursePoints[5].x - p.x, world.coursePoints[5].z - p.z);
      G.throttle = 0.7;
      G.speed = 68;
      G.timeLeft = 142;
    } else if (SHOT === 'landing') {
      for (const r of world.rings) {
        r.userData.taken = true;
        r.visible = false;
      }
      G.ringsGot = world.rings.length;
      G.targetRing = world.rings.length - 1;
      G.score = 2450;
      G.combo = 5;
      G.pos.set(RUNWAY.x + 6, RUNWAY.y + 48, RUNWAY.z - RUNWAY.length / 2 - 420);
      G.heading = 0;
      G.throttle = 0.35;
      G.speed = 52;
      G.timeLeft = 96;
    } else {
      // end: mission complete over the runway at golden hour framing.
      for (const r of world.rings) {
        r.userData.taken = true;
        r.visible = false;
      }
      G.ringsGot = world.rings.length;
      G.score = 3820;
      G.screen = 'missionComplete';
      G.pos.set(RUNWAY.x, RUNWAY.y + 2.2, RUNWAY.z - RUNWAY.length / 2 + 30);
      G.heading = 0;
      G.speed = 0;
    }
    updatePlaneTransform(0);
    updateCamera(1);
  }
}

// ---- main loop ----
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.screen === 'playing') updateFlight(dt);
  if (world) world.update(dt);
  if (G.screen === 'title') updatePlaneTransform(dt);
  updateCamera(dt);
  hud.draw(hudState(), dt);
  renderer.render(scene, camera);
}

loadLevel(0, false);
applyShotPreset();

// Read-only debug handle for automated play-testing (state snapshot only;
// it cannot change the game). Used by local test scripts, not by gameplay.
window.__awan = {
  get screen() { return G.screen; },
  get score() { return G.score; },
  get ringsGot() { return G.ringsGot; },
  get ringsTotal() { return world ? world.rings.length : 0; },
  get hull() { return G.hull; },
  get timeLeft() { return G.timeLeft; },
  get speed() { return G.speed; },
  get altitude() { return world ? Math.max(0, G.pos.y - world.heightAt(G.pos.x, G.pos.z)) : 0; },
  get heading() { return G.heading; },
  get levelIndex() { return G.levelIndex; },
  get pos() { return { x: G.pos.x, y: G.pos.y, z: G.pos.z }; },
};
if (SHOT === 'play' || SHOT === 'landing') {
  // Let the autopilot fly a few seconds so the shot catches the plane
  // mid-course, banked toward the next ring, instead of at the spawn point.
  const settleUntil = performance.now() + 2600;
  const settle = () => {
    if (performance.now() < settleUntil) {
      updateFlight(0.05);
      world.update(0.05);
      updateCamera(0.05);
      requestAnimationFrame(settle);
    }
  };
  settle();
}
frame();
