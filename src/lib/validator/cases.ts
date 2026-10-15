import type { LatLon } from "../schema/geo";
import type { Mission, Waypoint } from "../schema/mission";
import type { Constraints, Scenario } from "../schema/scenario";
import type { ViolationCode } from "../schema/validation";

// 100 validator fixtures built programmatically from one inline test site.
// Geometry helper from WAVE-02: dlat = north_m / 111_320,
// dlon = east_m / (111_320 * cos(lat0)). Home is the PX4 SITL default.

export interface ValidCase {
  name: string;
  scenario: Scenario;
  mission: Mission;
}

export interface InvalidCase extends ValidCase {
  /** exact set of violation codes the case must produce */
  codes: ViolationCode[];
}

const HOME: LatLon = { lat: 47.397742, lon: 8.545594 };
const M_PER_DEG_LAT = 111_320;
const COS_LAT0 = Math.cos((HOME.lat * Math.PI) / 180);

/** metre offset (east, north) -> lat/lon around home */
const at = (eastM: number, northM: number): LatLon => ({
  lat: HOME.lat + northM / M_PER_DEG_LAT,
  lon: HOME.lon + eastM / (M_PER_DEG_LAT * COS_LAT0),
});

const ring = (pts: ReadonlyArray<readonly [number, number]>): LatLon[] =>
  pts.map(([e, n]) => at(e, n));

/**
 * Test site (same shape as WAVE-02 scenarios, kept inline):
 * geofence rectangle east -150..150 m, north -100..150 m;
 * no-fly "parking-lot" east 60..140, north -90..-20 m.
 */
export const SITE: Scenario = {
  id: "test-site",
  title: "Validator test site",
  home: HOME,
  area: ring([
    [-40, 80],
    [40, 80],
    [40, 140],
    [-40, 140],
  ]),
  constraints: {
    geofence: ring([
      [-150, -100],
      [150, -100],
      [150, 150],
      [-150, 150],
    ]),
    no_fly: [
      {
        id: "parking-lot",
        name: "Parking lot",
        ring: ring([
          [60, -90],
          [140, -90],
          [140, -20],
          [60, -20],
        ]),
      },
    ],
    ceiling_m: 60,
    min_alt_m: 5,
    max_waypoints: 50,
    max_leg_m: 400,
    battery_wh: 77,
    cruise_power_w: 350,
    reserve_pct: 25,
  },
  pois: [
    {
      id: "roof-hatch-n",
      label: "Roof hatch north",
      ...at(0, 120),
      radius_m: 15,
    },
  ],
  preset_requests: ["Inspect the test site"],
};

const withConstraints = (
  id: string,
  patch: Partial<Constraints>,
): Scenario => ({
  ...SITE,
  id,
  constraints: { ...SITE.constraints, ...patch },
});

/** L-shaped fence: notch east 60..150 x north 60..150 removed; concave corner at (60,60). */
export const CONCAVE_SITE: Scenario = withConstraints("test-concave", {
  geofence: ring([
    [-150, -100],
    [150, -100],
    [150, 60],
    [60, 60],
    [60, 150],
    [-150, 150],
  ]),
});

/** waypoint budget small enough for schema-valid missions to trip max_waypoints */
export const FEW_WP_SITE: Scenario = withConstraints("test-few-wp", {
  max_waypoints: 3,
});

/** leg budget short enough for in-fence legs to trip max_leg */
export const SHORT_LEG_SITE: Scenario = withConstraints("test-short-leg", {
  max_leg_m: 60,
});

const wp = (
  i: number,
  eastM: number,
  northM: number,
  altM = 25,
  holdS = 0,
): Waypoint => ({
  id: `wp${i}`,
  ...at(eastM, northM),
  alt_m: altM,
  action: "none",
  hold_s: holdS,
});

/** waypoints from [eastM, northM, altM?, holdS?] tuples */
const wps = (
  pts: ReadonlyArray<readonly [number, number, number?, number?]>,
): Waypoint[] => pts.map(([e, n, a, h], i) => wp(i + 1, e, n, a ?? 25, h ?? 0));

const mission = (waypoints: Waypoint[], speedMps = 8): Mission => ({
  mission_id: "case-mission",
  speed_mps: speedMps,
  waypoints,
  notes: [],
});

const snake = (eastings: number[], northings: number[]): [number, number][] =>
  northings.flatMap((n, r) =>
    (r % 2 ? [...eastings].reverse() : eastings).map(
      (e) => [e, n] as [number, number],
    ),
  );

