# Engineering changes: hardening and real integrations

This document lists what changed in the last hardening pass, how each claim was verified, and what is
still not proven. Nothing here relies on a mocked transport unless it says so.

## 1. Security

| Problem found in the audit                                                               | Fix                                                                                                                       | Verified by                                                    |
| :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------- |
| Google/GitHub login trusted a client-claimed email (account takeover)                    | ID tokens are cryptographically verified; no claimed-email path                                                           | Runtime: forged logins return 401 in a production-mode boot    |
| Built-in demo bearer tokens and a demo-password bypass                                   | Demo users and sessions exist only when `ALLOW_DEV_MOCK_AUTH=true` outside production                                     | `tests/app.test.ts`; runtime 401                               |
| Auth guard bypass by putting `/events` in the query string; public model endpoint        | Exact-path public allow-list; every `/api` route needs a session                                                          | Runtime: `?x=/events` returns 401                              |
| Default JWT secret in production                                                         | Server refuses to start without a strong `JWT_SECRET`; `.env.example` no longer ships a usable secret                     | Config tests; runtime boot refusal                             |
| **New bug found:** two logins in the same second returned HTTP 500 (token is session PK) | Every JWT carries a random `jti`                                                                                          | Regression test in `tests/app.test.ts`                         |
| No room isolation; any user could read any room and its transcripts                      | Durable room registry: first joiner owns the room, owner can lock it, REST data requires membership, capacity cap         | `collaboration-rooms.test.ts`, `meeting-transcription.test.ts` |
| Chat and signaling identity was client-supplied                                          | Sender stamped by the server from the authenticated session                                                               | `collaboration-rooms.test.ts`                                  |
| No abuse limits                                                                          | Per-connection message rate limit (closes with 1008), payload cap, room capacity cap                                      | `collaboration-rooms.test.ts`                                  |
| Weak room codes (`Math.random`, ~31 bits)                                                | CSPRNG, 50-bit codes (the code is a join capability). The code is 4 characters longer; no other UI change                 | `room-code.test.ts`                                            |
| Web client read the wrong token key and only worked via the hardcoded demo token         | Reads `chaosboard_token`; hardcoded fallback removed                                                                      | Typecheck; hook rewrite                                        |

## 2. Real-time collaboration and WebRTC

- Room state (canvas operations, snapshot, transcripts, membership) persists in SQLite and survives everyone leaving and a server restart.
- Heartbeat termination, close and eviction share one cleanup path, so peers always get `user_left` and empty rooms are released (the old heartbeat path leaked rooms and left ghost participants).
- New package `@chaosboard/webrtc-mesh`: perfect-negotiation mesh (glare handling, rollback with a rebuild fallback for stacks that cannot roll back, ICE-candidate buffering, renegotiation on late tracks, bounded ICE restarts) and a reconnecting socket with jittered backoff and replay from the last seen sequence.
- Per-user ICE configuration endpoint with short-lived coturn REST credentials; `infra/docker-compose.yml` ships a coturn profile.
- **Verified with real WebRTC**: `apps/server/src/platform/tests/webrtc-real.test.ts` runs genuine ICE/DTLS/SDP between independent peer connections (werift) signalled through the production WebSocket bridge with real JWT auth: 3-peer full mesh, mid-call video renegotiation, simultaneous-offer glare, and departure cleanup.
- Not covered: browser-to-browser media on real networks, TURN relay traffic, and mesh scale beyond a handful of peers. Chrome, Safari and Firefox were not run in this environment.

## 3. Meta integration

- **Tool-calling repair agent** (`modules/repair/application/proposers/agent-proposer.ts`). Tools read live measured state; failed attempts are visible to the model; `submit_patch` is validated and returns problems for self-correction. The sandbox still decides. If the provider rejects tools, the proposer degrades to a single structured call and labels it `single_shot`. A model failure now surfaces as an error instead of a fake trade-off report.
- **Muse Voice Transcribe** adapter (`POST /asr/transcribe`, multipart `request` + WAV `audio`) with local WAV validation and silence skipping. The old Whisper dependency is gone. The browser now captures real 16 kHz PCM16 WAV (the previous 4-second `MediaRecorder` slices were not independently decodable) and segments speech locally, so silence is never uploaded or billed.
- **SAM 3.1** adapter through the Responses API, used to ground whiteboard node boxes and to localise the red fault-marker stroke.
- **Usage ledger and spend guard**: every billable call is priced from the Meta catalogue; calls stop at `META_BUDGET_USD - META_RESERVE_USD`. `GET /api/meta-ai/capabilities` reports what is configured and spent.
- Meeting copilot hazards that name non-existent nodes or edges are dropped; transcripts come from the server's record, not the client.
- **Live smoke test**: `pnpm smoke:meta` exercises chat tool-calling, SAM, vision and speech against your key and records redacted evidence.

### What is not verified

The adapters follow Meta's published request shapes as documented by Meta and third-party integrators, and are tested against wire-accurate local fakes. **No call to Meta's live API was made from this environment.** Run `pnpm smoke:meta` first, record the results in `docs/api-notes.md`, and adjust `META_STT_MODE` or paths if the live API differs.

## 4. Measurement and repair engine

- Real Toxiproxy version recorded in run provenance (was hardcoded).
- Repair proposers receive the full iteration history.
- Verified end to end against a real Toxiproxy process: `repair.integration.test.ts` runs an agent that submits a harmful patch, watches the sandbox roll it back, reads the rejection through a tool, and then submits a patch the sandbox accepts.

## 5. Repository hygiene

`pnpm check` passes: typecheck, 0 lint errors, formatting, 0 boundary violations, graph and docs checks, about 498 unit tests. 24 integration tests pass against real Toxiproxy (`TOXIPROXY_UPSTREAM_HOST=127.0.0.1` for a native process). `pnpm install --frozen-lockfile` exits 0. README, `.env.example` and ML docs no longer claim PostgreSQL, Redis, or unwired models. The ML dataset is labelled synthetic and `ml/data/generate_dataset.py` restores reproducibility.

## 6. Known remaining gaps

- **Recording consent has no UI.** The server rejects audio without `recordingConsent: true`, but the client defaults it to true. Add a consent prompt before shipping beyond a demo.
- WebRTC is full mesh with a default cap of 8; there is no SFU.
- One experiment runs at a time per host.
- The Redis/BullMQ queue manager is still instantiated but unused; PostgreSQL is not supported.
- The "Continue offline" button on the sign-in page is a client-only preview mode; it carries no server privileges.
- Browser-level end-to-end tests (Playwright) do not exist.
