# ChaosBoard: Build Plan

Status: authoritative build plan, revision 2 (TypeScript modular monolith). Last context check: Tuesday, October 27, 2026.
Builder: solo, indie track, Meta Global AI Developer Hackathon (Cerebral Valley).
Audience: the coding agent that implements this system one phase at a time, and the builder who tests each phase.

This document contains no implementation code on purpose. It defines features, flows, contracts, module boundaries, acceptance gates, and the things that must not happen. If the plan and the agent's instincts disagree, the plan wins. If the plan is wrong or incomplete, stop and report instead of improvising.

Revision 2 replaced the earlier Python backend with TypeScript end to end, replaced the earlier flat module list with capability modules that have enforced boundaries, and split the former Phase 1 into two phases. Nothing from revision 1 applies where it conflicts with this file.

---

## 0. How the coding agent must use this document

1. At the start of every session read sections 0 to 7 in full, then read only the phase being built.
2. Build exactly one phase at a time. Do not begin phase N+1 until phase N passes its gate and the builder says so.
3. Session protocol for every phase:
   1. Restate the phase goal and gate in your own words.
   2. List the files you will create or change and why.
   3. If the phase defines contracts, write the contract schemas and their tests first.
   4. Implement the smallest thing that satisfies the phase.
   5. Run `pnpm check` (type check, lint, module boundary check, fast tests) and the phase's slow tests, and report the real output.
   6. Write the phase report (template in Appendix B).
   7. Record every non-obvious decision in `docs/DECISIONS.md` with the reason and the alternative rejected.
4. Never invent API details. External API facts live in `docs/api-notes.md`, which Phase 0 fills from real calls. If a fact is not there, run a smoke test or stop and report. Do not guess parameter names, endpoints, model ids, or response shapes.
5. When something is ambiguous, choose the smallest reasonable interpretation and record it in `DECISIONS.md`. Ask the builder only if the answer changes a contract in section 6 or a module boundary in section 5.
6. Do not widen scope. Do not refactor code outside the current phase. Do not add dependencies without a `DECISIONS.md` entry that names the dependency, the reason, and the alternative of not adding it.
7. Create a module folder only in the phase that implements it. Do not scaffold empty modules, empty layer folders, or placeholder files "for later".
8. If a check fails, fix the cause. Do not weaken the test, skip it, loosen a rule, disable a lint or boundary check, or catch the error to make it pass.
9. If you could not verify something, say so in the phase report. "Not verified" is an acceptable report. A false "verified" is not.

---

## 1. Product thesis

### 1.1 What ChaosBoard is

A design-time resilience testing tool. The user sketches a system (on a digital canvas, or from a photo of a whiteboard), states what must stay true (for example, "99th percentile latency stays under 500 ms"), and ChaosBoard:

1. Turns the sketch into a validated topology.
2. Instantiates that topology as real processes talking over real sockets, with Toxiproxy between them.
3. Injects a fault (latency, stalled connections, resets, a fully down dependency) under open-loop load.
4. Measures what happened and checks the stated invariants, reporting PASS, VIOLATED, INCONCLUSIVE, or INVALID honestly.
5. Runs an agentic repair loop in which an open-weight Meta model proposes changes drawn from a bounded, typed catalog of resilience policies. Every proposed change is validated in code, applied, re-measured, and kept only if the measurement improves without new violations.
6. Reports what it could not fix and why, with the measured trade-off.

One-line pitch: draw a system, watch it get broken on purpose, and see the design repaired and re-measured, not just described.

### 1.2 Position against prior art

ChaosEater (arXiv 2511.07865, ASE 2025) already automates the full chaos engineering cycle with LLM agents for Kubernetes-based systems. ChaosBoard does not claim a new category. Its wedge is different input and different timing: it works at design time from a sketch or a photo, with no cluster and no deployed system, and it grounds every claim in measurements from a sandbox. The README must cite ChaosEater and state this wedge plainly.

### 1.3 What the sandbox can and cannot tell you (must appear in the README)

The sandbox runs stand-in services configured from the topology. It faithfully exercises resilience policies: timeouts, retries, backoff, jitter, connection pools, bounded and unbounded queues, circuit breakers, rate limits, idempotency handling, and fallback behavior. It does not model database internals, garbage collection behavior of the user's real runtime, kernel behavior, real network topology, or the user's actual code. Results come from one host; before/after comparisons on the same host are meaningful, absolute numbers are properties of that host. The tool never claims to prove correctness. It reports empirical results over a stated number of trials.

### 1.4 The central claim the benchmark must support or refute

A static LLM reading a diagram can guess how a design will behave. A sandbox measures it. The benchmark compares the model's pre-registered prediction with measured behavior on a fixed scenario set and reports agreement and error honestly, including cases where the static prediction is right. The project is judged on the quality of this measurement, not on a favorable story.

---

## 2. Hackathon facts (from the official participant guide supplied by the builder)

| Item | Fact |
|---|---|
| Event | Meta Global AI Developer Hackathon, organized by Cerebral Valley |
| Building period | Oct 27 to Nov 4, 2026 |
| Submission deadline | Nov 4, 9:00 PM Eastern (the guide says EST in the submission section). Nov 4 falls after US daylight saving ends (Nov 1), so this is UTC-5, which is Nov 5, 07:30 AM IST. |
| Internal targets | Feature freeze Nov 3 evening IST. Final submission no later than Nov 4, 20:00 IST. Treat the official deadline as a safety margin, not a target. |
| Judging | Stage 1 pass/fail (fits a problem statement, reasonably uses Meta models). Stage 2 scored 0 to 10: Impact 30%, Use of Meta AI Tooling 25%, Technical Depth and Execution 20%, Demo 25%. Stage 3: top 5 per track judged live from demo videos. |
| Submission requires | Public repository, 3-minute demo video, everyone who worked on it listed. The video, the code, and the live product are what judges use. |
| Rules that bind this plan | Repository must be public. New work only: everything presented must be built during the event and be clearly identifiable as such. Do not reuse code, data, or assets without rights. No disqualifying content. |
| Problem statements | "Build for Your World" and "Push the Frontier". ChaosBoard targets "Push the Frontier" (software) and is defensible under "Build for Your World". |
| Sample anti-projects | Basic RAG apps, simple image analyzers, generic AI-for-education chatbots, job screeners, personality analyzers, sports analyzers, medical advice, political or war content. ChaosBoard must never read as any of these. |
| Credits | $150 Meta Model API credits per participant; a payment card is required; claim by Nov 4, 9:00 PM ET, individually. Baseten $100 and a 2M TPM limit, reviewed and not guaranteed. Modal $100 for the first 1,000 participants. Fireworks $25 for shortlisted teams only. For Baseten, the guide says to use model id `meta-models/muse-spark-open-1026`. |
| Bonus prizes relevant here | Best Build on Meta Open Weight Models ($10K, flagged in the first judging round, partner verifies the project runs on Muse Glimmer or Muse Spark Open). Best Agentic Use-Case ($5K). Best Creative Build ($5K, requires Muse Image or Muse Wonder). Most Viral ($20K, X engagement, link submitted through the platform). Community Vote ($10K). |
| Dates after submission | Judging Nov 5 to 8. Closing ceremony Nov 9, 12:00 PM ET. Community vote winner Nov 16. |

Do not state in any public text that the project "will win" or "qualifies" for any prize. State only what it uses and let judges decide.

---

## 3. Meta tooling: roles and verification status

Status key: VERIFIED means confirmed from public sources by the planning process and still subject to the Phase 0 smoke test. UNVERIFIED means a guess that must not be coded against until Phase 0 proves it.

| Component | Planned role | Status |
|---|---|---|
| Muse Spark Open (`meta-models/muse-spark-open-1026` on a partner host) | Core repair agent. Also intent parsing for voice, and image reading if the partner endpoint accepts images. | Public reports describe a large mixture-of-experts open-weight model with tool calling and multimodal input, served by partners. The guide describes the partner interface as chat completions. Image input over the partner endpoint UNVERIFIED. |
| SAM 3.1 via Meta Model API | Segment diagram boxes and the red marker stroke on single keyframes. Not live video. | Reported to be available through the Responses API, returning per-frame text records with boxes and masks. The only published parser found is a Python package, which serves as a format reference only; a TypeScript parser must be written against the real output. Request format, auth, limits UNVERIFIED. Published throughput figures are for data-center GPUs and are irrelevant because only keyframes are used. |
| Muse Voice Transcribe | Single-speaker push-to-talk fault and invariant commands. | Reported as a streaming speech-to-text model with a WebSocket interface, keyword biasing, and endpoint detection. The Pipecat service for it is Python and is a protocol reference only; the TypeScript backend implements a direct socket client. Endpoint URL, model id, audio format UNVERIFIED. Diarization is not used. |
| Muse Image | Optional last-mile export card. Never a source of facts. | Reported to support a code-execution option and chained responses. Latency, text fidelity, and exact parameters UNVERIFIED. |
| Muse Wonder | Optional. Use only if the smoke test shows image input works and latency is acceptable for the step. | Reported as an always-reasoning model with adjustable effort. Parameter names and image support UNVERIFIED. |
| Muse Glimmer | Not used. | Excluded to avoid a second self-hosted model. |

Claims from earlier drafts that must NOT be used anywhere in code, docs, or the video: any SAM frame-rate figure on small GPUs, a model variant named "sam3.1-tiny", any Glimmer benchmark figure, any specific voice turn-detection latency, any compile-time promise such as "3 seconds", "mathematically proves", "100% accuracy", "guaranteed", "category creator", "bulletproof", or any prize-stacking dollar figure.

Model usage evidence: every provider call logs the provider name, model id, prompt template version, latency, token counts if returned, and run id. The README includes a short section describing exactly which parts of the system run on the open-weight model and on which partner, so the open-weight prize verification is easy for the partner and the judges.

---

## 4. Scope

### 4.1 Must ship (Phases 0 to 7)

Real sandbox, real faults, open-loop load, honest metrics and verdicts, bounded repair loop, benchmark with a static-LLM baseline and a rule-based baseline, and a working web UI that shows live measured data.

### 4.2 Should ship (Phases 8 to 10, in this value order)

Photo-to-topology ingestion with the red-stroke gesture (Phase 8), voice commands (Phase 9), report export and optional blueprint card (Phase 10). At least two of the three must work for the Meta tooling story to be strong.

### 4.3 Cut order if time runs out

1. Muse Image blueprint card (inside Phase 10). Keep the deterministic report.
2. Voice commands (Phase 9).
3. SAM red-stroke gesture (inside Phase 8). Keep the deterministic color-threshold detector and the photo read.
4. Photo ingestion (Phase 8). Keep the digital canvas.

Never cut Phases 0 to 7, the benchmark, or the honest-limitations documentation.

### 4.4 Non-goals

Live video tracking. Kubernetes support. Multi-user accounts. Cloud deployment of the sandbox for arbitrary users. Free-form code generation of services. Multiple debating agents. Formal verification or proofs. Real production traffic replay. A chatbot interface. Microservices of any kind for the control plane.

---

## 5. Architecture

### 5.1 Architectural style

ChaosBoard is a modular monolith control plane plus a small data plane.

- Control plane: one deployable server application, `apps/server`, organized into capability modules with enforced boundaries (5.4 to 5.6). It validates input, orchestrates experiments, persists runs, talks to Meta and partner APIs, and serves the web UI and the HTTP API.
- Data plane: the system under test. One worker process per topology node (`apps/worker`), one open-loop load generator process per experiment (`apps/loadgen`), and Toxiproxy. These are spawned and supervised by the control plane. They are test subjects and measurement instruments, not services of the product. The README and architecture docs must say so explicitly, so nobody mistakes the worker processes for microservices.
- The control plane is never on the request path of the measured traffic.

