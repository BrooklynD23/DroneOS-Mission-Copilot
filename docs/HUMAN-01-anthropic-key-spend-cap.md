# HUMAN-01 — Anthropic API key + spend limit (optional: enables LIVE mode)

| Field | Value |
|---|---|
| Needed before | No wave. Only for LIVE mode locally (`.env.local`) and on Vercel (HUMAN-02). Replay mode works without it. |
| Owner | Team lead (billing holder) |
| Env vars | `ANTHROPIC_API_KEY`, `DEMO_ACCESS_CODE` |
| Cost | Pay per token; Sonnet 5.5 for plan/repair, Haiku 5.5 for captions. See the [pricing page](https://platform.claude.com/docs/en/about-claude/pricing) — do not rely on numbers copied into docs. A demo is a handful of calls; cap total with the spend limit below. |

## Steps
1. Sign in at [platform.claude.com](https://platform.claude.com/).
2. Add billing / credits on the [Billing page](https://platform.claude.com/settings/billing).
3. Set a spend limit: Billing → **Spend limits** → **Set limit** (or **Adjust limit**) → enter a small monthly cap (team decision, e.g. the course budget). Steps per [rate limits → Setting your own spend limit](https://platform.claude.com/docs/en/api/rate-limits). When reached, requests fail with HTTP 400 `invalid_request_error`; the app returns `upstream` and the presenter switches to replay.
4. Create a key at [API keys](https://platform.claude.com/settings/keys), name it `droneos-demo`. Copy once; store it in the team password manager.
5. Pick `DEMO_ACCESS_CODE`: 16+ random characters, e.g. `openssl rand -base64 18`. Share only with presenters.
6. Local: create `.env.local` (git-ignored) with both vars. Never commit it; never paste the key in chat, issues or screenshots.
7. Rotate the key after the course or if it is ever exposed (delete it on the API keys page, create a new one, update Vercel).

## Verification
```bash
curl -fsS https://api.anthropic.com/v1/models -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" -o /dev/null && test ${#DEMO_ACCESS_CODE} -ge 16
```
Exit 0 = key valid and access code long enough. Then in the app (`pnpm dev`), enter the code: banner shows `LIVE · claude-sonnet-5-5`.
