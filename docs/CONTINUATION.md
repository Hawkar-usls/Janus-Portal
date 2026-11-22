## R12 — fix frozen "Проверяем..." and Google key onboarding, 2026-11-22

- Owner screenshot shows dropdown stuck at initial R11 HTML placeholder, with apparently unstyled "Обновить"; asks to get updating working and embed a demo Google Street View key. Published GitHub Pages headers independently confirmed `Cache-Control: max-age=600` on HTML/JS/CSS; **probable mixed cache revision**, not definitively observed in owner's browser.
- Branch `fix/r12-live-catalogue-refresh-cache-and-google-key-help`. `.github/workflows/pages.yml` stamps the **same deployment GITHUB_SHA** into published `dist/index.html` URLs of `./src/app.js?build=SHA` and `./src/styles.css?build=SHA`. The source R2 `index.html` still imports exact original `./src/app.js` with 5 imports. No new JS module/loader.
- `src/app.js` adds a **hard 18-second deadline** for 38-centre Panoramax scan, error/timeout text and state; refresh button **works while a scan is active** and starts a new generation after aborting old. **No throttle**: a 1.5s silent ignore initially found by browser regression was removed. Never show failed/stale places as live.
- Google Street View is offered via existing official Maps JS provider with owner's own correctly restricted key. Added official key setup link, clearer UI language. Official **Google Maps Demo Key** does not include Street View; production key can incur Dynamic Street View charges. No demo or user key published, no live Google call/test.
- Local Yaksa `npm run verify`: **50/50 PASS**. Edge `tools/browser-catalogue-r12-check.mjs`: 503 -> informative error & retry -> one live target, mobile stalled source stops in 18s with retry, Google guide. R11 browser regression including live 360 and fullscreen must also remain green. See `docs/CATALOGUE_CACHE_R12.md`.
- **Remaining release gates:** PR CI, merge, Pages artifact/green deploy, real public HTTPS Edge check that app.js and styles.css URLs carry **same commit SHA**, plus real Panoramax 360/refresh/outage regression, and owner-browser confirmation. Prior R3–R5 broken loader and present user's cache issue justify rollout caution.

## R11 deployed — live-only 360 origins, two random modes removed (2026-11-22)

