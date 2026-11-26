// Awan Courier — plane.js. The mail plane "Si Kancil" (a small single-prop
// courier), built entirely from primitives: no copied model, no external art.
import * as THREE from 'three';
import { PALETTE } from './config.js';

function tailTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0f8a8a';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#ffffff';
  g.font = 'bold 64px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('AWAN', 128, 52);
  g.fillStyle = '#ffc21c';
  g.font = 'bold 30px sans-serif';
  g.fillText('COURIER • AW-01', 128, 100);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildPlane() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: PALETTE.planeBody });
  const accentMat = new THREE.MeshLambertMaterial({ color: PALETTE.planeAccent });
  const whiteMat = new THREE.MeshLambertMaterial({ color: PALETTE.planeStripe });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x22282e });
  const glassMat = new THREE.MeshLambertMaterial({ color: PALETTE.canopy });

  // Fuselage: tapered cylinder along Z (nose at -Z... we fly toward -Z in
  // local space, so nose points -Z). Length ~7.5 m.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 6.4, 14), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.4;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 14), accentMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.6;
  group.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 12), bodyMat);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 4.4;
  group.add(tailCone);

  // Canopy (cockpit glass).
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), glassMat);
  canopy.scale.set(1, 0.72, 1.7);
  canopy.position.set(0, 0.78, -0.9);
  group.add(canopy);

  // Main wing: low wing, slight dihedral, orange tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.22, 1.9), bodyMat);
  wing.position.set(0, -0.15, -0.4);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.24, 1.9), accentMat);
    tip.position.set(side * 5.05, -0.15, -0.4);
    group.add(tip);
    // Wingtip navigation light.
    const nav = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff4444 : 0x44ff66 }),
    );
    nav.position.set(side * 5.7, -0.15, -0.4);
    group.add(nav);
  }
  // White cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.3, 5.6), whiteMat);
  stripe.position.set(0, 0.1, 0.4);
  group.add(stripe);

  // Tail: horizontal stabiliser + vertical fin with the AWAN marking.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.1), bodyMat);
  stab.position.set(0, 0.12, 4.6);
  group.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 1.6), bodyMat);
  fin.position.set(0, 0.95, 4.7);
  group.add(fin);
  const decalMat = new THREE.MeshBasicMaterial({ map: tailTexture() });
  for (const side of [-1, 1]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), decalMat);
    decal.position.set(side * 0.1, 0.95, 4.7);
    decal.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(decal);
  }

  // Propeller: hub + two blades + a faint blur disc.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 10), darkMat);
  hub.rotation.x = -Math.PI / 2;
  hub.position.z = -0.2;
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.34, 3.4, 0.1);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(bladeGeo, darkMat);
    blade.rotation.z = a;
    prop.add(blade);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
  );
  prop.add(disc);
  prop.position.z = -4.5;
  group.add(prop);

  // Fixed landing gear (visible on the runway shots).
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), darkMat);
    leg.position.set(side * 0.85, -0.85, -0.6);
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.85, -1.35, -0.6);
    group.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 10), darkMat);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.62, 4.2);
  group.add(tailWheel);

  group.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  return { group, prop };
}
