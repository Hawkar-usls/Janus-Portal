# JANUS PORTAL R13 — Unified 360 source mixer

Status: IMPLEMENTED_ON_BRANCH / UNIT_PASS / LIVE_EXTERNAL_BROWSER_PENDING.
Do not count offline mocks as browser or public deployment evidence.
Parent: unfinished R13 mixed-source catalogue branch.

## Implemented

The original single region selector fetches provider metadata in parallel.
One #viewer, one start button and R2 five-import graph are unchanged.

- Panoramax: existing STAC sphere check and official Panoramax viewer.
- KartaView: official /2.0/photo/ search, SPHERE projection, FOV >= 300,
  nearby coordinates and source-owned HTTPS photo. The WebGL viewer verifies
  successful CORS download and nearly 2:1 dimensions. Failures count zero.
- Wikimedia Commons: MediaWiki geosearch plus imageinfo and coordinates;
  require explicit equirectangular/photosphere metadata, 2:1 high-resolution
  asset, free license and uploader attribution. WebGL overlays author,
  license and canonical source link.
- Mapillary: optional user-issued developer client token. Only true is_pano
  photos with verified IDs and nearby geometry are admitted. Official
  MapillaryJS 4.1.2 and CSS load lazily into the original #viewer. Tokens
  are neither committed nor saved locally.
- Google: existing official Street View; requires manually supplied
  restricted browser key and explicit paid-search consent. Google is
  never queried by automatic regional refresh.

Scans run concurrently, retain valid providers if one fails, reject stale
refresh results and exclude flat or missing images. The default 5km adaptive
search, R7 bounded 40km unverified areas, R10 fullscreen and gaze are kept.
No client-side J Coins. Panoramax local history is unchanged; third-party
photos have session-only visits pending retention and attribution review.

## Limitations / independent gates

- The catalogue scans known geographic anchors, not the entire globe.
- KartaView API/CORS/image URL support, Commons real-photo spherical proof
  and Mapillary SDK loading need public HTTPS browser testing. The returned
  metadata does not guarantee actual renderer success.
- Commons projection and coordinates follow uploader claims and are not
  independent geographic authentication.
- Where CORS or rights block a source, do not proxy/scrape/mirror the image.
- Never publish or log a user Mapillary/Google token.
- No main-site Portal tab or wallet functionality is claimed.

## Required checks

1. GitHub CI: npm run verify plus tests/merged-sources-r13.test.mjs.
2. Edge/Chrome real image: Panoramax + Mapillary with owner token; Commons
   and KartaView where compatible assets are confirmed; failover and
   pause/resume/fullscreen on desktop and mobile.
3. After merge: Pages deployment SHA stamping, real HTTPS image and no JS
   exceptions; then explicit owner-browser confirmation.

References:
https://github.com/mapillary/mapillary-js
https://mapillary.github.io/mapillary-js/api/classes/viewer.Viewer/
https://commons.wikimedia.org/wiki/Commons:API/MediaWiki
https://kartaview.org/doc/photos

Keep production gate pending until independent source browser evidence exists.