- [PR #22](https://github.com/Hawkar-usls/Janus-Portal/pull/22) merged main as 5b0f959d26905832fef3cb9737f3e61006ac3b6b. [Main CI run 45028842182](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45028842182) **45/45 PASS**, [Pages 45028842222](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45028842222) **SUCCESS**.
- Public URL: https://hawkar-usls.github.io/Janus-Portal/?catalogue=r11-5b0f959 . Both HTML and src/app.js HTTP 200, original five R2 imports unchanged.
- **Public HTTPS real Edge E2E** from tools/browser-live-catalogue-r11-check.mjs: 38 known city-centres queried live; 19 found current Panoramax 360 photo metadata. Confirmed selectable Paris, Rennes, Lyon, Tokyo, NYC, Pune, Kathmandu, Fes, Merzouga, Cebu, Busay, 3 Penang and 5 Cuenca areas. No Cairo/Pyongyang static unverified choices. Original Fes panorama (34.06167,-4.97711) and fullscreen/exit PASS.
- Source-switch mock tested publicly: Fes initially available, then only Kathmandu, then empty, then HTTP 503 — stale entries **never reappear**; Google paid bulk mode disabled (explicit manual/official restricted key only), mobile 390px PASS, **0 uncaught JS errors**.
- New R11 behavior: exactly one old origin dropdown, two random origins removed, fresh provider verification every new session and 5min while idle plus manual refresh/visible return; per 38 known regions, not whole-world discovery or independent geotag authentication. Actual image load remains the final visit gate; no false visits/J Coins.
- **Owner-browser confirmation still pending.** User should open new link, see current source count and click Fes or another listed location, test refresh and fullscreen. Earlier R3–R5 loading failures justify caution. Read docs/LIVE_CATALOGUE_R11.md. Future global discovery requires licensed verified source indexes, not guessed city labels.

## R11 live 360 catalogue instead of random/unverified starts — 2026-11-22

- Latest owner request: remove the two random country choices and show only current source-confirmed 360° places through the single original panorama search, preserving R2 viewer and R10 fullscreen.
- Branch feat/r11-live-360-catalogue-no-random. Existing src/providers.js now has probePanoramaxCoverage: one no-store Panoramax search per known centre within 1.2km, 120-result cap, 8s timeout, FOV>=300/equirectangular with valid ID, collection, source image asset and photo within 5km of the centre. No new ES module import file.
- In index.html, the 38 candidate place names are in a hidden inert originCatalog template, not an exposed list. The visible originChoice is built ONLY from verified live results, with updated count/time/failure status and manual refresh button. Both random origin values removed. Auto-refresh on load, visible-tab/online return and every five minutes when idle, with four concurrent requests; stale/failed entries always removed.
- Manual coordinates are a separate disclosure and launch action (never misrepresented as a confirmed location); Google paid Street View auto catalogue disabled, manual-only restricted browser API key. First discovered Panoramax source photo is opened immediately within the original R2 #viewer, then natural gaze/next jumps unchanged. Failed photo is evicted; no fake visits or coins.
- Yaksa npm run verify: 45/45 PASS, original five ES imports and R10 fullscreen preserved. Real Edge test tools/browser-live-catalogue-r11-check.mjs: 19/38 API-confirmed areas, Pyongyang/Cairo absent; real Fes Panoramax 360 photo and fullscreen PASS, 0 JS errors. Mock Fes to Kathmandu refresh removes stale; empty and HTTP 503 yield empty list; Google manual-only and mobile PASS.
- Honest limitations: only known 38 anchor regions scanned; number of available places changes by time and may not be 19. Not global discovery or independently authenticated geotags. Actual photograph might vanish after metadata check.
- At handoff branch stage, still pending PR/CI, merge, Pages deployment, public HTTPS Edge smoke and owner-browser confirmation. Canonical spec docs/LIVE_CATALOGUE_R11.md. Historical R6/R7 static regional and R8 gateway instructions are superseded.

## R10 production fullscreen verified — 2026-11-22

- [PR #21](https://github.com/Hawkar-usls/Janus-Portal/pull/21) merged to main as `15625c506e034d538d1e4cc67700992b841e2107`; [Main CI 45027354737](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45027354737) **39/39 PASS**, [GitHub Pages 45027354747](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45027354747) **SUCCESS**.
- Live URL: https://hawkar-usls.github.io/Janus-Portal/?fullscreen=r10-15625c5 . Public HTML, `./src/app.js` return HTTP 200, original **five R2 imports** unchanged.
- Public HTTPS **real Edge desktop**: Fes Panoramax 360 loaded with natural gaze; native fullscreen filled 1366×840 viewport (photo 644px), `⛶ Свернуть` returned without destroying the photo. API-disabled CSS fullscreen fallback + keyboard Esc + button exit PASS. **Edge mobile 390×844** fallback filled viewport, 703px photo area, visible exit; no page JS errors.
- Additional public HTTPS `tools/browser-single-search-check.mjs`: one original search, empty simulated Cairo 0 fake visits and Start restored, real Fes 360 and gaze, mobile layout PASS.
- Full technical spec [FULLSCREEN_R10.md](FULLSCREEN_R10.md) and repeatable `tools/browser-fullscreen-r10-check.mjs`. This replaces historical R3–R5 fullscreen; those old runtime modules stay archived.
- **User's own browser not re-tested yet**. Ask owner to verify old Start + new fullscreen and exit; mobile CSS fallback may leave browser chrome visible. Do not claim unsupported OS-level fullscreen on iOS. Missing DPRK/Cairo genuine 360 coverage still open.

## R10 fullscreen on original JANUS viewer — 2026-11-22

- Owner's new request: **«нам так же необходим режим на весь экран»** while preserving R9's one-search/one-window requirement. No separate tourist portal/external page.
- Branch `feat/r10-fullscreen-original-viewer`. Added `#fullscreenBtn` next to status in original `.viewer-panel`. Native browser `requestFullscreen/exitFullscreen`; title and aria switch to «Свернуть» on expansion. CSS fixed `100dvh` fallback for browsers without generic Fullscreen API (iOS Safari / restricted embeds); Escape exits fallback. Browser-native Escape handles true fullscreen.
- Original 360 Panoramax `#viewer` is stretched using flexbox; existing viewer, gaze and R9 in-window search status retained. **Original `./src/app.js` + five ES imports**, no new runtime dependencies, unchanged single source/origin/Start control.
- Yaksa Node: **39/39 PASS**. `tools/browser-fullscreen-r10-check.mjs` on Edge: actual Fes 360 opened via original Start, then true native fullscreen (1366×840; photo viewport 644px), symmetric exit without destroying photo; forced API-disabled fallback Esc & button exit PASS; mobile 390×844 fallback photo area 703px, **0 uncaught page errors**.
- See [FULLSCREEN_R10.md](FULLSCREEN_R10.md) for design and limits. Note mobile fallback may leave address bar visible; don't claim native operating-system fullscreen on unsupported devices.
- **Next gate:** PR CI → squash merge → Pages success → public HTTPS real Edge fullscreen smoke → ask owner to verify in their browser. Preserve archived R3–R5 disabled and do not add a second source Gateway.

## R9 — Only the original panorama search; duplicate Gateway removed (2026-11-22)

- Owner supplied screenshots showing **two undesired areas**: large `JANUS GATEWAY — Один Портал — разные миры` section below main viewer and an `Альтернативные 360° туры` card in settings. Explicit instruction: **«вот это убери все должно быть через наш поиск тут»**.
- In branch `fix/r9-one-search-remove-duplicated-gateway` both areas removed in actual HTML, not CSS hiding. The existing right-hand panel now says `Поиск панорам` and contains **one** source selector `#provider`, **one** origin selector `#originChoice`, and original `▶ Запустить` button. All current Cairo/North Korea/Africa and verified R6 geographical choices preserved.
- Entire R8 `GATEWAY_PANORAMAX_VERIFIED`, `GATEWAY_EXTERNAL_TOURS`, `gatewayStart()`, `gatewaySourceCard()`, `renderGateway()` and their bootstrapping removed from `src/app.js`; deprecated external-tour and Gateway CSS removed.
- R7 no-source notice no longer refers to external links; searches locally and reports no photo rather than showing foreign country imagery. **No source photo coverage added** by this removal. Google only works with official restricted API key; external third-party VR needs new permitted official API/SDK, not link/iframe scraping.
- **R2 compatibility unchanged**: exactly five imports from `./src/app.js`, original viewer and gaze, 5km adaptive search, R7 max 40km in unverified areas.
- `npm run verify` **36/36 PASS**. **Local Yaksa Edge** `tools/browser-single-search-check.mjs` PASS: one UI, simulated empty Cairo 16 bounded queries/0 fake visits/Start enabled, live Fes Panoramax 360 at `34.06167,-4.97711` + gaze, phone-size UI, **0 JS exceptions**.
- **Pending now:** PR/CI merge, Pages publication, actual public HTTPS Edge smoke, **owner-browser confirmation**.
- This latest requirement supersedes historical R8 instructions in older docs. Read `docs/SINGLE_SEARCH_R9.md` and the last section of AGENTS.md; do not re-add the Gateway or alternative-tour panel.

## R8 published unified gateway — 2026-11-22

- [PR #18](https://github.com/Hawkar-usls/Janus-Portal/pull/18) merged into main as `4c13009d0fb766ad1d6d48c24edf7712379164bf`. [GitHub Pages run 45025652089](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45025652089): **SUCCESS**.
- Public URL: https://hawkar-usls.github.io/Janus-Portal/?gateway=r8-4c13009d. The HTML and `./src/app.js` return HTTP 200 and the original R2 **five imports are unchanged**.
- **36/36 tests PASS.** Deployed HTTPS Edge/Playwright: DPRK & Giza source cards, safe external links and missing-Google-key gate PASS; actual Fes 360 Panoramax & natural gaze PASS; mocked Pyongyang no-photo result resets Start, no fictitious visits; Edge mobile 390px gateway layout PASS; **0 page JS exceptions**.
- The gateway provides a **unified source/destination UI**, not a universal media rehosting proxy. Panoramax can be viewed inside the unchanged JANUS R2 player, Google via official Maps key, while DPRK Panorama / Harvard Giza 3D / Egypt Ministry media use source-owned external links. Embed/redistribution rights not established; don't attempt unauthorized framing or scraping.
- **Owner device not retested**. Confirm normal R2 Start and gateway separately before further changes; in case of user-site failure, revert R8 to R7 and inspect error. R3–R5 remain archived, wallet and main-site tab gates stay open.
- Full spec: [UNIFIED_SOURCE_GATEWAY_R8.md](UNIFIED_SOURCE_GATEWAY_R8.md), browser regression: `tools/browser-gateway-check.mjs`.

## R8 — Unified Source Gateway, one Portal interface — 2026-11-22

- User requested a **universal gateway** so Panoramax, Google and North Korea/Cairo/Africa external 360/3D tours are discoverable in one JANUS interface, after owner had explicitly confirmed R2 reliability and earlier R3–R5 had broken JavaScript initialization.
- Branch `feat/r8-unified-source-gateway-r2-safe`: new section `#sourceGateway` below the unchanged original player; 19 place presets; transparent capability/status cards for Panoramax 360 in the R2 viewer, official Google Street View only with user's restricted key, and external DPRK Panorama / Harvard Giza 3D / Egypt Ministry media via direct source-owned links.
- **No sixth ES module, no altered `./src/app.js` path, no new CDN, no iframe, no scrapers, no copy of third-party 360 assets.** Existing 5km autonomous and R7 40km unavailable-area guard untouched; J Coins not minted from external tours.
- Fixed existing `GoogleProvider.searchAtRadius` missing `visitedPoints` and `minSeparationKm` bindings, with 2 mocked tests; real Google E2E requires properly restricted key.
- Yaksa Node `npm run verify`: **36/36 PASS**, original 5 imports asserted.
- Yaksa **Edge/Playwright browser smoke** `tools/browser-gateway-check.mjs`: KNDPR/Giza provider cards correct; offsite links safe; Google without key gated without API call; actual Fes Panoramax 360 inside JANUS + natural gaze; mocked empty Pyongyang source gave **0 additional fake visits**, retry; mobile 390px source cards fit; **0 uncaught JS exceptions**.
- Detailed architecture/scope: `docs/UNIFIED_SOURCE_GATEWAY_R8.md`. The gateway is **unified routing and UI**, not a content proxy or authorized embedded copy of outside VR. Full in-viewer integration must rely on explicit embed rights or licensed official provider SDKs.
- **Pending at handoff creation:** PR/CI/main merge/Pages/deployed HTTPS browser gate, then user-browser re-confirmation. Keep the successful R2 startup the first priority and never restore archived R3–R5 wholesale.

## R7 публичный выпуск — 2026-11-22

- [PR #17](https://github.com/Hawkar-usls/Janus-Portal/pull/17) **merged**, squash `c1fd6498acc1b354eb7a6d59c3b64e629f6365f2`.
- [Main CI 45024553613](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45024553613): **30/30 PASS**. [Pages 45024553601](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45024553601): **SUCCESS**.
- Public URL: https://hawkar-usls.github.io/Janus-Portal/?r7=c1fd6498 . HTML and `./src/app.js` both HTTP 200; original **five R2 imports unchanged**, page includes Pyongyang and Cairo selections.
- Edge on **actual public HTTPS**: mocked empty Panoramax searches for Pyongyang and Cairo both stop after 16 bounded probes, no fictitious views/JC, `▶ Запустить` becomes usable again; then **real Fes/Morocco Panoramax 360** loaded and gaze started, **0** uncaught JS errors.
- External panorama sources (North Korea Travel DPRK panorama; Harvard Digital Giza; Egyptian ministry media hub) all HTTP 200 and open as normal owner-hosted links; no redistribution or iframe/new JS dependencies.
- **User device not retested yet.** Original R2 user-confirmed working; ask user to open R7, try Fes first, then Cairo and a DPRK external link. Do not say Pyongyang and Cairo themselves have built-in 360 coverage. See [KOREA_CAIRO_AFRICA_R7.md](KOREA_CAIRO_AFRICA_R7.md). Deeper source coverage and R3–R5 archived functionality remain pending.

## R7 — КНДР, Каир, Африка: осторожный каталог поверх подтверждённой R2 — 2026-11-22

- Потребность: добавить Северную Корею, Каир и больше Африки. Сохранён R2 браузерный запуск с `./src/app.js` и пятью прежними импортами; новых runtime-модулей нет.
- Географический каталог: **3 города КНДР**, **5 Египта**, **9 других стран Африки**. Новые 17 точек — **не** source-verified 360. Пхеньян и Каир не дали подходящих Panoramax фото в проверенных выборках.
- Выбранные неподтверждённые места исследуются 5→10→20→40км (или 50км, если пользователь выставил такой начальный радиус), без подмены снимками далёких стран. При 0 найденных фото показывается предупреждение, кнопка снова `Запустить`, 0 визитов. `random` исключает неподтверждённые точки. Рабочие старые места и радиус до 20,000 км без изменений.
- Три проверенные **HTTP 200** внешние ссылки на 360/3D: DPRK Panorama (КНДР), Harvard Giza3D (Каир/Гиза), Министерство туризма Египта (360-медиатека). Не встраивать и не зеркалировать их медиа без лицензий. Обычный Фес (Марокко) открывается в R2 Panoramax viewer.
- Метаданные возле Ломе/Того выдавали множество якобы 360° при координате в Гвинейском заливе; вручную проверенный фото-сэмпл изображал улицу европейского типа. Эту серию **НЕ** считать подтверждённой Африкой (см. [KOREA_CAIRO_AFRICA_R7.md](KOREA_CAIRO_AFRICA_R7.md)).
- Yaksa: `npm run verify` **30/30 PASS**; `tools/browser-r7-cautious-coverage-check.mjs` **PASS** — два мок-исследования без покрытия (Пхеньян, Каир), затем настоящая панорама Феса и `Живой взгляд`, **0** page errors.
- Следующее: PR → Actions CI → merge → Pages HTTPS → browser smoke на опубликованном сайте → подтверждение пользователя. Не заявлять реальное Panoramax 360 КНДР/Каира и не возвращать R3–R5 из архива.

## R6 production verification — 2026-11-22

- User confirmed the restored original R2 works on their device. R6 intentionally preserves the same browser bootstrap and only adds verified coordinates to the original selector.
- [PR #16](https://github.com/Hawkar-usls/Janus-Portal/pull/16) **merged** to main: `e2fe107a7e701e280e0bdcb76d15df3d50e7d3c9`.
- [Main CI 45022969811](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45022969811): **PASS 26/26**. [Pages 45022969870](https://github.com/Hawkar-usls/Janus-Portal/actions/runs/45022969870): **SUCCESS**.
- Live URL: https://hawkar-usls.github.io/Janus-Portal/?region=r6-e2fe107
- **Public HTTPS Edge/Playwright 15/15 PASS**: 14 new source-confirmed Panoramax 360 starts (six countries) plus control Paris, all actual photos within 5km of audited search anchors, natural gaze status `Живой взгляд`, **0** uncaught JS errors. Deployed HTML `./src/app.js`, JS 5 original imports, HTML and JS HTTP 200.
- **Still requires owner confirmation** that new options appear and work in their browser. Do not equate Yaksa proof with owner device proof. Source coverage for rural India/Africa generally incomplete, avoid inventing village panoramas.
- Source audit: [VERIFIED_REGIONAL_PANORAMAS_R6.md](VERIFIED_REGIONAL_PANORAMAS_R6.md); test: `tools/browser-regional-panoramas-check.mjs` with `PORTAL_URL` and optional Playwright.
- R3–R5 remain archived in `archive/r5-before-r2-rollback-20261122`; do not reintroduce their client modules without independent gate. Account/J Coins/main site integration remain pending.

## R6: новые реально найденные 360° регионы поверх работающей R2 — 2026-11-22

- Владелец подтвердил, что восстановленная оригинальная R2 **работает в его браузере**. Поэтому R6 не переносит интерфейс на новые модули или новый asset-loader.
- Ветвь `feat/r2-verified-regional-360-sources-20261122`: добавлены **14 географических стартов** в 6 странах — Пуна/Индия, Катманду/Непал, Фес и район Мерзуги/Марокко, Себу/Филиппины, район Пенанга/Малайзия, Куэнка и окраины/Эквадор. Полный аудит и photo IDs: [VERIFIED_REGIONAL_PANORAMAS_R6.md](VERIFIED_REGIONAL_PANORAMAS_R6.md).
- Все якоря выведены из реально возвращённых Panoramax STAC 360° метаданных; статичные 2D и неподтверждённые сельские точки **не добавляли**. Всего найдено 14 селекторных точек, но это не 14 непересекающихся коллекций; Куэнка и Пенанг содержат много пересекающихся фото-серий.
- Код R2: в `src/app.js` расширена только исходная карта `CITY` и добавлено `random-verified`; в `index.html` добавлены `option` и `optgroup`. `./src/app.js` + пять старых ES imports, старый провайдер, таймлайн взгляда, управление, карта, локальная статистика и исходный 5км радиус сохранены.
- Yaksa Node `npm run verify`: **26/26 PASS**. Реальный Edge/Playwright `tools/browser-regional-panoramas-check.mjs`: **15/15** (14 новых + исходный Париж), статус `Живой взгляд`, реальная панорама Panoramax в ≤5 км от исходной проверенной координаты, **0** ошибок JS. Скрипт необязателен и не входит в офлайн CI.
- Дальнейший шлюз: PR → CI → merge → Pages → настоящий HTTPS Edge smoke → **подтверждение именно в браузере владельца**. Не объявлять релиз раньше публикации.
- Более широкий поиск по странам Африки, Индии и Юго-Восточной Азии показал множество *плоских* фотографий без подтверждённого 360° поля зрения; не приписывать этим районам вымышленные фото. Подходящий лицензированный провайдер нужен отдельно.
- Архив более поздних R3–R5 по-прежнему `archive/r5-before-r2-rollback-20261122`; пользователь не разрешал восстанавливать его целиком.

## Critical rollback — 2026-11-22

- User reported that later Portal builds rendered styled HTML but **none of the controls initialized**. The screenshot contained the R5 watchdog "Код Портала не загрузился". The original JS failure was not captured.
- Emergency production rollback restores the **first published, proven R2** tree at `1b34bff74e2239d34cbdc09c1753df1041d63dc2`. Confirmed Edge on Yaksa locally: live Paris panorama, gaze, 23/23 tests, 0 uncaught JS errors.
- **Do not lose later work:** full R5 and all tours/extreme/fullscreen features backed up in `archive/r5-before-r2-rollback-20261122` (SHA `20fd3848927b4e93346498df95eddaaa6e88aed1`). See [ROLLBACK_2026-11-22.md](ROLLBACK_2026-11-22.md).
- A plausible regression is the more complex asset/module graph and commit-specific `assets/<sha>` paths, but exact root cause **NOT independently established**. R5 passed Yaksa, so user-browser access remains the decisive gate.
- Restore additional features only after user independently confirms R2 launch. No JC awards, no unapproved Google keys.

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
