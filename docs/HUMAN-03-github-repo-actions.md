# HUMAN-03 — GitHub repo + Actions

| Field | Value |
|---|---|
| Needed before | HUMAN-02. Not needed by any code wave (the loop commits locally and never pushes). |
| Secrets | **None required.** CI runs in replay mode with no keys. Do not add `ANTHROPIC_API_KEY` to Actions. |
| Variables | `DEMO_URL` (added in HUMAN-02 step 5) |
| Cost | $0 for a public repo; private repos get 2,000 Actions min/month free ([billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)) |

## Steps
1. Create an empty repo at [github.com/new](https://github.com/new) (no README/licence, to avoid a merge). Public is recommended (free minutes; graders can read it).
2. Install [GitHub CLI](https://cli.github.com/) and run `gh auth login`.
3. In the project root: `git remote add origin git@github.com:<org>/<repo>.git && git push -u origin main`.
4. Repo → Settings → Actions → General → allow GitHub Actions. Check that `web` and `sim` workflows run on the push (`e2e` runs only on `deployment_status`/manual dispatch, after HUMAN-02).
5. Optional: Settings → Branches → protect `main`, require the jobs of the `web` and `sim` workflows to pass (search the job names in the status-check box; they appear after one run).

## Verification
```bash
gh repo view --json name -q .name && gh run list --limit 3 --json conclusion -q '.[].conclusion' | grep -q success
```
Exit 0 = repo reachable and at least one recent workflow run succeeded.
