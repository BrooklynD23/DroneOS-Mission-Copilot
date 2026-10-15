// DroneOS — flight-approval desk. An order card feeds a reader, a gantry pen plots the
// route on a map tray, the plan is presented to a safety-gate console whose four panel
// dials must all swing green, then the bail over the launch button flips open and the
// drone lifts off its pad while a marker replays the route on the map.
// `node build.mjs` writes index.html (dark); `--light` writes index-light.html.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../.agents/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../../.agents/skills/anatomy/kit/lathe.mjs";
import { kitScript } from "../../../.agents/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 660;
const HEIGHT = 440;

// ---------- world layout (units ~= px, z up; viewer sits at +x +y) ----------
const PLATE = { x: -150, y: -85, w: 300, d: 170, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const BED = { x: -95, y: -52, w: 130, d: 104 }; // map tray
const BED_TOP = 0.8;
const FENCE = { x: -82, y: -42, w: 100, d: 84 }; // geofence rect on the map
const NOFLY = { x: 30, y: -16, r: 9 }; // no-fly ring round "the lot"
const ROUTE_Z = 1.05;
const WP6 = [-2, -6];
const WP7_OK = 6; // repaired position (inside the fence)
const WP7_BAD = 20; // drafted position (outside the fence)
const WP_MIN = -40;
const WP_MAX = 30;
const WPS = [
  [-78, -34],
  [-70, 8],
  [-52, 36],
  [-20, 36],
  [-2, 20],
  WP6,
  [WP7_BAD, -15],
];
const METRES = 3; // world units -> metres in the readout

const CONSOLE = { x: -100, y: -80, w: 140, d: 16, r: 2 };
const CON_STEP = { x: -98, y: -79, w: 136, d: 13, r: 1.6 };
const DIAL_XS = [-84, -56, -28, 0]; // geofence, ceiling, no-fly, battery
const DIAL_R = 8.5;
const DIAL_AXIS = G.unit3([0.72, 0.72, 0.42]);
const FACE_S = 3.05;
const REEL_C = [22, -68, 20.5];
const FLAG_PIVOT = [33, -69, 26];

const RAIL_L = { x: -108, y: -56, w: 5, d: 112, r: 1 };
const RAIL_R = { x: 38, y: -56, w: 5, d: 112, r: 1 };
const BEAM = { x: -109, y: -2.2, w: 152, d: 4.4, r: 1 }; // built at beamY = 0
const BEAM_Z = 12;

const HOPPER = { x: -145, y: -61, w: 16, d: 14, r: 1 };
const CARD = { x: -142, y: -60, w: 17, d: 11, r: 0.8 }; // built at CARD_HOME
const CARD_HOME = -142;
const CARD_IN = -122;
const COVER = { x: -124, y: -63, w: 22, d: 16, r: 1.5 };

const PED = { x: 70, y: -40, w: 22, d: 16, r: 2 }; // launch pedestal
const BUTTON = [81, -32];
const BAIL_L = [74.5, -37.5, 12.8]; // bail hinges (axis along x)
const BAIL_R = [87.5, -37.5, 12.8];
const BAIL_TIP_Y = -28; // closed bail top: (y, z) of the bar
const BAIL_TIP_Z = 17.6;

const PAD = [86, 42];
const PAD_R = 23;
const PAD_TOP = 3.2;
const DRONE_C = [86, 42];
const MOTORS = [
  [79.5, 35.5],
  [92.5, 35.5],
  [79.5, 48.5],
  [92.5, 48.5],
];

const fit = [
  ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
  [0, -69, 34],
  [86, 42, 46],
  [-146, -61, 13],
];
const P = k.fitProjection(fit, WIDTH, HEIGHT, { pad: 26, azimuth: 45 });

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// thin slab rotated in plan (drone arms)
const armRing = (cx, cy, deg, len, wid) => {
  const a = (deg * Math.PI) / 180;
  const [ux, uy] = [Math.cos(a), Math.sin(a)];
  const [nx, ny] = [-uy, ux];
  return [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ].map(([s, t]) => [cx + (ux * len * s) / 2 + (nx * wid * t) / 2, cy + (uy * len * s) / 2 + (ny * wid * t) / 2]);
};

// dial-face helpers: F = frame on the dial axis; face work happens at s = FACE_S
const faceFrame = (c) => G.frameAlong(c, DIAL_AXIS);
const fPt = (F, s, r, thDeg) => {
  const th = (thDeg * Math.PI) / 180;
  return at(G.pointOf(F, s, r, th));
};
const fArc = (F, s, r, a0, a1, n = 20) => {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(fPt(F, s, r, a0 + ((a1 - a0) * i) / n));
  return k.pathOf(pts);
};
const fRing = (F, s, r, n = 48) => fArc(F, s, r, 0, 360, n);
const fSeg = (F, s, r0, r1, th) => k.pathOf([fPt(F, s, r0, th), fPt(F, s, r1, th)]);

// ---------- static art ----------
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: -142, y: 72, w: 118, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  const label = { x: 100, y: 67, w: 38, d: 11, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  for (const [dy, w] of [
    [3, 20],
    [5.4, 26],
    [7.8, 14],
  ])
    out.push(L(k.lineOnTop([label.x + 4, label.y + dy], [label.x + 4 + w, label.y + dy], 0.8, P), { tone: "lo", free: true }));
  out.push(D([at([label.x + 34, label.y + 3, 0.8]), at([label.x + 34, label.y + 8, 0.8])], { size: 0.45 }));
  return out.join("");
}

function hopperAndReader() {
  const out = [];
  out.push(S(k.slabOf(HOPPER, 0, 1, P, 3), { tone: "lo", crease: "none" }));
  for (const ly of [HOPPER.y, HOPPER.y + HOPPER.d - 1.4])
    out.push(S(k.slabOf({ x: HOPPER.x, y: ly, w: HOPPER.w, d: 1.4, r: 0.5 }, 1, 1.8, P, 2), { tone: "mid" }));
  for (let i = 0; i < 2; i++)
    out.push(S(k.slabOf({ x: HOPPER.x + 1.6 + i * 0.7, y: HOPPER.y + 1.8 + i * 0.4, w: 12.5, d: 10.4, r: 0.6 }, 1 + i * 0.7, 0.6, P, 2), { tone: "mid", crease: "none" }));
  // reader tunnel: four legs, cover, sensor eye, terminal boss
  for (const [lx, ly] of [
    [-121, -60.5],
    [-105, -60.5],
    [-121, -49.5],
    [-105, -49.5],
  ])
    out.push(S(k.cylinder(lx, ly, 1.4, 0, 7, P, 16), { tone: "mid" }));
  out.push(S(k.slabOf(COVER, 7, 2.6, P, 4, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(COVER, 2.4), 9.6, P), { tone: "faint" }));
  out.push(S(k.cylinder(-113, -55, 1.7, 9.6, 2.6, P, 20), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -119.5, y: -53.5, w: 5, d: 4, r: 0.8 }, 9.6, 1, P, 2), { tone: "mid" }));
  return out.join("");
}

