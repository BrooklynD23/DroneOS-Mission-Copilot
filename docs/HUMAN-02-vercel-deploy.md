# HUMAN-02 — Vercel project, env vars, public demo URL

| Field | Value |
|---|---|
| Needed before | WAVE-07 (its gate runs E2E against `$DEMO_URL`). Code waves 00–06 never need it. |
| Depends on | HUMAN-03 (GitHub repo with WAVE-06 pushed). HUMAN-01 only if LIVE mode is wanted. |
| Env vars (Vercel) | `ANTHROPIC_API_KEY` + `DEMO_ACCESS_CODE` (optional, both or neither), `NEXT_PUBLIC_TILE_URL` (optional) |
| Env var (your shell + GitHub repo variable) | `DEMO_URL` = `https://<project>.vercel.app` |
| Cost | $0 on Hobby — **non-commercial use only** ([Hobby plan](https://vercel.com/docs/plans/hobby), [fair use](https://vercel.com/docs/limits/fair-use-guidelines)). Pro is required for commercial use. |

## Steps
1. Sign up / sign in at [vercel.com/signup](https://vercel.com/signup) with the GitHub account that owns the repo.
2. [vercel.com/new](https://vercel.com/new) → Import the GitHub repo → Framework preset **Next.js** → Root directory = repo root → leave build/install commands default (pnpm detected from the lockfile) ([Git deployments](https://vercel.com/docs/git)).
3. Before the first deploy, set env vars in Project → Settings → Environment Variables ([docs](https://vercel.com/docs/projects/environment-variables)) for **Production** and **Preview**:
   - All environments: `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel honours `packageManager: pnpm@12.11.2`.
   - Replay-only demo: nothing else.
   - LIVE-capable demo: `ANTHROPIC_API_KEY`, `DEMO_ACCESS_CODE` (mark as Sensitive).
4. Deploy. Copy the production URL; `export DEMO_URL=https://<project>.vercel.app` — add it to your shell profile **before** starting Claude Code; the loop's planner checks HUMAN-02 in its own shell.
5. GitHub repo → Settings → Secrets and variables → Actions → **Variables** → add `DEMO_URL` (used by `e2e.yml` job `deployed`).
6. Replace the demo link placeholder in `README.md` and commit.
7. After changing env vars, redeploy (env changes apply to new deployments only).

## Verification
```bash
test -n "$DEMO_URL" && curl -fsS "$DEMO_URL/api/plan" | grep -q '"live_available"' && curl -fsS -o /dev/null "$DEMO_URL/replays/north-roof/manifest.json"
```
Exit 0 = app deployed, API route live, replay files on the CDN. Then `BASE_URL="$DEMO_URL" E2E_SKIP_RATELIMIT=1 pnpm e2e`.
