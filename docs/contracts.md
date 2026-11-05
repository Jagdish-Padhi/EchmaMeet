# Contracts

The authoritative definitions are the zod schemas in `packages/contracts/src`. This page describes them in prose. Where the two disagree, the schemas win and this page is wrong; fix it in the same change.

## Rules

- Every boundary has a schema: HTTP requests and responses, events, worker and load generator messages, provider responses, files read from disk, and JSON database columns. Types are inferred from schemas and never written twice.
- Objects are strict. An unknown key is an error at every level.
- Identifiers are branded types (node, edge, topology, fault, invariant), so one kind of id cannot be passed where another is expected. Ids are lowercase slugs: a letter, then letters, digits, or hyphens, at most 40 characters (topology ids: at most 64, may start with a digit).
- Units are in field names (`timeoutMs`, `arrivalRateRps`).
- A breaking change updates the schemas, their valid and invalid fixtures, this page, and every consumer in one change.
- `packages/contracts` holds schemas, inferred types, and the catalog of numeric bounds. It holds no business rules; rules such as graph validity live in module `domain` folders.

## The catalog of numeric bounds

Defined once in `packages/contracts/src/catalog.ts`. This table is generated from that file by `pnpm docs:sync`, and `pnpm docs:check` (part of `pnpm check`) fails if it is stale.

<!-- catalog:start -->
| Setting | Minimum | Maximum |
|---|---|---|
| `topology.maxNodes` | | 12 |
| `topology.maxEdges` | | 24 |
| `topology.nameMaxLength` | | 80 |
| `topology.labelMaxLength` | | 60 |
| `node.maxWorkers` | 1 | 500 |
| `node.queueDepth` | 1 | 10000 |
| `node.processingMs` | 0 | 10000 |
| `node.lognormalSigma` | 0.01 | 2 |
| `node.ingressRateLimitRps` | 1 | 5000 |
| `node.cacheTtlMs` | 100 | 600000 |
| `node.consumeRateRps` | 1 | 5000 |
| `edge.timeoutMs` | 10 | 30000 |
| `edge.maxAttempts` | 1 | 6 |
| `edge.backoffBaseMs` | 0 | 2000 |
| `edge.backoffMultiplier` | 1 | 4 |
| `edge.maxBackoffMs` | 0 | 30000 |
| `edge.breakerFailureThresholdPct` | 5 | 100 |
| `edge.breakerWindowRequests` | 5 | 200 |
| `edge.breakerCooldownMs` | 100 | 30000 |
| `edge.breakerHalfOpenProbes` | 1 | 10 |
| `edge.poolMaxConnections` | 1 | 500 |
| `fault.latencyMs` | 1 | 30000 |
| `fault.jitterMs` | 0 | 30000 |
| `fault.stallHoldMs` | 1 | 600000 |
| `fault.resetAfterMs` | 0 | 60000 |
| `fault.slowCloseDelayMs` | 1 | 30000 |
| `fault.bandwidthKbPerSec` | 1 | 1000000 |
| `fault.dataLimitBytes` | 1 | 1000000000 |
| `fault.startOffsetMs` | 0 | 600000 |
| `trial.arrivalRateRps` | 1 | 5000 |
| `trial.warmupMs` | 0 | 60000 |
| `trial.measurementMs` | 1000 | 120000 |
| `trial.cooldownMs` | 0 | 30000 |
| `trial.clientTimeoutMs` | 100 | 60000 |
| `trial.trials` | 1 | 20 |
<!-- catalog:end -->

## Topology

A topology has a schema version (1), an id, a name, a source (`canvas`, `image`, or `scenario`), an entry node, nodes, and edges.

**Node.** Common fields: id, label, processing time (`constant` with `ms`, or `lognormal` with `medianMs` and `sigma`), concurrency (`maxWorkers`), queue (`bounded` with `maxDepth`, or `unbounded`), and an optional ingress rate limit (null means none). The `kind` selects extra fields:

| Kind | Extra fields |
|---|---|
| `service` | none |
| `cache` | `ttlMs` |
| `queue_consumer` | `consumeRateRps` |
| `ledger_sink` | `dedupeByKey` (whether it deduplicates writes by idempotency key) |

