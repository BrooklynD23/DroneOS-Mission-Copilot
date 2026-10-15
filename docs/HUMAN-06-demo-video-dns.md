# HUMAN-06 — 3-minute demo video, rehearsals (+ optional custom domain)

| Field | Value |
|---|---|
| Needed before | Presentation day. After WAVE-07 and HUMAN-02. |
| Env var | `DEMO_VIDEO_URL` (your shell; link also goes in `README.md`) |
| Cost | $0 (OBS, CapCut free tiers, YouTube unlisted). Custom domain: registrar price. |

## Steps
1. Rehearse the PLAN-00 §3 script 3× on the deployed URL, cold start each time; one run with Wi-Fi off to prove the recorded fallback ([A15](../../../AI/loop-research/scratchpads/A15-demo-reliability.md)). Log per-beat times and, in LIVE mode, 10 plan latencies (target p95 ≤15 s) in `docs/STATUS.md`.
2. Record with [OBS Studio](https://obsproject.com/) at 1920×1080, browser zoom so body text is ≥18 px; test a 10 s clip first ([A17](../../../AI/loop-research/scratchpads/A17-deploy-video.md)).
3. Record in REPLAY mode (deterministic). Optional second take in LIVE mode with the access code — never show the code on screen.
4. Edit in [CapCut](https://www.capcut.com/): burn-in captions, keep labels (`REPLAY`, `SYNTHETIC`/`RECORDED SITL`, `4×`) readable; ≤3:00.
5. Upload unlisted at [youtube.com/upload](https://www.youtube.com/upload); `export DEMO_VIDEO_URL=<link>`; add it to `README.md` line 3.
6. Keep the MP4 on the presenter laptop as the offline fallback ("FALLBACK — recorded").
7. Optional DNS: Vercel Project → Settings → Domains → add domain, then set the DNS records Vercel shows ([add a domain](https://vercel.com/docs/domains/add-a-domain)). Update `DEMO_URL` and the GitHub variable.

## Verification
```bash
test -n "$DEMO_VIDEO_URL" && curl -fsSIL -o /dev/null "$DEMO_VIDEO_URL" && grep -q "$DEMO_VIDEO_URL" README.md
```
Exit 0 = video reachable and linked from the README.
