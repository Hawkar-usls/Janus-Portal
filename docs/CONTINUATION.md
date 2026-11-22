# JANUS PORTAL — Resumption / next agent checklist (2026-11-22)

This file exists so the next authorized ChatGPT agent can continue **without needing the original chat**.

## Grounded user requirements

- Standalone repository: `Hawkar-usls/Janus-Portal`.
- Main site where a `Портал` tab is desired: `https://tg-pomoyka.hawkarlol.chatgpt.site/`.
- Autonomous panorama exploration: look around automatically, jump to random **unvisited nearest** locations, configurable origin, speed, acceleration.
- **Radius starts at 5 km by default; if no fresh spots exist, double outward until there is coverage** (capped; no fake claims).
- Persistent stats, visited-place map, competitive achievements, eventually **JANUS J Coins** tied to existing account wallet.
- User authorized use of a connected remote PC **Yaksa** and GitHub. An API key was provided privately in chat; NEVER copy it into repo, logs or docs.

## What is currently implemented

`index.html` + responsive CSS, Panoramax/Google provider adapters, automatic traversal/pause/turbo, deduped visit history, export, OpenStreetMap + Leaflet map (Panoramax only), achievements, unit tests, CI workflow and Pages workflow.

On 2026-11-22 GitHub Actions PR run [45007676303](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45007676303) ran **14/14 tests PASS** including provider spatial deduplication. Edge on Yaksa rendered a real Paris 360° panorama with visible source credits; first visit, Leaflet map, pause/resume worked. A later auto-second-jump test exhausted sampled candidates because the provider filled its result budget with near-identical photos; the provider was patched to filter by 20m *before* that cap and CI passed, but **the second automatic jump has not yet been revalidated in a browser after this fix**. Panoramax API metadata was independently fetched in Paris, Rennes and Lyon. A nonblocking /api/configuration 404 from the third-party viewer was observed.

## Mandatory next actions

1. **Experimental MVP merge vs production gate:** GitHub Actions and first real Panoramax browser view were verified; an experimental merge to `main` is acceptable with the explicit `BROWSER_E2E_PENDING` label. **Before claiming production readiness**, close [issue #6](https://github.com/Hawkar-usls/Janus-Portal/issues/6) with 2+ actual automatic jumps, rotation, pause and resume. Confirm the merged `main` SHA and Pages deployment.
2. **Deploy:** In GitHub Settings → Pages, choose Source `GitHub Actions` if necessary. Confirm actual run success and published URL. Don't assert deployed without evidence.
3. **Provider robustness:** Test Panoramax metadata paging, transient errors, partial coverage and antimeridian; test real Google display with a properly restricted project-specific API key, quota and attribution (not chat-shared key in logs). Add capped search budget and replay tests.
4. **User site integration:** Discover actual source or editor of `tg-pomoyka.hawkarlol.chatgpt.site`, route and authenticated account/wallet API. Wire `Портал` navigation. If editor unavailable, keep this as an issue.
5. **Server-authoritative J Coins / leaderboard:** Design `POST /api/portal/visit` on actual JANUS site backend; verify authenticated user, canonical place, idempotency, realistic rate limits and monetary cap. No client `balance += 1` fraud. Agree economics with owner, then deploy.
6. **Full statistics:** Save per-account visits in authorized DB and render filters by country/provider, per-day history, competitive rankings and privacy controls. Client local history isn't authoritative.
7. **Regression:** Browser tests across mobile/desktop; provider failures, no coverage, fast pause/stop, 10k visited points, Google SDK errors and external CDN failures.
8. **Audit:** Google current retention/attribution and Panoramax licenses; implement ToS-compliant durable stats.

## Repro commands

```bash
npm run verify
npm run dev
# http://127.0.0.1:4173
```

A no-dependency Node dev server is included. CI must be green. Remote Yaksa uses Windows PowerShell; call `npm.cmd` if `npm.ps1` is blocked by execution policy.

## Critical blockers

- The standalone repo does NOT contain the main site's code/auth/wallet. Independent integration cannot be declared complete from this repo.
- Browser E2E and deployment may need actual site/editor access, key quotas, Pages enabled.
- Google Maps terms require extra checks for durable geodata and third-party map usage.
- No endpoint for user reward issuance exists in this repo.

## Where evidence belongs

- PR descriptions, Actions run URL, browser screenshot only after genuine capture, `docs/STATUS.json`.
- Never expose API keys or paste account private information.
