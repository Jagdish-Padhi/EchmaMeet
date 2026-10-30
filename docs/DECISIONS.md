# Decisions

Every non-obvious choice, with the reason and what was rejected. Newest decisions go at the bottom of their section. A decision that changes a contract or a module boundary also updates `docs/plan.md` in the same change.

## Architecture and structure

**Modular monolith plus a data plane.** One server application organized into capability modules with enforced boundaries, and a small set of test-subject processes (workers, load generator, Toxiproxy). Rejected: microservices for the control plane, because nothing in this product needs independent deployment and the boundary rules give the same separation at a fraction of the cost.

**Boundaries are enforced by tooling, not convention.** `.dependency-cruiser.cjs` is generated from `tools/architecture/module-matrix.json` and the layer rules in plan section 5. `tools/architecture/boundaries.test.ts` builds a throwaway source tree that breaks each rule once and fails if a rule stops firing. Rejected: a lint-only approach, which cannot see cross-package structure.

**Modules are organized by capability, then by layer.** `domain`, `application`, `infrastructure`, and `http` folders appear only when they carry code. Rejected: a flat models, views, controllers split, which groups by technical role and hides the capability boundaries. `domain` is the "models" role and `http` is the "controllers" role.

**Composition lives outside modules.** `src/main.ts` (process entry), `src/app.ts` (HTTP composition), and later `src/cli/` are the only files that know which modules exist. `platform/` never imports a module.

**Platform access is narrow.** Module `http` layers may use `platform/http-kit.ts` only, `infrastructure` layers may use `platform/db.ts` only, and `domain` and `application` use no platform code. Configuration reaches modules as arguments from the composition root; modules never read environment variables.

**Sandbox module hexagonal boundary.** `apps/server/src/modules/sandbox` defines `WorkerProcessSupervisorPort`, `WorkerControlClientPort`, and `SandboxHandle` in its `application/ports.ts`. `application/sandbox-service.ts` imports neither Node child process primitives nor HTTP clients. Concrete adapters live in `infrastructure/` and are wired exclusively in `index.ts` (module composition root). This satisfies the `application-does-not-import-edges` architecture rule.

**Cross-process tree termination.** On Windows, standard `process.kill(pid)` signals only the direct child and can leave spawned sub-processes active. The sandbox supervisor terminates processes via `taskkill /pid <PID> /T /F` on Windows and detached process groups (`kill(-pid, 'SIGKILL')`) on Unix, verifying death via `process.kill(pid, 0)` checks with timeout deadlines to ensure no stray processes or orphaned ports remain.

**Load generator open-loop design (`apps/loadgen`).** Pre-computed arrival schedule (constant or Poisson) seeded for determinism, drift-corrected high-resolution monotonic timer loop (`process.hrtime.bigint()`), and asynchronous non-blocking request dispatch. Measuring duration from scheduled offset (`completedNs - targetNs`) rather than actual send time eliminates coordinated omission.

**Toxiproxy container-to-host routing on Docker.** The Toxiproxy control API is contacted at `127.0.0.1:8474`. Proxies listen on `0.0.0.0:<proxyPort>`. When running in Docker on Windows/Mac, upstream worker destinations on the host use `host.docker.internal:<nodePort>`.

**Cross-module integration tests live in `apps/server/tests/`.** Tests that integrate multiple server modules (e.g. `sandbox` + `chaos` + `measurement` + `topology`) live in `apps/server/tests/`, preserving module isolation inside `src/modules/` where depcruise enforces that modules cannot import one another outside the allowed module matrix.

## Language, runtime, and tooling

**TypeScript everywhere, strict.** One language for contracts, server, worker, load generator, and web, so a schema is written once and validates every boundary. Rejected: a Python backend (a second type system and a second contract definition), and Go for the load generator (a new language during a seven-day build).