### 5.2 Stack (decided; changes need a DECISIONS entry)

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript everywhere, strict | One language for contracts, server, workers, load generator, and web |
| Runtime | Current Node.js LTS, pinned in `engines` and `.nvmrc` | Verify the version against the release schedule in Phase 0 |
| Package manager | pnpm workspaces | Lockfile committed |
| Contracts | zod schemas in `packages/contracts`, types inferred from schemas | Single source of truth for every boundary |
| Server framework | Fastify | Request parsing goes through zod at the controller edge using one helper in `platform/http-kit`; no extra type-provider dependency unless justified |
| Logging | pino through Fastify, JSON lines | Structured, with run id |
| Persistence | SQLite through the built-in `node:sqlite` module, wrapped by `platform/db` | Decided in Phase 0 (see DECISIONS.md): it needs no native build, and the wrapper makes a driver swap a one-file change. It prints an experimental warning on Node 22. Raw SQL in repositories, versioned migrations per module. No ORM. |
| Outbound HTTP | undici | Explicit timeouts via abort signals, connection pool control |
| Worker HTTP server | `node:http` | No framework in the measured path |
| Image handling | sharp (or an equivalent if Phase 0 shows a problem) | Dimension limits, metadata stripping, raw pixel access for the color-threshold detector |
| Sockets | A maintained WebSocket library | Only for the voice bridge; decide in Phase 9 |
| Web | React, Vite, TypeScript strict, React Flow | One small chart library chosen in Phase 7; no state management library unless justified |
| Tests | Vitest (unit, integration, web components), Playwright (one end-to-end flow), fast-check optional for property tests | Integration tests use real processes and a real Toxiproxy |
| Lint and format | ESLint with typescript-eslint strict type-checked rules, Prettier | |
| Boundary enforcement | dependency-cruiser (or eslint-plugin-boundaries if justified) | Runs inside `pnpm check` from Phase 0 |
| Infrastructure | Docker Compose with the official Toxiproxy image | |

Pin exact versions after checking the registry. Prefer versions at least two weeks old. Commit lockfiles. Do not add MongoDB, an ORM, a message broker, Redis, GraphQL, or a dependency injection framework.

### 5.3 Repository layout

```
chaosboard/
  README.md                     the only markdown file outside docs/
  package.json                  workspace root with the scripts in 5.11
  pnpm-workspace.yaml
  tsconfig.base.json
  .nvmrc
  .dependency-cruiser.cjs       boundary rules (section 5.6)
  eslint and prettier config
  .env.example                  names only, no values
  docs/                         every markdown file except README.md lives here
    plan.md                     this document
    DECISIONS.md
    api-notes.md                filled by real calls in Phase 0
    smoke-tests.md              how to run and read the provider smoke scripts
    contracts.md                human description of the contracts in packages/contracts
    metrics.md                  precise metric definitions
    architecture.md             module map, dependency matrix, generated graph
    limitations.md
    benchmark-results.md        generated by the benchmark command (Phase 6), never hand-edited
  packages/
    contracts/                  zod schemas and inferred types; no business logic
    shared/                     tiny shared kernel: typed errors, ids, clock and random ports, result helpers
  apps/
    server/                     control plane (modular monolith)
      src/
        main.ts                 process entry: settings, database, shutdown, listen
        app.ts                  composition root for HTTP: mounts every module's routes
        module-migrations.ts    migrations of every module that owns tables, in dependency order
        cli/                    composition roots for command line tools (benchmark, calibrate)
        platform/               config, logging, db and migration runner, http-kit, lifecycle
        modules/                capability modules (5.4)
    worker/                     data plane: universal node worker
    loadgen/                    data plane: open-loop load generator
    web/                        React application
  benchmarks/
    scenarios/                  one JSON file per scenario
    predictions/                raw static-model outputs, committed before measurement
    results/                    raw generated results, never hand-edited
  e2e/                          Playwright flows
  infra/                        docker-compose.yml, Dockerfile
  scripts/
    smoke/                      provider smoke scripts and their small library (redaction, recorder)
  tools/
    architecture/               boundary rule tests and the module graph generator
```

Folders for modules, apps, and layers appear only when the phase that needs them is built (rule 7 in section 0).

### 5.4 Module catalog (apps/server/src/modules)

Every module is a capability with a single public entry file, `index.ts`. The table lists what each module owns, the Phase that builds it, and what other modules may use from it.

| Module | Owns | Public API (summary) | Phase |
|---|---|---|---|
| `topology` | The topology model, validation (graph rules and bounds), the policy catalog and naive defaults, normalization of extracted drafts | validate a topology, normalize a draft, read the policy catalog and defaults, topology types | 1 |
| `sandbox` | Network plan (ports), derivation of node configurations from a topology, supervision of worker and load generator processes, reading node counters | allocate a plan, start and stop a sandbox handle, read counters, start and stop a load run | 2 and 3 |
| `chaos` | Toxiproxy control, fault validation against what the server supports, fault application and cleanup | create proxies for a plan, apply and clear faults, list supported toxics, teardown | 3 |
| `measurement` | Metric computation, validity rules, aggregation across trials, invariant evaluation, verdicts | build a trial result, aggregate trials, evaluate invariants and verdicts | 3 and 4 |
| `runs` | The run record: experiments, trials, events, repair iterations, model call metadata, provenance; persistence and replay | create and finish a run, append events and artifacts, get and list runs, replay events | 4 |
| `experiments` | Experiment orchestration, the single-experiment host lock, the event stream, cancellation | start, cancel, and subscribe to an experiment | 4 |
| `meta-ai` | Clients for Spark Open on the partner host and for Meta Model API capabilities, with typed failures, bounded retries, timeouts, call metadata | ports for structured model calls, segmentation, speech, image generation | 5 (structured model), 8 (vision and segmentation), 9 (speech), 10 (image generation) |
| `repair` | Operation catalog, patch validation, telemetry summarizer, agent loop, rule-based baseline, trade-off reporter | start and cancel a repair session, read its iterations | 5 |
| `benchmarks` | Scenario loading, static prediction runs, repair comparisons, result computation and report generation | list scenarios, run a benchmark, read results | 6 |
| `vision` | Draft extraction from images, geometry, red-stroke detection, SAM output parsing | extract a draft, detect a gesture edge | 8 |
| `voice` | Command set, name resolution, keyword list, intent parsing, speech session bridge | open a session, parse an intent | 9 |
| `reporting` | Deterministic report and diagram from a run record, optional image card | generate a report, generate a card | 10 |

Web feature folders mirror these capabilities (5.9).

### 5.5 Layering inside a module

Modules are organized by capability first, and by dependency direction second. Do not use a flat models, views, controllers split across the whole app. Inside a module, create only the layers that carry code:

```
modules/<capability>/
  index.ts            the only file other modules may import
  domain/             pure types, rules, validation, calculations (the "models")
  application/        use cases, orchestration, and the ports (interfaces) it needs
  infrastructure/     adapters that implement ports: SQLite, Toxiproxy, processes, Meta APIs, file IO
  http/               Fastify route plugins and controllers (the "controllers"); thin
  tests/              unit and integration tests for this module
```

Layer rules:

- `domain` imports only `packages/contracts` and `packages/shared`. It performs no I/O, reads no clock, uses no randomness without an injected source, reads no environment, and imports no Node built-in modules.
- `application` imports its own `domain`, ports it defines, and the public APIs of other modules it is allowed to use (5.6).
- `infrastructure` implements ports and may use Node built-ins, third-party libraries, and the `platform` database handle. It never contains business rules.
- `http` imports its own `application`, `packages/contracts`, and `platform/http-kit`. A controller parses the request with a contract schema, calls one use case, and maps the result or typed error to a response. No business logic, no persistence calls, no calls to other modules.
- Business rules never live in `http` or `infrastructure`. If a rule needs a file read, the rule goes in `domain` and the read goes behind a port.
- Public API (`index.ts`) exports use cases, types, and route registration. It never exports infrastructure details or domain internals that other modules should not depend on.
- Each module owns its database tables (prefixed with the module name) and its migrations. No module reads another module's tables.
- Tests may import internals of their own module only.

### 5.6 Dependency rules and enforcement

Allowed imports between workspaces and modules. Anything not listed is forbidden, and the boundary check fails the build.

| From | May import (public APIs only) |
|---|---|
| `packages/contracts` | nothing |
| `packages/shared` | nothing |
| `topology` | contracts, shared |
| `chaos` | contracts, shared |
| `sandbox` | contracts, shared, topology |
| `measurement` | contracts, shared |
| `runs` | contracts, shared |
| `experiments` | contracts, shared, topology, sandbox, chaos, measurement, runs |
| `meta-ai` | contracts, shared |
| `repair` | contracts, shared, topology, experiments, runs, meta-ai |
| `vision` | contracts, shared, topology, meta-ai |
| `voice` | contracts, shared, topology, meta-ai |
| `reporting` | contracts, shared, runs, meta-ai |
| `benchmarks` | contracts, shared, topology, experiments, repair, runs, meta-ai |
| `platform` | contracts, shared; and module public APIs only inside `main.ts` and `cli/` composition files |
| `apps/worker`, `apps/loadgen` | contracts, shared |
| `apps/web` | contracts only (schemas and types) |

Additional rules, all enforced by the boundary check or lint:

- No cycles anywhere.
- No import of another module's files other than its `index.ts`.
- `domain` folders cannot import from `application`, `infrastructure`, or `http`. `application` cannot import from `infrastructure` or `http`. Infrastructure cannot import `http`.
- `http` layers may import `platform/http-kit` only; `infrastructure` layers may import `platform/db` only. All other configuration and dependencies are passed in by the composition root as constructor or function arguments. Modules never read environment variables and never import `platform/config`.
- `apps/worker`, `apps/loadgen`, and `apps/web` can never import from `apps/server`.
- `domain` folders, and the pure policy folder in `apps/worker`, are additionally restricted by lint rules: no `Date.now`, no `new Date()` without arguments, no `Math.random`, no `process`, no `console`, no Node built-in imports.
- A boundary test deliberately includes a forbidden import fixture and asserts the check fails, so the rule set cannot silently stop working.
- A script generates the module dependency graph from the code into `docs/architecture.md` (as a Mermaid diagram) and the check fails if the committed graph is stale. The README embeds or links this generated graph, not a hand drawing.

### 5.7 Runtime topology and data flow

```
 browser (apps/web)
     | HTTP + server-sent events + WebSocket (voice)
     v
 apps/server  (control plane, modular monolith)
     | spawns and supervises                       | Toxiproxy HTTP control API
     v                                             v
 apps/worker x N  <---- through proxies ---->  Toxiproxy (container)
     ^
     | open-loop requests
 apps/loadgen x 1  (one process per experiment)
```

1. A controller in `experiments/http` validates the request with the contract schemas and calls the `startExperiment` use case.
2. `experiments` takes the exclusive host lock. Only one experiment runs at a time because measurement integrity requires uncontested CPU.
3. `sandbox` builds a network plan: a port for every node and a proxy listen port for every edge. `chaos` creates the proxies from the plan. `sandbox` derives each node configuration from the topology and the plan and starts the worker processes with edges pointing at the proxy addresses, then waits for readiness with a deadline.
4. A warmup runs and is discarded. Baseline trials (no fault) run, then the fault is applied and faulted trials run back to back. Each trial starts a load generator run; the generator streams its per-request records to the control plane in a typed format.
5. `measurement` merges generator records and node counters into a trial result, applies validity rules, aggregates, and evaluates invariants. Verdicts are computed only in `measurement/domain`.
6. `runs` records everything and `experiments` emits typed events, which the HTTP layer streams to the browser as server-sent events.
7. The repair loop (`repair`) proposes a validated patch, applies it to a copy of the topology, calls `experiments` again, and accepts or rolls back using the same verdict logic.
8. Teardown runs on every path (success, failure, cancellation, signal, crash): proxies removed, processes terminated, ports released, lock released.

### 5.8 Persistence and provenance

