> **Gnani AI edition.** This document was written for an earlier provider. References to a hosted LLM, whiteboard vision model or partner image adapter are historical: the current build uses Gnani Prisma/Timbre for speech and a deterministic rule engine plus trained ML model for reasoning (see README and `docs/DECISIONS.md`).

# API Notes

Purpose: the only source of truth for external API behavior in ChaosBoard. Filled during Phase 0 and amended whenever an API behaves differently than recorded.

Rules for whoever fills this file (human or agent):

1. Record only what a real call returned. Do not copy request shapes, endpoints, parameter names, or limits from memory, from `plan.md`, or from any earlier spec.
2. Every entry names the script that produced it, the date and time, and the number of runs behind any latency figure.
3. Never record API keys, tokens, account identifiers, card details, or personal data. Redact before saving. Recorded responses saved as fixtures go inside the owning module's `tests/fixtures/recorded/` folder (for example the SAM parser fixtures belong to the `vision` module) with the capture date in the file name.
4. If something does not work, write "does not work", paste the error status and message (redacted), and record the fallback decision. An honest failure entry is as valuable as a success.
5. If a capability was not tested, its status stays NOT TESTED. Nothing in code may depend on a NOT TESTED capability.
6. When an entry changes, keep the old observation with its date and add the new one beneath it.

---

## 1. Status summary

| Capability | Status | Fallback decision | Last checked |
|---|---|---|---|
| Spark Open: plain completion | NOT TESTED | | |
| Spark Open: structured output | NOT TESTED | | |
| Spark Open: tool calling | NOT TESTED | | |
| Spark Open: image input | NOT TESTED | | |
| Spark Open: reasoning levels | NOT TESTED | | |
| SAM 3.1 on one keyframe | NOT TESTED | | |
| Voice Transcribe streaming | NOT TESTED | | |
| Muse Image generation | NOT TESTED | | |
| Muse Wonder: text | NOT TESTED | | |
| Muse Wonder: image input | NOT TESTED | | |
| Toxiproxy supported toxics | WORKS | Container addressing confirmed via Docker Compose on Windows 11 (`host.docker.internal` upstream, `0.0.0.0:28001` container bind, `127.0.0.1:28001` host client). All 7 toxic types verified. | 2026-10-30 |
| Host capacity calibration | WORKS | Calibrated via `apps/server/src/cli/calibrate.ts`. Stable capacity 50-100 RPS, recommended scenario cap 25-30 RPS. | 2026-10-30 |
| Node LTS pinned and SQLite option chosen | WORKS | Node v24.13.0 and `node:sqlite` verified on Windows 11 host across unit and migration tests. | 2026-10-30 |
| Image library installs and runs on the builder's machine | NOT TESTED | | |

Status values: NOT TESTED, WORKS, PARTIAL (say what is missing), DOES NOT WORK.

---

## 2. Entry template

Copy this block for each capability and sub-test.

- Capability and sub-test:
- Script and date/time:
- Host and base URL (no keys):
- Authentication style:
- Model id used:
- Request that worked (describe each field and its type; link to a redacted recorded fixture):
- Response observed (describe each field and its type; link to the recorded fixture):
- Streaming behavior (message types, ordering, how completion is signaled), if applicable:
- Latency over N runs (N, minimum, median, maximum):
- Limits observed (rate limit headers, maximum image size or dimensions, maximum audio length, maximum output tokens, context size):
- Error behavior (status and body for a bad key, a malformed request, an oversized input, a timeout):
- Cost observed (tokens or credits consumed by this test):
- Surprises or deviations from what the docs say:
- Decision (use as planned, use with a change, use a fallback, do not use):

---

## 3. Spark Open on the partner host

Provided by the hackathon guide (official, still confirm with a real call): for Baseten, use the model id `meta-models/muse-spark-open-1026` and not the id shown in the partner docs. The guide describes the Baseten interface as a chat completions API.

Sub-tests to run and record, one entry each:

1. Plain text completion.
2. Structured output against a small schema: does the host enforce the schema, or only follow the prompt? How often does it return malformed output in 20 attempts?
3. Tool calling: one tool, one call, one result round trip.
4. Image input: one real diagram photo. Does the endpoint accept it, in which format, with what size limit, and is the reading usable?
5. Reasoning levels: which values are accepted, and the latency difference between the lowest and highest.
6. Rate limit behavior: record headers, and what a 429 looks like.
7. Which partner host is actually usable for this account (Baseten, Fireworks, Together, Modal), and which credits arrived.

Entries:

(none yet)

---

## 4. SAM 3.1 through the Meta Model API

Sub-tests:

