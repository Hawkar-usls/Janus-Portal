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

**First read** `docs/CONTINUATION.md` plus `docs/HUMAN_GAZE_R2.md`; check PR #8 and its verification gates. For browser regression run `tools/browser-gaze-check.mjs` with live Panoramax/Playwright when possible. Never mark actual person identification: only tentative category detections with confidence. The map and J Coins remain separately gated.

## R6 browser compatibility and verified regional imagery

The owner explicitly confirmed **R2 works in their browser** after R3–R5 rollback; preserve its only `<script type="module" src="./src/app.js">` entrypoint and five imports. R6 adds 14 independently checked geographic anchors in `src/app.js`, corresponding options in `index.html`, optional offline/browser tests, and no runtime JS modules. Only claim Panoramax 360 photo availability for actually observed equirectangular/FOV≥300 source results. Read `docs/VERIFIED_REGIONAL_PANORAMAS_R6.md`. **Do not redeploy archived R3–R5 automatically.** If a change introduces an inactive UI, revert it rather than adding more speculative mechanisms. The original 5km and adaptive global radius must remain intact.

## R7 North Korea, Cairo and Africa coverage safety

Read `docs/KOREA_CAIRO_AFRICA_R7.md` before touching R7. The 17 new geographical `CITY` starts are **NOT** verified 360° assets. The live Panoramax audit found no suitable 360° in sampled North Korea/Cairo bboxes; Togo results had apparent location contamination, and the sample photo resembled a European road while the coordinate was offshore. Do not market these records as genuine local 360s. New starts have bounded max search 40km, graceful 0-visit return to Start and are EXCLUDED from generic random; existing verified modes retain original 20,000km adaptive search. External source-owned 360/3D tour links for Korea/Egypt are static `<a>` tags, not image mirroring or new imports. R2 entrypoint `./src/app.js` and the five original imports remain the owner-confirmed contract. Never restore archived R3–R5 wholesale.

## R8 Unified Source Gateway

Read `docs/UNIFIED_SOURCE_GATEWAY_R8.md`. The user asked to access Panoramax, Google, North Korea tours, Giza 3D and Egyptian media from **one Portal UI**. The implementation is a section in `index.html`, CSS, and in-module functions in `src/app.js` — **no sixth JS import or new CDN**. Panoramax viewer/gaze R2 unchanged. Existing Google Street View provider now explicitly receives `visitedPoints` and `minSeparationKm`, tested with fake responses without paid API calls.

**Rights gate:** Only Panoramax and official Google with a user-provided restricted key render inside the JANUS viewer. DPRK Panorama, Harvard Digital Giza and Egyptian Ministry media are **source-owned off-site links** with `noopener noreferrer` because reproduction/framing rights are not verified. Never bypass X-Frame-Options/CSP, scrape tiles, mirror copyrighted media, or falsely count external visits/J Coins. The gateway should report *source type and verified coverage* honestly.

Release gate: `npm run verify`, `tools/browser-gateway-check.mjs` with optional Playwright, then PR CI, Pages, deployed HTTPS Edge test, and **user-browser confirmation**. Do not reinstate archived R3–R5 modules. Preserve all previous 5→10→20→40… exploration behavior and R7 40km no-coverage protection.

## R9 user-overrides R8 dual UI — one search only

**Newest explicit owner instruction (screenshots 2026-11-22):** remove the entire JANUS GATEWAY block and separate external 360 tours box. All choices MUST be routed through the **original right-hand one search** (`#originChoice`, `#provider`, `#startBtn`) and the original R2 viewer. In R9 `index.html` and `src/app.js` **do not** contain `sourceGateway`, `gatewayPlace`, `gatewaySources`, `external-panorama-links`, `renderGateway` or source-owned tour links; don't re-add them. The old R8 and R7 documentation is historical, not the live UI. Latest spec: `docs/SINGLE_SEARCH_R9.md`.

R2 script entrypoint `./src/app.js` and exactly five imports remain unchanged. R6 verified live Panoramax anchors remain; R7 geographic-only DPRK/Cairo/Africa anchors remain but must NOT be misrepresented as covered. R7 40km bounded fallback and no fake visits remain. Google official API needs the owner's restricted browser key. The user wants additional sources searched *inside* the app, so next work is legally licensed APIs/SDKs integrated with the original search, never a secondary catalogue or illegal iframe/scraping. Use `tools/browser-single-search-check.mjs` with Edge and public Pages URL, then user-browser confirmation before declaring success.

## R10 fullscreen on original R2 panorama (latest UI)

Owner requires **«На весь экран»** with a symmetric **«Свернуть»** control. Implemented as `#fullscreenBtn` in the original `.viewer-panel`, **not** an additional Gateway, photo viewer or external page. Uses browser Fullscreen API and, if unavailable (iOS/restricted browser), full viewport CSS fallback (may not hide browser toolbar); Esc exits fallback. See `docs/FULLSCREEN_R10.md`. Never introduce new JS imports/CDN to implement fullscreen: original `./src/app.js` and exactly five imports remain authoritative. Search/empty-status/photo always stays in `#viewer` as in R9; the original `#startBtn` is unchanged. Validate with `tools/browser-fullscreen-r10-check.mjs` (real Panoramax Fes, native fullscreen, exit, forced fallback, mobile 390x844), offline 39/39, public Pages and owner device. In R3–R5 the JS loader broke for the owner; preserve that lesson.

## R11 newest owner directive: live-confirmed destinations only, no random country options

