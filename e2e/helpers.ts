import { expect, type Page, type TestInfo } from "@playwright/test";

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** Serve a 1x1 PNG for every map tile: offline, deterministic, no OSM load. */
export async function blockTiles(page: Page): Promise<void> {
  const fulfill = (route: { fulfill: (o: object) => Promise<void> }) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG });
  await page.route("**/*tile*.png", fulfill);
  const custom = process.env.NEXT_PUBLIC_TILE_URL;
  if (custom) {
    const origin = new URL(custom.replace(/\{[^}]*\}/g, "0")).origin;
    await page.route(`${origin}/**`, fulfill);
  }
  // default OSM tiles (tile.openstreetmap.org/z/x/y.png)
  await page.route("**://*.tile.openstreetmap.org/**", fulfill);
}

/** Fails the test on any console error or uncaught page error. */
export function expectNoConsoleErrors(page: Page): () => void {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return () => expect(errors).toEqual([]);
}

/** Stable per-test documentation-range IP: 203.0.113.<1..254>. */
export function uniqueIp(testInfo: TestInfo): string {
  let h = testInfo.workerIndex;
  for (const c of testInfo.title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `203.0.113.${(h % 254) + 1}`;
}

/** Page ready with tiles stubbed and a private rate-limit bucket. */
export async function setup(page: Page, testInfo: TestInfo): Promise<void> {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp(testInfo) });
  await blockTiles(page);
}
