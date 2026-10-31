<div align="center">

# Resilio (ChaosBoard)

**Autonomous Design-Time Chaos Engineering & Architecture Resilience Platform**

_Draw distributed systems, inject real physical network chaos, verify declarative invariants under open-loop synthetic load, and autonomously heal architectural vulnerabilities using Meta AI._

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%20%7C%206.x%20Strict-blue?logo=typescript&logoColor=white)](tsconfig.base.json)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.13.0-green?logo=node.js&logoColor=white)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-12.13.0-orange?logo=pnpm&logoColor=white)](pnpm-workspace.yaml)
[![React](https://img.shields.io/badge/React-19.3.0-61dafb?logo=react&logoColor=black)](apps/web/package.json)
[![Fastify](https://img.shields.io/badge/Fastify-5.12.7-white?logo=fastify&logoColor=black)](apps/server/package.json)
[![Toxiproxy](https://img.shields.io/badge/Chaos%20Engine-Shopify%20Toxiproxy%202.13-red)](https://github.com/Shopify/toxiproxy)
[![Architecture Enforcement](https://img.shields.io/badge/Architecture-Dependency%20Cruiser%20Strict-purple)](.dependency-cruiser.cjs)
[![Meta AI Hackathon](https://img.shields.io/badge/Meta%20AI-Muse%20Wonder%20%7C%20Spark%20%7C%20SAM%203.1-0081FB?logo=meta&logoColor=white)](https://dev.meta.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

[Key Capabilities](#key-capabilities) • [System Architecture](#system-architecture) • [Meta AI SRE & Multimodal Integration](#meta-ai-sre--multimodal-integration) • [Benchmark Suite](#benchmark-suite) • [Quick Start](#quick-start) • [Configuration](#configuration) • [Developer Commands](#developer-commands) • [Limitations & Soundness](#limitations--soundness)

</div>

---

## Executive Overview

Distributed system failure modes—such as cascading retry storms, thread exhaustion under latency spikes, queue memory bloat, and premature circuit breaker trips—are notoriously difficult to detect before production. Static linters cannot capture runtime socket dynamics, while staging environments are high-friction, costly, and rarely subjected to destructive chaos testing.

**Resilio** bridges this gap by bringing **physical chaos engineering directly into design time**:

1. **Draw or Scan**: Architects design system topologies on an interactive SVG canvas or ingest napkin sketches and whiteboard photos via Meta SAM 3.1 computer vision.
2. **Materialize**: Resilio provisions standalone Node.js operating-system processes (`apps/worker`) communicating over real loopback TCP/HTTP sockets with Shopify Toxiproxy inline on every edge.
3. **Stress & Break**: An open-loop synthetic load generator (`apps/loadgen`) dishes monotonic drift-corrected Poisson/constant request schedules, while Toxiproxy injects latency, jitter, connection drops, and bandwidth throttling.
4. **Evaluate Invariants**: Declarative architectural contracts (e.g., end-to-end $p_{99} \le 500\text{ ms}$, completion rate $\ge 99\%$, zero duplicate commits) are evaluated across repeated trials with statistical medians and interquartile ranges (IQR).
5. **Autonomously Heal**: When an invariant is violated, Meta AI models (Muse Wonder 1.0, Muse Spark 1.3) analyze raw telemetry, diagnose root causes, and propose targeted resilience repairs from a bounded, typed catalog (adaptive timeouts, exponential backoff with jitter, half-open circuit breakers, queue high-water marks, idempotency tokens).
6. **Empirically Verify**: Resilio re-executes the chaos experiment in the real sandbox. A repair is accepted **only if** empirical measurements improve and no secondary invariants break.

---

## Key Capabilities

### ⚡ Physical Sockets & Real Operating System Processes

Resilio is **not a discrete-event mathematical simulation**. It spawns real Node.js processes on the operating system. Inter-service traffic traverses physical TCP sockets, exercises Node's HTTP networking stacks (powered by pinned `undici`), allocates real memory buffers, and experiences true operating system scheduling and garbage collection.

### 🎯 Open-Loop Load Generation (Zero Coordinated Omission)

Traditional closed-loop benchmarking tools artificially under-report tail latency by waiting for prior responses before dispatching the next request ("coordinated omission"). Resilio's `apps/loadgen` uses a high-resolution monotonic timer loop (`process.hrtime.bigint()`) with drift compensation. It calculates duration from scheduled offset ($\text{completedNs} - \text{targetNs}$), capturing authentic queue bloat and latency cascades.

### 🤖 Autonomous Meta AI SRE Copilot & Empirical Repair Loop

- **Multi-Turn Diagnosis**: Ingests telemetry, error codes, and invariant metrics to hypothesize root-cause failure mechanisms.
- **Typed Catalog Bounds**: Proposals strictly conform to `packages/contracts/src/catalog.ts` (e.g., maximum backoff $\le 30{,}000\text{ ms}$, circuit breaker trip thresholds $1\text{--}100$). The model cannot inject arbitrary code.
- **Re-Measurement Verification**: Before/after differential reports prove whether an invariant was restored. If the trade-off is insurmountable (e.g. CAP theorem partition), Resilio provides an honest trade-off analysis.

### 👁️ Whiteboard & Diagram Computer Vision (Meta SAM 3.1)

Architectural reviews frequently start on physical whiteboards. Resilio allows uploading or photographing sketches:

- Meta SAM 3.1 (Segment Anything) extracts service boundaries, queues, databases, and directional arrows.
- Automatic fallback: Built-in deterministic color-threshold detection and contour clustering for air-gapped or offline environments.

### 🎙️ Live Architecture Review Voice Bridge

Resilio includes an active meeting copilot. Engineering teams can conduct live architecture reviews while the streaming audio bridge transcribes discussion, detects anti-patterns (e.g., "we will just retry immediately on failure"), triggers real-time visual hazard warnings on canvas edges, and allows voice-driven chaos execution.

### 🗄️ Pluggable Enterprise Storage & Distributed Tasks

- **Persistence**: Out-of-the-box zero-dependency SQLite (via `node:sqlite`), instantly switchable to enterprise PostgreSQL (Neon Serverless, Supabase, or AWS RDS).
- **Execution Fabric**: In-process synchronous execution with seamless upgrade to Redis + BullMQ distributed worker queues for clustered load testing.
- **Security**: Firebase Google Auth popup integration, GitHub OAuth SSO, and cryptographic HMAC-SHA256 JWT sessions.

---

## System Architecture

Resilio implements a clean separation between an **orchestrating control plane** and an **isolated data plane**, enforced continuously by Dependency Cruiser rules with zero exceptions.

```mermaid
flowchart TB
    subgraph UI ["User Experience (apps/web)"]
        Canvas["Interactive SVG Review Canvas"]
        VoiceComp["Streaming Voice & Meeting Bridge"]
        VisionComp["Whiteboard SAM 3.1 Ingestion"]
        TelemetryDash["Real-Time SSE Telemetry & Diff Inspector"]
    end

    subgraph ControlPlane ["Control Plane (apps/server - Fastify Modular Monolith)"]
        direction TB
        HttpAPI["HTTP & SSE Gateway (Fastify 5.12)"]

        subgraph Modules ["Inward-Facing Capability Modules"]
            TopologyMod["Topology Engine"]
            ChaosMod["Chaos Orchestrator"]
            SandboxMod["Process Supervisor"]
            MeasureMod["Measurement & Invariants"]
            MetaAIMod["Meta AI SRE Client"]
            RepairMod["Autonomous Repair Engine"]
            VisionMod["Vision Parser"]
            VoiceMod["Voice Intent Parser"]
            RunsMod["Runs & Benchmark Store"]
        end

        Platform["Platform (PostgreSQL / Neon / SQLite, BullMQ / Redis, Pino Logging)"]
    end

    subgraph DataPlane ["Isolated Data Plane (Operating System Sockets & Subprocesses)"]
        direction TB
        LoadGen["Load Generator (apps/loadgen)<br/>Monotonic Open-Loop Dispatch"]

        subgraph Proxies ["Shopify Toxiproxy Engine (:8474)"]
            Proxy1["TCP Proxy Edge A (:28001)"]
            Proxy2["TCP Proxy Edge B (:28002)"]
        end

        subgraph Workers ["Service Stand-In Processes (apps/worker)"]
            WorkerA["Worker Node A<br/>Circuit Breakers / undici Pools"]
            WorkerB["Worker Node B<br/>Queues / In-Memory State"]
        end
    end

    Canvas -->|REST & SSE| HttpAPI
    VoiceComp -->|WebSocket| HttpAPI
    VisionComp -->|Image Multipart| HttpAPI

    HttpAPI --> Modules
    Modules --> Platform

    SandboxMod -->|Spawn & Supervise PID| Workers
    SandboxMod -->|Spawn & Schedule| LoadGen
    ChaosMod -->|Toxics REST API| Proxies

    LoadGen -->|Open-Loop HTTP Requests| Proxy1
    Proxy1 -->|Physical Network Faults| WorkerA
    WorkerA -->|Inter-Service HTTP Traffic| Proxy2
    Proxy2 -->|Latency / Drop / Throttling| WorkerB

    Workers -.->|Telemetry Samples| MeasureMod
```

### Monorepo Workspaces & Boundaries

| Workspace            | Type          | Responsibilities                                                                                                                           | Enforced Rule                                                      |
| :------------------- | :------------ | :----------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| `packages/contracts` | Pure Library  | Zod schemas, TypeScript types, and the bounded numeric catalog (`catalog.ts`). Zero runtime logic.                                         | Cannot import any other workspace.                                 |
| `packages/shared`    | Pure Library  | Seeded PRNG, monotonic clock ports, typed Result monads, domain error hierarchies.                                                         | Imports only standard library.                                     |
| `apps/server`        | Control Plane | Modular monolith Fastify server. Hexagonal modules: `domain` $\leftarrow$ `application` $\leftarrow$ `infrastructure` $\leftarrow$ `http`. | Enforced zero cross-module leaks via Dependency Cruiser.           |
| `apps/worker`        | Data Plane    | Stand-in microservice runtime: timeouts, retries, jitter, circuit breakers, queues, idempotency caches.                                    | Imports contracts and shared only. No platform or database access. |
| `apps/loadgen`       | Data Plane    | Open-loop arrival scheduler (Poisson, Constant). Monotonic nanosecond timing.                                                              | Zero dependencies on server internals.                             |
| `apps/web`           | Frontend UI   | React 19 SPA, zero-dependency SVG topology canvas, SSE telemetry streaming, Firebase auth, audio recorder.                                 | Consumes `@chaosboard/contracts` schemas.                          |

---

## Meta AI SRE & Multimodal Integration

Resilio utilizes Meta's frontier models across vision, voice, and autonomous reasoning, backed by deterministic fallbacks ensuring offline and self-hosted functionality:

| Capability                          | Model                                                                                                    | Endpoint / Provider                                           | Fallback When Unconfigured                                                    |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------ | :---------------------------------------------------------------------------- |
| **Autonomous SRE Copilot & Repair** | **Meta Muse Wonder 1.0** (`muse-wonder-1.0`)<br/>_1M token context for multi-node failure telemetry RCA_ | Dev Meta AI (`https://api.meta.ai/v1`) or vLLM / Hugging Face | Local Random Forest ML classifier + deterministic heuristics                  |
| **Real-Time Meeting Voice Copilot** | **Meta Muse Spark 1.3** (`muse-spark-1.3`)<br/>_Sub-second streaming intent parsing_                     | Meta WebSocket API or compatible inference provider           | Deterministic regex and tokenized architectural keyword extractor             |
| **Whiteboard Diagram Ingestion**    | **Meta SAM 3.1** (`meta-models/sam-3.1`)<br/>_Zero-shot structural segmentation_                         | Meta Multimodal Vision API                                    | Pure TypeScript contour analysis & color thresholding ($R>130, G<110, B<110$) |
| **Visual Architecture Artifacts**   | **Meta Muse Image** (`meta-models/muse-image`)                                                           | Meta Generation API                                           | Deterministic vector SVG schematic renderer                                   |

---

## Benchmark Suite

Resilio includes an automated empirical benchmark suite (`benchmarks/scenarios/`) validating 6 canonical distributed systems failure archetypes:

```bash
pnpm benchmark
```

|   #   | Benchmark Scenario                     | Failure Mechanism Injected                                             | Monitored Invariant                                            | Autonomous Repair Applied                                                                                     |
| :---: | :------------------------------------- | :--------------------------------------------------------------------- | :------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| **1** | **Synchronous Retry Storm**            | 800ms downstream delay + jitter under 100 req/s load.                  | $p_{99} \le 500\text{ ms}$, Worker pool utilization $\le 80\%$ | Adds exponential backoff ($200\text{--}4000\text{ ms}$) with full jitter and reduces max retries from 5 to 2. |
| **2** | **Missing Timeout Cascade**            | Downstream stall (5000ms delay) pinning upstream worker threads.       | Ingress availability $\ge 99\%$, Active concurrency $\le 50$   | Injects 350ms deadline timeout with fail-safe cached fallback.                                                |
| **3** | **Unbounded Queue Memory Bloat**       | Producer-consumer rate mismatch (300 in / 50 out per sec).             | Queue depth $\le 200$, Event loop lag $\le 25\text{ ms}$       | Configures bounded queue capacity (150 items) + 429 Backpressure shedding.                                    |
| **4** | **Non-Idempotent Retry Mutation**      | Transient socket resets causing client-side request resubmission.      | Exactly-once ledger writes, zero duplicate commits             | Attaches HMAC UUID idempotency keys + in-memory deduplication window.                                         |
| **5** | **Over-Sensitive Circuit Breaker**     | Transient 5% network packet drops triggering false outage.             | Ingress availability $\ge 95\%$, Premature trip count $= 0$    | Tunes breaker threshold from 3 failures to 25% failure rate over a 10s sliding window.                        |
| **6** | **Availability vs. Consistency (CAP)** | Full network partition toxic separating primary from replication node. | Zero stale reads vs. $99\%$ write uptime                       | Generates formal trade-off verdict (explaining impossibility of satisfying both).                             |

_Full results, statistical medians, IQRs, and token metrics are documented in [`docs/benchmark-results.md`](docs/benchmark-results.md)._

---

## Quick Start

### Option 1: Docker Compose (Recommended)

Run the full stack (Web UI, API Control Plane, and Shopify Toxiproxy) with a single command:

```bash
# Clone the repository
git clone https://github.com/your-username/chaosboard.git
cd chaosboard/infra

# Launch Toxiproxy and Resilio
docker compose up
```

Open **`http://localhost:3000`** in your browser.

---

### Option 2: Local Monorepo Setup

#### Prerequisites

- **Node.js**: `^22.13.0` (Verified on Node 22.x, `.nvmrc` included)
- **pnpm**: `12.13.0` (`npm install -g pnpm@12.13.0`)
- **Toxiproxy**: [Shopify Toxiproxy](https://github.com/Shopify/toxiproxy/releases) running locally on port `8474` (or via Docker: `docker run -d -p 8474:8474 -p 28000-28099:28000-28099 ghcr.io/shopify/toxiproxy`)

#### 1. Install Dependencies

```bash
pnpm install
```

#### 2. Configure Environment

```bash
cp .env.example .env
```

_(The default configuration uses zero-config embedded SQLite and local in-process task execution. See [.env.example](.env.example) to optionally add Neon PostgreSQL, Redis, Firebase Google Auth, or Meta AI API keys)._

#### 3. Run Quality Verification Suite

```bash
# Runs TypeScript check, ESLint + Prettier, Dependency Cruiser boundary enforcement,
# architecture graph validation, catalog doc sync, and unit tests
pnpm check
```

#### 4. Launch Development Servers

```bash
pnpm dev
```

- **Web Canvas UI**: `http://localhost:5173` (Proxies `/api` requests to backend)
- **API Server & SSE Stream**: `http://localhost:8787`

---

## Configuration

All configuration is centralized through typed environment variables in [`.env.example`](.env.example):

```bash
# Server Core
SERVER_HOST=127.0.0.1
SERVER_PORT=8787
DATA_DIR=./data

# Chaos Injection Engine
TOXIPROXY_URL=http://127.0.0.1:8474

# Database: Embedded SQLite by default, or Neon / Supabase Serverless PostgreSQL
# DATABASE_URL=postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require

# Distributed Job Queue: In-process by default, or Redis / BullMQ
# REDIS_URL=rediss://default:token@xyz.upstash.io:6379

# Meta AI SRE Copilot (Dev Meta AI / Fireworks / Together / Local vLLM)
PARTNER_BASE_URL=https://api.meta.ai/v1
PARTNER_API_KEY=
PARTNER_MODEL_ID=muse-wonder-1.0

# Authentication (Firebase Google Auth & GitHub SSO)
JWT_SECRET=your-secure-jwt-signing-key-here
# VITE_FIREBASE_API_KEY=
# VITE_FIREBASE_PROJECT_ID=
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
```

---

## Developer Commands

| Command                 | Target / Scope      | Description                                                                                      |
| :---------------------- | :------------------ | :----------------------------------------------------------------------------------------------- |
| `pnpm dev`              | Full Stack          | Runs server (`:8787`) and web client (`:5173`) in watch mode concurrently.                       |
| `pnpm check`            | CI / Pre-commit     | Comprehensive gate: `typecheck` + `lint` + `boundaries` + `graph:check` + `docs:check` + `test`. |
| `pnpm test`             | Unit Tests          | Executes all Vitest suites across packages, server modules, and frontend components.             |
| `pnpm test:integration` | Sandboxes & Sockets | Executes real end-to-end chaos tests with live worker subprocesses and Toxiproxy.                |
| `pnpm benchmark`        | Empirical Scenarios | Runs the 6 distributed failure scenarios and outputs `docs/benchmark-results.md`.                |
| `pnpm calibrate`        | Hardware Baseline   | Measures local host event-loop noise floor and benchmark calibration bounds.                     |
| `pnpm boundaries`       | Architecture Gate   | Validates zero architectural boundary violations using Dependency Cruiser.                       |
| `pnpm graph`            | Documentation       | Automatically regenerates the Mermaid dependency graph in `docs/architecture.md`.                |
| `pnpm docs:sync`        | Documentation       | Synchronizes numeric bounds between TypeScript contracts and markdown tables.                    |
| `pnpm format`           | Code Style          | Formats entire monorepo using Prettier 3.                                                        |

---

## Project Structure

```text
chaosboard/
├── apps/
│   ├── web/                     # React 19 SPA, SVG canvas, audio recorder, Firebase auth
│   ├── server/                  # Control Plane: Fastify modular monolith (12 hexagonal modules)
│   ├── worker/                  # Data Plane: Standalone HTTP/TCP service processes
│   └── loadgen/                 # Data Plane: Open-loop monotonic Poisson/constant load generator
├── packages/
│   ├── contracts/               # Zod schemas, boundary types, and bounded numeric catalog
│   └── shared/                  # Monotonic clock, seeded PRNG, typed Result monads
├── benchmarks/
│   └── scenarios/               # 6 Canonical distributed failure scenario definitions
├── docs/
│   ├── architecture.md          # Architectural style guide & generated Mermaid module graph
│   ├── benchmark-results.md     # Empirical trial results, medians, IQRs, token metrics
│   ├── contracts.md             # Synchronized table of catalog bounds and invariants
│   ├── DECISIONS.md             # Formal architectural decision log (ADR)
│   └── limitations.md           # Product charter and scientific boundary disclosures
├── infra/
│   └── docker-compose.yml       # Production Docker Compose stack (Toxiproxy + Resilio)
├── tools/
│   ├── architecture/            # Boundary enforcement and Mermaid graph generator
│   └── docs/                    # Automated catalog-to-markdown sync utilities
└── Dockerfile                   # Multi-stage production container build
```

---

## Limitations & Soundness

Resilio is committed to **scientific honesty** regarding what design-time chaos testing can and cannot prove:

- **Empirical, Not Proof of Correctness**: Resilio does not mathematically verify arbitrary business logic. It reports empirical measurements across repeated trials with medians and interquartile ranges (IQR).
- **Stand-In Network Services**: Sandboxed worker nodes faithfully exercise network dynamics (retries, timeouts, jitter, circuit breakers, queues, connection pools). They do not replicate proprietary database storage engines, kernel interrupts, or multi-datacenter fiber routing.
- **Single-Host Event Loop Guard**: Data plane processes execute on the host machine. To prevent false positives from CPU saturation or event-loop stalls, Resilio continuously monitors event-loop lag and marks trials with excessive noise as `INVALID` or `INCONCLUSIVE`.
- **Bounded Autonomous Scope**: Meta AI models are strictly constrained to proposing parameter modifications within the typed bounds catalog. They cannot rewrite application source code or install unverified packages.

See [`docs/limitations.md`](docs/limitations.md) for the complete charter.

---

## License

This project is licensed under the [MIT License](LICENSE).
Built with ❤️ for the **Meta Global AI Developer Hackathon**.