SQLite, owned per module. `runs` stores the system of record: topology snapshots, fault and invariant specs, per-trial results, events, repair iterations with raw model requests and responses (keys never stored), verdicts, git commit, configuration hash, seeds, host description (CPU count, OS, Node version, Docker version), Toxiproxy version, model ids, prompt template versions, token counts if returned, and timestamps. Migrations are versioned SQL files in each module's `infrastructure/migrations`, applied by the platform runner in module dependency order at startup. Writes are transactional. The synchronous driver blocks the control plane event loop for short moments; this is acceptable because the control plane is not on the measured request path, but the worker and generator processes never touch the database. Be honest in the docs: a recorded run explains how a result was produced but does not guarantee identical numbers on a rerun.

### 5.9 HTTP API surface (resource level; finalize in `docs/contracts.md` during Phase 1 and extend per phase)

| Module | Endpoints |
|---|---|
| platform | `GET /api/health` |
| topology | `POST /api/topologies/validate` |
| experiments | `POST /api/experiments`, `GET /api/experiments/:id`, `GET /api/experiments/:id/events` (server-sent events), `POST /api/experiments/:id/cancel` |
| runs | `GET /api/runs`, `GET /api/runs/:id`, `GET /api/runs/:id/events` (replay), `GET /api/runs/:id/export` |
| repair | `POST /api/repairs`, `GET /api/repairs/:id`, `GET /api/repairs/:id/events` (server-sent events), `POST /api/repairs/:id/cancel` |
| benchmarks | `GET /api/scenarios`, `GET /api/scenarios/:id`, `GET /api/benchmarks/results` |
| vision | `POST /api/vision/extract`, `POST /api/vision/gesture` |
| voice | WebSocket upgrade at `/api/voice/stream`, `POST /api/voice/intent` |
| reporting | `POST /api/reports`, `GET /api/reports/:id`, `POST /api/reports/:id/card` |

Errors use RFC 9457 problem details (`application/problem+json`) with a stable machine-readable `code` and a human message. Every request and response body is defined by a schema in `packages/contracts`. A second experiment start while one is running returns a clear busy problem, not a queue.

Web application structure, mirroring the backend: `apps/web/src/app` (shell, routing), `apps/web/src/features/<capability>` (board, experiments, repair, benchmarks, vision, voice, reports, runs; each with components, hooks, and local state; each exposing one `index.ts`), `apps/web/src/api` (one typed client built on contract schemas that parses every response), and `apps/web/src/ui` (small shared presentational components). Features may import the API client, `ui`, and contracts, and may import another feature only through its `index.ts`.

### 5.10 Measurement integrity rules specific to Node

These exist because a Node process can quietly distort the thing being measured.

- All latency is computed inside the load generator process from one monotonic clock (`process.hrtime.bigint`). Timestamps from different processes are never subtracted. Wall-clock time is used only for display and ordering of events.
- The generator builds its full arrival schedule from the seed before the run, then sends each request at its scheduled time with a drift-corrected timer loop (no fixed-interval timers that accumulate drift). It records scheduled time, actual send time, and completion time, and reports the lag distribution.
- Event loop delay is monitored with the built-in event loop delay histogram in the generator and in every worker. A trial is INVALID if generator lag or worker event loop delay exceeds the configured limits, with the reason recorded.
- The generator's HTTP client must not cap concurrency in a way that turns it into a closed-loop client. If local resource exhaustion (file descriptors, ephemeral ports) occurs, the trial is INVALID with that reason.
- Workers use `node:http` with no framework, simulate work with timers (never CPU-burning loops), do no synchronous I/O, and write no per-request log lines in the hot path. Queue depth and busy-worker time are sampled inside the worker at a fixed interval and exposed as series; the control plane reads them, it does not sample remote state on its own schedule.
- Optional: record garbage collection pause totals per trial from performance observers as a diagnostic.
- Pin the Node version and flags, document them in the run record, and recommend CPU limits for containers.

### 5.11 Workspace scripts (names are part of the contract)

- `pnpm check`: type check all workspaces, lint, boundary check, stale-graph check, fast unit tests.
- `pnpm test:integration`: slow tests against real processes and Toxiproxy.
- `pnpm lint` and `pnpm format`: ESLint plus a Prettier check, and Prettier write.
- `pnpm boundaries`: the module boundary check alone.
- `pnpm graph` and `pnpm graph:check`: regenerate, or verify, the module dependency graph in `docs/architecture.md`.
- `pnpm smoke:spark-open`, `pnpm smoke:toxiproxy`, `pnpm smoke:probe <file>`, `pnpm smoke:ws <file>`: provider smoke scripts (excluded from every default run; see `docs/smoke-tests.md`).
- `pnpm dev` and `pnpm start`: development run and server start. A production build arrives in Phase 11.
- Defined in the phase that introduces them: `pnpm test:e2e` (Phase 7, Playwright) and `pnpm benchmark` (Phase 6).

Scaffolding time-box: the whole Phase 0 workspace setup, tooling, and boundary rules should take about two hours. Do not polish scaffolding at the expense of the measurement quality and the demo, which carry most of the score.

---

## 6. Contracts (specification in prose; implemented as zod schemas in `packages/contracts`, described in `docs/contracts.md`)

### 6.0 Rules for contracts

- Every boundary has a schema: HTTP requests and responses, server-sent events, worker configuration and control endpoints, load generator configuration and record lines, provider responses, files read from disk, and database JSON columns. Types are inferred from schemas. Nothing is hand-typed twice.
- `packages/contracts` contains schemas, inferred types, and small pure parsing helpers. It contains no business rules. Rules such as graph validity live in module `domain` folders.
- Each schema carries a schema version where the data is persisted or exchanged between processes. Changes are additive when possible. A breaking change updates `docs/contracts.md`, the fixtures, and every consumer in the same change.
- Each schema has at least one valid and one invalid fixture in its tests.
- Identifiers use branded types (topology id, node id, edge id, run id, experiment id) so ids cannot be mixed up silently. Units are in the field name (`timeoutMs`, `rateRps`).

Contract groups: topology; node configuration and worker control; fault; invariant; trial configuration; load generator configuration and record lines; trial result; experiment result and verdict; repair patch and trade-off report; run record; events; API request and response bodies and problem details; vision draft; voice command; benchmark scenario and results.

### 6.1 TopologySpec

Fields: schema version, topology id, display name, source (canvas, image, scenario), nodes, edges, entry definition, optional route classes.

Node: unique id (lowercase slug), kind (service, cache, queue_consumer, ledger_sink), simulated processing time (constant or a seeded distribution), maximum concurrent workers, queue behavior (bounded depth, or explicitly unbounded), optional ingress rate limit, and kind-specific settings (cache time-to-live; queue consumer consume rate; ledger deduplication by idempotency key on or off, which is a property of the ledger node and not of the edge).

Edge: id, source, target, mode (synchronous call or asynchronous enqueue), and a policy object: timeout in ms (explicitly null means no timeout), retry settings (max attempts, base backoff, multiplier, max backoff, jitter mode of none, full, or equal), circuit breaker settings (enabled, failure threshold percent, minimum request window, cooldown, half-open probe count), fallback mode (fail fast with 503, serve stale cache, enqueue for later), idempotency settings (whether the caller sends an idempotency key), and a connection pool limit.

Validation (in `topology/domain`, with precise error messages that name the offending id): unique ids; edges reference existing nodes; no self-loops; the graph is a directed acyclic graph in version 1 and cycles are rejected with a clear message; every node reachable from the entry; numeric values inside catalog bounds; mode and kind combinations legal; maximum node and edge counts to stay inside host capacity.

### 6.2 Policy catalog bounds (initial proposal; finalize in Phase 1 and then freeze)

Timeout 10 to 30,000 ms or null. Max attempts 1 to 6. Base backoff 0 to 2,000 ms. Multiplier 1 to 4. Breaker failure threshold 5 to 100 percent. Breaker window 5 to 200 requests. Breaker cooldown 100 to 30,000 ms. Connection pool 1 to 500. Worker concurrency 1 to 500. Queue depth 1 to 10,000 or explicitly unbounded. Rate limit 1 to 5,000 requests per second. Bounds exist so that neither the model nor the user can request something that makes the host the bottleneck instead of the design. The bounds are defined once, as data, in `packages/contracts` (`catalog`). The schemas, the topology validator, the repair patch validator, and the UI forms all read that single definition, and `topology` exposes the naive defaults.

### 6.3 FaultSpec

Fault id, target edge id, fault type, parameters, toxicity (the fraction of connections affected, greater than 0 and at most 1), direction, start offset within the trial. Fault types use ChaosBoard's own vocabulary, independent of any provider's attribute names: `latency` (latency and jitter), `stall` (data withheld, optionally for a fixed hold time), `connection_reset` (reset after a delay), `slow_close`, `bandwidth_limit`, `data_limit`, and `dependency_down` (toxicity must be 1). The `chaos` module maps each type to what the running Toxiproxy server supports and rejects a fault it cannot express. Against Toxiproxy 2.13.0 in the planning sandbox, the server accepted the toxic types latency, bandwidth, slow_close, timeout, slicer, limit_data, and reset_peer, and a disabled proxy refuses connections; see `docs/api-notes.md` for the measured behavior of each. Packet loss is not a toxic. Express partial failure as a toxicity fraction on resets or timeouts and call it that in the UI and docs. Confirm the actual list and semantics against the server in Phase 0 and record it.

### 6.4 InvariantSpec

Id, metric, scope (whole system, a node, or an edge), comparator, threshold. Metrics: end-to-end p99 latency, end-to-end error rate, completion rate, retry amplification (per edge), worker saturation (per node), maximum queue depth (per node), duplicate write rate (per ledger node), breaker open-time fraction (per edge).

### 6.5 TrialConfig

Arrival rate, arrival process (constant spacing or seeded Poisson), warmup duration, measurement duration, cooldown, client request timeout, seed, number of trials. Live default is a small number of short trials for responsiveness. The benchmark uses five trials.

### 6.6 Metric definitions (also written to `docs/metrics.md`; implemented in `measurement/domain`)

- Scheduled send time is decided before the run from the seed. Latency is measured from the scheduled send time, not from the moment the generator got around to sending. This is what prevents coordinated omission.
- End-to-end p99 is computed exactly over all requests scheduled in the measurement window. A failed request contributes its time to failure, capped at the client timeout. Success-only latency is reported separately.
- Completion rate is successful responses divided by scheduled requests.
- Retry amplification for an edge is total attempts sent on the edge divided by first attempts on that edge, within the window.
- Worker saturation is the time-weighted fraction of the window in which all workers of a node were busy.
- Queue depth is sampled inside the node at a fixed interval; report maximum and a high percentile.
- Duplicate write rate is committed writes beyond the first per logical request, divided by logical requests, measured at a ledger node.
- Generator lag is actual send time minus scheduled send time. Report a high percentile and the maximum. A trial whose lag exceeds the configured limit is INVALID. Worker event loop delay above its limit also invalidates the trial.
- Cross-trial aggregation: take the median of the per-trial value and report the interquartile range. Never average percentiles. Never pool raw samples across trials and then take a percentile as if it were one trial.

### 6.7 Verdicts (implemented in `measurement/domain`)

- PASS: the median satisfies the invariant and the interquartile range does not cross the threshold.
- VIOLATED: the median violates the invariant and the interquartile range does not cross the threshold.
- INCONCLUSIVE: the interquartile range straddles the threshold. Report it as such. Never round it to PASS or VIOLATED.
- INVALID: the measurement cannot be trusted (generator lag over the limit, worker event loop delay over the limit, a node crashed unexpectedly, local resource exhaustion, the baseline without any fault already violates the invariant, a trial was interrupted). Always say why.

The baseline-must-be-healthy rule: if the no-fault baseline already violates an invariant, the experiment is INVALID for that invariant, because the system is overloaded or misconfigured independent of the fault.

### 6.8 RepairPatch

