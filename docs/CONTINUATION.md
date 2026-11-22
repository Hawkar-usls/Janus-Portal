## R3 merge and live deployment verified — 2026-11-22

- [PR #10](https://github.com/Hawkar-usls/Janus-Portal/pull/10) **merged**: `24f6e737413c31ddb7ba55c251536a2791cae290`.
- Main [CI 45014029643](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45014029643): **29/29 tests PASS**.
- [GitHub Pages 45014029614](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45014029614): **SUCCESS**. Public URL **https://hawkar-usls.github.io/Janus-Portal/**. HTML and all new JS files `src/tours.js`, `src/tour-runner.js`, `src/discovery.js`, `src/fullscreen.js` returned **HTTP 200**.
- Real **Edge on public HTTPS**: tabs showed 12 tours, 37 destinations; Cairo/Giza searchable; Paris guided tour opened a genuine Panoramax photo **~1.2km from Eiffel Tower**; native fullscreen entered with `viewerPanel` height 980px and collapsed; **0 JS page errors**.
- Local Edge additional: planned route displayed **5 ordered stops + polyline**, simulated mobile no-Fullscreen-API immersive panel 844px and ESC restore; **0 JS errors**.
- Production-site browser with a *mocked empty Panoramax API* correctly handled Egyptian tour: **7 stops skipped, 0 visits, JC not awarded**; no JS exceptions. This is the safe fallback, not a claim that Egypt is without panoramas.
- Added `tools/browser-discovery-check.mjs` to reproduce tabs/fullscreen/mobile/zero-coverage checks using optional Playwright; Pages workflow now scoped to application source changes to avoid doc-only redeploys.
- Remaining external dependencies: actual JANUS site editor/auth and J Coin wallet (#1–3), Google Street View browser key restrictions/real Cairo imagery (#4), held-out object attention calibration (#9). **Do not claim these closed.**

## R3 excursion/fullscreen update — 2026-11-22

- Feature branch `feat/immersive-discovery-tours-r3`, new feature PR pending. Explicit user requirement: immersive/fullscreen panorama that can be collapsed, many more starting locations, dedicated Cairo / landmark tourist excursion tabs in the spirit of Microsoft Flight Simulator Discovery Flights.
- Created `src/tours.js`: 37 curated starting locations, 12 themed routes, notably Cairo/Giza/Luxor and world wonders; `src/tour-runner.js` searches the actual panorama provider within **2 then 4 km** of each planned stop (max 2 probes/radius). Absent or previously viewed images are skipped, not replaced by a different city's photo. Ordinary autonomous radius stays **5→10→20→…20,000 km**.
- Added `src/discovery.js` accessible tabs, search/category filters and stop summaries; `src/fullscreen.js` native Fullscreen API with button/ESC exit and CSS fallback. Routes display planned markers on the interactive map.
- Yaksa local Node v24 `npm run verify`: **29/29 PASS**. Edge real browser: 12 tours, 37 destinations, Cairo/Giza search present, Paris landmark tour opened an actual Panoramax photo **0.8 km from Eiffel Tower**, native fullscreen `#viewerPanel` entered at **980px** then collapsed; uncaught JavaScript errors **0**. Simulated Panoramax with zero features in Cairo route: **7 stops skipped, 0 visits, J Coins remain —**, no JS errors.
- A direct Panoramax first-page query for sampled Giza, Egyptian Museum Cairo, and Karnak bounding boxes returned 0 photos in each on 2026-11-22. This is **not exhaustive** and **not proof that the sites lack all 360 imagery**. Google mode still needs a properly limited browser key, API+quota, and live verification.
- See `docs/DISCOVERY_TOURS_R3.md` for implementation and exact gates. Pending merge/deploy on a successful PR + Pages; check Actions and deployed URL before claiming it live.

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

## R2 publication update — 2026-11-22

- PR [#8](https://github.com/Hawkar-usls/Janus-Portal/pull/8) **merged** into `main`, squash SHA `0c2b6cfd38c2714cc4b578098d4a8a7a82568dd0`.
- `23/23` tests passed in [main CI](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45012146536).
- **Live Portal** is available at **https://hawkar-usls.github.io/Janus-Portal/**. Pages enabled via authorized GitHub API (`build_type=workflow`). CI workflow [45012393984](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45012393984) successfully deployed after restoring `src/gaze.js` and `src/attention.js` to the build artifact and adding a 20s artifact-indexing delay.
- Edge smoke on the published HTTPS site: Panoramax real panorama loaded; x 235.02° → 250.07° (genuine movement), pausing froze pose exactly, resuming worked; no page JS exceptions. Nonblocking Panoramax `/api/configuration` HTTP 404 still appears.
- Separate local Edge E2E: live squint **zoom 50/100**, a second automatic jump (1→2), and optional local MediaPipe `person` model category score ~0.50 on one Paris image. These results do not imply reliable independent object-detection accuracy; calibration is [issue #9](https://github.com/Hawkar-usls/Janus-Portal/issues/9).
- Old issues [#6](https://github.com/Hawkar-usls/Janus-Portal/issues/6) and [#7](https://github.com/Hawkar-usls/Janus-Portal/issues/7) closed after successful checks.
- Existing site tab [#1](https://github.com/Hawkar-usls/Janus-Portal/issues/1), J Coins [#2](https://github.com/Hawkar-usls/Janus-Portal/issues/2), user rankings [#3](https://github.com/Hawkar-usls/Janus-Portal/issues/3), Google restricted key [#4](https://github.com/Hawkar-usls/Janus-Portal/issues/4) remain unresolved. **No server JC awards.**

## Human Gaze R2 update — 2026-11-22

- Feature branch `feat/human-gaze-r2`, PR [#8](https://github.com/Hawkar-usls/Janus-Portal/pull/8) implements **natural gaze + variable dwell + local visual interest**. See [docs/HUMAN_GAZE_R2.md](HUMAN_GAZE_R2.md).
- Yaksa Windows Node v24: `npm run verify` **23/23 PASS**.
- Live Edge Panoramax test #1: loaded real image, `getXYZ().x` moved **247.97° → 320.10°**, pause froze same pose, resume moved again; 3 contrast regions were found.
- Live Edge Panoramax test #2: observed **max zoom 50/100**, deliberate look-back, fixation, zoom-in/zoom-out, then **2nd automatic jump**: unique visit count **1→2**; no uncaught page JS errors.
- Local ML test: after correcting a nonexistent CDN version to `@mediapipe/tasks-vision@1.2.3`, actual Edge loaded JS/WASM and a 7.25 MB model (all HTTP 200); on one Paris pano `0c5a2b1b-62dc-4a37-a744-bdf0bab67002`, model output **one tentative `person` detection with score 0.5021**. This is a model prediction, not independently hand-labeled accuracy validation.
- R2 still needs Google Street View live API key/configuration test, semantic heading calibration on independent images, and main website deployment; J Coins remain backend-gated.
- ML mode is **opt-in** to avoid automatically fetching a large model and minimize optional third-party telemetry for visitors.

## Handoff update — 2026-11-22 (main merged)

- PR [#5](https://github.com/Hawkar-usls/Janus-Portal/pull/5) **merged** to `main`; squash SHA `85fa0b28034fb4e8602e9dda65b13c737ae51b4b`.
- Main CI [45007885399](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45007885399) **PASS** (14/14 unit tests).
- First GitHub Pages run [45007885426](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45007885426) **FAIL** precisely at `actions/configure-pages@v5`: repository's Pages site not enabled. Enabling Pages via `Settings → Pages → Source: GitHub Actions` or separate authorized Pages API token is required. The normal `GITHUB_TOKEN` cannot perform automatic enablement.
- The external Yaksa remote PC became intermittently unresponsive during the second-jump live re-test. The browser success for the **first** panoramic visit remains supported; second after the spatial fix is **not** verified. Issue [#6](https://github.com/Hawkar-usls/Janus-Portal/issues/6) tracks it.
- Website tab and J Coins **NOT deployed**; issues [#1](https://github.com/Hawkar-usls/Janus-Portal/issues/1) and [#2](https://github.com/Hawkar-usls/Janus-Portal/issues/2) retain full integration requirements.

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