**Node version policy.** `engines` is `>=22.13.0` and `.nvmrc` is `22`. The floor comes from the pinned tools: Vitest 5 needs `^22.12 || ^24 || >=26`, ESLint 10 needs `^22.13 || >=24`. The scaffold was verified on Node 22.22.2. Newer versions are expected to work but were not tested here.

**pnpm 12.13.0 with an explicit build policy.** pnpm 12 refuses to install when a dependency has an unreviewed build script. esbuild's install script only verifies a prebuilt binary that ships as an optional dependency, so `allowBuilds: esbuild: false` is set in `pnpm-workspace.yaml`. Revisit if a later phase adds a dependency that genuinely needs a build step (for example an image library with native code).

**TypeScript 6.0.3, not 7.x.** typescript-eslint 8.71.2 declares a peer range below 6.1.0, so TypeScript 7 would break type-aware linting. Revisit when typescript-eslint supports it.

**Dependency pinning rule.** Exact versions, committed lockfile, and the newest stable release at least 14 days old when checked on Oct 28, 2026. Pinned: typescript 6.0.3, eslint 10.12.0, @eslint/js 10.0.1, typescript-eslint 8.71.2, eslint-plugin-react-hooks 7.1.1, prettier 3.9.10, vitest 5.0.4, tsx 4.23.15, dependency-cruiser 18.6.0, globals 17.13.0, zod 4.6.7, fastify 5.12.7, pino 10.4.0, react and react-dom 19.3.0, vite 8.3.4, @vitejs/plugin-react 6.1.2, undici 8.11.2.

**Undici 8.11.2 pinned for worker HTTP client.** Published Sep 24, 2026. Selected for `apps/worker` to enforce exact per-edge connection pool limits (`new undici.Pool(origin, { connections: pool.maxConnections })`) alongside standard `AbortSignal` timeouts and circuit breaker integration. Node's global `fetch` does not permit configuring fixed per-origin connection pool sizes.

**`@types/node` 22.x.** Typings match the runtime floor, so code cannot accidentally use an API that does not exist on Node 22.

**Workspace packages export TypeScript source.** `packages/*` point their `exports` at `src/index.ts`. Development and tests run through tsx and Vite, and type checking uses Bundler module resolution, so relative imports are extensionless. A production build (bundling the server and the data plane programs with a bundler) is a Phase 11 decision.

**Environment files use Node's own flag.** Scripts run with `--env-file-if-exists=<path to .env>`, so no dotenv dependency is needed. Configuration is parsed once, in `platform/config.ts`.

**No CORS.** In development Vite proxies `/api` to the server, so the browser only ever talks to its own origin. In production the server will serve the built web assets (Phase 11). No cross-origin access is configured.

## Persistence

**SQLite through `node:sqlite`.** Built into Node, so there is no native build to fail on a contributor's machine. It prints an ExperimentalWarning on Node 22. All use goes through `platform/db.ts`, so swapping to a driver such as better-sqlite3 touches one file. Rejected: MongoDB, because run records are append-only and queried by id, and a database server would complicate the one-command start.

**Rows are untyped at the database boundary.** `SqlDatabase.get` and `all` return `Record<string, unknown>`; repositories parse rows with a schema. This matches the rule that every boundary is parsed.

**Migrations are per module.** Versioned SQL, applied in module dependency order by `platform/migrations.ts`, each in its own transaction, with a check that an applied migration was not renamed.

## Contracts and domain

**One catalog of bounds.** `packages/contracts/src/catalog.ts` defines every numeric bound as data. Schemas, validators, the repair patch validator, and the UI read it. Bounds added beyond the plan's first list: maximum backoff 0 to 30,000 ms, half-open probes 1 to 10, lognormal sigma 0.01 to 2, processing time 0 to 10,000 ms, cache TTL 100 to 600,000 ms, consume rate 1 to 5,000 per second, and topology limits of 12 nodes and 24 edges.

**Schemas are strict.** Unknown keys are rejected at every level, so a typo in a policy field is an error and not a silent no-op.

