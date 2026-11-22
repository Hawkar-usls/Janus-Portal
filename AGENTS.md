# JANUS PORTAL — Instructions for the next ChatGPT coding agent

**Owner:** Hawkar-usls. **Repository:** https://github.com/Hawkar-usls/Janus-Portal
**Goal:** complete a working standalone panorama exploration screensaver and safely integrate it as a **«Портал»** tab in https://tg-pomoyka.hawkarlol.chatgpt.site/ with user profile, statistics, competition and **server-authorized** J Coins.

## On every new run — do this in order

1. Fetch this exact GitHub repo and `docs/STATUS.json`, `docs/CONTINUATION.md`, current open PRs/issues, and the most recent Actions runs. Do **not** infer current state from chat summaries.
2. Inspect `src/`, execute `npm run verify` and read failures; record commit SHA, logs and real run status.
3. Continue the highest-priority unfinished task in `docs/CONTINUATION.md`; implement, test and commit via PR. Never treat an internal PASS as a production PASS.
4. After merging, update `docs/STATUS.json` and `docs/CONTINUATION.md` with links to evidence, any blockers, and concrete next steps.
5. If access to the ChatGPT Sites project is unavailable, stop at a **documented integration contract and issue**. Do not claim that the main website has been edited.

## Hard invariants

- **Default jump radius 5 km**, then `5 → 10 → 20 → 40 ... → 20,000 km` if sampled nearby candidates are absent or visited. Search is non-exhaustive; never claim "entire world covered".
- Prefer new nearby real 360° views; dedupe both source-specific IDs and spatial locations within ~20 metres. Do not award an event on a failed load or an already-visited view.
- **Do not put any user-provided Google API key in repository files, PRs, issues, tests, example configs, logs or responses.** A browser key is not secret but MUST be HTTP-referrer/API restricted, with quotas, billing controls, and ideally rotated if ever disclosed without restrictions. Never commit a server key.
- Google Street View uses only the official API and its visible attribution. Do not scrape tiles or mirror/rehost images. Google-derived coordinates currently remain volatile (session only) pending ToS review; don't blend them onto OSM layers without explicit compliance review.
- Respect each Panoramax photo's license and credit. Leaflet/OpenStreetMap attribution is mandatory.
- J Coins are **not** minted by the client. Client local history and test results are not evidence of rewards. Before 1 JC/new visit becomes real, integrate existing JANUS wallet server-side with idempotency, abuse controls, cap and reconciliation. Reuse actual site account identity.
- Do not run uncontrolled paid Google API search loops; cap calls and detect quota errors. Do not imply Panoramax is available everywhere.
- Ask for permissions only if genuinely needed. Don't re-ask for site/repo details already available.

## Architecture

- `src/navigation.js`: deterministic geodesic jump selection, expansion strategy.
- `src/tours.js` and `src/tour-runner.js`: R3 curated tourist routes (including Cairo), bounded landmark-local searches, no fake photos or JC rewards.
- `src/discovery.js` and `src/fullscreen.js`: tabs, catalogue filters and accessible panorama fullscreen/ESC/mobile fallback.
- `src/gaze.js`: R2 natural gaze choreography with eased turns, focus, squint, returns, variable dwell, pause/resume/stop; no API calls.
- `src/attention.js`: Panoramax-only local contrast saliency and optional MediaPipe object/person inference; **never** process Google photos.
- `src/providers.js`: external API adapters. Watch for changed Panoramax web-viewer version and Google API behavior.
- `src/app.js`: controls, timeline, map, achievements, no global JS coins reward.
- `src/storage.js`: local Panoramax history; Google session-only.
- `docs/SITE_INTEGRATION.md`: backend contract and economics gate.
- `tests/`: prove invariants; add live/manual browser tests with evidence.
- `.github/workflows/ci.yml`, `pages.yml`: verify and publish after actual successful Actions run.

## Status language

Use labels: `UNIT_PASS`, `LIVE_PROVIDER_PASS`, `BROWSER_E2E_PASS`, `PAGES_DEPLOYED`, `SITE_TAB_LIVE`, `WALLET_BACKEND_PASS`. Never promote a missing gate. Prefer links to concrete run IDs and PRs.

**First read** `docs/CONTINUATION.md`, `docs/DISCOVERY_TOURS_R3.md` and `docs/HUMAN_GAZE_R2.md`; check PR #8 and its verification gates. For browser regression run `tools/browser-gaze-check.mjs` with live Panoramax/Playwright when possible. Never mark actual person identification: only tentative category detections with confidence. The map and J Coins remain separately gated.
