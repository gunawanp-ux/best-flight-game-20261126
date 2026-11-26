// Awan Courier — Island Run. Original flight game by the entry author.
// config.js — tuning, levels and palette. No external dependencies.

export const GAME_NAME = 'Awan Courier';
export const GAME_SUBTITLE = 'Island Run';
export const GAME_TAGLINE = 'Fly the mail run. Thread the rings. Land her home.';

export const WORLD = {
  size: 2600, // terrain spans -1300..1300 m on x and z
  segments: 180,
  waterLevel: 0,
  seaColor: 0x1d6f9e,
  skyTop: 0x2f7fc9,
  skyHorizon: 0xcfe8f5,
  fogColor: 0xcfe0ea,
  fogNear: 500,
  fogFar: 2400,
};

// One level per island. Difficulty rises: more storms, taller peaks, faster cruise.
export const LEVELS = [
  {
    name: 'Pulau Hijau',
    sub: 'Level 1 — Green Island',
    seed: 101,
    rings: 12,
    timeLimit: 180,
    stormClouds: 4,
    clouds: 22,
    mountainScale: 0.75,
    cruise: 52,
    briefing:
      'Calm skies over Pulau Hijau. Thread all 12 golden rings, then bring her down on the runway.',
  },
  {
    name: 'Pulau Badai',
    sub: 'Level 2 — Storm Island',
    seed: 207,
    rings: 14,
    timeLimit: 200,
    stormClouds: 9,
    clouds: 26,
    mountainScale: 1.0,
    cruise: 60,
    briefing:
      'Storm cells over Pulau Badai. Dodge the black clouds, thread 14 rings, land on the strip.',
  },
  {
    name: 'Puncak Salju',
    sub: 'Level 3 — Snow Peaks',
    seed: 313,
    rings: 16,
    timeLimit: 220,
    stormClouds: 12,
    clouds: 24,
    mountainScale: 1.35,
    cruise: 68,
    briefing:
      'Thin air and tall snowy peaks. 16 rings over the ridge, then a mountain-valley landing.',
  },
];

export const FLIGHT = {
  minSpeed: 26, // m/s at idle throttle
  maxSpeed: 92, // m/s at full throttle
  boostAdd: 26,
  maxPitch: 0.55, // rad, climb / dive
  maxBank: 1.05, // rad of visual bank
  turnRate: 0.85, // rad/s at full bank
  pitchRate: 1.4, // rad/s
  ringRadius: 15,
  ringScore: 100,
  ringTimeBonus: 3, // seconds added per ring
  landingSpeedMax: 62,
  hullMax: 100,
  groundHitDamage: 34,
  stormDamage: 9,
};

export const PALETTE = {
  planeBody: 0x0f8a8a, // teal fuselage
  planeAccent: 0xff7a1a, // orange wingtips
  planeStripe: 0xffffff,
  canopy: 0x173a5e,
  ring: 0xffc21c,
  ringGlow: 0xffe27a,
  runway: 0x2b2f36,
  runwayMark: 0xf5f7fa,
  grass: 0x4f9e3f,
  grassDark: 0x2f7a2e,
  sand: 0xe8d29a,
  rock: 0x8a8f96,
  snow: 0xf4f8fb,
  treeTrunk: 0x6b4a2b,
  treeTop: 0x2e7d32,
  houseWall: 0xf2e3c6,
  houseRoof: 0xc65a3a,
  cloudWhite: 0xffffff,
  storm: 0x3a4148,
};