function card() {
  // built at CARD_HOME, slides +x under the reader cover
  const lines = [
    k.lineOnTop([CARD.x + 3, CARD.y + 3], [CARD.x + 14, CARD.y + 3], 1.6, P),
    k.lineOnTop([CARD.x + 3, CARD.y + 5.5], [CARD.x + 11.5, CARD.y + 5.5], 1.6, P),
    k.lineOnTop([CARD.x + 3, CARD.y + 8], [CARD.x + 9, CARD.y + 8], 1.6, P),
  ].join("");
  return [
    S(k.slabOf(CARD, 0.7, 0.9, P, 3, 0.4), { tone: "hi", crease: "lo" }),
    L(lines, { tone: "lo", free: true }),
    D([at([CARD.x + 1.6, CARD.y + 1.6, 1.6])], { size: 0.5 }),
  ].join("");
}

const DIAL_FACES = []; // filled during consoleBar(); serialised into the page

function consoleBar() {
  const out = [];
  out.push(S(k.slabOf(CONSOLE, 0, 8, P, 5, 0.8), { tone: "mid" }));
  out.push(S(k.slabOf(CON_STEP, 8, 6, P, 5, 0.6), { tone: "mid" }));
  // vent slots: closed outlines on the front face of the base (y = -64)
  const vents = [];
  for (const vx of [-62, -52, -42]) {
    const x0 = vx, x1 = vx + 7, z0 = 2.4, z1 = 5.6, y = -64, rr = 1.4;
    const r = [];
    for (const [a0, cx, cz] of [
      [180, x1 - rr, z0 + rr],
      [270, x1 - rr, z1 - rr],
      [0, x0 + rr, z1 - rr],
      [90, x0 + rr, z0 + rr],
    ])
      for (let i = 0; i <= 3; i++) {
        const a = ((a0 + (90 * i) / 3) * Math.PI) / 180;
        r.push(at([cx + rr * Math.cos(a), y, cz + rr * Math.sin(a)]));
      }
    vents.push(k.pathOf(r, true));
  }
  out.push(L(vents.join(""), { tone: "lo" }));
  // knurled release knob at the left end
  out.push(S(k.cylinder(-94, -71, 4.4, 14, 4, P, 28), { tone: "mid" }));
  out.push(L(k.knurl(-94, -71, 4.4, 14, 18, 30, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([-94, -71], [-90.4, -71], 18, P), { tone: "hi" }));
  out.push(D([at([-94, -71, 18])], { size: 0.5, tone: "hi" }));
  // engraved name on the step top
  out.push(k.faceTextSvg(k.topMatrix([-46, -66.8], 14, P, "x"), "GATE", { size: 3, tone: "lo", anchor: "middle" }));
  // four dials: bracket post, axle, body, bezel, face art, lamp well
  DIAL_XS.forEach((x) => {
    const F = faceFrame([x, -68, 21.5]);
    DIAL_FACES.push({ c: G.pointOf(F, FACE_S, 0, 0), u: F.u, v: F.v, r: DIAL_R });
    out.push(S(k.slabOf({ x: x - 4.5, y: -73.2, w: 4, d: 4.5, r: 0.8 }, 14, 6, P, 3), { tone: "mid" }));
    out.push(S(G.disc(-3.6, -2, 1.7, F, P), { tone: "mid" }));
    out.push(S(G.disc(-2, 2, DIAL_R, F, P), { tone: "hi", crease: "lo" }));
    out.push(S(G.disc(2, FACE_S, DIAL_R + 0.6, F, P), { tone: "hi", crease: "lo" }));
    out.push(`<path class="iso-fill" style="fill:var(--anatomy-lit-top)" d="${fRing(F, FACE_S, DIAL_R - 1.4)}"/>`);
    out.push(L(fRing(F, FACE_S, DIAL_R - 1.4), { tone: "mid" }));
    out.push(L(fRing(F, FACE_S, DIAL_R - 2.7, 40), { tone: "faint" }));
    const ticks = [];
    for (let t = 0; t <= 12; t++) ticks.push(fSeg(F, FACE_S, DIAL_R - 4.4, DIAL_R - 2.7, 15 + (150 * t) / 12));
    out.push(L(ticks.join(""), { tone: "lo" }));
    for (const [a0, a1, tone] of [
      [20, 80, "red"],
      [100, 160, "green"],
    ]) {
      out.push(L(fArc(F, FACE_S, DIAL_R - 5.6, a0, a1), { tone }));
      out.push(L(fSeg(F, FACE_S, DIAL_R - 5.6, DIAL_R - 2.7, a0) + fSeg(F, FACE_S, DIAL_R - 5.6, DIAL_R - 2.7, a1), { tone }));
    }
    out.push(L(fRing(F, FACE_S, 1.6, 16), { tone: "mid" }));
    out.push(L(k.ring(x, -66.8, 1.7, 14.15, P, 16), { tone: "lo" }));
  });
  // replay spool at the right end
  const RF = faceFrame(REEL_C);
  DIAL_FACES.push({ c: G.pointOf(RF, 2.2, 0, 0), u: RF.u, v: RF.v, r: 7 });
  out.push(S(k.slabOf({ x: 17.6, y: -73, w: 4, d: 4.5, r: 0.8 }, 14, 5.5, P, 3), { tone: "mid" }));
  out.push(S(G.disc(-1.6, 1.6, 7, RF, P), { tone: "mid" }));
  out.push(S(G.disc(1.6, 2.2, 7.5, RF, P), { tone: "mid" }));
  out.push(L(fRing(RF, 2.2, 5.4, 40), { tone: "lo" }));
  out.push(L(fRing(RF, 2.2, 1.7, 16), { tone: "mid" }));
  // semaphore flag mast + pivot boss
  out.push(S(k.cylinder(33, -69, 1.3, 14, 12, P, 16), { tone: "mid" }));
  const FF = faceFrame(FLAG_PIVOT);
  out.push(S(G.disc(-1.2, 1.2, 2.1, FF, P), { tone: "mid" }));
  out.push(L(k.ring(33, -66.2, 1.6, 14.15, P, 16), { tone: "lo" }));
  return out.join("");
}

function mapBed() {
  const out = [];
  out.push(S(k.slabOf(BED, 0, BED_TOP, P, 4), { tone: "lo", crease: "none" }));
  for (const r of [
    { x: BED.x, y: BED.y, w: BED.w, d: 3 },
    { x: BED.x, y: BED.y + BED.d - 3, w: BED.w, d: 3 },
    { x: BED.x, y: BED.y + 3, w: 3, d: BED.d - 6 },
    { x: BED.x + BED.w - 3, y: BED.y + 3, w: 3, d: BED.d - 6 },
  ])
    out.push(S(k.slabOf({ ...r, r: 0.8 }, BED_TOP, 2.6, P, 3, 0.4), { tone: "mid" }));
  const grid = [];
  for (let gx = -80; gx <= 16; gx += 16) grid.push(k.lineOnTop([gx, -49], [gx, 49], BED_TOP + 0.05, P));
  for (let gy = -33; gy <= 47; gy += 16) grid.push(k.lineOnTop([-92, gy], [32, gy], BED_TOP + 0.05, P));
  out.push(L(grid.join(""), { tone: "faint" }));
  // the house being inspected
  const house = { x: -44, y: 20, w: 12, d: 10, r: 1 };
  out.push(S(k.slabOf(house, BED_TOP, 7, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(house, 1.8), BED_TOP + 7, P, 3), { tone: "faint" }));
  out.push(L(k.lineOnTop([house.x, house.y + 5], [house.x + 12, house.y + 5], BED_TOP + 7, P), { tone: "lo" }));
  for (const [tx, ty] of [
    [-88, 42],
    [26, 46],
  ]) {
    out.push(S(k.cylinder(tx, ty, 0.7, BED_TOP, 1.8, P, 10), { tone: "mid" }));
    out.push(S(k.cylinder(tx, ty, 2, BED_TOP + 1.8, 1.8, P, 16), { tone: "lo" }));
  }
  // no-fly ring + the building on the lot
  out.push(L(k.ring(NOFLY.x, NOFLY.y, NOFLY.r, BED_TOP + 0.1, P, 40), { tone: "red", dashed: true }));
  const bld = { x: 26, y: -19.5, w: 8, d: 7, r: 1 };
  out.push(S(k.slabOf(bld, BED_TOP, 7, P, 4, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(bld, 1.6), BED_TOP + 7, P, 3), { tone: "faint" }));
  // geofence: posts + a dashed wire at their tops
  const posts = [
    [FENCE.x, FENCE.y],
    [FENCE.x + FENCE.w / 2, FENCE.y],
    [FENCE.x + FENCE.w, FENCE.y],
    [FENCE.x + FENCE.w, FENCE.y + FENCE.d / 2],
    [FENCE.x + FENCE.w, FENCE.y + FENCE.d],
    [FENCE.x + FENCE.w / 2, FENCE.y + FENCE.d],
    [FENCE.x, FENCE.y + FENCE.d],
    [FENCE.x, FENCE.y + FENCE.d / 2],
  ];
  for (const [px, py] of posts) out.push(S(k.cylinder(px, py, 0.9, BED_TOP, 4.2, P, 10), { tone: "mid" }));
  out.push(L(k.onTop(k.ringOf(FENCE, 3), BED_TOP + 4.2, P, true), { tone: "mid", dashed: true }));
  out.push(D(posts.map(([px, py]) => at([px, py, BED_TOP + 4.2])), { size: 0.5 }));
  // origin ring where the route starts
  out.push(L(k.ring(WPS[0][0], WPS[0][1], 3, BED_TOP + 0.2, P, 24), { tone: "lo" }));
  out.push(D([at([WPS[0][0], WPS[0][1], BED_TOP + 0.2])], { size: 0.5 }));
  // compass rose
  out.push(L(k.ring(-88, -46, 3.4, BED_TOP + 0.1, P, 24), { tone: "lo" }));
  out.push(L(k.lineOnTop([-88, -46], [-88, -43.6], BED_TOP + 0.1, P), { tone: "mid" }));
  return out.join("");
}

function gantry() {
  const out = [];
  for (const rail of [RAIL_L, RAIL_R]) {
    out.push(S(k.slabOf(rail, 0, 4, P, 3, 0.4), { tone: "mid" }));
    out.push(D([at([rail.x + 2.5, rail.y + 5, 4]), at([rail.x + 2.5, rail.y + rail.d - 5, 4])], { size: 0.4 }));
  }
  for (const rail of [RAIL_L, RAIL_R])
    for (const y of [rail.y - 4, rail.y + rail.d]) {
      out.push(S(k.slabOf({ x: rail.x - 0.5, y, w: 6, d: 4, r: 1 }, 0, 9, P, 3, 0.5), { tone: "mid" }));
      out.push(D([at([rail.x + 2.5, y + 2, 9])], { size: 0.45 }));
    }
  return out.join("");
}

function beam() {
  // built at beamY = 0, translated along y; the carriage translates along x inside it
  const out = [];
  out.push(S(k.slabOf({ x: -109, y: -3.4, w: 7, d: 6.8, r: 0.8 }, 4, 8, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 37, y: -3.4, w: 7, d: 6.8, r: 0.8 }, 4, 8, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf(BEAM, BEAM_Z, 3.2, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.lineOnTop([BEAM.x + 0.7, 0], [BEAM.x + BEAM.w - 0.7, 0], BEAM_Z + 3.2, P), { tone: "faint" }));
  out.push(D([at([BEAM.x + 2.6, 0, BEAM_Z + 3.2]), at([BEAM.x + BEAM.w - 2.6, 0, BEAM_Z + 3.2])], { size: 0.45 }));
  const carriage = [
    S(k.slabOf({ x: -4.5, y: -3.2, w: 9, d: 6.4, r: 1 }, BEAM_Z + 3.2, 4, P, 3, 0.4), { tone: "hi", crease: "lo" }),
    S(k.slabOf({ x: -2.2, y: -1.3, w: 4.4, d: 2.6, r: 0.6 }, 10.5, BEAM_Z - 10.5, P, 2), { tone: "mid" }),
    `<g data-part="pen">`,
    S(k.cylinder(0, 0, 1.1, 2.8, 7.7, P, 12), { tone: "hi", crease: "none" }),
    S(k.cylinder(0, 0, 2, 8.2, 2.4, P, 16), { tone: "mid" }),
    S(k.cylinder(0, 0, 1.9, 0.8, 2, P, 16, 0.6), { tone: "hi", lit: true }),
    `</g>`,
  ].join("");
  out.push(`<g data-part="carriage">${carriage}</g>`);
  return out.join("");
}

function pedestal() {
  const out = [];
  out.push(S(k.slabOf(PED, 0, 9, P, 4, 0.7), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 72, y: -38, w: 18, d: 12, r: 1.5 }, 9, 2.5, P, 4, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(BUTTON[0], BUTTON[1], 5.5, 11.5, 1.9, P, 28), { tone: "mid" }));
  out.push(L(k.ring(BUTTON[0], BUTTON[1], 5.5, 13.4, P, 28), { tone: "lo" }));
  for (const hx of [74.5, 87.5]) out.push(S(k.slabOf({ x: hx - 1.1, y: -39.6, w: 2.2, d: 3.4, r: 0.6 }, 11.5, 2.4, P, 2), { tone: "mid" }));
  out.push(L(k.ring(76, -27, 1.6, 11.6, P, 16), { tone: "lo" }));
  return out.join("");
}

function pad() {
  const out = [];
  out.push(S(k.cylinder(PAD[0], PAD[1], PAD_R, 0, PAD_TOP, P, 56, 0.8), { tone: "mid" }));
  out.push(L(k.ring(PAD[0], PAD[1], PAD_R - 3, PAD_TOP, P, 56), { tone: "lo" }));
  out.push(
    L(
      [
        k.lineOnTop([PAD[0] - 3, PAD[1] - 4], [PAD[0] - 3, PAD[1] + 4], PAD_TOP, P),
        k.lineOnTop([PAD[0] + 3, PAD[1] - 4], [PAD[0] + 3, PAD[1] + 4], PAD_TOP, P),
        k.lineOnTop([PAD[0] - 3, PAD[1]], [PAD[0] + 3, PAD[1]], PAD_TOP, P),
      ].join(""),
      { tone: "lo", free: true },
    ),
  );
  out.push(
    D(
      [
        [PAD[0] - PAD_R + 4.5, PAD[1]],
        [PAD[0] + PAD_R - 4.5, PAD[1]],
        [PAD[0], PAD[1] - PAD_R + 4.5],
        [PAD[0], PAD[1] + PAD_R - 4.5],
      ].map(([x, y]) => at([x, y, PAD_TOP])),
      { size: 0.5 },
    ),
  );
  return out.join("");
}

function drone() {
  const out = [];
  for (const sy of [36.4, 45.9]) out.push(S(k.slabOf({ x: 77, y: sy, w: 18, d: 1.7, r: 0.6 }, PAD_TOP, 1.4, P, 3), { tone: "mid" }));
  for (const deg of [-45, -135]) out.push(S(k.extrude(armRing(DRONE_C[0], DRONE_C[1], deg, 19, 3.2), PAD_TOP + 1.4, 1.6, P, {}), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf({ x: 82.4, y: 38.4, w: 7.2, d: 7.2, r: 1.6 }, PAD_TOP + 1.4, 3.2, P, 4, 0.5), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf({ x: 83.4, y: 39.4, w: 5.2, d: 5.2, r: 0.8 }, PAD_TOP + 4.6, 1.8, P, 3), { tone: "mid" }));
  for (const [mx, my] of MOTORS) {
    out.push(S(k.cylinder(mx, my, 2.1, PAD_TOP + 2.2, 2.6, P, 16), { tone: "mid" }));
    out.push(S(k.cylinder(mx, my, 4.6, PAD_TOP + 4.8, 0.5, P, 28), { tone: "mid", crease: "none" }));
    out.push(D([at([mx, my, PAD_TOP + 5.3])], { size: 0.8, tone: "hi" }));
  }
  out.push(`<path data-props class="iso-line" data-tone="hi" data-free="both" style="stroke-width:.8" d=""/>`);
  return out.join("");
}

// ---------- shared model (also serialised into the page) ----------
const routeLenOf = (wps) => {
  let len = 0;
  for (let i = 1; i < wps.length; i++) len += Math.hypot(wps[i][0] - wps[i - 1][0], wps[i][1] - wps[i - 1][1]);
  return len;
};
const routePoint = (wps, progress) => {
  const total = routeLenOf(wps);
  let need = total * progress;
  for (let i = 1; i < wps.length; i++) {
    const [ax, ay] = wps[i - 1];
    const [bx, by] = wps[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (need <= seg || i === wps.length - 1) {
      const t = clampN(need / seg, 0, 1);
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }
    need -= seg;
  }
  return wps[wps.length - 1];
};
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
const routePath = (wps, progress, isoPt) => {
  const total = routeLenOf(wps);
  let need = total * progress;
  if (need <= 0.05) return "";
  const pts = [isoPt([wps[0][0], wps[0][1], ROUTE_Z])];
  for (let i = 1; i < wps.length && need > 0; i++) {
    const [ax, ay] = wps[i - 1];
    const [bx, by] = wps[i];
    const seg = Math.hypot(bx - ax, by - ay);
    const take = Math.min(seg, need);
    pts.push(isoPt([ax + ((bx - ax) * take) / seg, ay + ((by - ay) * take) / seg, ROUTE_Z]));
    need -= seg;
  }
  return k.pathOf(pts);
};

// ---------- assemble ----------
const body = [
  plate(),
  hopperAndReader(),
  `<g data-part="card">${card()}</g>`,
  consoleBar(),
  // plate cables, ends on the console and pedestal faces
  k.wireSvg(at([-112, -47, 8.5]), at([-98, -64, 6]), { via: [at([-110, -43, 0.8]), at([-102, -56, 0.8])], tone: "lo" }),
  k.wireSvg(at([36, -66, 10]), at([78, -24, 5]), { via: [at([46, -62, 0.8]), at([58, -40, 0.8]), at([70, -28, 0.8])], tone: "lo" }),
  mapBed(),
  `<g data-part="route-g">
    <path data-part="ghost" class="iso-line" data-tone="lo" data-dashed="" d="" style="display:none"/>
    <circle data-part="ghostdot" cx="0" cy="0" r="0.9" class="iso-ghostdot" style="display:none"/>
    <path data-part="route" class="iso-line" data-tone="lit" data-free="end" d="" style="stroke-width:1.2"/>
    <g>${D(WPS.slice(0, 6).map(([x, y]) => at([x, y, BED_TOP + 0.25])), { size: 0.7, tone: "mid" })}</g>
    <circle data-part="wp7" cx="0" cy="0" r="1.1" class="iso-wp7"/>
    <circle data-part="marker" cx="0" cy="0" r="1.8" class="iso-marker" style="display:none"/>
  </g>`,
  gantry(),
  `<g data-part="beam">${beam()}</g>`,
  pedestal(),
  `<g data-part="cap">${S(k.cylinder(BUTTON[0], BUTTON[1], 4.3, 13.4, 2.8, P, 28, 0.6), { tone: "hi", lit: true })}</g>`,
  `<g data-part="bail"><path class="iso-line" data-tone="mid" style="stroke-width:1.3" d=""/></g>`,
  pad(),
  `<g data-part="dshadow"><path class="iso-halo" d="${k.haloOf({ x: 78, y: 35, w: 16, d: 14, r: 7 }, PAD_TOP + 0.05, 0.1, P)}" style="filter:blur(4px)"/></g>`,
  `<g data-part="drone">${drone()}</g>`,
  `<g data-part="needles">${[0, 1, 2, 3].map(() => `<path class="iso-line" data-tone="hi" data-free="end" style="stroke-width:1.05" d=""/>`).join("")}</g>`,
  `<g data-part="lamps">${DIAL_XS.map((x) => {
    const c = at([x, -66.8, 14.35]);
    return `<g class="iso-dots" data-tone="mid" data-lamp><circle cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="1.15"/></g>`;
  }).join("")}</g>`,
  (() => {
    const c = at([-113, -55, 12.2]);
    return `<circle data-part="eye" cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="1" class="iso-eye"/>`;
  })(),
  `<g data-part="flag"><path class="iso-fill" d="" style="stroke:var(--anatomy-red);stroke-width:.7"/></g>`,
  `<g data-part="spokes"><path class="iso-line" data-tone="mid" style="stroke-width:.8" d=""/></g>`,
  (() => {
    const c = at([76, -27, 11.9]);
    return `<g data-part="armed"><g class="iso-dots" data-tone="mid"><circle cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="1.1"/></g></g>`;
  })(),
].join("");

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A flight-approval desk for a drone copilot. An order card feeds a reader; a gantry pen plots the route on a map tray fenced by posts and wire. The plan is presented to a gate console of four dials — geofence, ceiling, no-fly, battery — that each swing into a green or red arc. All green opens the guard over the launch button; pressing it lifts the drone off its pad while a marker replays the route.",
  body,
});