An ordered list of operations. Each operation names a target (node or edge id), an operation kind from the catalog (set a numeric or enum policy value, enable or configure a breaker, insert a queue on an edge, give a route its own pool, change the fallback mode), the new value, and a short rationale string from the model. Validation is pure and lives in `repair/domain`: unknown targets, unknown operation kinds, out-of-bounds values (using the catalog from `topology`), operations that make the topology invalid, and patches larger than the configured maximum are rejected with machine-readable reasons. Applying a validated patch returns a new topology and never mutates the old one.

### 6.9 TradeOffReport

When no valid patch satisfies every invariant, the system reports: the best configuration reached, which invariants it satisfies and which it does not, the measured evidence for each, the specific reason the remaining invariants cannot be met within the catalog (for example, a synchronous dependency that is fully down cannot complete writes), and what a human would have to relax or redesign. This report is a first-class result, not an error.

### 6.10 Events

A typed, versioned union of events used for server-sent streams and for replay from the run record: experiment started, sandbox ready, trial started, fault applied, trial finished, trial invalid (with reason), experiment finished, experiment failed, experiment cancelled, repair iteration started, patch proposed, patch rejected, patch applied, iteration measured, patch accepted, patch rolled back, repair finished. Each event carries the run id, a sequence number, and a wall-clock timestamp for ordering and display.

---

## 7. Engineering charter (applies to every phase)

### 7.1 Honesty rules

- Every number shown anywhere (UI, README, video, report) must trace to a run id and be reproducible from stored data. No literals that look like results.
- No sample data presented as a result. No "demo mode" that fabricates telemetry. If a fixture is used in a unit test, it is labeled as a fixture, lives under the owning module's `tests/` folder, and never ships in the runtime path.
- No hardcoded defaults that quietly pre-bake the answer. The naive starting policies applied to a freshly drawn topology (for example, a long timeout, several immediate retries, no breaker) are textbook defaults, documented in `docs/DECISIONS.md`, and visible in the UI as defaults.
- Never silently fall back. If the model call fails, the UI says the model call failed. If SAM fails and the deterministic detector is used, the UI says so. Fallbacks are explicit, logged, and labeled.
- Never claim verification that did not happen. Words like "proves", "guarantees", "bulletproof", "100%", "zero errors" are banned from code comments, UI copy, docs, and the video unless a test literally establishes them.
- Report failures. If a benchmark scenario does not behave as designed, that goes in the results, not in the bin.
- If a model's prediction or repair was right, say so. The baseline comparison is only credible if it can lose.

### 7.2 Code quality rules (TypeScript)

- Compiler strictness: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `verbatimModuleSyntax` are on in every workspace. Switches over unions are exhaustive.
- No `any`. No non-null assertions. No `@ts-ignore` or `@ts-expect-error` without a one-line justification and a linked `DECISIONS.md` entry. Type assertions are allowed only immediately after validation at a boundary, and never to silence a type error. Data from outside the process is `unknown` until a schema parses it.
- Typed boundaries: every API request and response, every provider response, every file read, every message between processes, and every JSON database column is parsed with a contract schema at the edge. No raw objects of unknown shape passed around inside the system.
- Errors are typed. Define a small set of error classes or tagged results in `packages/shared` with a stable code. Domain functions return typed results for expected failures and throw only for programmer errors. No `catch` that swallows; no broad catch without re-throwing a typed error that adds context. Preserve the original error as the cause.
- Asynchronous discipline: no floating promises, no promises in places that expect synchronous callbacks, every outbound call and every child-process wait takes an abort signal or a deadline, no unbounded concurrency, no unbounded queues or caches in the tool itself, and no event loop blocking in the data plane.
- Small modules with one responsibility. No god files. No module named `utils`, `helpers`, `common`, `misc`, or `manager`. Prefer functions and plain data over class hierarchies; use a class only where it holds lifecycle or state. No inheritance for code reuse.
- No sleeping to wait for something to be ready. Use readiness checks with deadlines. Time-based windows that are part of the measurement design are the only legitimate waits.
- Dependencies are passed in (constructor or function arguments) from a composition root. No module-level singletons holding mutable state. Randomness and time come from injected sources defined in `packages/shared`.
- Environment variables are read only in `platform/config`, parsed with a schema, and passed down as typed objects.
- Cleanup is guaranteed: processes, ports, proxies, temp files, sockets, timers, and subscriptions are released on success, failure, cancellation, signals, and uncaught errors. Leaked processes after a test run is a bug.
- Structured logging with the run id on every line. No `console.log`. No logging of secrets, full prompts containing keys, or raw audio. No per-request logging in the data plane hot path.
- Comments explain why, not what. No commented-out code. No leftover TODOs in committed code; if work is deferred, it goes in `docs/DECISIONS.md` or the phase report.
- Naming: kebab-case file names, PascalCase types, camelCase values, specific names. Functions do what their names say. Default exports are avoided except where a framework requires them. Barrel files exist only as module `index.ts` public entries.

### 7.3 AI-slop prohibitions

These are the usual agent failure modes. Each is forbidden.

- Emojis anywhere: code, comments, logs, UI, docs, commit messages.
- Placeholder content: lorem ipsum, "example", "foo", "TODO", "coming soon", dummy charts, fake leaderboards, empty files created for symmetry.
- Magic numbers inline. Constants are named, documented, and live in one config or catalog location with validation.
- Hardcoded ports, hosts, model ids, file paths, thresholds, or arrival rates in logic. These come from validated configuration or from the scenario files.
- Tests that assert nothing, assert only that a function ran, or mock the thing under test. Mock only external services at a boundary, and keep at least one test per boundary against the real thing (marked slow or live).
- Over-abstraction: factories of factories, plugin systems, base classes with one subclass, generic "service" and "handler" wrappers, dependency injection frameworks, interfaces with a single implementation and no boundary reason, repository layers wrapped around repositories.
- Duplicate implementations of the same logic in two places, including duplicated types that should be inferred from a contract schema.
- Dead code, unused dependencies, unused exports, and speculative features "for later".
- Verbose, self-congratulatory docstrings and README prose. Plain, specific writing only.
- Adding retries, caches, or abstractions the phase did not ask for.
- Changing a contract without updating `docs/contracts.md`, its fixtures, and its consumers in the same change.
- Disabling, weakening, or bypassing lint rules, boundary rules, or type checks to get a change through.
- Generating UI with generic gradients, glass effects, glow, stock illustrations, or default-framework palettes as a substitute for design.

### 7.4 Configuration, secrets, security

- All secrets come from environment variables. `.env.example` lists names only. `.env` is ignored by git. Run a secret scan before every commit and before submission.
- API keys never reach the browser. Browser audio and images go to the backend, and the backend talks to providers.
- Validate upload type, size, and image dimensions. Reject early.
- Topology data is data. It is never evaluated, interpolated into a shell command, or used to build file paths. Child processes are started with argument arrays and no shell, and configuration reaches them as one validated JSON document.
- CORS restricted to the configured web origin. Endpoints that trigger heavy work are rate limited and guarded by the single-experiment lock.
- Do not send private data to any provider. Only synthetic topologies and the builder's own diagrams are used.
- Respect third-party licenses; keep a short list of dependencies and licenses in the README. Be careful with new packages: check maintenance and publication age before adding.

### 7.5 Testing rules

- Unit tests for all `domain` logic, written first for contracts: validation errors, verdict logic including INCONCLUSIVE and INVALID, metric computations on hand-built inputs with known answers, patch validation, geometry.
- Integration tests for `sandbox`, `chaos`, the load generator, and `experiments` run against real processes and a real Toxiproxy. Mark them slow. `pnpm test:integration` runs them with one command.
- Failure-path tests are mandatory, not optional: provider timeout, malformed model output, out-of-bounds patch, Toxiproxy unreachable, node crash mid-trial, generator lag over limit, cancellation mid-experiment, database write failure, oversized image upload, unparseable voice transcript.
- Determinism tests: the same seed produces the same arrival schedule.
- Architecture tests: the boundary check fails on a deliberately forbidden import fixture; the generated graph matches the committed one.
- Contract tests: every schema has valid and invalid fixtures.
- Live provider smoke tests live in `scripts/smoke/` and are excluded from the default run. Recorded real responses may be stored as parser fixtures inside the owning module's `tests/fixtures/recorded/`, labeled as recorded, with the capture date in the file name.
- A phase is not done until its tests pass from a clean checkout.

### 7.6 UI rules

- Real data only. Every chart and number comes from a stored run or a live event stream.
- Every view has loading, empty, error, busy, and cancelled states that tell the truth.
- Verdict states are shown as text labels (PASS, VIOLATED, INCONCLUSIVE, INVALID), never by color alone.
- Show uncertainty: interquartile ranges, trial counts, and a visible INVALID reason.
- Show provenance: run id, trial count, seed, model id for any model-made change.
- Restrained, legible design: one typeface family plus a monospace for numbers, a small consistent spacing scale, a neutral palette with one accent, adequate contrast, keyboard operability, visible focus states. No decoration that does not carry information.
- Progress indicators reflect real progress (trial k of n), never fake animation.
- The web app parses every API response with contract schemas. It never trusts a response shape.

### 7.7 Language and claims policy

Allowed phrasing: "measured over N trials", "median p99 with interquartile range", "the model proposed", "validated against the catalog", "not verified", "inconclusive", "could not be repaired within the catalog". Forbidden phrasing is listed in 7.1 and section 3. The README opens with what the system is, what it is not, and its limitations, before any result.

### 7.8 Dependencies

Fewer is better. Each dependency gets a `DECISIONS.md` entry. No dependency for something the platform does in a few lines. No unmaintained packages. Pin exact versions and commit the lockfile.

### 7.9 Git hygiene

First commit on Oct 27 or later so the history shows the work was done during the event. Small commits with plain, specific messages. No generated or vendored bulk files other than the generated architecture graph and benchmark results. No commits that mix unrelated changes. No secrets, ever; if one leaks, rotate it immediately.

---

## 8. Phases

Each phase lists: goal, dependencies, modules touched, features with detail, flow, tests, gate, strict notes, and fallback. Target dates are IST and assume the builder tests each phase the same day. Budgets are in section 10.

---

### Phase 0: Foundations, boundary enforcement, and provider smoke tests

Target: Oct 27 evening to Oct 28 morning. Depends on: nothing. Touches: workspace root, `packages/contracts` and `packages/shared` (minimal), `apps/server/src/platform`, a minimal `apps/web` shell, `scripts/smoke`, `docs`.

Goal: a clean, checked workspace with enforced module boundaries, and verified facts about every external API before any feature code depends on them.

Features:

1. Workspace skeleton. pnpm workspaces with `packages/contracts`, `packages/shared`, `apps/server`, and `apps/web`. Do not create `apps/worker`, `apps/loadgen`, or any module folders yet. Node version pinned. One TypeScript base configuration with the strict flags from 7.2.
2. Tooling. ESLint with strict type-checked rules (including no floating promises, no misused promises, no explicit any, no non-null assertions, exhaustive switch checks, consistent type imports) and Prettier. The domain purity restrictions from 5.6 are encoded as lint overrides that apply to `modules/*/domain/**` as those folders appear.
3. Boundary enforcement. dependency-cruiser configured with the full matrix from 5.6 from day one, plus the architecture test that proves a forbidden import fails the check, plus the graph generation script and stale-graph check. The matrix must pass with zero modules and keep passing as modules are added.
4. Workspace scripts exactly as named in 5.11, with `pnpm check` green on a clean checkout.
5. Platform layer in `apps/server/src/platform`: configuration (a single schema-validated settings object from environment variables; missing or malformed required values fail at startup naming the variable), logging (structured, with request and run id fields), the database handle and the per-module migration runner (decide the SQLite driver here per 5.2 and record it), `http-kit` (zod parsing helper, problem-details mapping, SSE helper), and lifecycle (graceful shutdown hooks that later phases register cleanup with). A `GET /api/health` endpoint proves the wiring.
6. Contracts and shared minimum: the health response schema, the problem-details schema, the typed error base, id helpers, and the clock and random source ports. Nothing else yet.
7. Web shell. Vite React app that calls `/api/health` through a typed client that parses the response with the contract schema, and shows the real result or the real error. No other screens.
8. Docs scaffolding. `docs/DECISIONS.md` with the stack decisions from 5.2 and the module boundary decision, `docs/api-notes.md` from the template, `docs/architecture.md` with the module table and the generated graph, `docs/limitations.md` seeded with the content of 1.3. `.env.example` with names only: provider base URLs, API keys, model ids, Toxiproxy address, data directory, web origin.
9. Provider smoke scripts in `scripts/smoke/`, one per capability, each making one real call and recording to `docs/api-notes.md`: endpoint, auth style, request shape that worked, response shape, observed latency, error behavior, rate-limit headers if any.
   - Spark Open on the partner host: plain text completion, then a structured-output request, then a tool-call request, then an image input request. Record which work.
   - Meta Model API: SAM 3.1 on one real diagram photo; record the output format in enough detail to write a TypeScript parser.
   - Muse Voice Transcribe: a short recorded sentence including the keyword list; record the protocol, audio format, and partial and final message behavior.
   - Muse Image: one generation request with a small structured prompt; record whether the code-execution option and chained responses behave as reported, and text fidelity.
   - Muse Wonder: one image request and one text request at the lowest effort; record whether images are accepted, what effort values are valid, and latency.