1. One real whiteboard or diagram photo with a text prompt for boxes.
2. One real photo with a red marker stroke and a text prompt for the stroke.
3. Record the output format in enough detail (record types, field names, coordinate system, mask encoding, ordering across frames) to write a TypeScript parser in the `vision` module. The only published parser found is a Python package; use its documentation as a format reference only, never as a dependency.
4. Latency per keyframe, image size limits, and cost per call.
5. Behavior on an image with no match, and on an oversized image.

Entries:

(none yet)

---

## 5. Muse Voice Transcribe

Sub-tests:

1. A short recorded sentence containing topology labels and fault terms, with and without keyword biasing.
2. Protocol: connection setup, authentication, audio format and chunking, message types, partial versus final results, how to end an utterance.
3. Behavior on silence, on a dropped connection, and on an invalid audio format.
4. Latency from end of speech to final transcript, over several runs.
5. Whether the protocol is simple enough for a direct TypeScript WebSocket client in `meta-ai`. The Pipecat service is Python and is a protocol reference only.

Entries:

(none yet)

---

## 6. Muse Image

Sub-tests:

1. One generation request assembled from a small structured prompt containing a few labels and numbers.
2. Whether the code-execution option behaves as reported, and what it changes about layout accuracy.
3. Whether chained responses work for one refinement.
4. Text fidelity: do the labels and numbers in the image match the input exactly? Record mismatches.
5. Latency and cost per image.

Entries:

(none yet)

---

## 7. Muse Wonder

Sub-tests:

1. One text request at the lowest effort setting: which values are valid, and latency.
2. One image request: accepted or rejected, and how.
3. Whether any step in ChaosBoard benefits enough from Wonder to justify its cost and latency. If not, record "not used".

Entries:

(none yet)

---

## 8. Toxiproxy

Record the server version, how the control API is addressed from Docker Compose, and for each toxic the server reports: its name, parameters, direction handling, and the behavior actually observed in a test against a trivial echo target. In particular, record what the timeout toxic does to data and connections at a zero value, what the reset toxic does, and how the toxicity fraction is applied (per connection or otherwise).