// ---------- live ----------
const FLAG_F = G.frameAlong(FLAG_PIVOT, DIAL_AXIS);
const live = `
const P = ${JSON.stringify(P)};
const WPS = ${JSON.stringify(WPS)};
const ROUTE_Z = ${ROUTE_Z}, WP6 = ${JSON.stringify(WP6)};
const WP7_OK = ${WP7_OK}, WP7_BAD = ${WP7_BAD}, WP_MIN = ${WP_MIN}, WP_MAX = ${WP_MAX};
const FENCE = ${JSON.stringify(FENCE)}, NOFLY = ${JSON.stringify(NOFLY)}, METRES = ${METRES};
const DIALS = ${JSON.stringify(DIAL_FACES)};
const CARD_HOME = ${CARD_HOME}, CARD_IN = ${CARD_IN};
const BAIL_L = ${JSON.stringify(BAIL_L)}, BAIL_R = ${JSON.stringify(BAIL_R)};
const BAIL_TIP_Y = ${BAIL_TIP_Y}, BAIL_TIP_Z = ${BAIL_TIP_Z};
const PAD_TOP = ${PAD_TOP}, DRONE_C = ${JSON.stringify(DRONE_C)}, MOTORS = ${JSON.stringify(MOTORS)};
const FLAG_C = ${JSON.stringify(FLAG_PIVOT)};
const FLAG_U = ${JSON.stringify(FLAG_F.u)}, FLAG_V = ${JSON.stringify(FLAG_F.v)};

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (n) => svg.querySelector('[data-part="' + n + '"]');
const el = {
  card: $("card"), ghost: $("ghost"), ghostdot: $("ghostdot"), route: $("route"), wp7: $("wp7"), marker: $("marker"),
  beam: $("beam"), carriage: $("carriage"), pen: $("pen"), bail: $("bail").firstChild, cap: $("cap"),
  shadow: $("dshadow"), drone: $("drone"), eye: $("eye"),
  flag: $("flag").firstChild, spokes: $("spokes").firstChild, armed: $("armed").firstChild,
  props: svg.querySelector("[data-props]"),
};
const needles = [...$("needles").children];
const lamps = [...svg.querySelectorAll("[data-lamp]")];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isoPt = (p) => iso(p, P);
const routeLenOf = ${routeLenOf.toString()};
const routePoint = ${routePoint.toString().replaceAll("clampN", "clamp")};
const routePath = ${routePath.toString().replaceAll("k.pathOf", "pathOf")};
const wpList = (x) => WPS.slice(0, 6).concat([[x, -15]]);
const checks = (x) => ({
  geo: x <= FENCE.x + FENCE.w && x >= FENCE.x,
  nf: Math.hypot(x - NOFLY.x, -15 - NOFLY.y) > NOFLY.r + 0.5,
  ceil: true,
  batt: true,
});
const passedCount = (c) => [c.geo, c.ceil, c.nf, c.batt].filter(Boolean).length;

// dial-face 2D projection (centre + projected u,v basis serialised from the build)
const dial2d = DIALS.map((d) => {
  const c = iso(d.c, P);
  const edge = (v) => iso([d.c[0] + v[0], d.c[1] + v[1], d.c[2] + v[2]], P).map((q, i) => q - c[i]);
  return { c, u: edge(d.u), v: edge(d.v), r: d.r };
});
const dialPt = (d, r, th) => {
  const t = (th * Math.PI) / 180, co = Math.cos(t), si = Math.sin(t);
  return [d.c[0] + r * (co * d.u[0] + si * d.v[0]), d.c[1] + r * (co * d.u[1] + si * d.v[1])];
};

const mk = (x) => ({ x, v: 0 });
const springTo = (s, target, dt, stiff, damp, calm) => {
  if (calm) { s.x = target; s.v = 0; return false; }
  let moving = false;
  for (let i = 0; i < 4; i++) { s.v += ((target - s.x) * stiff - s.v * damp) * (dt / 4); s.x += s.v * (dt / 4); }
  if (Math.abs(target - s.x) > 5e-4 || Math.abs(s.v) > 5e-4) moving = true; else { s.x = target; s.v = 0; }
  return moving;
};

let clock = 0, last = 0, frame = 0, visible = false;
let manual = false, idleTimer = 0, hopAt = -1, pressedAt = -1;
let wpT = WP7_BAD, spin = 0;
const wpX = mk(WP7_BAD), cardX = mk(CARD_HOME);
const beamY = mk(-48), penX = mk(-78), penLift = mk(3.4);
const needleA = [mk(235), mk(235), mk(235), mk(235)];
const flagA = mk(0), bailA = mk(0), capD = mk(0), droneH = mk(0), reelA = mk(0);

const T_LOOP = 23.5;
const phaseAt = (t) =>
  t < 1.2 ? "feed" : t < 5.4 ? "draw" : t < 8.4 ? "check" : t < 10.9 ? "repair" : t < 11.9 ? "arm" : t < 12.6 ? "press" : t < 16.2 ? "fly" : t < 17.6 ? "land" : t < 19.4 ? "logged" : "reset";

function tourTargets(t, ph) {
  const c = checks(wpX.x);
  const verdicts = [c.geo, c.ceil, c.nf, c.batt];
  const allOk = verdicts.every(Boolean);
  const sweepT = [5.6, 6.15, 6.7, 7.25];
  const wps = wpList(wpX.x);
  const T = {};
  T.card = t > 0.2 && t < 20.6 ? CARD_IN : CARD_HOME;
  T.eye = t > 0.9 && t < 20.6;
  T.draw = ph === "draw" ? clamp((t - 1.2) / 4.2, 0, 1) : t < 19.6 ? 1 : clamp(1 - (t - 19.6) / 1.0, 0, 1);
  T.wp = t < 8.6 ? WP7_BAD : t < 19.9 ? WP7_OK : WP7_BAD;
  if (ph === "draw") {
    const pt = routePoint(wps, Math.max(T.draw, 0.001));
    T.pen = pt; T.lift = 0;
  } else if (ph === "repair") {
    T.pen = [wps[6][0], -15]; T.lift = 0;
  } else if (ph === "check" || ph === "arm") {
    T.pen = [-40, -48]; T.lift = 3.4;
  } else {
    T.pen = [-88, -46]; T.lift = 3.4;
  }
  T.needles = [0, 1, 2, 3].map((i) => (t >= sweepT[i] && t < 19.6 ? (verdicts[i] ? 130 : 50) : 235));
  T.lamps = [0, 1, 2, 3].map((i) => (t >= sweepT[i] && t < 19.6 ? (verdicts[i] ? "green" : "red") : "mid"));
  T.flag = t >= 6.15 && t < 10.6 && (!c.geo || (t >= 6.7 && !c.nf)) ? 1 : 0;
  T.bail = allOk && t >= 10.9 && t < 19.4 ? 1 : 0;
  T.cap = ph === "press" ? 1 : 0;
  T.drone = t >= 12.6 && t < 16.4 ? 30 : 0;
  T.marker = ph === "fly" ? clamp((t - 12.6) / 3.0, 0, 1) : -1;
  T.spinning = ph === "fly";
  return T;
}

function manualTargets() {
  const c = checks(wpX.x);
  const all = c.geo && c.nf;
  const hopAge = hopAt >= 0 ? clock - hopAt : -1;
  if (hopAge > 3.8) { hopAt = -1; pressedAt = -1; }
  return {
    card: CARD_IN, eye: true, draw: 1, wp: wpT,
    pen: [wpX.x, -15], lift: 0,
    needles: [c.geo, true, c.nf, true].map((ok) => (ok ? 130 : 50)),
    lamps: [c.geo, true, c.nf, true].map((ok) => (ok ? "green" : "red")),
    flag: all ? 0 : 1,
    bail: all ? 1 : 0,
    cap: pressedAt >= 0 && clock - pressedAt < 0.35 ? 1 : 0,
    drone: hopAge >= 0 && hopAge < 0.9 ? 26 : hopAge >= 0 && hopAge < 2.4 ? 26 : 0,
    marker: hopAge >= 0 ? clamp(hopAge / 2.6, 0, 1) : -1,
    spinning: hopAge >= 0 && hopAge < 3.4,
  };
}

const needleD = (i, th) => {
  const d = dial2d[i];
  return pathOf([dialPt(d, 1.6, th + 180), dialPt(d, d.r - 4.4, th)]);
};
const flagD = (a) => {
  const th = ((178 - a * 70) * Math.PI) / 180;
  const dir = [Math.cos(th) * FLAG_U[0] + Math.sin(th) * FLAG_V[0], Math.cos(th) * FLAG_U[1] + Math.sin(th) * FLAG_V[1], Math.cos(th) * FLAG_U[2] + Math.sin(th) * FLAG_V[2]];
  const per = [-Math.sin(th) * FLAG_U[0] + Math.cos(th) * FLAG_V[0], -Math.sin(th) * FLAG_U[1] + Math.cos(th) * FLAG_V[1], -Math.sin(th) * FLAG_U[2] + Math.cos(th) * FLAG_V[2]];
  const corner = (al, pr) => isoPt([FLAG_C[0] + al * dir[0] + pr * per[0], FLAG_C[1] + al * dir[1] + pr * per[1], FLAG_C[2] + al * dir[2] + pr * per[2]]);
  return pathOf([corner(1.2, 2), corner(11, 2), corner(11, -2), corner(1.2, -2)], true);
};
const bailPath = (a) => {
  const th = a * 1.35, co = Math.cos(th), si = Math.sin(th);
  const tip = (hx) => {
    const dy = BAIL_TIP_Y - BAIL_L[1], dz = BAIL_TIP_Z - BAIL_L[2];
    return isoPt([hx, BAIL_L[1] + dy * co - dz * si, BAIL_L[2] + dy * si + dz * co]);
  };
  const hl = isoPt(BAIL_L), hr = isoPt(BAIL_R);
  const tl = tip(BAIL_L[0]), tr = tip(BAIL_R[0]);
  return pathOf([hl, tl]) + pathOf([hr, tr]) + pathOf([tl, tr]);
};
const spokeD = (a) => {
  const d = dial2d[4];
  let out = "";
  for (const off of [0, 120, 240]) out += pathOf([dialPt(d, 1.9, a + off), dialPt(d, 5.2, a + off)]);
  return out;
};
const propD = (t) =>
  MOTORS.map(([mx, my]) => {
    const a = isoPt([mx - Math.cos(t) * 4.3, my - Math.sin(t) * 4.3, PAD_TOP + 5.6]);
    const b = isoPt([mx + Math.cos(t) * 4.3, my + Math.sin(t) * 4.3, PAD_TOP + 5.6]);
    return "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + "L" + b[0].toFixed(1) + " " + b[1].toFixed(1);
  }).join("");
const padC = isoPt([86, 42, 0]);

let lastText = "";
function draw(T, ph) {
  const wps = wpList(wpX.x);
  el.card.setAttribute("transform", translateAlong(P, [cardX.x - CARD_HOME, 0, 0]));
  el.eye.style.fill = T.eye ? "var(--anatomy-green)" : "var(--anatomy-paper)";
  const d = routePath(wps, T.draw, isoPt);
  el.route.setAttribute("d", d);
  el.route.style.display = d ? "" : "none";
  const w7 = isoPt([wps[6][0], -15, ROUTE_Z]);
  el.wp7.setAttribute("cx", w7[0]);
  el.wp7.setAttribute("cy", w7[1]);
  const ghostOn = Math.abs(wpX.x - WP7_BAD) > 1 && (manual || ph === "repair" || ph === "arm");
  if (ghostOn) {
    el.ghost.setAttribute("d", pathOf([isoPt([WP6[0], WP6[1], ROUTE_Z]), isoPt([WP7_BAD, -15, ROUTE_Z])]));
    el.ghost.style.display = "";
    const gd = isoPt([WP7_BAD, -15, ROUTE_Z]);
    el.ghostdot.setAttribute("cx", gd[0]); el.ghostdot.setAttribute("cy", gd[1]);
    el.ghostdot.style.display = "";
  } else { el.ghost.style.display = "none"; el.ghostdot.style.display = "none"; }
  el.beam.setAttribute("transform", translateAlong(P, [0, beamY.x, 0]));
  el.carriage.setAttribute("transform", translateAlong(P, [penX.x, 0, 0]));
  el.pen.setAttribute("transform", translateAlong(P, [0, 0, penLift.x]));
  for (let i = 0; i < 4; i++) {
    needles[i].setAttribute("d", needleD(i, needleA[i].x));
    if (lamps[i].getAttribute("data-tone") !== T.lamps[i]) lamps[i].setAttribute("data-tone", T.lamps[i]);
  }
  el.flag.setAttribute("d", flagD(flagA.x));
  el.bail.setAttribute("d", bailPath(bailA.x));
  el.cap.setAttribute("transform", translateAlong(P, [0, 0, -2.2 * capD.x]));
  const h = droneH.x;
  el.drone.setAttribute("transform", translateAlong(P, [h * 0.05, -h * 0.04, h]));
  const sc = Math.max(0.3, 1 - h / 55);
  el.shadow.setAttribute("transform", "translate(" + (padC[0] * (1 - sc)) + " " + (padC[1] * (1 - sc)) + ") scale(" + sc + ")");
  el.shadow.style.opacity = Math.max(0.12, 0.9 - h / 42).toFixed(2);
  el.props.setAttribute("d", propD(spin * 14));
  el.spokes.setAttribute("d", spokeD(reelA.x * 230));
  if (T.marker >= 0) {
    const mp = routePoint(wps, T.marker);
    const m2 = isoPt([mp[0], mp[1], ROUTE_Z + 0.5]);
    el.marker.setAttribute("cx", m2[0]); el.marker.setAttribute("cy", m2[1]);
    el.marker.style.display = "";
  } else el.marker.style.display = "none";
  el.armed.setAttribute("data-tone", T.bail ? "green" : "mid");
  const c = checks(wpX.x);
  let text;
  if (manual) {
    text = "wp7 " + (wpX.x <= FENCE.x + FENCE.w ? "inside" : "+" + Math.round((wpX.x - (FENCE.x + FENCE.w)) * METRES) + " m outside") + " fence · checks " + passedCount(c) + "/4";
    if (hopAt >= 0) text = "replay · drone +" + Math.round(droneH.x * METRES * 0.4) + " m";
  } else {
    text =
      ph === "feed" ? "order card in · 'inspect north roof'" :
      ph === "draw" ? "drafting · wp " + Math.max(1, Math.ceil(T.draw * 7)) + "/7" :
      ph === "check" ? (c.geo ? "gate · checks " + passedCount(c) + "/4" : "geofence ✗ wp7 outside fence") :
      ph === "repair" ? "repair · wp7 " + Math.round((wpX.x - WP7_OK) * METRES) + " m to go" :
      ph === "arm" ? "all green · unlocked" :
      ph === "fly" ? "replay 4× · drone +" + Math.round(droneH.x * METRES * 0.4) + " m" :
      ph === "land" ? "touchdown · logged" :
      ph === "logged" ? "replay saved · evidence linked" : "resetting";
  }
  if (text !== lastText) { readout.textContent = text; lastText = text; }
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  clock = manual ? clock + dt : calm ? 17.5 : (clock + dt) % T_LOOP;
  const ph = manual ? "manual" : phaseAt(clock);
  const T = manual ? manualTargets() : tourTargets(clock, ph);
  wpT = T.wp;
  springTo(wpX, wpT, dt, 60, 13, calm);
  springTo(cardX, T.card, dt, 90, 16, calm);
  springTo(beamY, T.pen[1], dt, 60, 13, calm);
  springTo(penX, T.pen[0], dt, 60, 13, calm);
  springTo(penLift, T.lift, dt, 120, 20, calm);
  for (let i = 0; i < 4; i++) springTo(needleA[i], T.needles[i], dt, 46, 11, calm);
  springTo(flagA, T.flag, dt, 90, 12, calm);
  springTo(bailA, T.bail, dt, 60, 14, calm);
  springTo(capD, T.cap, dt, 160, 18, calm);
  springTo(droneH, T.drone, dt, 26, 9.5, calm);
  if (T.spinning && !calm) { spin += dt; reelA.x += dt * 2.6; }
  draw(T, ph);
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

const goManual = () => {
  manual = true;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { manual = false; clock = 0; hopAt = -1; pressedAt = -1; }, 4200);
  run();
};
// dragging near the route's last leg pulls waypoint 7 along x
const stripA = isoPt([WP_MIN, -15, ROUTE_Z]), stripB = isoPt([WP_MAX, -15, ROUTE_Z]);
stage.addEventListener("pointermove", (ev) => {
  const box = svg.getBoundingClientRect();
  const px = ((ev.clientX - box.left) / box.width) * ${WIDTH};
  const py = ((ev.clientY - box.top) / box.width) * ${WIDTH};
  const dx = stripB[0] - stripA[0], dy = stripB[1] - stripA[1];
  const t = clamp(((px - stripA[0]) * dx + (py - stripA[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  const dist = Math.hypot(px - (stripA[0] + dx * t), py - (stripA[1] + dy * t));
  if (dist < 55) { goManual(); wpT = clamp(WP_MIN + t * (WP_MAX - WP_MIN), WP_MIN, WP_MAX); }
});
stage.addEventListener("keydown", (ev) => {
  if (!["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown", "Home", " ", "Enter", "Escape"].includes(ev.key)) return;
  ev.preventDefault();
  if (ev.key === "Escape") { manual = false; clock = 0; hopAt = -1; pressedAt = -1; run(); return; }
  goManual();
  if (ev.key === "ArrowRight" || ev.key === "ArrowUp") wpT = clamp(wpT + (ev.shiftKey ? 10 : 3), WP_MIN, WP_MAX);
  if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") wpT = clamp(wpT - (ev.shiftKey ? 10 : 3), WP_MIN, WP_MAX);
  if (ev.key === "Home") wpT = WP7_BAD;
  if (ev.key === " " || ev.key === "Enter") {
    const c = checks(wpX.x);
    if (c.geo && c.nf && hopAt < 0) { hopAt = clock; pressedAt = clock; }
  }
});
draw(tourTargets(0, "feed"), "feed");
`;