// Safe lane region: east -140..45 (< zone east edge 60), north -80..140.
// Convex, so any leg between lane points stays clear of the no-fly zone.
const LANES: [number, number][][] = [
  [
    [0, 20],
    [0, 60],
    [0, 100],
    [0, 140],
  ],
  [
    [-120, -60],
    [-60, -20],
    [-120, 20],
    [-60, 60],
    [-120, 100],
    [-60, 140],
  ],
  [
    [45, -40],
    [45, 10],
    [45, 60],
    [45, 110],
  ],
  [
    [-100, -70],
    [-40, -70],
    [20, -70],
    [20, -20],
    [-40, -20],
    [-100, -20],
  ],
  snake([-100, -50, 0, 40], [0, 50, 100]),
  [
    [40, -10],
    [0, -10],
    [-40, -10],
    [-40, 30],
    [0, 30],
    [40, 30],
  ],
];

const generated: ValidCase[] = [];
let gi = 0;
const pushLane = (lane: [number, number][], len: number, reverse = false) => {
  const pts = reverse ? [...lane.slice(0, len)].reverse() : lane.slice(0, len);
  const waypoints = pts.map(([e, n], i) =>
    wp(i + 1, e, n, 10 + ((gi * 7 + i * 5) % 45), (gi + i) % 4 === 0 ? 5 : 0),
  );
  generated.push({
    name: `gen-${gi}-${len}wp`,
    scenario: SITE,
    mission: mission(waypoints, 3 + (gi % 10)),
  });
  gi++;
};
for (const lane of LANES) {
  for (let len = 1; len <= lane.length; len++) pushLane(lane, len);
}
for (const lane of LANES) pushLane(lane, lane.length, true);
// 38 prefixes + 6 reversed lanes = 44 generated cases

const specials: ValidCase[] = [
  {
    name: "alt-exactly-ceiling",
    scenario: SITE,
    mission: mission(wps([[30, 60, 60]])),
  },
  {
    name: "alt-exactly-min",
    scenario: SITE,
    mission: mission(wps([[-20, 40, 5]])),
  },
  {
    name: "wp-on-fence-boundary",
    scenario: SITE,
    mission: mission(wps([[150, 0, 20]])),
  },
  {
    name: "wp-on-fence-corner",
    scenario: SITE,
    mission: mission(wps([[150, 150, 20]])),
  },
  {
    name: "fifty-waypoints",
    scenario: SITE,
    mission: mission(
      wps(
        snake(
          [-140, -120, -100, -80, -60, -40, -20, 0, 20, 40],
          [-60, -20, 20, 60, 100],
        ),
      ),
      10,
    ),
  },
  {
    name: "single-fast-hover",
    scenario: SITE,
    mission: mission(wps([[10, 10, 15, 60]]), 15),
  },
];

export const validCases: ValidCase[] = [...generated, ...specials];

const holds = (
  pts: ReadonlyArray<readonly [number, number]>,
  altM: number,
  holdS: number,
): Waypoint[] => pts.map(([e, n], i) => wp(i + 1, e, n, altM, holdS));