**Edge.** Id, source, target, mode (`sync_call` or `async_enqueue`), and a policy:

| Policy field | Meaning |
|---|---|
| `timeoutMs` | Request timeout. Explicit null means no timeout; it is never a default. |
| `retry` | `maxAttempts`, `backoffBaseMs`, `backoffMultiplier`, `maxBackoffMs`, `jitter` (`none`, `full`, or `equal`) |
| `breaker` | `enabled`, `failureThresholdPct`, `windowRequests`, `cooldownMs`, `halfOpenProbes` |
| `fallback` | `fail_fast_503`, `serve_stale_cache`, or `enqueue_for_later` |
| `idempotency` | `sendKey`: whether the caller sends an idempotency key |
| `pool` | `maxConnections` |

**Semantic rules (checked by the `topology` module, after the schema passes).** Unique node ids and edge ids. Edges connect existing nodes, never a node to itself, and at most one edge per ordered pair. The entry exists and is not a queue consumer. The graph is acyclic and every node is reachable from the entry. Asynchronous edges target queue consumers, and edges into a queue consumer are asynchronous. A ledger sink has no outgoing edges. Stale-cache fallback requires a cache source.

Every rule failure is reported as a problem with a stable code (`schema_violation`, `duplicate_node_id`, `duplicate_edge_id`, `unknown_edge_endpoint`, `self_loop`, `duplicate_edge_pair`, `unknown_entry_node`, `entry_is_queue_consumer`, `cycle_detected`, `unreachable_node`, `async_edge_target_not_consumer`, `consumer_requires_async_edge`, `ledger_has_outgoing_edge`, `stale_fallback_requires_cache_source`), a readable message, and the ids involved. Graph rules run only when the schema passes, and all violated graph rules are reported together.

## Topology draft

A loosely specified topology (from the canvas importer or from image extraction): a name, a source (`canvas` or `image`), nodes with a free-form `ref`, a label, and an optional kind, edges between refs with an optional mode, and an optional entry ref. Normalization produces a validated topology plus notes for everything it changed: `edge_dropped_unknown_endpoint`, `edge_dropped_self_loop`, `edge_dropped_duplicate_pair`, `node_id_collision_resolved`, `node_kind_defaulted`, `edge_mode_defaulted`, `entry_inferred`.

## Fault

Fault id, target edge, type, toxicity (greater than 0, at most 1), direction (`upstream` or `downstream`), start offset, and type-specific fields:

| Type | Fields |
|---|---|
| `latency` | `latencyMs`, `jitterMs` |
| `stall` | `holdMs` (null means stalled until the fault is cleared) |
| `connection_reset` | `afterMs` |
| `slow_close` | `delayMs` |
| `bandwidth_limit` | `rateKbPerSec` |
| `data_limit` | `maxBytes` |
| `dependency_down` | none; toxicity must be 1 |

The vocabulary is ChaosBoard's own. The `chaos` module maps it to Toxiproxy.

## Invariant

Id, metric, scope, comparator (`lt`, `lte`, `gt`, `gte`), and a non-negative threshold. The metric decides the scope kind:

| Metric | Scope |
|---|---|
| `e2e_p99_ms`, `e2e_error_rate`, `completion_rate` | system |
| `retry_amplification`, `breaker_open_fraction` | edge |
| `worker_saturation`, `queue_depth_max`, `duplicate_write_rate` | node |

## Trial configuration

Arrival rate, arrival process (`constant` or `poisson`), warmup, measurement window, cooldown, client timeout, an unsigned 32-bit seed, and the number of trials. Bounds are in the catalog.

## Health and problem details

`GET /api/health` returns `status` (`ok` or `degraded`), `service`, `nodeVersion`, and `checks.database`. Every API failure is RFC 9457 problem details (`application/problem+json`) with `type`, `title`, `status`, an optional `detail` and `instance`, a stable machine-readable `code`, and optional field-level `errors`.

## Network plan

A network plan allocates non-conflicting ports for nodes and proxies in a topology: schema version (1), `topologyId`, `nodes` (nodeId and port), and `edges` (edgeId and proxyPort). Ports are in the range 1024 to 65535.

