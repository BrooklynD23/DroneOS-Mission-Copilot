# DroneOS Mission Copilot: Web Stack and Hosting Research

Checked 2026-10-14. Versions from npm registry `latest` tags unless noted.

## 1. Versions

| Piece | Version | Link | Note |
|---|---|---|---|
| Node.js LTS | v24.22.0 "Krypton" | [nodejs.org/dist/index.json](https://nodejs.org/dist/index.json) | Use v24 LTS. v26.12.0 is Current (not LTS). |
| pnpm | 12.11.2 | [pnpm.io](https://pnpm.io) / [npm](https://registry.npmjs.org/pnpm/latest) | Install via `corepack enable` or `npm i -g pnpm`. |
| TypeScript | 7.0.2 | [typescriptlang.org](https://www.typescriptlang.org/) / [npm](https://registry.npmjs.org/typescript/latest) | Major jump from 5.x: check Next.js compatibility before pinning. UNVERIFIED for Next.js 16.4 support. |
| Next.js (App Router) | 16.4.1 | [nextjs.org/docs/app/getting-started/installation](https://nextjs.org/docs/app/getting-started/installation) | Min Node 20.9. Turbopack default. |
| React | 19.3.1 | [react.dev](https://react.dev/) | Next App Router bundles React canary; still declare `react`/`react-dom`. |
| react-dom | 19.3.1 | [react.dev](https://react.dev/) | Pair with React. |
| Vite | 8.3.4 | [vite.dev](https://vite.dev) | Alternative only. Not needed if using Next.js. |
| Tailwind CSS | 4.3.3 | [tailwindcss.com](https://tailwindcss.com) | Skip. Plain CSS is enough for MVP. Next scaffold offers Tailwind as a prompt. |
| Leaflet | 1.9.4 | [leafletjs.com](https://leafletjs.com/reference.html) | Stable. 2.0 is alpha per docs. |
| react-leaflet | 5.0.0 | [react-leaflet.js.org](https://react-leaflet.js.org) | Peer deps for React 19: UNVERIFIED. |
| @geoman-io/leaflet-geoman-free | 2.20.2 | [geoman.io](https://geoman.io) | Polygon/polyline drawing and editing for Leaflet. Chosen drawing tool. |
| leaflet-draw | 1.0.4 | [github.com/Leaflet/Leaflet.draw](https://github.com/Leaflet/Leaflet.draw#readme) | Alternative. Older; use only if Geoman fails. |
| maplibre-gl | 6.14.0 | [maplibre.org](https://maplibre.org/) | Alternative to Leaflet for vector tiles. No Geoman. |
| @turf/boolean-point-in-polygon | 7.4.0 | [github.com/Turfjs/turf](https://github.com/Turfjs/turf) | Geofence containment. |
| @turf/line-intersect | 7.4.0 | [github.com/Turfjs/turf](https://github.com/Turfjs/turf) | Path crosses fence. |
| @turf/length | 7.4.0 | [github.com/Turfjs/turf](https://github.com/Turfjs/turf) | Route length checks. |
| @turf/buffer | 7.4.0 | [github.com/Turfjs/turf](https://github.com/Turfjs/turf) | Safety margins around fences. |
| @turf/boolean-intersects | 7.4.0 | [github.com/Turfjs/turf](https://github.com/Turfjs/turf) | Polygon-polygon overlap. |
| zod | 4.6.7 | [zod.dev](https://zod.dev) | Use v4. Native JSON Schema export. |
| zod-to-json-schema | 3.25.2 | [github.com/StefanTerdell/zod-to-json-schema](https://github.com/StefanTerdell/zod-to-json-schema#readme) | Not needed. Use `z.toJSONSchema()` from zod v4 ([zod.dev/json-schema](https://zod.dev/json-schema)). |
| @anthropic-ai/sdk | 0.134.0 | [github.com/anthropics/anthropic-sdk-typescript](https://github.com/anthropics/anthropic-sdk-typescript#readme) | Use `zodOutputFormat()` helper per [structured outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). |
| vitest | 5.0.4 | [vitest.dev](https://vitest.dev) | Unit tests for validator. |
| @vitest/coverage-v8 | 5.0.4 | [vitest.dev/guide/coverage](https://vitest.dev/guide/coverage) | Coverage target 80% per user rules. |
| @playwright/test | 1.64.1 | [playwright.dev](https://playwright.dev) | E2E. Docker tag `v1.64.0-noble` in docs (see CI section). |
| Biome | 2.5.15 | [biomejs.dev/guides/getting-started](https://biomejs.dev/guides/getting-started/) / [npm](https://registry.npmjs.org/@biomejs/biome/latest) | Pick over ESLint+Prettier. Next.js supports Biome as linter option ([docs](https://nextjs.org/docs/app/getting-started/installation#set-up-linting)). |
| ESLint | 10.12.0 | [eslint.org](https://eslint.org) | Only if Biome cannot cover a needed rule. |
| typescript-eslint | 8.71.2 | [typescript-eslint.io](https://typescript-eslint.io/packages/typescript-eslint) | Only with ESLint. |
| Prettier | 3.9.10 | [prettier.io](https://prettier.io) | Only with ESLint. Biome formats instead. |
| @upstash/ratelimit | 2.2.0 | [github.com/upstash/ratelimit-js](https://github.com/upstash/ratelimit-js#readme) | Shared rate limiter for serverless. |
| @upstash/redis | 1.39.0 | [github.com/upstash/upstash-redis](https://github.com/upstash/upstash-redis#readme) | Required by ratelimit. |

## 2. Map tiles and usage policy

| Piece | Version | Link | Note |
|---|---|---|---|
| OSM standard tiles | n/a | [operations.osmfoundation.org/policies/tiles](https://operations.osmfoundation.org/policies/tiles/) | Dev/demo only. No bulk prefetch, offline, or default library User-Agent. Must send distinct User-Agent and show "© OpenStreetMap contributors". No numeric cap, may block without notice. |
| OpenFreeMap | n/a (public service) | [openfreemap.org](https://openfreemap.org/) | No API key, no registration, commercial use allowed, no map-view limit. Attribution required. Offline download cap: 3,000 tiles or 50 MB per download. Quick start URLs not verified. |
| Esri World Imagery | n/a | [goto.arcgis.com/maps/World_Imagery](https://goto.arcgis.com/maps/World_Imagery) | Governed by Esri Master License Agreement. Free-dev/commercial terms NOT verified. Not for offline tile export. Skip unless required. |

## 3. Hosting (free tiers)

| Host | Limits (free) | Link | Commercial use | Fit |
|---|---|---|---|---|
| Vercel Hobby | 1M function invocations; 4 CPU-hrs active; 360 GB-hrs memory; 100 GB fast data transfer; 10 GB fast origin transfer; 1M CDN requests; 300 s max function duration; 100 deployments/day; 200 projects; 3 WAF custom rules; 1 h runtime logs | [vercel.com/docs/plans/hobby](https://vercel.com/docs/plans/hobby) | **Non-commercial, personal use only** per [fair-use guidelines](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage) | Native Next.js. Best if MVP is personal/demo. |
| Cloudflare Pages | 500 builds/mo; 1 concurrent build; 20,000 files/site; 25 MiB/asset; 100 projects | [developers.cloudflare.com/pages/platform/limits](https://developers.cloudflare.com/pages/platform/limits/) | Not addressed on page | Static only. Next.js needs an adapter (UNVERIFIED which). |
| Cloudflare Workers Free | 100,000 requests/day; 10 ms CPU per request; 50 subrequests per invocation; 100 Workers projects | [developers.cloudflare.com/workers/platform/limits](https://developers.cloudflare.com/workers/platform/limits/) | Not addressed on page | Good for a single API route; more setup than Vercel. |
| Netlify Free | 300 credits/mo (bandwidth 20 credits/GB; web requests 2 credits/10k; compute 10 credits/GB-hr; production deploy 15 credits). Build minutes and function limits NOT listed on page | [netlify.com/pricing](https://www.netlify.com/pricing/) | Not addressed | Credit model is hard to predict. Not recommended. |
| GitHub Pages | Static only. Limits NOT verified | UNVERIFIED | UNVERIFIED | Fine for static replays alone; cannot host `/api` route. |

## 4. Rate limiting on serverless

| Option | Free limit | Link | Verdict |
|---|---|---|---|
| In-memory per-instance limiter | Free | n/a | **Not real.** Each serverless instance has its own memory; limits reset on cold start and don't share across instances. |
| Upstash Ratelimit + Redis | 500K commands/mo; 250 MB data; 10 GB bandwidth/mo; no card needed to start | [upstash.com/pricing](https://upstash.com/pricing) | **Use this.** Real shared limit, ~15 lines. Free-tier database count conflicts on page (1 vs 10). |
| Vercel WAF rate-limit rule | Hobby allows up to 3 WAF custom rules; rate-limit rule type on Hobby NOT verified | [vercel.com/docs/plans/hobby](https://vercel.com/docs/plans/hobby) | Possible zero-code option. UNVERIFIED for Hobby. |

## 5. Anthropic API

| Piece | Value | Link | Note |
|---|---|---|---|
| Sonnet model ID | `claude-sonnet-5-5` (dateless, pinned) | [platform.claude.com models overview](https://platform.claude.com/docs/en/models/overview) | $2 input / $10 output per MTok. Use for mission JSON generation. |
| Haiku model ID | `claude-haiku-5-5` | [models overview](https://platform.claude.com/docs/en/models/overview) | From $0.10 input / $0.50 output per MTok. Cheap option for simple prompts. |
| Opus model ID | `claude-opus-5-5` | [models overview](https://platform.claude.com/docs/en/models/overview) | $4 / $20 per MTok. Not needed for MVP. |
| Structured output | `output_config.format` with `type: "json_schema"`; or strict tool use `strict: true` | [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) | Supported on Sonnet 5.5 and Haiku 5.5. Schema limits: no `minLength`/`maxLength`, no numeric bounds, `additionalProperties: false` required. Validate with zod after. |
| Console (API keys) | n/a | [platform.claude.com](https://platform.claude.com/) | Spend limits page: UNVERIFIED. |

## 6. Recommendation

1. Host on **Vercel Hobby** if the MVP stays personal or demo. Hobby is non-commercial only; a paid product needs Vercel Pro ($20 per developer seat/mo per [pricing page](https://vercel.com/docs/plans/hobby#upgrading-to-pro)).
2. Use Next.js 16.4 App Router with **plain CSS** (answer "No" to Tailwind on `create-next-app`).
3. Put replay JSON and JPG frames in `public/` as static files. Served by Vercel CDN; under the 100 GB Hobby transfer cap at MVP traffic. Replay size limit for Git deploy: UNVERIFIED.
4. Map: Leaflet 1.9.4 + react-leaflet + Geoman for drawing. Tiles: OSM for dev only; OpenFreeMap-based (MapLibre) for anything public.
5. Geofence: Turf 7.x + your own `validateMission()` in TypeScript. Zod 4 for mission schema; `z.toJSONSchema()` for the Claude schema.
6. Anthropic: one route handler, model `claude-sonnet-5-5`, `zodOutputFormat()` for structured output, then zod re-validate server-side.
7. Rate limit: Upstash Ratelimit (sliding window per IP) on the one API route.
8. Testing: Vitest (unit, validator), Playwright (E2E), Biome (lint+format). CI on GitHub Actions free tier (public repo = unlimited standard runners; private = 2,000 min/mo).

## 7. CI (GitHub Actions)

| Item | Value | Link |
|---|---|---|
| Free minutes, public repo | Standard GitHub-hosted runners free | [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) |
| Free minutes, private repo | 2,000 min/mo; 500 MB artifacts; 10 GB cache/repo | [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) |
| Playwright container | `mcr.microsoft.com/playwright:v1.64.0-noble` with `options: --user 1001` | [playwright.dev/docs/ci](https://playwright.dev/docs/ci) |
| Checkout / Node setup | `actions/checkout@v6`, `actions/setup-node@v6` with `lts/*` | [playwright.dev/docs/ci](https://playwright.dev/docs/ci) |

Note: npm `@playwright/test` is 1.64.1 but docs example image is v1.64.0. Pin image tag to the npm version when it exists; UNVERIFIED whether `v1.64.1-noble` is published.

## 8. Human setup steps

| Step | Account / key | Exact URL | Env var | Cost |
|---|---|---|---|---|
| 1 | Vercel account (Hobby) | [vercel.com/signup](https://vercel.com/signup) | none | $0 (non-commercial) |
| 2 | Anthropic API key | [platform.claude.com](https://platform.claude.com/) | `ANTHROPIC_API_KEY` | Pay per token: Sonnet 5.5 $2/$10 per MTok |
| 3 | Upstash Redis database | [console.upstash.com](https://console.upstash.com/) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | $0 free tier (500K commands/mo) |
| 4 | GitHub repo | [github.com/new](https://github.com/new) | none | $0 public; private = 2,000 min/mo free |
| 5 | Map tiles (OSM) | [operations.osmfoundation.org](https://operations.osmfoundation.org/policies/tiles/) | `NEXT_PUBLIC_TILE_URL` (optional) | $0 |
| 6 | Vercel env vars | [vercel.com/dashboard](https://vercel.com/dashboard) | set the three above in Project Settings | $0 |

## Unverified

- Vercel Hobby rate-limit rule availability in WAF: UNVERIFIED.
- Esri World Imagery developer/commercial terms: UNVERIFIED. Esri Master Agreement referenced, no free-dev terms found.
- OpenFreeMap raster URL for Leaflet: UNVERIFIED (vector style URLs not captured).
- Netlify build minutes and function limits: UNVERIFIED.
- GitHub Pages limits: UNVERIFIED.
- Cloudflare Next.js adapter name: UNVERIFIED.
- react-leaflet 5.0.0 React 19 peer compatibility: UNVERIFIED.
- Anthropic Console spend-limit settings: UNVERIFIED.
- Playwright `v1.64.1-noble` image tag: UNVERIFIED.
- Zod v4 compatibility with `zodOutputFormat()`: UNVERIFIED.

## Planner notes (2026-10-14)

| Item | Finding | Evidence |
|---|---|---|
| `zodOutputFormat()` + zod v4 | Verified: `@anthropic-ai/sdk@0.134.0` ships `helpers/zod` importing `zod/v4`; peer `zod ^3.25 \|\| ^4` | [unpkg helpers/zod.d.ts](https://unpkg.com/@anthropic-ai/sdk@0.134.0/helpers/zod.d.ts) |
| Schema limits | SDK helpers strip `minimum`/`maximum`/`minLength`/`maxLength` into descriptions and re-validate against the original schema | [structured outputs → How SDK transformation works](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) |
| Spend limits | Verified: Console → Billing (`platform.claude.com/settings/billing`) → Spend limits → Set/Adjust limit; at the cap requests return HTTP 400 `invalid_request_error` | [rate limits](https://platform.claude.com/docs/en/api/rate-limits) |
| Pricing numbers in §5 | Not re-verified; plan links the [pricing page](https://platform.claude.com/docs/en/about-claude/pricing) instead of quoting | — |
| TypeScript pin | 7.0.2 is `latest`; plan pins **5.9.3** (last 5.x) because TS 7 + Next 16.4 compatibility is unverified | [npm](https://www.npmjs.com/package/typescript) |
| react-leaflet 5.0.0 | Licence **Hippocratic-2.1** (npm metadata); peers React ^19 OK. Not used: Leaflet is driven directly | [npm](https://www.npmjs.com/package/react-leaflet) |
| vitest 5.0.4 | `vite` is a required (non-optional) peer → pin `vite@8.3.4` | npm registry metadata |
| create-next-app 16.4.1 | Refuses non-empty dirs except a whitelist (`.claude`, `docs`, `.git`, …); `README.md`/`AGENT.md` conflict → scaffold in a temp dir | [is-folder-empty.ts](https://github.com/vercel/next.js/blob/canary/packages/create-next-app/helpers/is-folder-empty.ts) |
| Rate limit decision | No Upstash in MVP: live mode is access-code gated + spend limit; in-memory limiter marked `ponytail:` with Upstash as upgrade | PLAN-00 §6 |
