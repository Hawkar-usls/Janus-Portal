# «Портал» — integration contract for JANUS website and J Coins

**Status: design only, not deployed.** Standalone repo cannot change ChatGPT Sites automatically without access to the source/editing surface. The target is `tg-pomoyka.hawkarlol.chatgpt.site`; integrate an embedded module or route via the actual project.

## Functional contract

The existing site must provide an authenticated `accountId` and a trusted JANUS wallet provider. The Portal is a **client that can propose a visit**, never a ledger authority. Map and history may display pending visits; only server-verified visits can modify balance, leaderboards or achievements with economic value.

### Suggested API (illustrative; adapt to the real site's implementation)

- `GET /api/portal/me`: authenticated profile, authorized balance and exploration summary (no userId accepted from browser as authority).
- `GET /api/portal/visits?cursor=...`: paginated server records, scope to authenticated user.
- `POST /api/portal/visits` with authenticated session cookie + CSRF protection:
  ```json
  {"provider":"panoramax","panoramaId":"source-id","sessionId":"opaque-session-token","eventId":"uuid-client-nonce","claimedSeenAt":"ISO-8601"}
  ```
  Example successful response: `{"visitAccepted":true,"firstVisit":true,"awardedJCoins":0,"balance":null,"reason":"reward_gate_not_enabled"}` until economy gate passes.
- `GET /api/portal/leaderboard?period=weekly`: rank by server-verified unique places; privacy-safe pseudonyms.
- `GET /api/portal/progress`: world/country/provider/day counts, achievements, and route (respect content-provider data retention).
- `DELETE /api/portal/visits/me`: data deletion/export capability by authenticated user according to project policy.

### Mandatory backend checks

1. AuthN/AuthZ from the site's existing session, not a username supplied in JSON; enforce CSRF if cookie auth.
2. Validate provider's real image ID and permitted source; check actual metadata and coordinate plausibility through authorized service, respecting upstream ToS and budgets. Do not trust client coordinates.
3. Unique event using `UNIQUE(account_id, provider, canonical_place_key)` plus `UNIQUE(account_id, event_id)` for idempotency; serialize wallet transactions with the canonical ledger.
4. Google panorama IDs may change between sessions. Do not use them as permanent place identity. Design permissible canonicalization or exclude Google visits from rewards until policy and stability reviewed. A spatial grid can unfairly collapse adjacent landmarks; test boundary effects.
5. Cooldown, daily/weekly caps, abuse detection, rate limits and budget circuit breakers. No monetary claim from client `localStorage` or repeated requests.
6. Define independent reward-gate tests: new place, duplicate, failed panorama, race condition, replay, disconnected account, other-user impersonation, quota exhausted, malicious input. Run in staging with real wallet rollback before enabling production.
7. Atomic wallet settlement and audit: write visit and reward in one DB transaction; use ledger transaction IDs and reconciliation. No double reward on retries.
8. Screen readers/mobile; allow disabling auto camera motion and all scheduled jumps.

## J Coins economic rule

**Proposed, not enabled:** 1 JC per server-confirmed first unique eligible place, 0 for repeats. Owner must confirm rules and reserve/daily cap. Default API returns **0 awarded** until production gate is explicitly approved. Client must not show earned JC based on local-only exploration.

## Storage / licensing

- Panoramax metadata should preserve attribution/license and publisher link. No bulk picture rehosting.
- Google Street View: do not scrape or persist Google-derived imagery. Current Portal keeps Google-derived point coordinates **session-only** and does not plot them onto OpenStreetMap tiles. Consult current Google Maps Platform ToS before storing, displaying alongside non-Google maps or using points for global stats.
- User trips may be sensitive. Provide visibility controls, export/delete, account ownership, consent, and avoid exposing exact visited points of other players by default.
- OSM tiles: attribution, rate limits, and fair usage; use commercial tile provider if traffic grows.

## Acceptance gate for production

- `SITE_TAB_LIVE`: **real** authenticated route/tab on main site, screenshot and test URL.
- `WALLET_BACKEND_PASS`: server-level idempotent ledger tests, security review, caps, reconciliation.
- `RANKING_LIVE`: users see correct server-tracked counts and only consented leaderboards.
- `PROVIDER_COMPLIANCE_PASS`: licensing, key quotas and storage rules verified.
- `BROWSER_E2E_PASS`: at least one genuine pan/rotate/jump/stop journey per enabled provider.

Do not change the production economy until all relevant gates pass.