Owner said to remove both random origin choices and to show only live-verified available locations in the original search. Read docs/LIVE_CATALOGUE_R11.md. The original #originChoice is API-confirmed-only; random and random-verified origins were removed. #originCatalog is merely a hidden inert template of 38 geographic centres to probe, never a visible list of unverified places. Only real Panoramax equirectangular/FOV>=300 photos with valid source ID, collection, image asset and nearby coordinates enter liveCoverage. Network errors or stale checks remove entries rather than using static fallback.

Four concurrent no-store source requests, per-place 8-second timeout, refresh on load, manual #refreshCoverageBtn, visibility/online return and every five minutes while idle. These checks cover 38 prior candidate regions, not all places on Earth, and are not independent photo/geotag truth verification. A freshly found first photo opens inside the original R2 viewer, and failed image loads never count visits. Manual coordinates are in #manualOrigin outside verified list; Google paid Street View is opt-in manual only with restricted API key. Preserve original ./src/app.js with five imports, R9 one-search and R10 fullscreen; no new runtime libraries or duplicate source gateway.

Verification: npm run verify 45/45; tools/browser-live-catalogue-r11-check.mjs Edge real Panoramax 19/38 available on 2026-11-22, genuine Fes 360 + fullscreen; mocked refresh Fes to Kathmandu, empty, HTTP 503, missing-key Google manual, mobile and no JS errors. Release requires PR CI, Pages, public HTTPS browser verification and owner-side confirmation. Do not restore the archived R3-R5 loaders or static unverified/random choices.

## R12 latest owner bug report: stuck live catalogue and Google demo key request

Owner screenshot 2026-11-22 showed R11 HTML placeholder "Проверяем доступные 360°..." never changing, with an unstyled refresh button. Inspect docs/CATALOGUE_CACHE_R12.md. GitHub Pages actually sets Cache-Control: max-age=600 on HTML/app.js/styles.css; different cached revisions may mix new R11 HTML with old R10 JS/CSS. R12 **versions both public JS and CSS URLs with the same GITHUB_SHA at deploy time** in .github/workflows/pages.yml, leaving source index.html's original R2 ./src/app.js and five import paths unchanged. Never remove the SHA asset stamping in Pages workflow or reintroduce an extra JS module/CDN. HTML itself may still be cached for up to ten minutes; a fresh query on the page URL can refresh it.

R11 live scan now has an overall 18-second deadline and explicit timeout/API failure states. #refreshCoverageBtn remains clickable DURING scan; each click immediately aborts the prior generation and starts a new one. There is **NO silent click throttle**: an initial 1.5s debounce was found to break R11 source-switch browser tests and was removed. Old results cannot overwrite new list. R2 original viewer, R9 single search and R10 fullscreen remain mandatory.

Google Maps Demo Key is real but officially *does not support Street View*. A working native Google Street View panorama needs a user-issued browser key with Maps JavaScript API, correct HTTP-referrer/API restrictions and appropriate billing/quota settings. The current site provides only a key input and an official key setup link; do not invent keys, commit user keys or call unpaid unsupported demos "Google Street View". Key is not persisted. No legitimate key was available for a real Google API test.

Test R12 with npm run verify (50 tests), tools/browser-catalogue-r12-check.mjs (503 error/retry, key guide, 18-sec stalled-source abort), tools/browser-live-catalogue-r11-check.mjs (real 360 and source swap), and after deployment verify HTML has BOTH ?build=<40-hex-SHA> versioned assets matching the same commit and loaded with HTTP 200. E2E in user's browser is a separate acceptance gate; distinguish probable cache mismatch from proven cause.

## R13: ONE automatic blended-source location search (latest owner instruction)

The owner rejected provider choice: all available sources must be mixed by geographic location and refreshed together. Read docs/MIXED_SOURCES_R13.md. The visible portal has only one place selector, one Start, one Refresh, and the original fullscreen viewer. A hidden provider control exists only for old DOM compatibility and must not reappear as a visible choice.

The keyless blended source adapter in existing src/providers.js searches Panoramax STAC plus KartaView SPHERE/FOV>=300 public API plus geotagged genuinely equirectangular 2:1 Wikimedia Commons images with explicit free licenses and valid HTTPS URLs. Every resulting photo is independently source-attributed. Both KartaView and Commons are displayed through an in-file dependency-free WebGL equirectangular viewer, never an outside page. IMPORTANT: WebGL UNPACK_FLIP_Y_WEBGL must be false or photo is upside down; STOP/PAUSE must not dispose the canvas, only switching source may call dispose(). The original Panoramax R2 viewer, 5 script imports, gaze and fullscreen remain untouched.

Refresh is one simultaneous generation of all three source probes for each of 39 known centres, 30s overall, five-minute schedule while idle. One geographic item may have multiple source photos; counts per source overlap; no fake availability and no recycled failed requests. Google is allowed only after manual owner-issued restricted key and cost checkbox, max 4 billable lookups total per manual expedition, not mass swept across 39 cities. Mapillary requires owner token and remains unconnected, no copied demo token. Do not claim global all-place discovery or independent GPS authentication. Avoid reintroducing R8 duplicate Gateway or random country options.

Verification local Yaksa: 55/55 tests PASS, real Edge 20 unique currently available geographic regions (Panoramax 19, KartaView 7, Wikimedia Commons 1), real KartaView Fes and Commons San Diego panoramic images rendered in JANUS, author/license links, correctly oriented image after visual screenshot, original Fes and fullscreen PASS, 0 JS errors. Need green PR CI, Pages publish, actual HTTPS Edge and owner-browser confirmation before claiming deployment. R3-R5 legacy modules remain disabled.
