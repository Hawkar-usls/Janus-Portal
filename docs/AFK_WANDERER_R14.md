# JANUS PORTAL R14 — AFK Wanderer + Passport + World Conquest

Date: 2026-11-22. Based on user approval of the proposed AFK screensaver game.

## Scope and compatibility

This update develops the **existing** R13 automatic R2 panorama expedition, rather than introducing a duplicate player, source selector or random-origin menu. Only source-confirmed Panoramax, KartaView and Wikimedia Commons panoramas may be selected automatically; Google Street View remains an explicit paid-key manual action. The same R2 viewer and natural gaze director, R9 in-viewer status, R10 fullscreen, R12 coherent cache-busted JS/CSS, R13 one blended source catalogue, and exactly **five existing app.js import paths** are preserved.

### JANUS WANDERER — AFK journey

- Sidebar button `#afkBtn` is available once the source-backed location catalogue is nonempty. Clicking it starts an ordinary expedition with **AFK active**; its status is visible in `#afkIndicator` inside the original panorama header and `#afkNote`. Clicking again stops all pending work.
- The R2 gaze choreography still rotates and zooms at variable dwell times and triggers local subsequent jumps. On `NoLocationsError` for the current area, AFK **only** selects another region with a currently confirmed nearby unused source photo. Selection is deterministic **nearest-region first** and uses both source-specific visit IDs and ~20m spatial duplicate filtering, with an exhausted-region set per mission.
- Only source IDs advertised by the current live `liveCoverage` Map can be pinned. AFK never invents a city, never enables paid Google, and stops with an explicit “current confirmed catalogue exhausted” message if there is no suitable candidate. It does not imply global map completeness.
- Between verified regions a 650ms cancellable step allows STOP. The original 5km default radius and doubling-search strategy remain untouched. The AFK “region jump” is a deliberate new start at another verified anchor, not a literal physical 5km displacement; route distances remain geodesic statistics between actual photo coordinates.
- Clicking original Start/Stop or reloading exits the AFK session; no background execution is promised when the page/tab is closed or suspended.

### JANUS PASSPORT — unique discovery journal

- Only **successful photo loads** feed the existing `addVisit` and local history. Source-specific identical IDs are deduplicated; the existing navigation also excludes near-identical photo locations on automatic jumps.
- Publicly licensed/open sources **Panoramax, KartaView, Commons** now persist ID + lat/lng + timestamp as local browser history. No image pixels or Google metadata are written to persistent storage. Google remains in volatile session history only.
- The Passport panel shows unique visited panoramas, approximate visited-country stamps, local XP, level progress, and source-specific view counts. Local XP = **10 × distinct viewed photo IDs + 25 × distinct approximate countries**. Repeated visits cannot award more.
- Country stamps use **≤25km proximity to one of 39 known geographic starting anchors**, not a reverse-geocoder or independent proof of boundaries. Panoramas outside those anchors are explicitly marked “unassigned”, not forced into a random country.
- An export now contains an additional Passport snapshot, the XP formula and `jCoinsCredited:false`; JSON history retains its existing schema identifier for compatibility. Reset clears the local Passport/history, not any remote wallet state.

### WORLD CONQUEST — interactive local map and achievements

- The original Leaflet/OpenStreetMap discovery map includes successful Panoramax, KartaView and Commons visits (up to 300 recent visible points); **Google data is never plotted on OpenStreetMap**.
- Country stamp buttons focus the existing map around the selected country’s last nearby confirmed photo; no second map or source picker is created.
- New local achievements: first country stamp, three approximate countries, three open photo sources; the six existing achievements remain.
- **No account-backed leaderboard, cross-user contest, or real J Coins**. These need access to the original user-account backend, server-side idempotent visit adjudication, antifraud and quota controls; no browser-earned XP can be redeemed for JC. This is clearly labeled in UI.

## Validation

- Existing `npm run verify` plus `tests/afk-passport-r14.test.mjs`: deduplication, country proximity/no guess, deterministic XP/level, storage roundtrip for open sources, Google volatile, pure AFK nearest new source, 20m exclusion, no paid Google, source-vetted choices and original five import paths.
- `tools/browser-afk-game-r14-check.mjs`: **deterministic mocked providers and gaze timers** on Chromium. Scenario: only Fes (Panoramax) + Kathmandu (Commons) available; click AFK -> two successful views -> auto-move when Fes exhausted -> stop when all known source-backed views spent; verify passport two countries/70 XP, local persistence on reload, reset and no J Coins. Source metadata/panorama/gaze are mocked in this test, **not** a live Panoramax integration test.
- `.github/workflows/browser-r14.yml`: CI installs Playwright Chromium and runs the above browser test on PR. Results must be inspected before claiming BROWSER_E2E_PASS.
- Preexisting R13 deployed HTTPS real-source proof is not automatically proof of this R14 release. Require green unit CI, green R14 browser workflow, merge, green Pages, and a new real-source HTTPS browser smoke / owner-browser acceptance.

## Not implemented

- A global competitive leaderboard, server-wallet payouts, account sync, unseen worldwide panoramic coverage, a continuously running background server process, and fully validated geopolitical classification. No claim of all-world conquest.
