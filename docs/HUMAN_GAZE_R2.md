# R2 — HUMAN GAZE / живой взгляд

**Status:** work in [PR #8](https://github.com/Hawkar-usls/Janus-Portal/pull/8). Unit tests PASS; browser smoke result must be confirmed on the latest revision before merging.

## User requirement

No mechanically uniform spin. The expedition should feel like a real observer turning their head: nonconstant head velocity, quick looks and return glances, fixations on interesting parts, gradual zoom-in (squint), zoom-out, brief attention to people or objects when genuinely recognized, and variable viewing time by interests. The jump radius still starts at **5 km** and increases when the next unvisited panorama isn't found; gaze does not change this rule.

## What the implementation actually does

- `src/gaze.js`: a time-domain state machine. Smoothstep head turns, alternating sweep direction, occasional backward checks, low-amplitude fixation drift, slow zoom-in/out, optional revisits; variable attention-dependent per-location dwell. Uses exact start/end poses and a rate multiplier so turbo doesn't double count views. Pausing freezes the logical clock, stopping cancels the animation frame. Seeds can be injected for repeatable tests.
- `src/attention.js`: for **Panoramax only**, reads a 360° photo preview into a browser canvas (subject to CORS). First computes visual contrast/saliency in memory. If the user selects object mode, lazily loads **MediaPipe EfficientDet-Lite0** and runs **local** inference over 4 overlapping-ish horizon views, looking for COCO categories including `person`, vehicles and animals. No photos or coordinates are uploaded to JANUS. Models/library are fetched from a CDN; no user image is sent to that CDN by the app. People are not identified, only tentative detection boxes, subject to false positives and wrong headings.
- `src/providers.js`: uses Panoramax `viewer.psv.getXYZ/setXYZ` (official photo-sphere viewer) or Google `StreetViewPanorama.getPov/setPov/getZoom/setZoom` (official Maps JS). Google images must **not** be read, downloaded, passed through a canvas, or sent to an object detector. Therefore Google exploration is natural head choreography without content-derived focus.
- `src/app.js`: gaze runs only after panorama load succeeds; next geographical jump begins when gaze ends. Pausing, stopping and manual skip cancel stale timelines, and turbo changes playback rate during the same gaze. Changing interest mode on an existing panorama restarts analysis in memory.

## Design limits / honesty

- **"Visual detail" is a contrast heuristic, not person recognition.** Only object model results can be described as tentative `person` detections.
- **People detection is not guaranteed:** source image CORS, CDN availability, model loading, low-resolution previews, anonymization and panoramic distortion affect accuracy. The mode falls back to heuristic visual attention when model initialization fails.
- Equirectangular x→compass headings use an approximate original heading anchor. An image's projection and metadata may make this inaccurate; tune on real panoramas.
- The renderer also runs on devices with `prefers-reduced-motion`; default style becomes static but automatic jumps remain available.
- High zoom consumes rendering resources; user can select gentle or no motion.
- No new J Coins logic; every new place still has to be validated by the main site's authenticated server (gate pending).
- Default base dwell **16 s**, user range **5–60 s**. Actual dwell is randomized around that base and extended on detected interests; turbo ×2 halves playback time. Max plan duration is 100s before turbo.

## Validation gates

- `UNIT_PASS`: new tests for easing, angular wrapping, focus-sensitive dwell, zoom, deterministic time, cancel/pause and object metadata.
- `PANORAMAX_GAZE_BROWSER_PASS`: verify 2 poses have changed over time; a freeze while paused; movement after resume; `z>0` while squinting; no JS errors.
- `LOCAL_OBJECT_DETECTION_PASS`: model loads in an actual browser, and at least one supported object from a known allowed Panoramax photo or independent fixture is detected with a legitimate confidence score. A heuristic-only fallback is **not** that gate.
- `GOOGLE_GAZE_BROWSER_PASS`: authorized browser key plus real panorama, camera poses change without reading pixels, quota/attribution preserved.
- `SECOND_AUTO_JUMP_PASS`: after adaptive dwell ends, search the next unvisited location and repeat (Issue #6 from MVP).
- `MOTION_ACCESSIBILITY_PASS`: reduced-motion option and touch interaction.

## Next autonomous agent

1. Reopen repo `AGENTS.md`, `docs/STATUS.json`, CI and PR #8.
2. Verify and fix browser-level PhotoViewer pose/zoom handling and optional semantic detector.
3. Test against a stable fixture or real Panoramax sample; distinguish unreliable object results from confirmed visual detections.
4. Update `docs/STATUS.json` and create issues if any gates remain missing. Do not claim fully deployed while Google and the main site still lack credentials/editor access.