const extraCss = `
.iso-wp7{fill:var(--anatomy-lit)}
.iso-marker{fill:var(--anatomy-lit)}
.iso-ghostdot{fill:none;stroke:var(--anatomy-lo);stroke-width:.7}
.iso-eye{stroke:var(--anatomy-lo);stroke-width:.6;fill:var(--anatomy-paper)}
`;

const plate2 = k.plateHtml({
  fig: "Fig 1",
  title: "DroneOS — safety gate",
  hint: "drag on the map to move wp7 · space launches",
  readout: "order card in",
  keys: [
    { mark: "lit", label: "Route and pen: what the plan does" },
    { mark: "green", label: "A dial in its green arc passed its check" },
    { mark: "red", label: "Failed check: needle to red, flag up, launch locked" },
    { mark: "dashed", label: "Geofence wire and the no-fly ring" },
  ],
  caption:
    "A natural-language mission becomes a flight plan only after a deterministic gate. The card drops in, the pen plots the route, and the plan is held to four gauges — geofence, ceiling, no-fly, battery — that must all swing green before the bail opens and the launch button can lift the drone. Pull waypoint 7 past the fence and the geofence dial trips, the flag flips up and the gate locks.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="DroneOS safety gate: arrow keys move waypoint 7 across the geofence edge, Space presses the launch button when every check passes" aria-valuetext="idle">${svg}<style>${extraCss}</style></div>`,
});

const name = theme === "light" ? "index-light.html" : "index.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "DroneOS — safety gate", theme, body: plate2, script: kitScript() + live, width: 720 }));
console.log("wrote", name);