**Idempotency is split cleanly.** An edge only says whether the caller sends an idempotency key. Whether a target deduplicates is a property of the ledger node (`dedupeByKey`). The plan's earlier "target deduplicates" on the edge duplicated that fact.

**Fault vocabulary is ChaosBoard's own.** `latency`, `stall`, `connection_reset`, `slow_close`, `bandwidth_limit`, `data_limit`, `dependency_down`. The `chaos` module (Phase 3) maps them to Toxiproxy toxics. Parameter names do not mirror Toxiproxy attributes, so the contract survives a change of fault injector.

**Extra invariant metric.** `breaker_open_fraction` (per edge) was added because scenario 5 needs it.

**Version 1 topology rules.** Acyclic; at most one edge per ordered pair of nodes (two edges would make a single toxic ambiguous); asynchronous edges must target a queue consumer and edges into a queue consumer must be asynchronous; a ledger sink has no outgoing edges; stale-cache fallback requires a cache source; the entry cannot be a queue consumer. Route classes (needed only by the optional shared-pool scenario) are deferred.

**Naive defaults.** Edge: timeout 5000 ms, three attempts, no backoff, no jitter, breaker disabled, fail fast 503, no idempotency key, pool of 50. Node: constant 20 ms processing, 20 workers, bounded queue of 500, no rate limit, cache TTL 30 s, consume rate 100 per second, ledger deduplication off. They are textbook starting values and are not tuned to make any scenario fail more dramatically.

**Draft normalization never guesses silently.** Dropped edges, resolved id collisions, defaulted kinds, defaulted asynchronous modes, and an inferred entry each produce a note. Duplicate node references and an ambiguous entry are errors.

## Smoke tests

**Scripts test hypotheses and record what happened.** The Spark Open script uses the OpenAI-compatible chat completions convention the guide describes, labeled as a hypothesis. Capabilities whose request shape must come from provider docs (SAM, Muse Image, Muse Wonder, Muse Voice Transcribe) use generic probe files that the builder writes from the docs, so no request shape is invented. Recordings go to `.smoke-output/` (git-ignored), are redacted, and are reviewed by hand before anything is copied into `docs/api-notes.md` or committed as a fixture.

## Experiment orchestration and storage (Phase 4)

**Single-host mutual exclusion lock.** A node process may only run one active experiment at a time to prevent port collisions, cross-talk in Toxiproxy, and resource contention on worker processes. Concurrent requests receive an HTTP 409 Conflict with RFC 7807 Problem Details (`code: "experiment_busy"`).

**The baseline-must-be-healthy rule.** If an invariant condition is violated during the un-faulted baseline run, the invariant verdict evaluates to `INVALID` with a detailed evidence explanation rather than reporting false chaos violation.

**Strict 4-state verdict evaluation.** Invariant verdicts evaluate strictly to `PASS`, `VIOLATED`, `INCONCLUSIVE` (when the interquartile range straddles the threshold), or `INVALID` (if baseline is unhealthy or zero valid trials completed).

**Transactional SQLite run and event persistence.** Runs and strictly monotonic event sequences are recorded transactionally with SQLite v1 migrations. Replaying events from `/api/runs/:id/events` yields the identical historical SSE event stream.

## Repair agent, catalog, and model adapter (Phase 5)

**Pure patch validation against catalog bounds.** All repair operations (`set_timeout`, `set_retry`, `set_circuit_breaker`, `set_fallback`, `set_edge_mode`, `set_concurrency`, `set_queue`, `set_ingress_rate_limit`) are validated purely against the frozen catalog bounds and the current topology structure before application. Disallowed operations (such as non-existent nodes/edges, unbounded queues on rate-limited nodes, or values outside catalog limits) reject immediately with structured issue details without mutating topology.

