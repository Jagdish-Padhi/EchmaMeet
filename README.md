# ChaosBoard

Design-time chaos testing. Draw a system, break it on purpose, measure what happens, and repair the design with changes that are validated and re-measured, not just described.

Built for the Meta Global AI Developer Hackathon.

---

## What it is, and what it is not

ChaosBoard turns a sketch or diagram of a distributed system into real processes that communicate over real TCP/HTTP sockets, injects network and hardware faults between them using Toxiproxy under open-loop synthetic load, and checks stated architectural invariants against empirical measurements.

An open-weight Meta model proposes resilience repairs from a bounded, typed catalog of resilience policies. Code validates every proposal, the sandbox measures it across repeated trials, and the repair loop keeps a change only if empirical measurements improve without creating new invariant violations. When a design cannot be repaired within the catalog bounds, it reports the measured trade-off.

### What it is not:

- **It does not test your real production system.** The sandbox runs stand-in worker services configured from your topology. It exercises resilience policies (timeouts, retries, exponential backoff, jitter, connection pools, queues, circuit breakers, rate limits, idempotency keys, fallbacks). It does not simulate database internals, custom business logic, the kernel, or a physical multi-datacenter network.
- **It does not prove correctness.** It reports empirical results over a stated number of trials with medians and interquartile ranges (IQR). It marks verdicts as `INCONCLUSIVE` or `INVALID` when noise or event-loop lag invalidates a trial.
- **Results come from real hardware.** Before and after comparisons on the same host are statistically sound; absolute millisecond figures belong to the benchmarked machine.

See [`docs/limitations.md`](docs/limitations.md) for the full charter and limitations.

---

## System Architecture

ChaosBoard is structured into an explicit **control plane** and an isolated **data plane**:

1. **Control Plane (`apps/server`)**: A modular monolith with strictly enforced architectural boundaries (`apps/server/src/modules/`). Each module contains domain logic, application use cases, infrastructure adapters, and HTTP controllers. Enforced with Dependency Cruiser and zero exceptions.
2. **Data Plane (`apps/worker`, `apps/loadgen`)**: Lightweight, standalone Node.js programs spawned as isolated operating-system processes. They communicate strictly over real sockets and have no access to the server's platform or persistence code.
3. **Web User Interface (`apps/web`)**: A responsive React 19 application built with a zero-dependency SVG topology canvas, real-time telemetry streaming over Server-Sent Events (SSE), push-to-talk voice bridge, whiteboard photo ingestion, and artifact export.
4. **Typed Contracts (`packages/contracts`)**: Pure Zod schemas and TypeScript types shared across the monorepo. Every boundary enforces runtime validation.

The complete dependency graph is regenerated automatically and verified in [`docs/architecture.md`](docs/architecture.md).

---

## Meta Model Usage Disclosure

ChaosBoard integrates Meta open-weight and multimodal models with deterministic fallback mechanisms:

| Capability | Meta Model | Host / Provider | Fallback When Unconfigured |
|---|---|---|---|
| **Autonomous Repair Proposer** | Meta Spark Open (`meta-models/muse-spark-open-1026`) | OpenAI-compatible endpoint (Baseten, Fireworks, Together, or local vLLM) | Deterministic rule-based proposer with symptom heuristics |
| **Voice Intent Parser** | Meta Spark Open | Streaming WebSocket bridge | Deterministic regex / token intent parser |
| **Whiteboard Segmentation** | Meta SAM 3.1 | Meta Model API (`/v1/models/sam-3.1`) | Pure TypeScript color-threshold detector ($R > 130, G < 110, B < 110$) |
| **Blueprint Card Rendering** | Meta Muse Image | Meta Model API (`/v1/models/muse-image`) | Pure deterministic vector SVG diagram generator |

---

## Benchmark Suite Summary

ChaosBoard was evaluated across six canonical distributed failure scenarios in `benchmarks/scenarios/`:

1. **Synchronous Retry Storm**: Cascading worker exhaustion caused by immediate retries under downstream delay.
2. **Missing Timeout Cascade**: Upstream threads pinned by stalled downstream dependencies.
3. **Unbounded Queue**: Memory and latency bloat from unconstrained producer-consumer rate mismatch.
4. **Non-Idempotent Retry**: Duplicate ledger commits caused by aggressive client timeouts.
5. **Over-Sensitive Circuit Breaker**: Premature outage triggered by noisy transient resets.
6. **Availability vs. Consistency Trade-off**: Network partition where fail-fast protection compromises availability.

All scenarios and empirical measurements are committed in [`docs/benchmark-results.md`](docs/benchmark-results.md).

---

## Quick Start

### Option 1: One-Command Docker Compose

Prerequisites: [Docker Desktop](https://www.docker.com/) or Docker Engine with Docker Compose.

```bash
# Clone the repository
git clone https://github.com/your-username/chaosboard.git
cd chaosboard/infra

# Launch Toxiproxy and ChaosBoard
docker compose up
```

Access the application in your browser at `http://localhost:3000`.

### Option 2: Local Development

Prerequisites: Node.js 22.13+ and pnpm 12.13.0 (`npm install -g pnpm@12.13.0`).

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment template
cp .env.example .env

# 3. Verify all checks pass (typecheck, lint, boundaries, graph, unit tests)
pnpm check

# 4. Run development servers (API server on :8787, Web on :5173)
pnpm dev
```

---

## Key Commands

| Command | Description |
|---|---|
| `pnpm check` | Runs full typecheck, lint, boundary checks, graph verification, and unit tests |
| `pnpm test:integration` | Runs end-to-end integration tests with real sockets, sandboxes, and Toxiproxy |
| `pnpm dev` | Starts server and web development servers concurrently |
| `pnpm calibrate` | Calibrates local host capacity and measures event-loop noise threshold |
| `pnpm benchmark` | Executes the 6-scenario benchmark suite and regenerates `docs/benchmark-results.md` |
| `pnpm boundaries` | Verifies strict architectural layer rules using Dependency Cruiser |
| `pnpm graph` | Regenerates the architecture Mermaid graph in `docs/architecture.md` |

---

## License

This project is licensed under the [MIT License](LICENSE).