## Node configuration

A single validated JSON document passed to `apps/worker` to configure a node process:
- `schemaVersion`: 1
- `nodeId`: id of the node
- `topologyId`: id of the topology
- `listenHost`: host address to bind (e.g. `127.0.0.1`)
- `listenPort`: port to bind (1024 to 65535)
- `node`: `TopologyNode` specification (kind, processing, concurrency, queue, ingress rate limit, and kind-specific fields)
- `outgoingEdges`: list of outgoing edges (`edgeId`, `targetNodeId`, `targetUrl`, `mode`, `policy`)
- `seed`: unsigned 32-bit integer for deterministic processing time and jitter
- `sampleIntervalMs`: sampling interval for queue depth and busy worker time series (10 to 5000 ms)

## Worker control and introspection

Endpoints exposed on the worker process on separate control paths (bypassing concurrency limits):
- `GET /control/status`: returns `WorkerStatus` (`status: 'ready'`, `nodeId`, `kind`, `listenPort`, `uptimeMs`, `eventLoopDelay` summary with min, max, mean, p50, p90, p99 ms)
- `GET /control/counters`: returns `WorkerCounters` (monotonic counters: `requestsIn`, `attemptsOut` by edge id, `retries`, `timeouts`, `errorsByClass`, `breakerTransitions` by edge id, `shedRequests`, `ledgerDuplicates`)
- `GET /control/series`: returns `WorkerSeries` (`nodeId`, `intervalMs`, `samples` with `timestampMs`, `queueDepth`, `busyWorkers`)
- `POST /control/reset`: resets counters and samples, returns `{ status: 'ok', resetAtMs }`
- `POST /control/shutdown`: initiates graceful shutdown, returns `{ status: 'shutting_down' }`

## Load generator contracts

Contracts for `apps/loadgen`:
- `LoadgenConfig`: configuration schema (`targetUrl`, `arrivalProcess`: `constant` or `poisson`, `arrivalRateRps`, `warmupDurationMs`, `measurementDurationMs`, `cooldownDurationMs`, `clientTimeoutMs`, `seed`, `requestIdPrefix`, `method`, `headers`, `body`).
- `LoadgenRecord`: per-request record streamed as JSON Lines (`requestId`, `phase`: `warmup`/`measurement`/`cooldown`, `scheduledOffsetMs`, `actualSendOffsetMs`, `completedOffsetMs`, `durationMs` from scheduled time, `sendLagMs`, `statusClass`, `httpStatus`, `errorClass`).
- `LoadgenSummary`: generator exit summary (`totalScheduled`, `totalSent`, `totalCompleted`, `totalTimeouts`, `totalErrors`, `actualDurationMs`, `sendLag` percentiles, `eventLoopDelay` summary).

## Trial results and aggregation

Contracts for trial metrics and multi-trial aggregation in `modules/measurement`:
- `TrialResult`: single trial outcome (`trialIndex`, `seed`, `validity`: `{ valid: boolean, reason: string | null }`, `metrics`: `p99LatencyMs`, `p50LatencyMs`, `completionRate`, `retryAmplification` per edge, `workerSaturation` per node, `maxQueueDepth` per node, `duplicateWriteRate`, `breakerOpenFraction` per edge; `diagnostics`: `generatorLag`, `generatorEventLoopDelay`, `workerEventLoopDelays` per node, `totalScheduledRequests`, `totalCompletedRequests`).
- `TrialAggregate`: multi-trial aggregation (`trialsCount`, `validTrialsCount`, `invalidTrialsCount`, `invalidReasons`, `metrics`: median, p25, p75, and IQR for every metric across valid trials). Percentiles are never averaged across trials; medians and IQRs are computed over per-trial values.

## HTTP endpoints implemented so far

| Method and path | Purpose |
|---|---|
| `GET /api/health` | Server status with a real database check |
| `POST /api/topologies/validate` | Validate a topology. Returns `{ valid: true, topology }` or `{ valid: false, problems }` with status 200; a malformed body is a 400 problem. |

Further endpoints are listed in section 5.9 of `docs/plan.md` and are added by the phase that builds them.