**Pareto improvement decision rule for rollback protection.** Candidate patches are measured against real experiment trials. A patch is accepted if and only if:
1. No previously passed invariant regressed to violated or invalid status.
2. At least one targeted invariant transitioned to PASS or moved closer to its threshold.
Otherwise, the orchestrator rolls back immediately to the previous best topology.

**Single structured model re-ask on schema validation failure.** If the structured LLM adapter encounters invalid JSON or schema validation mismatch, it issues a single automatic re-ask payload containing the specific validation issues before reporting a failure.

**Deterministic fallback rule-based proposer.** In rule-based mode, the proposer selects pure symptom-based heuristics (capping retries under retry storm, adding exponential backoff with full jitter, enabling circuit breakers, scaling worker pools) without scenario name leakage.

**Lock orchestration between sequential experiment iterations.** Because experiment teardown cleans up sandboxes and resets Toxiproxy toxics asynchronously, the repair orchestrator waits for `isBusy() === false` before launching subsequent iterations, preventing concurrency lock collisions.

## Benchmark suite and static-model baseline (Phase 6)

**Pre-registered static predictions committed before empirical runs.** Static predictions for all six core scenarios are captured with frozen prompt version `prediction-v1` and persisted under `benchmarks/predictions/<scenarioId>.json`. They record violation forecasts, numeric p99 and error rate predictions, and failure mode hypotheses prior to empirical measurement to prevent cherry-picking.

**Pure domain agreement and magnitude error calculation.** The static baseline is evaluated against real empirical sandbox trials in `benchmarks/domain/metrics.ts`. Violation agreement is measured per invariant; magnitude errors are expressed as distribution ratios (`p99Ratio = predicted / measured`) rather than misleading single averages; and failure modes are token-matched.

**Truthful report generation strictly from stored runs.** `docs/benchmark-results.md` is produced directly by `generateBenchmarkReport(suiteSummary)` from raw run data. It contains no hand-coded or fabricated numbers, records host hardware and commit metadata, reports surprises (such as order-of-magnitude prediction divergence under cascading timeouts), and documents system limitations plainly.

**Workspace root discovery for benchmark assets.** `FileBenchmarkStorage` locates the workspace root via parent traversal for `pnpm-workspace.yaml`. This guarantees consistent reading and writing of `benchmarks/scenarios`, `benchmarks/predictions`, and `benchmarks/results` across server dev, CLI (`pnpm benchmark`), and Vitest test runners.

## Web UI, design system, and live experience (Phase 7)

**Zero-dependency, accessible SVG telemetry and canvas architecture.** Instead of adding heavyweight third-party graphing libraries (such as Recharts or Chart.js) or external canvas dependencies with React 19 peer-dependency risks, ChaosBoard uses custom pure SVG/CSS components (`LiveTelemetryChart`, `BoardCanvas`). Real percentile points (p50, p95, p99) and error rates map directly to SVG paths without artificial smoothing or synthetic animations.

**Contract-enforced API client and SSE stream consumer.** `createApiClient` in `apps/web/src/api/client.ts` parses every HTTP response through its Zod contract schema; schema violations or RFC 9457 problem details reject with typed errors. Server-sent events (`/api/experiments/:id/events` and `/api/repairs/:id/events`) are validated by `subscribeToRunEvents` using `runEventSchema`, guaranteeing the UI never displays corrupted or ungrounded data.

**Design system and accessibility charter.** One sans-serif font stack, one monospace stack for numbers and identifiers, a small spacing scale, single warm amber accent (`#b45309`), high-contrast dark slate text (`#0f172a`), visible keyboard focus rings (`2px solid #2563eb`), and status indicators that never convey state by color alone (always distinct text label + semantic border/icon).

**No client-side derivation of metrics or verdicts.** The UI acts as a pure renderer for backend contracts. Invariant verdicts, percentile aggregates, Pareto trade-off frontiers, and agreement metrics are computed solely by server domain modules.

## Open decisions

**License.** A public repository is required. Choose a license before submission. This was left to the builder on purpose.