Planning sandbox observations (not the builder's environment; re-run `pnpm smoke:toxiproxy` to confirm). Recorded 2026-10-29 on Linux x86_64 with Node 22.22.2 against a native Toxiproxy 2.13.0 server (`GET /version` returned `{"version": "2.13.0"}`). No Docker was available in the sandbox, so container addressing is untested. The script put a TCP echo server behind a proxy and measured what a client experienced. Baseline median first byte was 2 ms.

The server accepted these toxic types: latency, bandwidth, slow_close, timeout, slicer, limit_data, reset_peer. Taking a proxy down was done by updating it with `enabled: false`.

| Toxic and attributes tried | Observed behavior | Maps to ChaosBoard fault |
|---|---|---|
| latency, latency 300, jitter 0, downstream | First byte at 302 ms | `latency` |
| latency, latency 300, jitter 0, upstream | First byte at 301 ms (the delay applies in either direction) | `latency` (direction) |
| latency, latency 300, jitter 200 | First byte at 216 ms in a single sample, so the delay varies within the jitter range | `latency` with jitter |
| bandwidth, rate 1 | About 1 KB per second: 2,400 of 3,072 bytes arrived in the 2.5 s window, as 24 chunks | `bandwidth_limit` (rate unit is KB per second) |
| slow_close, delay 600 | After the client ended the connection, the close completed 601 ms later | `slow_close` |
| timeout, timeout 500 | No data returned; the connection was closed after about 503 ms | `stall` with a hold time |
| timeout, timeout 0 | No data returned and the connection stayed open for the whole 2.5 s window | `stall` held until cleared |
| limit_data, bytes 10 | Only 10 of 40 bytes came back, then the connection closed immediately | `data_limit` |
| reset_peer, timeout 100 | The client saw a connection reset about 101 ms after connecting | `connection_reset` |
| slicer, average_size 1 | The 40-byte reply arrived as 40 chunks of one byte | none planned |
| latency 400 ms with toxicity 0.5 | 11 of 30 connections were delayed, so toxicity is a per-connection random choice (a 30-connection sample is not exactly half) | `toxicity` |
| proxy disabled (`enabled: false`) | New connections were refused; after re-enabling, traffic flowed again | `dependency_down` |

Control API shapes that worked on 2.13.0: `POST /proxies` with name, listen, upstream, enabled (an ephemeral listen port such as `127.0.0.1:0` is returned resolved in the response); `POST /proxies/{name}/toxics` with name, type, stream, toxicity, and attributes; `DELETE /proxies/{name}/toxics/{toxic}`; `POST /proxies/{name}` to update a proxy; `DELETE /proxies/{name}`.

Builder environment observation. Recorded 2026-10-30 on Windows 11 x86_64 with Docker Desktop 4.97.0 (Docker Engine 29.9.2, Linux container kernel 6.6.87.2) running `ghcr.io/shopify/toxiproxy:2.13.0` via `infra/docker-compose.yml`. Script `scripts/smoke/toxiproxy.ts` executed with `TOXIPROXY_URL=http://127.0.0.1:8474`, `TOXIPROXY_PROXY_LISTEN=0.0.0.0:28001`, `TOXIPROXY_CLIENT_HOST=127.0.0.1`, `TOXIPROXY_UPSTREAM_HOST=host.docker.internal`, and `SMOKE_ECHO_BIND=0.0.0.0`. Recording written to `.smoke-output/toxiproxy-2026-10-30T02-57-58-611Z.json`.
Baseline median first byte was 12 ms. All 7 toxics passed with measured behavior matching planning sandbox observations (downstream latency 309 ms, upstream latency 307 ms, jitter 177 ms, bandwidth 2,420 bytes in 25 chunks at ~1 KB/s, slow_close closeAfterEnd 601 ms, timeout 500ms closed at 517 ms, timeout 0 held 2,507 ms, limit_data exactly 10 bytes, reset_peer closed at 106 ms, toxicity 0.5 delayed 17/30 connections). Container-to-host upstream addressing verified via `host.docker.internal`.

---

## 9. Platform decisions and host calibration

Platform decisions (Phase 0):

- Builder operating system and Docker version: Windows 11 x86_64, Docker Desktop 4.97.0 (Engine 29.9.2), Docker Compose 5.6.1.
- Node version: `v24.13.0` on host; engines floor `>=22.13.0` satisfied.
- Built-in SQLite module: `node:sqlite` works on Node v24.13.0 with standard ExperimentalWarning. Wrapped by `platform/db.ts`.
- Image library: not needed until Phase 8, so not installed or tested.
- How the application reaches Toxiproxy (host or Compose networking) and how Toxiproxy reaches worker processes: Application reaches Toxiproxy control API at `http://127.0.0.1:8474`. Proxies listen on `0.0.0.0:<port>` inside container, mapped to host ports `127.0.0.1:28000-28099`. Toxiproxy routes upstream traffic to worker nodes using `host.docker.internal:<node-port>`.

Host calibration (filled in Phase 3):

- Machine description: 12th Gen Intel(R) Core(TM) i3-1215U (8 logical cores), 7.7 GB RAM, Windows 11 x86_64, Node v24.13.0, pnpm 12.13.0, Docker Engine 29.9.2.
- Fault-free capacity measurement method and date: `apps/server/src/cli/calibrate.ts` on 2026-10-30; open-loop stepped arrival rates (50, 100, 200 RPS) with 1ms constant processing time on a single service node.
- Highest stable arrival rate on a trivial topology, and where degradation begins: 50-100 RPS maintains p99 latency ~30 ms and low generator lag. At 200 RPS, knee is reached (p99 latency increases to 856 ms).
- Fraction of that capacity that scenarios may use, and why: 50% safety fraction (recommended scenario arrival rate cap <= 25-30 RPS) to prevent host saturation or generator lag distortion during multi-node topology trials.

---

## 10. Accounts and credits (operational, no secrets)

- Meta Model API credits claimed (yes or no, date):
- Partner credits requested and received (host, amount, date):
- Payment method confirmed (yes or no; never record card details):
- Spend limit notification set (yes or no):

---

## 11. Decisions and fallbacks

| Date | Decision | Reason | Evidence entry |
|---|---|---|---|
| | | | |

---

## 12. Leads to check (these are not facts)

Pointers found while planning. Each must be confirmed by a real call before anything depends on it.

- Hackathon guide resource list: Meta Model API docs, quickstart, model list, cookbook, API cookbook, API fundamentals, Muse Code recipes, open-weights cookbook. Start from the links in the official participant guide.
- Pipecat (a Python framework) documents a speech-to-text service for Meta's transcription model: `docs.pipecat.ai/api-reference/server/services/stt/meta`. Use it only as a protocol reference; ChaosBoard implements a direct TypeScript client.
- A Python package named `meta-sam-parser` on PyPI describes a parser for SAM 3.1 output delivered through a streamed Responses API. It is a format reference only; the TypeScript parser is written against the real recorded output.
- ComfyUI documents a node for Meta's image editing API: `docs.comfy.org/built-in-nodes/MetaMuseImageEditApi`. It may show request fields worth comparing against the real behavior.
- Toxiproxy's own README is the reference for the toxic list; confirm against the version actually running.