10. Toxiproxy check. Start the container, query its version and the toxics it supports, apply and remove each supported toxic on a trivial echo target, and record exact semantics. Record how the app (on the host or in Compose) addresses Toxiproxy and how upstream addresses are resolved, plus the builder's operating system.
11. Credits and accounts. Claim Meta credits, request partner credits, confirm a working card. Record which partner host is actually usable. This is an operational task, not code.

Flow: workspace, tooling and boundary check, platform and health endpoint, web shell, docs, then each smoke script in the order above, then a written summary in `api-notes.md` of what works, what does not, and the decision for each fallback.

Tests: configuration validation unit tests; problem-details mapping; the architecture test; the health endpoint through a real server instance. The smoke scripts are manual and excluded from the default run.

Gate: `pnpm check` passes on a clean checkout with the boundary matrix active; the health round trip works from the browser; `api-notes.md` has a real entry for every capability or an explicit "does not work, fallback chosen" entry; no secrets in git history.

Strict notes:
- Do not write feature code in this phase.
- Do not create module folders or placeholder files "for later".
- Do not copy request shapes from memory, from this plan, or from any earlier spec. Only record what a real call returned.
- Do not commit recorded responses that contain keys, personal data, or anything you do not have the right to publish.
- Do not skip the image-input test on Spark Open. The vision design in Phase 8 depends on it.
- Do not leave a smoke script that only works with a hardcoded key or path.
- Do not spend more than about two hours on scaffolding.
- Do not weaken the boundary rules to make something pass.

Fallback: if the partner host is unavailable, try the other partner hosts listed in section 2. If no open-weight host works by end of Oct 28, stop and tell the builder before proceeding to Phase 5, because the open-weight prize and the core agent depend on it.

---

### Phase 1: Contracts and the topology module

Target: Oct 28. Depends on: Phase 0. Touches: `packages/contracts`, `modules/topology`, docs.

Goal: a topology can be described, validated with precise errors, given textbook default policies, and exposed through a tested API. No processes yet.

Features:

1. Contract schemas for topology, node, edge, policy, fault, invariant, trial configuration, and the shared id types, exactly as in section 6, each with valid and invalid fixtures. Freeze the written description in `docs/contracts.md` at the end of the phase.
2. `topology/domain`: validation with every rule in 6.1, each failure naming the offending id and rule; the policy catalog and bounds (6.2); the naive default policies applied to new edges, documented in `DECISIONS.md`; deterministic normalization of an extracted draft into a topology (slug ids from labels with collision handling, drop impossible edges, apply defaults) so the vision module can reuse it later.
3. `topology/application`: validate-topology and normalize-draft use cases returning typed results.
4. `topology/http`: `POST /api/topologies/validate` returning either the normalized topology or a list of precise problems.
5. Public API in `topology/index.ts` with exactly what later modules need: types, validate, normalize, catalog, defaults.
6. Scenario-compatible fixtures: the six core scenario topologies from section 9 as test fixtures that validate, so later phases start from known-good inputs.

Flow: JSON topology, schema parse, domain validation, typed result, problem details on failure.

Tests: every validation rule with passing and failing cases; boundary values for every catalog bound; cycle and unreachable-node detection; normalization collisions; property tests for validator invariants if fast-check was approved; the validate endpoint through a real server instance.

Gate: all six scenario fixtures validate; every rule has a failing test whose error message names the offending id; `docs/contracts.md` matches the schemas.

Strict notes:
- No business rule in `http` or in the contracts package.
- No hardcoded bounds outside the catalog.
- No validation that returns only a boolean; errors must be specific and machine-readable.
- Do not model features no scenario needs.
- Do not let the web depend on anything but contract schemas and types.

Fallback: if the catalog bounds prove wrong in Phase 2 or 3, amend them in one place with a `DECISIONS.md` entry and updated tests.

---

### Phase 2: Data plane runtime (worker and sandbox)

Target: Oct 28 to Oct 29. Depends on: Phase 1. Touches: `contracts` (node configuration and worker control schemas), `apps/worker`, `modules/sandbox`.

Goal: a validated topology becomes real running processes, and each process behaves according to its policy configuration. No chaos, no load generator yet.

Features, `apps/worker` (the universal node program, configured only by one validated JSON document):

1. Pure policy logic in its own folder with the domain purity restrictions: retry schedule with backoff and the three jitter modes, circuit breaker state machine (closed, open, half-open), token bucket rate limiter, bounded queue behavior. All unit-tested with injected time and random sources.
2. Runtime adapters over `node:http` and undici pools: simulated processing time (timer-based, documented as simulated work), concurrency limit with queue, bounded-queue rejection with a service-unavailable response or explicit unbounded mode, outbound calls per edge honoring timeout, retries, pool limit, breaker, fallback mode, and idempotency key sending.
3. Node kinds: service, cache (time-to-live entries, miss calls downstream), queue consumer (pulls from an in-process queue at a configured rate, for asynchronous edges), ledger sink (records committed writes by logical request id and idempotency key, exposes duplicate counts).
4. Request identity: every logical request carries a request id; retried attempts carry an attempt number, so retry amplification and duplicates are computable.
5. Introspection and control endpoints on a separate control path: counters (requests in, attempts out per edge, retries, timeouts, errors by class, breaker transitions, shed requests, ledger duplicates), self-sampled series (queue depth, busy workers) at a fixed interval, event loop delay histogram, a documented counter reset, and a shutdown call. Counters are monotonic.

Features, `modules/sandbox`:

6. `domain`: the network plan (a port for every node and a proxy listen port for every edge, drawn from a validated range, no collisions), and the pure derivation of each node configuration from the topology and the plan.
7. `application` and `infrastructure`: sandbox start that spawns one worker process per node with an argument array and no shell, passes configuration as a single validated JSON document, waits for readiness with a deadline, captures process output to the run log, detects unexpected exits, and guarantees teardown on every path (success, failure, cancellation, signals, uncaught errors), including child process trees on the builder's operating system. A counters reader that fetches and parses counters through the contract schemas.
8. Public API: allocate a plan, start a sandbox from a topology and a plan, read counters and series, stop.

Flow: validated topology, network plan, node configurations, process start, readiness, running sandbox handle; teardown reverses it.

Tests:
- Unit: every pure policy with exact expected behavior (backoff spacing, jitter bounds from a seeded source, breaker transitions, token bucket refill); plan allocation without collisions; configuration derivation.
- Integration with real sockets: a two-node and a three-node topology show that timeout, retry count, backoff spacing, breaker transitions, queue rejection, concurrency limit, and ledger deduplication behave per configuration.
- Failure: port already in use, a worker that exits at startup, readiness deadline exceeded, teardown after a crash leaves no processes or ports.

Gate: the two- and three-node topologies run; each policy field demonstrably changes behavior in a test; teardown leaves zero stray processes or ports, including after a forced kill of the server.

Strict notes:
- No mocking of sockets or HTTP between nodes. The point is real network behavior.
- No generation of code from the model or from the topology. Behavior comes only from configuration.
- No hardcoded ports or timings. No sleep as a readiness check.
- Do not implement retries or the breaker with a third-party resilience library that hides the behavior being measured. The logic must be small, readable, and tested, because its behavior is the subject of the experiments.
- Do not use a web framework in the worker. Do not log per request.
- Do not block the worker event loop. No synchronous I/O, no CPU-burning loops to simulate work.
- Do not add node kinds the scenarios do not need.
- Do not let a node accept unbounded memory growth by accident. Unbounded queues are an explicit configuration, never a default.
- Do not let the control endpoints share the request path's concurrency limits.

Fallback: if one process per node is too heavy on the builder's machine, host several nodes in one process on separate ports, record the change and its measurement implications in `DECISIONS.md`, and keep real sockets.

---

### Phase 3: Fault injection, open-loop load, and trial measurement

Target: Oct 29 to Oct 30. Depends on: Phase 2. Touches: `contracts` (fault, load generator, trial result schemas), `modules/chaos`, `apps/loadgen`, `modules/sandbox` (load run handle), `modules/measurement` (metrics and aggregation), `apps/server/src/cli` (calibration).

Goal: run a single trial and N back-to-back trials with a real fault and get honest, validity-checked metrics.

Features:

1. `chaos`: Toxiproxy client behind a port; create one proxy per edge from the network plan; apply and remove toxics per `FaultSpec` with start offsets; verify the server version and the supported toxic list at startup and reject unsupported faults with a clear error; clean up proxies on every exit path.
2. `apps/loadgen`: the open-loop generator as its own process. Builds the entire arrival schedule from the seed before the run (constant spacing or seeded Poisson). Sends each request at its scheduled time regardless of outstanding responses, using the drift-corrected timer loop from 5.10. Streams one typed record per request (scheduled time, actual send time, completion time, status class, request id) to the control plane. Reports its own lag distribution and event loop delay. If it cannot keep up, or local resources are exhausted, the trial is marked INVALID, never quietly degraded.
3. `sandbox` load run handle: start and stop the generator process with the same lifecycle guarantees as workers; parse the record stream through the contract schema.
4. `measurement/domain` and `application`: every metric in 6.6 computed exactly from records and counters; trial validity rules (generator lag, worker event loop delay, node crashes, local resource exhaustion, interrupted trials); multi-trial aggregation as median and interquartile range; time series assembled for the UI. Verdict logic comes in Phase 4.
5. Trial lifecycle: warmup (discarded), measurement window, cooldown. Counters are read at window start and end so only the window is measured. Fresh seed per trial derived from the base seed.
6. Host calibration command line tool in `apps/server/src/cli`: measures the fault-free capacity of the host with a trivial topology at increasing arrival rates, records the knee, and writes the result to a calibration file referenced by scenarios and experiments. Scenario arrival rates must stay below a documented fraction of that capacity, and an experiment refuses to run if the requested rate exceeds it. The rate is a scenario parameter, not a constant in code.
7. Baseline comparison support: fault-free trials run first with the same schedule so baseline and faulted metrics are comparable.

Flow: topology and fault, plan, proxies, nodes, warmup, baseline trials, apply fault, faulted trials, collect, aggregate, teardown.

Tests:
- Unit: metric computations on hand-built records with known answers (percentiles, amplification, saturation, duplicates); aggregation uses median and interquartile range; the schedule is reproducible from a seed; latency from scheduled time differs from latency from actual send time in a test that induces generator delay.
- Integration: a three-node topology with a latency toxic shows a measurable p99 increase versus baseline across trials, with variance reported; a stalled-connection fault exhausts workers; removing the toxic restores baseline.
- Failure: Toxiproxy down, node crash mid-trial yields INVALID with reason, generator lag over the limit yields INVALID, local resource exhaustion yields INVALID, cancellation tears everything down.

