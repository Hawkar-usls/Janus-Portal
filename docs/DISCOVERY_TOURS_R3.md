# R3 — DISCOVERY TOURS / Экскурсии в духе обзора мира

## Goal and user requirement

Expand JANUS PORTAL with an immersive **fullscreen / exit** button and memorable tourist locations. Inspiration: curated sightseeing / discovery flights in Microsoft Flight Simulator; the implementation is an **original JANUS interface** using real existing street panoramas, not an aircraft or a 3D copy of a flight simulator. The user explicitly requested **Cairo** and other landmark routes.

## What was added

- A prominent fullscreen toggle within the panoramic header. Uses the real browser Fullscreen API; pressing the button again or **Esc** returns. On browsers that deny native fullscreen (e.g., some embedded mobile browsers) a reversible CSS immersive layout is used.
- Three experience tabs: **Свободный портал**, **Экскурсии**, **Места мира**. Search by city/country/stop names and filter by themes.
- **37 curated starting areas** (Egypt, Europe, Asia, North and South America, Oceania, Africa and nature destinations).
- **12 guided excursions** with named search centres (Cairo/Giza/Luxor, Paris, Rome, London, Tokyo, New York, Istanbul, Kyiv, world wonders, natural wonders, Italian cities, East Asia).
- Planned tour path displayed as dashed route and ordered stops on the map, independent of panorama-provider data.
- Each attraction is an **availability search centre** with bounded 2–4 km search; it is not a promise of a photo exactly at the landmark. The viewer clearly labels distances to the target. Unavailable or already-viewed stops are skipped, never counted or rewarded. Free exploration retains the 5 → 10 → 20 … 20,000 km adaptive search.
- Existing natural gaze, random attention-dependent dwell, pause/turbo, history, wallet guard and source attribution stay intact.

## Provider coverage and truthfulness

**Panoramax is not Google Street View.** On 2026-11-22, the API's initial first-page results for three sampled bounding boxes around Giza, the Cairo Egyptian Museum and Karnak returned **0 images**. This is **not** proof of no panorama anywhere in Egypt; alternate or new records can appear later. A preflight search at the requested time decides what is available.

Google mode is available through the existing official Street View JavaScript API adapter but needs a **properly HTTP-referrer-restricted browser key, enabled API, quota and billing**. Never commit a key or assume Google imagery covers every landmark; never mix Google pixel/data retention with Panoramax/OpenStreetMap. For a tourist tour with no Panoramax imagery, the app shows an honest skipped-stop result; it does not disguise Paris photos as Cairo.

## Tests and browser evidence

- `tests/discovery.test.mjs`: catalogue uniqueness and coordinate validation; bounded tour matching, wrong-country rejection, abortability; native fullscreen + CSS fallback with Escape.
- Yaksa Node v24: `29/29` tests PASS on 2026-11-22.
- Edge/Playwright local browser: category tabs and filters work, Cairo/Giza displayed, Paris tour opened a **real** Panoramax scene **0.8 km from the Eiffel Tower**, fullscreen entered on `#viewerPanel` at 980px height and returned on second click; 0 uncaught JS errors.
- Mocked Panoramax returning no records: Cairo/Luxor tour ended with **0/7 visited, 7 skipped, 0 local unique places, 0 JC** and no JS errors. The mock verifies the safety case, **not the actual absence of Egyptian imagery**.
- Live Cairo actual panorama and restricted Google Street View in production remain unverified.

## Acceptance / next work

1. Ship to `main` via PR after green GitHub Actions, then deploy Pages and test actual HTTPS.
2. Mobile screen rotation, ESC/fallback, fullscreen with active Panoramax and Google view; accessibility on small devices.
3. Provider coverage improvements and preflight markers. Stop searches must remain bounded; no unlimited paid Google queries.
4. More missions, narration and optional on-device audio in a later version, with user-controlled volume and no third-party media rights violations.
5. **Do not award J Coins** until the site's authenticated server wallet is integrated and reward/cost controls are approved.

## Continuation

Reopen `AGENTS.md`, `docs/STATUS.json`, this document and open Issues/PRs. Preserve the original autonomous exploration behavior as a separate tab; only tour mode narrows search near tourist attractions. Do not claim native flight/3D simulation: this is a real-panorama sightseeing screensaver.