export const invalidCases: InvalidCase[] = [
  // --- geofence ---
  {
    name: "gf-east-out",
    scenario: SITE,
    codes: ["geofence"],
    mission: mission(wps([[200, 0]])),
  },
  {
    name: "gf-north-out",
    scenario: SITE,
    codes: ["geofence"],
    mission: mission(wps([[0, 200]])),
  },
  {
    name: "gf-south-out",
    scenario: SITE,
    codes: ["geofence"],
    mission: mission(wps([[-50, -150]])),
  },
  {
    name: "gf-west-out",
    scenario: SITE,
    codes: ["geofence"],
    mission: mission(wps([[-200, 50]])),
  },
  {
    name: "gf-concave-point-in-notch",
    scenario: CONCAVE_SITE,
    codes: ["geofence"],
    mission: mission(wps([[100, 100]])),
  },
  {
    name: "gf-concave-leg-cuts-corner",
    scenario: CONCAVE_SITE,
    codes: ["geofence"],
    mission: mission(
      wps([
        [100, 50],
        [50, 100],
      ]),
    ),
  },
  // --- ceiling ---
  {
    name: "ceiling-61",
    scenario: SITE,
    codes: ["ceiling"],
    mission: mission(wps([[20, 80, 61]])),
  },
  {
    name: "ceiling-70",
    scenario: SITE,
    codes: ["ceiling"],
    mission: mission(wps([[0, 50, 70]])),
  },
  {
    name: "ceiling-120",
    scenario: SITE,
    codes: ["ceiling"],
    mission: mission(wps([[-30, 40, 120]])),
  },
  {
    name: "ceiling-second-wp",
    scenario: SITE,
    codes: ["ceiling"],
    mission: mission(
      wps([
        [0, 40, 20],
        [20, 80, 90],
        [40, 40, 20],
      ]),
    ),
  },
  {
    name: "ceiling-high-hover",
    scenario: SITE,
    codes: ["ceiling"],
    mission: mission(wps([[45, -30, 200]])),
  },
  {
    name: "ceiling-with-holds",
    scenario: SITE,
    codes: ["ceiling"],
    mission: mission(
      wps([
        [0, 60, 75, 10],
        [30, 60, 75, 10],
      ]),
    ),
  },
  // --- min_alt ---
  {
    name: "min-alt-4",
    scenario: SITE,
    codes: ["min_alt"],
    mission: mission(wps([[0, 50, 4]])),
  },
  {
    name: "min-alt-0",
    scenario: SITE,
    codes: ["min_alt"],
    mission: mission(wps([[20, 60, 0]])),
  },
  {
    name: "min-alt-negative",
    scenario: SITE,
    codes: ["min_alt"],
    mission: mission(wps([[-40, 30, -10]])),
  },
  {
    name: "min-alt-4-9",
    scenario: SITE,
    codes: ["min_alt"],
    mission: mission(wps([[30, 100, 4.9]])),
  },
  {
    name: "min-alt-mid-wp",
    scenario: SITE,
    codes: ["min_alt"],
    mission: mission(
      wps([
        [0, 40, 20],
        [0, 80, 20],
        [40, 80, 2],
        [40, 40, 20],
      ]),
    ),
  },
  {
    name: "min-alt-south-low",
    scenario: SITE,
    codes: ["min_alt"],
    mission: mission(wps([[-20, -50, 1]])),
  },
  // --- no_fly ---
  {
    name: "nf-wp-inside",
    scenario: SITE,
    codes: ["no_fly"],
    mission: mission(wps([[100, -55]])),
  },
  {
    name: "nf-wp-inside-2",
    scenario: SITE,
    codes: ["no_fly"],
    mission: mission(wps([[80, -30]])),
  },
  {
    name: "nf-wp-near-corner",
    scenario: SITE,
    codes: ["no_fly"],
    mission: mission(wps([[135, -25]])),
  },
  {
    name: "nf-leg-passes-through-ew",
    scenario: SITE,
    codes: ["no_fly"],
    mission: mission(
      wps([
        [40, -55],
        [150, -55],
      ]),
    ),
  },
  {
    name: "nf-leg-passes-through-ns",
    scenario: SITE,
    codes: ["no_fly"],
    mission: mission(
      wps([
        [100, 10],
        [100, -95],
      ]),
    ),
  },
  {
    name: "nf-leg-grazes-north-edge",
    scenario: SITE,
    codes: ["no_fly"],
    mission: mission(
      wps([
        [40, -20],
        [150, -20],
      ]),
    ),
  },
  {
    name: "nf-multiple-legs",
    scenario: SITE,
    codes: ["no_fly"],
    mission: mission(
      wps([
        [0, 50],
        [150, -60],
      ]),
    ),
  },
  // --- battery ---
  {
    name: "battery-ten-holds",
    scenario: SITE,
    codes: ["battery"],
    mission: mission(
      holds(
        [
          [-60, 0],
          [-20, 0],
          [20, 0],
          [20, 40],
          [-20, 40],
          [-60, 40],
          [-60, 80],
          [-20, 80],
          [20, 80],
          [20, 120],
        ],
        30,
        60,
      ),
    ),
  },
  {
    name: "battery-slow-tour",
    scenario: SITE,
    codes: ["battery"],
    mission: mission(
      wps([
        [-100, -60],
        [-100, 100],
        [40, 100],
        [40, -60],
      ]),
      1,
    ),
  },
  {
    name: "battery-long-slow",
    scenario: SITE,
    codes: ["battery"],
    mission: mission(
      wps([
        [-140, -80],
        [-140, 140],
        [45, 140],
        [45, -80],
        [-140, -80],
        [45, 140],
      ]),
      2,
    ),
  },
  {
    name: "battery-high-holds",
    scenario: SITE,
    codes: ["battery"],
    mission: mission(
      holds(
        [
          [-80, 20],
          [-40, 20],
          [0, 20],
          [40, 20],
          [40, 60],
          [0, 60],
          [-40, 60],
          [-80, 60],
          [-80, 100],
        ],
        60,
        60,
      ),
      6,
    ),
  },
  {
    name: "battery-wide-snake",
    scenario: SITE,
    codes: ["battery"],
    mission: mission(
      wps(snake([-140, -100, -60, -20, 20, 40], [-80, 0, 80, 140])),
      2,
    ),
  },
  {
    name: "battery-edge-over",
    scenario: SITE,
    codes: ["battery"],
    mission: mission(
      holds(
        [
          [-40, 20],
          [0, 20],
          [40, 20],
          [40, 60],
          [0, 60],
          [-40, 60],
          [-40, 100],
          [0, 100],
          [40, 100],
          [40, 140],
        ],
        30,
        55,
      ),
    ),
  },
  // --- max_waypoints (budget 3) ---
  {
    name: "mw-four",
    scenario: FEW_WP_SITE,
    codes: ["max_waypoints"],
    mission: mission(
      wps([
        [0, 40],
        [40, 40],
        [40, 80],
        [0, 80],
      ]),
    ),
  },
  {
    name: "mw-five",
    scenario: FEW_WP_SITE,
    codes: ["max_waypoints"],
    mission: mission(
      wps([
        [0, 40],
        [40, 40],
        [40, 80],
        [0, 80],
        [-40, 60],
      ]),
    ),
  },
  {
    name: "mw-six",
    scenario: FEW_WP_SITE,
    codes: ["max_waypoints"],
    mission: mission(
      wps([
        [-40, 20],
        [0, 20],
        [40, 20],
        [40, 60],
        [0, 60],
        [-40, 60],
      ]),
    ),
  },
  {
    name: "mw-eight",
    scenario: FEW_WP_SITE,
    codes: ["max_waypoints"],
    mission: mission(
      wps(
        snake([-60, -20, 20, 40], [20, 60]).concat([
          [-60, 100],
          [0, 100],
        ]) as [number, number][],
      ),
    ),
  },
  {
    name: "mw-ten",
    scenario: FEW_WP_SITE,
    codes: ["max_waypoints"],
    mission: mission(
      wps(
        snake([-80, -40, 0, 40], [20, 60]).concat([
          [-80, 100],
          [-40, 100],
        ]) as [number, number][],
      ),
      6,
    ),
  },
  // --- max_leg (budget 60 m) ---
  {
    name: "ml-single-67",
    scenario: SHORT_LEG_SITE,
    codes: ["max_leg"],
    mission: mission(wps([[60, 30]])),
  },
  {
    name: "ml-middle-leg",
    scenario: SHORT_LEG_SITE,
    codes: ["max_leg"],
    mission: mission(
      wps([
        [50, 20],
        [50, 90],
      ]),
    ),
  },
  {
    name: "ml-return-leg",
    scenario: SHORT_LEG_SITE,
    codes: ["max_leg"],
    mission: mission(wps([[20, 70]])),
  },
  {
    name: "ml-diagonal",
    scenario: SHORT_LEG_SITE,
    codes: ["max_leg"],
    mission: mission(
      wps([
        [-60, -30],
        [40, 60],
      ]),
    ),
  },
  {
    name: "ml-far-corner",
    scenario: SHORT_LEG_SITE,
    codes: ["max_leg"],
    mission: mission(wps([[-80, 70]])),
  },
  // --- multi-code ---
  {
    name: "multi-gf-ceiling",
    scenario: SITE,
    codes: ["geofence", "ceiling"],
    mission: mission(wps([[200, 0, 80]])),
  },
  {
    name: "multi-gf-nf",
    scenario: SITE,
    codes: ["geofence", "no_fly"],
    mission: mission(wps([[200, -50]])),
  },
  {
    name: "multi-ceiling-min",
    scenario: SITE,
    codes: ["ceiling", "min_alt"],
    mission: mission(
      wps([
        [0, 40, 70],
        [40, 80, 2],
      ]),
    ),
  },
  {
    name: "multi-min-nf",
    scenario: SITE,
    codes: ["min_alt", "no_fly"],
    mission: mission(wps([[100, -55, 2]])),
  },
  {
    name: "multi-ceiling-battery",
    scenario: SITE,
    codes: ["ceiling", "battery"],
    mission: mission(
      holds(
        [
          [-60, 0],
          [-20, 0],
          [20, 0],
          [20, 40],
          [-20, 40],
          [-60, 40],
          [-60, 80],
          [-20, 80],
          [20, 80],
          [20, 120],
        ],
        80,
        60,
      ),
    ),
  },
  {
    name: "multi-gf-ml",
    scenario: SITE,
    codes: ["geofence", "max_leg"],
    mission: mission(wps([[400, 300]])),
  },
  {
    name: "multi-mw-battery",
    scenario: FEW_WP_SITE,
    codes: ["max_waypoints", "battery"],
    mission: mission(
      holds(
        [
          [-60, 0],
          [-20, 0],
          [20, 0],
          [20, 40],
          [-20, 40],
          [-60, 40],
          [-60, 80],
          [-20, 80],
          [20, 80],
          [20, 120],
        ],
        30,
        60,
      ),
    ),
  },
  {
    name: "multi-ml-nf",
    scenario: SHORT_LEG_SITE,
    codes: ["max_leg", "no_fly"],
    mission: mission(
      wps([
        [45, -60],
        [145, -60],
      ]),
    ),
  },
  {
    name: "multi-nf-ceiling",
    scenario: SITE,
    codes: ["no_fly", "ceiling"],
    mission: mission(wps([[100, -55, 80]])),
  },
];