Gate: Scenario 1 (retry storm, section 9) shows, over repeated runs, a clear and repeatable degradation under fault relative to baseline, with variance recorded in `docs/metrics.md`, the baseline stays healthy at the chosen arrival rate, and calibration results are recorded in `api-notes.md`.

Strict notes:
- No closed-loop generator. No generator that waits for a response before the next send. No `setInterval` scheduling.
- No latency measured from actual send time. This is the coordinated omission mistake.
- No subtracting timestamps from different processes.
- No discarding of trials that look bad. Invalid trials are reported as invalid with a reason.
- No averaging of percentiles. No percentile computed over samples pooled across trials as if from one trial.
- No unseeded randomness. Seeds are recorded in the run record.
- No fixed arrival rate baked into code to look impressive. The rate comes from the scenario and is checked against calibration.
- No running the generator in the server process or in a worker process.
- Do not claim packet loss. Describe what the toxic actually does.
- Do not run two experiments at once on the host.

Fallback: if the host is too noisy to separate effects, shorten and repeat trials, lower the arrival rate, and report the noise in `limitations.md`. If a requested toxic is unsupported, change the scenario, not the facts.

---

### Phase 4: Verdicts, experiments, runs, and the experiment API

Target: Oct 30. Depends on: Phase 3. Touches: `contracts` (experiment, verdict, run record, event schemas), `modules/measurement` (invariants and verdicts), `modules/runs`, `modules/experiments`.

Goal: an experiment is a first-class, stored, observable object with honest verdicts.

Features:

1. `measurement/domain`: invariant evaluation for each `InvariantSpec`: compute the per-trial metric, aggregate, and produce PASS, VIOLATED, INCONCLUSIVE, or INVALID per 6.7 with the evidence (per-trial values, median, interquartile range, threshold) and the baseline-must-be-healthy rule.
2. `runs`: the run record and its persistence. SQLite repositories and versioned migrations owned by the module; transactional writes; creating and finishing a run; appending events, trials, and artifacts; recording provenance (git commit, configuration hash, seeds, host description, Node version, Toxiproxy version, model ids and prompt versions where relevant); get and list; event replay in order. Collision-safe run ids.
3. `experiments`: the experiment use case that orchestrates sandbox, chaos, load runs, measurement, and runs; the single-experiment host lock; typed progress events (6.10); cancellation; guaranteed release of everything on every path; persisted partial results with the reason on failure or cancellation.
4. HTTP: the experiment endpoints and the run endpoints from 5.9, including server-sent events and event replay. A second start request while an experiment runs returns a busy problem. Controllers contain no business logic.
5. Public APIs: `experiments` exposes start, cancel, subscribe; `runs` exposes the record operations; both with typed results.

Flow: request, schema parse, topology validation, lock, run, events, persist, response; cancellation and failure paths persist partial results with the reason.

Tests:
- Unit: verdict logic for all four states with borderline cases, including an interquartile range that straddles the threshold and a baseline that already violates; run record assembly.
- Integration: end-to-end experiment through the API on a real sandbox, event stream order, persisted record completeness, reload and replay of events; migrations apply from empty and from the previous version.
- Failure: cancellation mid-trial, database write failure, busy lock, malformed request, a crash leaves the record marked failed with a reason.

Gate: Scenario 1 run through the API produces a stored record whose verdicts match hand calculation from the stored per-trial data, and a replayed event stream matches the original.

Strict notes:
- No always-PASS or always-VIOLATED shortcuts. INCONCLUSIVE and INVALID must be reachable and tested.
- No verdict computed in a controller, in `experiments`, or in the UI. Only `measurement/domain` decides.
- No storing of derived numbers that cannot be recomputed from stored trial data without also storing the inputs.
- No silent truncation of stored data.
- No module reads another module's tables.
- Do not queue concurrent experiments to hide contention.
- Do not invent run ids from counters or timestamps alone.

Fallback: if database contention causes trouble, serialize writes through one writer and record the decision.

---

### Phase 5: Repair agent, catalog, and the structured model adapter

Target: Oct 30 to Oct 31. Depends on: Phase 4 and a working open-weight provider from Phase 0. Touches: `contracts` (repair patch, trade-off, repair events), `modules/meta-ai` (structured model port and adapter), `modules/repair`.

Goal: a bounded, auditable loop in which the open-weight model proposes policy changes, code validates them, the sandbox measures them, and the loop accepts or rolls back.

Features:

1. `meta-ai`: a port for structured model calls (messages in, a contract-schema-validated object or a typed failure out) and an adapter for the partner-hosted Spark Open built on undici with explicit timeouts, bounded retries with backoff and jitter on transport errors, an optional single re-ask on malformed output that includes the validation error, and call metadata returned to the caller (provider, model id, prompt template version, latency, token counts if returned). Failure taxonomy: timeout, transport error, refusal, malformed output, schema mismatch. Keys never logged.
2. `repair/domain`: the operation catalog and bounds (drawing on the topology catalog), the pure patch validator with machine-readable rejection reasons, pure patch application returning a new topology, the telemetry summarizer producing a compact, factual, versioned text from an experiment result (measured values only, no instructions that could leak the expected answer), the accept or rollback decision logic using the same verdict results as everywhere else, the rule-based baseline repairer with explicit symptom-based heuristics, and the trade-off report builder (6.9).
3. `repair/application`: the repair loop with hard limits (maximum iterations, maximum model calls, wall-clock cap, maximum operations per patch). Each iteration: summarize, ask, validate, apply to a copy, call `experiments`, compare. Accept only if the targeted invariants improve and no previously satisfied invariant becomes violated. Otherwise roll back to the best accepted topology. Stop when all invariants pass, when limits are hit, or when the catalog is exhausted. A pluggable proposer so the model repairer and the rule-based baseline share the loop and the interface.
4. Structural operations in the catalog (insert a queue on an edge, give a route its own pool, change fallback mode) so the model has real design choices and not only number tuning.
5. Persistence of every iteration through `runs`: summary sent, raw model output, validation result, applied patch, measured result, accept or rollback decision, model call metadata.
6. `repair/http`: start, read, stream events, and cancel a repair session.

Flow: violated experiment, summary, model proposal, validation, apply, measure, decide, repeat or finish with report.

Tests:
- Unit: patch validator on valid, out-of-bounds, unknown target, structurally invalid, and oversized patches; accept and rollback decisions on constructed results including a patch that improves one invariant and breaks another; summarizer output on fixed inputs; rule-based repairer decisions.
- Integration: a scripted proposer (clearly labeled as test-only) exercises loop control, limits, rollback, and persistence; one live slow test runs the real model on Scenario 1.
- Failure: provider timeout, malformed output twice in a row, model proposes only invalid patches, model proposes a harmful patch that passes validation but fails measurement (must roll back), iteration limit reached, cancellation mid-loop.

Gate: on Scenarios 1 and 2 the loop reaches PASS or produces a truthful trade-off report using the real model, every iteration is persisted, and a forced bad proposal is rolled back in a test.

Strict notes:
- The model never writes code, shell commands, or file paths. Its only output is a patch matching the catalog schema.
- Nothing the model says is trusted. Bounds and structure are enforced in code.
- The loop must have hard limits. No open-ended "keep trying".
- Do not hardcode the known-good fix for any scenario anywhere, including in prompts, defaults, or the rule-based baseline. The baseline uses symptom-based rules, not scenario names.
- Do not tune naive defaults to make a scenario fail more dramatically than textbook defaults would.
- Do not let the prompt contain the expected failure label or the ground truth.
- Do not retry a rejected patch unchanged.
- Do not swallow a model failure and pretend no repair was needed. Report "model unavailable" as that.
- Do not let `repair` import `sandbox`, `chaos`, or `measurement`; it reaches measurement only through `experiments` results.
- Do not log API keys or full headers.

Fallback: if the open-weight host is rate limited, add request spacing and caching of identical telemetry summaries within a run, and record the effect. If structured output is unreliable, use constrained decoding if the host supports it, otherwise parse strictly and re-ask once.

---

### Phase 6: Benchmark suite and static-model baseline

Target: Oct 31. Depends on: Phase 5. Touches: `modules/benchmarks`, `apps/server/src/cli` (benchmark command), `benchmarks/`.

Goal: a reproducible, honest comparison that the README and video can rely on.

Features:

1. Scenario files, one per scenario, each containing the topology, fault, invariants, trial settings, and a written designed failure mode label (what failure the design is built to exhibit). Labels are written before any measurement and committed. See section 9. Scenario schemas live in `contracts`; loading and validation live in `benchmarks`.
2. Pre-registered static predictions. For each scenario, a fixed, versioned prompt gives the model only the topology and fault description and asks for a structured prediction: will each invariant be violated (yes or no), a numeric estimate for p99 and error rate, and the likely failure mode. Repeat K times per scenario to expose variance. Raw outputs are saved under `benchmarks/predictions/` and committed before the measured runs. The prompt is frozen once measurement begins.
3. Measured runs. Each scenario runs with five trials and the base seed recorded. Raw results saved under `benchmarks/results/`.
4. Repair comparisons. For each scenario that is violated, run the model repairer and the rule-based baseline from the same starting topology with the same limits. Optionally include a simple grid search over a small parameter set if time allows, to answer "why not just optimize".
5. Metrics computed by code, not by hand (in `benchmarks/domain`):
   - Violation prediction agreement between static prediction and measurement.
   - Magnitude error for numeric predictions (ratio of predicted to measured, reported as a distribution, not a single average).
   - Failure-mode label agreement.
   - Fix rate within the iteration limit for each repairer, number of iterations, regressions introduced, model calls, tokens, wall time.
   - Variance and INCONCLUSIVE counts.
6. Report generator. Writes `docs/benchmark-results.md` from raw results only: tables, per-scenario outcomes including failures and surprises, host description, seeds, model id, prompt versions, and a limitations section. The generated file states the date and commit.
7. One command (`pnpm benchmark`) reruns everything; partial reruns are supported per scenario.
8. `benchmarks/http`: read-only endpoints for scenarios and results, used by the UI.

Flow: scenarios, predictions saved, measurement, repair comparisons, generation of results, review by the builder.

Tests: report generator on small synthetic inputs with known expected output; scenario loader validation; a check that predictions exist and predate results by commit order or timestamp metadata; metric computations on hand-built inputs.

Gate: `docs/benchmark-results.md` regenerates from raw data with one command and contains no number that is not derived from that data. At least one scenario outcome the builder did not expect is reported as-is.

Strict notes:
- No hand-edited numbers anywhere in results or README. If a number needs to change, rerun.
- No cherry-picking runs. Keep all runs; report all trials and invalid ones.
- Do not re-prompt the static baseline until it looks worse. The prompt is frozen before measurement.
- Do not give the static baseline less information than the sandbox gets, and do not give it more.
- Do not report a single average where the spread matters.
- Do not describe designed labels as measured outcomes.
- Do not claim the static baseline fails if it did not. If it matched on the textbook cases, say so and show where measurement added value (magnitude, interaction effects, trade-offs).
- Do not invent expected numbers in the scenario files. Files contain designs and labels, never predicted results.

Fallback: if time is short, ship the six core scenarios with the model repairer and the static baseline, skip grid search, and say what was skipped.

---

### Phase 7: Web UI and live experience

