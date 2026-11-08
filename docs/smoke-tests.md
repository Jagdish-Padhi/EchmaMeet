> **Gnani AI edition.** This document was written for an earlier provider. References to a hosted LLM, whiteboard vision model or partner image adapter are historical: the current build uses Gnani Prisma/Timbre for speech and a deterministic rule engine plus trained ML model for reasoning (see README and `docs/DECISIONS.md`).

# Provider smoke tests

Phase 0 needs real facts about every external API before any feature code depends on it. These scripts make real calls and write what happened to `.smoke-output/` (git-ignored). You then copy the verified facts into `docs/api-notes.md`.

None of the scripts hardcode an endpoint, a request shape, or a key. Anything that must come from provider documentation is supplied by you.

## Rules

- Recordings are redacted automatically (credential values and sensitive headers), but read a recording before you copy anything from it. Never commit a recording that contains keys, personal data, or content you do not have the right to publish.
- A request the server rejects is a result. Record it and the decision it leads to.
- Only what a real call returned goes into `api-notes.md`. Do not copy request shapes from memory or from the plan.
- To keep a real response as a parser fixture, copy the relevant part into the owning module's `tests/fixtures/recorded/` folder with the capture date in the file name.

## Setup

Copy `.env.example` to `.env` and fill in the values you have. Scripts read `../.env` through Node's `--env-file-if-exists` flag.

## Spark Open on the partner host

```
pnpm smoke:spark-open
```

Needs `PARTNER_BASE_URL`, `PARTNER_API_KEY`, and `PARTNER_MODEL_ID`. The hackathon guide gives the Baseten model id `meta-models/muse-spark-open-1026`. Optional: `PARTNER_CHAT_PATH` (default `/chat/completions`), `SMOKE_IMAGE_PATH` (a photo of a hand-drawn diagram, for the image input test), `SMOKE_STRUCTURED_ATTEMPTS` (default 10).

It tests, in order: a plain completion (three runs for latency), structured output against a schema (how many of N attempts match), a tool call with a result round trip, and image input. The request shapes follow the OpenAI-compatible chat completions convention that the guide describes; they are hypotheses, and the recording shows what the server did. Reasoning-effort levels are not probed because the parameter name is unknown; use the generic probe once you find it in the docs.

## Toxiproxy

```
pnpm smoke:toxiproxy
```

Needs `TOXIPROXY_URL` (for example the address where the control API listens). It starts a local echo server, puts a proxy in front of it, applies each toxic type, and measures what a client experiences, including how the toxicity fraction is applied and what disabling the proxy does.

Toxiproxy can run natively (download the server binary for your platform from its GitHub releases page) or in Docker. With Docker, the container and the host must reach each other. `infra/docker-compose.yml` starts Toxiproxy with the control port and a range of proxy ports published to localhost. The image tag in that file was not pulled in the planning sandbox, so confirm it pulls. Variables for the script:

| Variable | Meaning | Default |
|---|---|---|
| `TOXIPROXY_PROXY_LISTEN` | Address Toxiproxy binds for the proxy | `127.0.0.1:0` |
| `TOXIPROXY_CLIENT_HOST` | Host the script uses to reach the proxy port | `127.0.0.1` |
| `TOXIPROXY_UPSTREAM_HOST` | Host Toxiproxy uses to reach the echo server | `127.0.0.1` |
| `SMOKE_ECHO_BIND` | Address the echo server binds | `127.0.0.1` |

With the Compose file, a working combination is `TOXIPROXY_PROXY_LISTEN=0.0.0.0:28000`, `TOXIPROXY_UPSTREAM_HOST=host.docker.internal`, and `SMOKE_ECHO_BIND=0.0.0.0`. Record what actually worked on your machine in `api-notes.md` section 9.

## Generic HTTP probe (SAM 3.1, Muse Image, Muse Wonder, anything else)

```
pnpm smoke:probe path/to/probe.json
```

You write the probe file from the provider's documentation. Fields: `name`, `method` (default POST), `url`, `headers`, `body` (any JSON, or a string), `repeat` (default 1), `timeoutMs`, and `stream` (read the body incrementally and record when each chunk arrived, useful for streamed output).

Placeholders keep credentials and large files out of the file and are expanded when the script runs:

| Placeholder | Meaning |
|---|---|
| `${ENV:NAME}` | An environment variable (an error if it is not set) |
| `${FILE_TEXT:path}` | The UTF-8 content of a file |
| `${FILE_BASE64:path}` | The base64 content of a file, for example an image |

A header such as `authorization` should be written as `Bearer ${ENV:META_API_KEY}` so the key never appears in the file. Keep probe files outside the repository until they are verified and free of secrets.

## WebSocket probe (Muse Voice Transcribe)

```
pnpm smoke:ws path/to/ws-probe.json
```

Fields: `name`, `url`, `headers`, `steps`, `closeAfterMs`. Steps are `{ "type": "sendText", "text": "..." }`, `{ "type": "sendFile", "path": "...", "chunkBytes": N, "intervalMs": N }` (for streaming a recorded audio file in chunks), and `{ "type": "wait", "ms": N }`. Every received message is recorded with its time since the connection opened, which is how you learn the message types, the partial and final transcript behavior, and the latency. Use a short recorded sentence that contains your topology labels and fault terms.

## Turning a recording into api-notes

For each capability, fill the entry template in `docs/api-notes.md`: the request that worked (field by field), the response (field by field), latency over several runs, limits seen, error behavior, cost, and the decision. Then change the capability's row in the status table.