Target: a thin slice may start after the Phase 4 gate (with the builder's approval), completing Nov 1. Depends on: Phases 4 and 5 APIs; benchmark data from Phase 6 for the results view. Touches: `apps/web` only (plus contract additions the API already defined).

Goal: a coherent interface where every number is real and the whole loop (draw, break, measure, repair, explain) is visible and operable.

Structure: follow 5.9. Feature folders `board`, `experiments`, `repair`, `benchmarks`, `runs` (vision, voice, and reports are added in their own phases), each with its own components, hooks, and local state and one `index.ts`. One typed API client in `src/api` that parses every response with contract schemas. Server-sent event consumption through one small hook that validates each event against the event schema.

Features:

1. Board view. A canvas for nodes and directed edges using React Flow. Create, move, rename, connect, and delete nodes and edges. Node and edge inspectors edit policy fields with the catalog bounds enforced in the form and re-validated by the backend. Naive default policies are applied to new edges and labeled as defaults. Validation problems from the backend are shown next to the offending element.
2. Scenario loader. Loads any scenario from the benchmark endpoints into the board so demos and tests are repeatable with real runs.
3. Experiment panel. Choose a fault (type, target edge, parameters, toxicity), set invariants, set trial settings, start, cancel. Shows trial k of n from the real event stream, live latency percentiles and error rate over time for the current trial, per-node saturation and queue depth, and per-edge retry amplification. Baseline and faulted results are shown side by side with interquartile ranges and trial counts.
4. Verdict display. Each invariant shows PASS, VIOLATED, INCONCLUSIVE, or INVALID as text, with the measured median, interquartile range, threshold, and for INVALID the reason.
5. Repair timeline. Each iteration shows the telemetry summary sent, the model's proposed patch with its rationale, the validator result, the applied diff of policy values on the topology, the measured before and after, and the accept or rollback decision. A final trade-off panel renders the trade-off report when present. Model id and iteration cost are visible.
6. Run history and record view. List past runs, open one, replay its events, export its JSON record.
7. Benchmark results view. Renders the generated results data with tables and per-scenario detail, linking to raw files. Reads generated data only.
8. State handling. Every view has loading, empty, error, busy (host lock), and cancelled states with plain explanations and a way to recover.
9. Accessibility and layout. Keyboard operation for all controls, visible focus, sufficient contrast, status never conveyed by color alone, a layout that works on a laptop screen and a 1080p recording.
10. Design system. One typeface family and one monospace for numbers, a small spacing scale, one accent color, consistent components. Design decisions go in `DECISIONS.md`. Pick the chart library here and record it.

Flow: load or draw a topology, validate, set fault and invariants, run, watch live, read verdicts, start repair, read the timeline, export.

Tests: component tests for state handling and verdict rendering from fixture payloads (labeled as fixtures, test-only); strict type checking; one Playwright flow (draw or load, run, view) against the real backend, marked slow; keyboard and contrast checks on the main flows.

Gate: the builder can complete the full flow from a scenario load to a repaired result in the browser, and every number on screen can be located in the stored run record.

Strict notes:
- No hardcoded sample metrics, charts, leaderboards, or "demo data" anywhere in components or the runtime path.
- No fake progress bars, spinners that hide real states, or animations that imply activity that is not happening.
- No client-side computation of verdicts or metrics. The UI renders what the backend returns.
- No generic gradients, glass panels, glow, stock illustrations, or emoji. No default component-library look left unconsidered.
- No giant single component files. No state management library unless a `DECISIONS.md` entry justifies it.
- No secrets, keys, or provider URLs in browser code.
- No color-only status.
- No imports from `apps/server`; only contract schemas and types are shared.
- No copy that overclaims. Use the language policy in 7.7.

Fallback: if the canvas editor consumes too much time, ship scenario loading plus a minimal editor for policy fields, and defer free-form drawing; the photo path in Phase 8 then becomes the input story.

---

### Phase 8: Vision ingestion (photo to topology) and the red-stroke gesture

Target: Nov 2 morning. Depends on: Phase 7 board, Phase 0 findings on image input and SAM. Touches: `contracts` (vision draft, gesture), `modules/meta-ai` (image reading and segmentation adapters), `modules/vision`, `apps/web/src/features/vision`.

Goal: turn a photo or screenshot of a hand-drawn architecture into a draft topology a human confirms, and let a red marker stroke select an edge to break.

Features:

1. Upload and validation (`vision/http` and `vision/infrastructure`). Accept common image types, enforce size and dimension limits, strip metadata, reject early with clear messages. Image bytes are processed with the image library and are not kept beyond the run record unless the builder enables it.
2. Draft extraction. The vision-capable model through `meta-ai` (Spark Open if image input works over the partner endpoint, otherwise the alternative recorded in Phase 0) reads the image and returns a structured draft: nodes with labels and a guessed kind, directed edges with source and target, approximate geometry in image coordinates, and per-element confidence plus a list of ambiguities (unreadable label, unclear arrow direction, overlapping shapes). The response is validated against the draft schema; failures are reported, not smoothed over.
3. Normalization through the `topology` public API (slug ids, collision handling, defaults, validation). `vision` does not reimplement topology rules.
4. Confirmation step in the web feature. The user sees the draft overlaid on the original image, with low-confidence and ambiguous elements marked in text, and edits or confirms before anything runs. Nothing runs from an unconfirmed draft.
5. SAM 3.1 shape support. Where Phase 0 confirmed it works, use SAM on the keyframe to get masks for boxes and for the red stroke, using a TypeScript parser written against the real recorded output format. Masks refine node geometry and locate the stroke. SAM is used on single keyframes only.
6. Red-stroke gesture (`vision/domain` for geometry). On a keyframe capture (button press, no live stream), locate the red stroke, reduce it to a polyline, and intersect it with edge polylines in the same image coordinate frame. Exactly one clear intersection selects that edge and proposes a fault on it, shown for confirmation. Zero or several intersections ask the user to choose. The camera must not move between the extraction frame and the gesture frame; if it did, the system re-extracts from the gesture frame and says so.
7. Deterministic fallback. A color-threshold red-stroke detector over raw pixel data exists from the start so the gesture works if SAM is slow or unavailable. The UI states which detector produced the result.
8. Extraction evaluation. The builder hand-labels about ten of their own diagrams. A script computes node precision and recall and directed-edge precision and recall, and writes the results next to the benchmark results with the same honesty rules. Include failures. Keep a small development set separate from the evaluation set.

Flow: upload, validate, extract, normalize, confirm, board; separately, keyframe, locate stroke, intersect, confirm fault.

Tests: geometry unit tests (segment intersection, polyline simplification, tie handling) with known answers; draft schema validation; SAM output parser against recorded real output (labeled, dated); color-threshold detector on real photos from the builder; oversized and malformed upload failures; model timeout and malformed output.

Gate: five of the builder's own diagrams go from photo to a confirmed, runnable topology, the red stroke selects the intended edge in a repeatable test photo, and the extraction evaluation is generated and committed even if the numbers are modest.

Strict notes:
- No live or continuous video processing. No frame-rate claims of any kind.
- Do not run chaos from an unconfirmed draft. Do not silently guess arrow direction or labels; surface the ambiguity.
- Do not tune the extraction prompt on the evaluation diagrams and then report them as unseen.
- Do not use SAM where a trivial deterministic check is enough and then claim SAM was essential. State plainly what each component does.
- Do not fabricate image fixtures; use real recorded outputs or the builder's own photos.
- Do not reimplement topology validation or normalization inside `vision`.

Fallback: if the photo read is unreliable, keep the confirmation step as the primary guard, narrow the claim to "draft extraction with human confirmation", and report the measured accuracy.

---

### Phase 9: Voice commands

Target: Nov 2. Depends on: Phase 7 and the Phase 0 voice findings. Touches: `contracts` (voice command, voice events), `modules/meta-ai` (speech adapter), `modules/voice`, `apps/web/src/features/voice`.

Goal: push-to-talk, single-speaker spoken commands that become validated, confirmed actions.

Features:

1. Push-to-talk capture in the browser. No always-on microphone. Audio goes to the backend over a WebSocket; the backend streams to the speech provider through `meta-ai` so no key reaches the browser. Audio is not stored by default. The direct socket client follows the protocol recorded in Phase 0.
2. Streaming transcript with partial and final results displayed as they arrive, with keyword biasing built from topology labels plus a fixed vocabulary of fault and metric terms, in the format the provider documents.
3. Intent parsing in `voice/application`. The final transcript is converted by the open-weight model (structured output constrained to a small command set) into a typed command: inject a fault on a named edge with parameters, set or change an invariant, run the experiment, start repair, cancel, or load a scenario. Name resolution in `voice/domain` is deterministic against current topology labels; ambiguity or no match produces a clarification message, never a guess.
4. Confirmation. The parsed command is shown in plain language and as typed fields, and requires an explicit confirm action. A setting to auto-confirm may exist but is off by default and visible. Confirmed commands execute through the same validated HTTP endpoints as the rest of the UI; `voice` never calls other modules to execute them.
5. Latency display. Show real timings for capture end to final transcript and transcript to parsed command.
6. Error states: no microphone permission, provider unavailable, empty transcript, unparseable intent, unsupported command. Each says what happened.

Flow: hold to talk, stream, transcript, parse, resolve names, confirm, execute through the UI's normal API path.

Tests: intent parser on recorded real transcripts (labeled, dated) including ambiguous and unsupported ones; name resolution; command validation reuses topology and fault validation; failure paths above; the socket bridge with a labeled fake speech provider for loop-control tests plus one live slow test.

Gate: five distinct spoken commands, including one ambiguous and one unsupported, produce correct confirmations or correct clarifications on the builder's machine.

Strict notes:
- No wake word. No always-on capture. No retained audio by default.
- No execution of a command that was not confirmed (unless the visible auto-confirm setting is on).
- No hardcoded transcripts or canned responses standing in for the provider.
- No speaker separation or multi-speaker features.
- No claims about accuracy or latency that were not measured on this system.
- Do not let the intent parser emit free text that is executed. Only the typed command set.

Fallback: if streaming is unreliable, use short utterances with a final-only transcript and say so.

---

### Phase 10: Report export and optional blueprint card

Target: Nov 2 to Nov 3, only if on schedule. Depends on: Phase 4, and optionally Phase 0 findings for Muse Image. Touches: `contracts`, `modules/meta-ai` (image generation adapter), `modules/reporting`, `apps/web/src/features/reports`.

Goal: a shareable artifact of a run that is truthful by construction.

Features:

1. Deterministic report (`reporting/domain`). A self-contained document generated only from the stored run record: topology, fault, invariants, baseline and faulted metrics with interquartile ranges, verdicts with reasons, the repair timeline with diffs, the trade-off report if any, and provenance (run id, seeds, host, model ids, prompt versions, commit). Also a JSON export of the same data.
2. Deterministic diagram. The topology and the before and after policy changes drawn as vector graphics from the data, with no model involved.
3. Optional blueprint card via Muse Image. A single request assembled from the run record with only numbers and labels that exist in it. If Phase 0 showed the code-execution option helps with precise layout, use it; if chained responses help iteration, use them for at most one refinement. The card is labeled as an illustrative rendering. Immediately beside it the UI shows the authoritative numbers from the run record.
4. Output check. Compare any text the image model rendered with the source strings where feasible; if the rendered text is wrong or garbled, retry once, and if still wrong, ship the deterministic diagram instead and say so.
5. Cost and time caps on the image call, with a clear failure message on timeout.

Flow: select a run, generate report, optionally generate card, download.

Tests: report content matches the run record field by field; a report generated twice from the same record is identical; image path failure handling (timeout, refusal, garbled text simulated at the boundary and labeled).

Gate: a report from a real repaired run opens offline, every number in it matches the stored data, and the card path either works or degrades visibly.

Strict notes:
- The image model never supplies facts. Anything it renders must exist in the run record.
- No numbers typed into prompts by hand. They come from the record.
- No pretending an illustrative image is evidence.
- No hidden fallback. If the deterministic diagram replaces the card, the UI says so.
- Do not spend more than one day on this phase.

Fallback: cut the card and ship the deterministic report. The card is first on the cut list.

---

### Phase 11: Packaging, documentation, demo, and submission

Target: Nov 3 to Nov 4 (feature freeze Nov 3 evening IST). Depends on: all shipped phases.

Goal: a stranger can run it, understand it, and trust its claims in minutes, and the submission is complete and early.

Features:

1. One-command run. `docker compose up` brings up Toxiproxy and the application (the server serves the built web assets and spawns the worker and load generator processes). Document host requirements and the calibration step. Verify from a fresh clone on a clean machine or clean container, including container-to-container addressing between the application and Toxiproxy.
2. README. Order: what it is; what it is not and its limitations; how it works in a short description with the generated module graph and the control plane versus data plane explanation; quick start; the benchmark summary with a link to the generated results and raw data; prior art (ChaosEater and others) and the wedge; exactly which components use which Meta models and via which host; what was built during the hackathon and when (with a pointer to commit history); dependency licenses. No marketing language.
3. Docs finished: `architecture.md` (with the regenerated graph), `metrics.md`, `contracts.md`, `limitations.md`, `DECISIONS.md` reviewed, `api-notes.md` current.
4. Cleanup pass. Remove dead code, unused dependencies, stray files, and any leftover TODO. Run the secret scan on the full history. Confirm `.env` is not tracked. Confirm `pnpm check`, `pnpm test:integration`, and `pnpm test:e2e` pass from a fresh clone.
5. Optional hosted instance. Only if everything else is done and stable. If hosted, rate limit it, keep keys server side, and label it as a hosted demo of the same code.
6. Demo video (3 minutes). Record raw footage progressively from Oct 31 onward. Final cut on Nov 3. Storyboard in section 11.
7. Submission. Follow the checklist in section 12. Submit early, then verify the submitted links from a logged-out browser.
8. Promotion for the viral and community prizes, only if the builder wants them: a short X post with the video, the repository link, and an honest one-sentence description; submit the post link through the platform as the rules require.

Tests: fresh-clone run of the full default checks and the slow integration tests; the README quick start executed step by step by someone who did not write it if possible.

Gate: all items in the section 12 checklist are done before Nov 4, 20:00 IST.

Strict notes:
- No new features after the freeze. Bug fixes only, each with a test.
- No claims in README, video, or posts beyond what the stored results support.
- No video segments that hide a failure by cutting. Editing for length is fine; fabrication is not. Show real timings and the run id on screen.
- Do not show or reuse any work that predates the event.
- Do not leave the repository private, the video link private, or a contributor unlisted.

---

## 9. Scenario set (designs, not results)

Core scenarios, in build order. Each is a design that is intended to exhibit a known anti-pattern. Measured numbers come only from runs.

1. Synchronous retry storm. A caller with several immediate retries and a long timeout, a downstream slowed by added latency with jitter. Designed to show retry amplification and worker exhaustion. Invariants: end-to-end p99, error rate, retry amplification.
2. Missing timeout cascade. A caller with no timeout on a dependency whose connections stall. Designed to show workers pinned and the failure spreading upstream. Invariants: completion rate, worker saturation upstream.
3. Unbounded queue. A producer faster than a throttled consumer with an unbounded queue. Designed to show queue growth without limit. Invariants: maximum queue depth, end-to-end latency. Report queue growth honestly; do not claim an out-of-memory crash unless a real memory limit was configured and the crash was observed.
4. Non-idempotent retry. A write path whose timeout is shorter than the downstream's occasional response time, retried without an idempotency key, with a ledger counting commits. Designed to show duplicate writes. Invariant: duplicate write rate.
5. Over-sensitive circuit breaker. A breaker with a very low threshold and window, with a small fraction of connections reset. Designed to show the breaker turning minor noise into outage. Invariants: completion rate, breaker open-time fraction.
6. Availability versus consistency trade-off. A synchronous dependency taken fully down where writes cannot be deferred. Designed so that no catalog change can complete the writes while a fail-fast policy can protect the upstream. Expected report is a trade-off report, not a PASS.

Optional if ahead of schedule: shared connection pool contention between a fast and a slow route; cache stampede after simultaneous expiry.

Rules for all scenarios: the fault-free baseline must be healthy at the chosen arrival rate; the arrival rate must be below the calibrated capacity; label and design are committed before any measurement; no scenario may rely on a behavior the runtime does not actually implement.

---

## 10. Schedule (IST), budgets, and gates

| Dates | Phase | Budget | Gate that must pass before moving on |
|---|---|---|---|
| Oct 27 evening to Oct 28 | 0 and 1 | about 1 day | Boundary check active; `api-notes.md` complete; six scenario fixtures validate |
| Oct 28 to Oct 29 | 2 | about 1 day | Two- and three-node topologies run with policies demonstrably effective and clean teardown |
| Oct 29 to Oct 30 | 3 | about 1 day | Scenario 1 shows repeatable degradation versus a healthy baseline, variance recorded |
| Oct 30 | 4 | about 0.75 day | Stored run records and verdicts match hand calculation; replay works |
| Oct 30 to Oct 31 | 5 | about 1 day | Real model repair loop works on Scenarios 1 and 2; rollback tested |
| Oct 31 | 6 (and thin UI slice after the Phase 4 gate) | about 1 day | `docs/benchmark-results.md` regenerates from raw data; at least one unexpected outcome reported honestly |
| Oct 31 to Nov 1 | 7 | about 1.25 days | Full browser flow works end to end |
| Nov 2 | 8 and 9 | about 1 day | Photo to confirmed topology on five diagrams; five voice commands confirmed |
| Nov 2 to Nov 3 | 10 (only if ahead) | about 0.5 day | Report exports truthfully |
| Nov 3 | Freeze, video | | Fresh-clone run passes; final video cut |
| Nov 4 | 11 submit | | Checklist complete by 20:00 IST |

This schedule is aggressive and assumes focused full-time work. Slip rule: if any phase exceeds its budget by half, stop, tell the builder, and apply the cut order in 4.3 or rescope the phase before continuing. If Phase 5 is not passing by Oct 31 midday, stop adding features and fix it, because the core agent and the benchmark depend on it.

---

## 11. Demo video storyboard (3 minutes, adjust to what actually works)

1. Problem in one sentence and one visual of a sketched design (0:00 to 0:15).
2. Draw or photograph the system and confirm the extracted topology (0:15 to 0:45).
3. Break an edge by voice or red stroke, show the live measured degradation with real timings and the invariant turning VIOLATED (0:45 to 1:25).
4. Repair loop: the model's proposal, validator, measured before and after, accept or rollback (1:25 to 2:00).
5. Benchmark slide with real generated numbers, including something the static prediction got right and something it got wrong (2:00 to 2:30).
6. The unfixable scenario and the honest trade-off report (2:30 to 2:50).
7. What was built during the hackathon, which Meta models are used where, and the repository link (2:50 to 3:00).

Rules: run id and trial counts visible on screen; no mocked footage; if a take fails, record again rather than edit around it. If voice, vision, or the card were cut, replace those beats with the canvas flow; do not mention cut features.

---

## 12. Submission checklist

- Repository is public, builds from a fresh clone, `.env` is untracked, secret scan clean.
- First commit is on or after Oct 27 and the history shows incremental work.
- README states limitations before results and credits prior art.
- `docs/benchmark-results.md` regenerated from raw data on the final commit; raw data committed.
- The module dependency graph in `docs/architecture.md` is regenerated and the boundary check passes on the final commit.
- Demo video is exactly the required length or shorter, accessible without login, and uses only work built during the event.
- All contributors are listed on the submission page.
- Meta credits claimed before the deadline; model usage section in README matches reality.
- Open-weight usage is described precisely (which model, which partner, which functions).
- Submission entered by the team representative before Nov 4, 20:00 IST, then re-opened and verified from a logged-out browser.
- Optional: X post submitted through the platform if pursuing the viral prize.

---

## 13. Risks and responses

| Risk | Early signal | Response |
|---|---|---|
| Node event loop or garbage collection distorts measurement | Generator lag or worker event loop delay near limits | Lower arrival rate, separate processes (already required), shorter trials, report the diagnostics, invalidate affected trials |
| Host noise hides fault effects | Large interquartile range in baseline trials | Lower arrival rate, longer or more trials, CPU limits in containers, report the noise |
| One process per node too heavy locally | Slow starts, memory pressure | Several nodes per process on separate ports with a `DECISIONS.md` entry |
| Open-weight host unavailable or rate limited | Phase 0 smoke failures | Switch partner host; add request spacing; escalate to the builder immediately |
| Model emits invalid patches | High rejection rate in Phase 5 | Constrained output if supported, one re-ask with the validator error, catalog simplification |
| Static baseline matches the sandbox on easy cases | Phase 6 agreement high | Report it; emphasize magnitude, interaction, and trade-off cases |
| SAM or image input not usable via API | Phase 0 notes | Deterministic red-stroke detector and confirmation-first extraction; narrow claims |
| Native image library fails to install on the builder's machine | Install errors in Phase 0 | Switch to a pure-JavaScript alternative and record it |
| Boundary rules slow the work | Frequent boundary failures | Fix the design, not the rule; ask the builder before amending 5.6 |
| Scope creep | Any work outside the current phase | Stop, note it in the phase report, ask the builder |
| Demo fails live | Flaky run in rehearsal | Judges watch the video; keep the live product stable with one-command start and fixed scenarios |
| Credits exhausted | Billing page | Cache identical summaries within a run, lower iteration limits, use the cheaper path for non-core calls |
| Late-night regressions | Failing fresh-clone run | Freeze on Nov 3, bug fixes only |

---

## Appendix A: Questions Phase 0 must answer in `api-notes.md` and `DECISIONS.md`

1. Which partner host and model id serves Spark Open for this account, and what are its rate limits?
2. Does the partner endpoint accept image input? Structured output? Tool calls? Which reasoning levels?
3. What is the exact SAM 3.1 request shape, authentication, and output format, in enough detail to write a TypeScript parser? What does it cost and how fast is it on one keyframe?
4. What are the voice endpoint, model id, audio format, message types, and keyword biasing format?
5. Do Muse Image's code-execution option and chained responses work as reported, and how legible is rendered text?
6. Does Muse Wonder accept images, which effort values are valid, and is it worth using for any step?
7. Which toxics does the installed Toxiproxy support, what exactly does each do, and how does the app address Toxiproxy on the builder's operating system?
8. Which Node LTS is pinned, and is the built-in SQLite module stable in it, or which driver replaces it?
9. Does the image library install cleanly on the builder's machine?
10. What are the host's calibrated limits (answered in Phase 3)?

## Appendix B: Phase report template (agent fills this at the end of every phase)

- Phase and date.
- Modules and apps touched.
- What was built (features, files).
- How it was tested (commands run, real output summarized, including `pnpm check`).
- Gate result: passed, failed, or partially passed, with evidence.
- What was not verified.
- Deviations from the plan and the reason; links to `DECISIONS.md` entries.
- Known issues and risks for the next phase.

## Appendix C: Session preamble to paste when starting a phase

"Read docs/plan.md sections 0 to 7 and Phase N. Do not read ahead. Restate the goal and gate. List the files you will touch. Write contract schemas and tests first where the phase defines contracts. Implement only Phase N. Create only the modules and folders this phase needs. Respect the module boundaries and layer rules in section 5 and run `pnpm check`. Do not invent API facts; use docs/api-notes.md. Obey the engineering charter, especially: no fabricated numbers, no silent fallbacks, no emojis, no placeholder data, no hardcoded ports, rates, model ids, or thresholds, typed validation at every boundary, explicit timeouts, guaranteed cleanup, no weakening of lint, boundary, or type rules. Run all checks and report real output. Finish with the phase report. Stop at the gate."

## Appendix D: Universal definition of done for any phase

- Contract schemas, fixtures, and `docs/contracts.md` updated together.
- `pnpm check` and the phase's slow tests pass from a clean checkout.
- Failure-path tests for the phase exist and pass.
- The boundary check passes and the generated module graph is current.
- No leftover TODOs, dead code, unused dependencies, or debugging output.
- Docs updated: contracts, metrics, decisions, api-notes, architecture as relevant.
- Phase report written and honest about what is unverified.
- The builder has run the phase by hand and agrees the gate passed.

## Appendix E: New module checklist

Before creating any module: confirm it appears in 5.4 and in the 5.6 matrix; create only the layers that hold code; export through `index.ts` only; define ports for anything touching I/O; keep tables and migrations inside the module; add its row to `docs/architecture.md` and regenerate the graph; add tests in the module's `tests` folder; confirm the boundary check passes with zero exceptions.
