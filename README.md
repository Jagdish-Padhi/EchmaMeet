# EchmaMeet: Voice-First Distributed Chaos Engineering & Autonomous SRE Studio

> **Built for the Great Indian AI Hackathon & Internship Challenge by Gnani.ai**  
> *Transforming how Indian engineering teams design, review, and stress-test distributed architectures using voice, real physical chaos execution, and autonomous SRE intelligence.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.2-black.svg?logo=fastify)](https://www.fastify.io/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react)](https://react.dev/)
[![Gnani AI](https://img.shields.io/badge/Speech%20Platform-Gnani%20Prisma%20%2B%20Timbre%20v3-orange.svg)](https://app.gnani.ai/voice)
[![Groq AI](https://img.shields.io/badge/Reasoning%20AI-Groq%20Llama%203.3%2070B-f55036.svg)](https://console.groq.com)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Neon-336791.svg?logo=postgresql)](https://neon.tech)
[![Tests Passing](https://img.shields.io/badge/Tests-489%20Passing-brightgreen.svg)](file:///apps/server)

---

## Executive Summary

Most voice interfaces stop at superficial "speech in, text out" assistants. **EchmaMeet** closes the loop on real, physical consequences:

1. **Speak naturally in Hindi, English, or Hinglish**: Transcribed with **Gnani Prisma v3.0** speech platform via low-latency REST and streaming WebSocket audio bridges (`indic-auto` language detection).
2. **Physical Chaos Execution**: Injects verified network faults (latency, jitter, packet drop, bandwidth degradation) via **Toxiproxy** across real TCP sockets and multi-process services under open-loop load.
3. **Autonomous SRE Copilot ("Echma")**: A resident distributed systems expert powered by **Groq Cloud Llama 3.3 70B** high-speed reasoning and **Gnani Timbre v3.0** (Lakshmi neural voice persona). Echma silently monitors whiteboard design sessions, raises her hand when architectural hazards emerge, and guides teams through verified auto-remediation.
4. **Native Audio Expression Tags**: Echma weaves authentic emotion and human realism into spoken opinions using Gnani Timbre's inline expression tags (`<Excited>`, `<Pauses>`, `<Giggle>`, `<Laugh>`, `<Slow>`, `<Whispers>`, `<Clears throat>`).
5. **Auditable PostgreSQL Voice Ledger**: Every spoken utterance, intent parsing metric, STT/TTS round-trip latency, and chaos outcome is persisted in **PostgreSQL / Neon Serverless**.

---

## System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Tier (Browser / React 19)"]
        Mic["Microphone (AudioWorklet 16kHz PCM)"]
        Canvas["Interactive Whiteboard & SRE Canvas"]
        Drawer["Enterprise Studio Drawer (Vertical Cards)"]
        PiP["Picture-in-Picture Meeting Stage"]
    end

    subgraph Gateway ["Control Plane (Fastify Modular Monolith)"]
        WSBridge["WebSocket Voice Bridge (1024-byte Paced Frames)"]
        AuthModule["Auth & JWT Session Gate"]
        VoiceParser["Hindi / Hinglish Intent Parser"]
        PreflightValidator["Authoritative Topology Validator"]
    end

    subgraph SpeechAI ["Speech Intelligence (Gnani AI)"]
        PrismaSTT["Gnani Prisma v3.0 (indic-auto)"]
        TimbreTTS["Gnani Timbre v3.0 (Lakshmi Voice + Audio Tags)"]
    end

    subgraph ReasoningAI ["Reasoning & Autonomy Tier"]
        GroqLLM["Groq Cloud AI (High-Speed LLM Inference)"]
        RuleEngine["Deterministic Hazard Detection Rules"]
        MLDiagnosis["Trained Random-Forest Model (ML Diagnostics)"]
    end

    subgraph ChaosEngine ["Physical Sandbox & Chaos Execution"]
        Toxiproxy["Toxiproxy Daemon (:8474 TCP Proxies)"]
        WorkerSandbox["Isolated Multi-Process Worker Sandbox"]
        LoadGen["Open-Loop Synthetic Load Generator"]
        TelemetryAggregator["Empirical Telemetry (Median ± IQR Aggregation)"]
    end

    subgraph Persistence ["Persistence Layer"]
        NeonDB[("PostgreSQL / Neon (Voice Ledger & Analytics)")]
        SQLiteDB[("Embedded SQLite (Deterministic Run State)")]
    end

    %% Audio & Voice Flows
    Mic -->|Raw PCM Frames| WSBridge
    WSBridge -->|Paced Audio + Keyterms| PrismaSTT
    PrismaSTT -->|Transcript| VoiceParser
    VoiceParser -->|Spoken Reply| TimbreTTS
    TimbreTTS -->|48kHz WAV Audio| Client

    %% Agent & Meeting Flows
    Canvas -->|Topology Draft| PreflightValidator
    PreflightValidator -->|Context & Hazards| GroqLLM
    GroqLLM -->|Spoken Opinion + Audio Tags| TimbreTTS
    GroqLLM -->|Hand Raise & Patch| Canvas

    %% Chaos & Measurement Flows
    Canvas -->|Validated Topology| WorkerSandbox
    WorkerSandbox -->|TCP Connections| Toxiproxy
    LoadGen -->|Synthetic Traffic| Toxiproxy
    Toxiproxy -->|Metrics| TelemetryAggregator
    TelemetryAggregator -->|Invariant Verdicts| Drawer

    %% Storage Flows
    WSBridge -->|Audit Log| NeonDB
    TelemetryAggregator -->|Run Records| SQLiteDB
```

---

## Key Features & Innovations

### 1. Gnani AI Speech Stack (Prisma STT + Timbre TTS)
* **Dual-Mode Hearing**:
  * **Push-to-Talk (REST)**: Audio is recorded in an `AudioWorklet`, converted client-side to 16 kHz mono WAV, and sent to `POST /stt/v3` with `indic-auto` language sniffing.
  * **Hands-Free Streaming (WebSocket)**: Connects to `wss://.../stt/v3/stream` through a server-side proxy that paces audio into exact 1024-byte PCM frames, pads terminal silence for clean VAD segment closure, and injects domain `x-keyterms`.
* **Timbre v3.0 Neural Voice ("Lakshmi")**:
  * Expressive female persona configured at native `1.0` cadence without robotic pitch alteration.
  * Dynamically embeds Gnani audio expression tags (`<Excited>`, `<Pauses>`, `<Giggle>`, `<Laugh>`, `<Slow>`, `<Whispers>`, `<Clears throat>`, `<Exhales>`, `<Sigh>`) to sound delightfully human and relatable.
* **Deterministic Hindi & Hinglish Command Lexicon**:
  * Understands Hindi number words (*"तीन सौ"* → `300`), Devanagari labels, unit conversions, and code-mixed engineering slang.

### 2. Groq Cloud AI Agentic Reasoning (Llama 3.3 70B)
* **Real-Time SRE Copilot**: Ultra-fast LLM inference through Groq Cloud (`https://api.groq.com/openai/v1`) using `llama-3.3-70b-versatile` to evaluate live whiteboard topologies against operational constraints.
* **Intelligent Hand-Raising Protocol**: Echma remains respectful during brainstorming and sets `handRaised: true` only when high-severity hazards exist (deadlock cycles, cascading retries, unbounded buffers).
* **Grounded Transcript Verification**: Analyzes verbal call transcripts and pairs spoken observations with verified canvas symbols.
* **Zero Meta AI Lock-In**: Entire reasoning and speech pipeline is powered exclusively by Gnani AI and Groq Cloud AI.

### 3. Authoritative Preflight Validation & Auto-Remediation
* **Role-Aware Connection Wiring**:
  * Connecting or reconnecting an edge to a `queue_consumer` automatically configures `mode: 'async_enqueue'`, eliminating `consumer_requires_async_edge` preflight rejections.
  * Changing a node's kind to `queue_consumer` automatically adapts all incoming links.
* **One-Click "Auto-Fix Architecture & Retry"**:
  * If an invalid topology is tested, `SimulationDiagnosticsModal` offers a direct remediation action.
  * Sweeps the topology, fixes link modes and buffer boundaries, validates the result via `api.validateTopology`, and restarts the trial seamlessly.
* **Truthful Multi-State Spoken Feedback**: Echma never announces false completion; she re-validates the canvas with the server before declaring an architecture clean.

### 4. Enterprise Whiteboard & Drawer UX
* **High-Contrast Neon Red Glow (`#ff1744`)**: Real-time pulsing glow on compromised links, arrowheads (`#arrow-hazard`), and docks for rapid visual identification.
* **Vertical Card Layouts**:
  * Replaced horizontal table overflow with `.verdict-vertical-card`, `.run-vertical-card`, and `.benchmark-vertical-card` components that fit 100% of the 440px side drawer.
  * Integrated interactive `[Vertical] | [Table]` view switcher with full light and dark mode styling.
* **Picture-in-Picture Conference Stage**:
  * Floating draggable video window with genuine hardware camera/mic stream release on toggle to eliminate laptop heating and battery drain.

### 5. Physical Chaos & Empirical Sandbox
* **Real Multi-Process Execution**: Physical processes executing across TCP proxies managed by Toxiproxy (`:8474`).
* **Empirical Invariant Verdicts**: Evaluates p99 latency, completion rate, queue depth, and retry amplification using median and IQR statistical aggregation.
* **Autonomous Repair Loop**: Evaluates rule-based baseline proposers against trained ML diagnosis models with trade-off analysis.

---

## Spoken Voice Commands

| Intent | Spoken Input (Hindi / Hinglish) | Spoken Input (English) | Chaos Action Triggered |
| :--- | :--- | :--- | :--- |
| **Inject Latency** | *"gateway se backend par teen sau millisecond latency inject karo"* | *"inject 300 ms latency from gateway to backend"* | Toxiproxy introduces 300ms downstream latency |
| **Run Experiment** | *"paanch trial ke saath experiment chalaao"* | *"run resilience experiment with 5 trials"* | Executes 5 baseline and 5 faulted trials |
| **Autonomous Repair** | *"repair shuru karo"* | *"start autonomous repair"* | Iterates through policy patches & re-measures |
| **Set Invariant** | *"p99 threshold chaar sau set karo"* | *"set p99 threshold to 400 milliseconds"* | Updates SLO contract boundary |
| **Load Scenario** | *"retry storm scenario load karo"* | *"load retry storm benchmark scenario"* | Populates pre-configured architecture |
| **Cancel Execution** | *"rok do" / "cancel karo"* | *"cancel current experiment"* | Releases locks and restores proxies |

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/voice/parse` | Converts audio (WAV base64) or text into typed `VoiceCommand` |
| `WS` | `/ws/voice` | Low-latency streaming voice session (paced 1024-byte PCM frames) |
| `POST` | `/api/gnani/stt` | Secure server-side proxy to Gnani Prisma STT |
| `POST` | `/api/gnani/tts` | Secure server-side proxy to Gnani Timbre TTS |
| `GET` | `/api/gnani/health` | Verifies Gnani API connectivity and available voices |
| `GET` | `/api/voice/history` | Retrieves PostgreSQL-backed voice ledger audit logs |
| `GET` | `/api/voice/analytics` | Aggregated language distribution, latency p50/p95, and success rate |
| `POST` | `/api/topologies/validate` | Authoritative distributed topology preflight check |
| `POST` | `/api/experiments/start` | Dispatches empirical chaos simulation trials |
| `POST` | `/api/rooms/:roomId/opinions` | Evaluates live meeting context and returns SRE opinion |

---

## Quick Start Guide

### Prerequisites
* **Node.js**: `^22.13.0` (LTS)
* **pnpm**: `^12.13.0`
* **Toxiproxy** (Optional for local chaos injection): Download binary or run via Docker on port `8474`:
  ```bash
  docker run -d --name toxiproxy -p 8474:8474 ghcr.io/shopify/toxiproxy
  ```

### Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Jagdish-Padhi/EchmaMeet.git
   cd EchmaMeet
   ```

2. **Install workspace dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables (Optional for Zero-Config Evaluation)**:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and configure your credentials:
   ```env
   # Gnani AI Speech Platform Credentials (https://app.gnani.ai/voice)
   GNANI_API_KEY=your_gnani_api_key_here
   GNANI_STT_MODEL=prisma-v3.0
   GNANI_TTS_MODEL=timbre-v3.0

   # Groq Cloud AI Inference (Llama 3.3 70B - https://console.groq.com)
   EVON_BASE_URL=https://api.groq.com/openai/v1
   EVON_API_KEY=gsk_your_groq_api_key_here
   EVON_MODEL_ID=llama-3.3-70b-versatile

   # Optional PostgreSQL Voice Ledger (https://neon.tech)
   DATABASE_URL=postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require
   ```

### Execution Modes: Running With vs. Without API Keys

| Capability | Mode A: Offline / Zero-Config (No API Keys) | Mode B: Sovereign Production Mode (With Keys) |
| :--- | :--- | :--- |
| **Speech-to-Text (STT)** | Browser Web Speech API fallback | **Gnani Prisma v3.0** (`indic-auto`, 10 Indic languages + Hinglish) |
| **Text-to-Speech (TTS)** | Native Indian English (`en-IN` / `hi-IN` female voice) | **Gnani Timbre v3.0** (`Lakshmi` neural persona with expression tags) |
| **SRE Hazard Detection** | **Deterministic Rule Engine** (100% offline, zero-latency) | Rule Engine + **Groq Llama 3.3 70B** conversational reasoning |
| **Chaos Execution** | Full multi-process sandbox + Toxiproxy TCP fault injection | Full multi-process sandbox + Toxiproxy TCP fault injection |
| **Auto-Remediation** | Complete 1-click DAG topology repair & preflight validation | Complete 1-click DAG topology repair & preflight validation |

> **Hackathon Judges Quick Test:** You can run `pnpm dev` immediately without any API keys to evaluate the whiteboard, meeting WebRTC stage, chaos execution, and rule-based SRE hand-raising. Add your `GNANI_API_KEY` to experience the live Gnani Prisma and Timbre neural speech pipeline.

4. **Verify Gnani AI Speech Connection** (When `GNANI_API_KEY` is configured):
   ```bash
   pnpm smoke:gnani
   ```
   *Performs a live Timbre TTS synthesis → Prisma STT transcription round-trip to guarantee your credentials and audio codecs are active.*

5. **Start Development Servers**:
   ```bash
   pnpm dev
   ```
   * Web Studio: `http://localhost:5173`
   * Fastify API: `http://localhost:8787`

---

## 90-Second Demo Walkthrough

1. **Launch the Studio**: Navigate to `http://localhost:5173` and click **"Solo AI Review"**.
2. **Review with Echma**:
   * Draw a three-node service chain on the whiteboard: `Gateway` &rarr; `Order Service` &rarr; `Queue Worker`.
   * Notice that the link into `Queue Worker` automatically adapts to `mode: async_enqueue` without preflight failures.
3. **Trigger Chaos by Voice**:
   * Click the microphone in the voice dock and speak:  
     *"gateway se order-service par 300 ms latency inject karo"*
   * Echma transcribes the Hindi input with **Gnani Prisma**, updates the canvas, and confirms aloud via **Gnani Timbre** with Lakshmi's natural voice.
4. **Inspect Hazard & Auto-Remediate**:
   * Introduce a deliberate cycle (`Order Service` &rarr; `Gateway`).
   * Echma flags the hazard with a **high-contrast neon red pulse** (`#ff1744`), raises her hand, and explains the risk:  
     *`<Excited> Notice how this loop... <Pauses> can deadlock worker threads under surge.`*
   * Click **"Remediate"** on the whiteboard banner: Echma applies the resilience patch, confirms validation with the server, and announces success.
5. **Simulate & Observe Invariant Verdicts**:
   * Run the simulation trial: open the **Telemetry** drawer to inspect the **Vertical Card Layout** displaying empirical `p99`, `IQR`, and threshold verdicts without horizontal clipping.
6. **Voice Ledger Audit**:
   * Switch to the **Voice Ledger** drawer to inspect persistent PostgreSQL records of your commands, STT/TTS latencies, and language mix.

---

## Quality Assurance & Verification

```bash
# Run complete test suite across server and web workspaces
pnpm test

# Build production bundle with strict TypeScript validation
pnpm build
```

* **Full Workspace Test Suite**: **489 automated tests passing across 104 test files** (`vitest`).
* **Web Unit Tests**: **16 test files / 57 tests passed** (`vitest`).
* **Server Unit Tests**: **53 test files / 270 tests passed** (`vitest`).
* **Contracts & Shared Tests**: **28 test files / 106 tests passed** (`vitest`).
* **Worker & Tool Tests**: **7 test files / 46 tests passed** (`vitest`).
* **Architectural Boundaries**: Strict package boundary enforcement verified via `dependency-cruiser`.
* **Zero Robotic Voice Fallbacks**: Pure Gnani Timbre neural speech pipeline.

---

## Repository Map

```text
├── apps/
│   ├── server/             # Fastify backend, Gnani speech client, Groq reasoning runtime
│   │   ├── src/modules/
│   │   │   ├── gnani/      # Prisma STT & Timbre TTS clients (REST + Streaming WebSocket)
│   │   │   ├── reasoning/  # Groq Cloud OpenAI-compatible LLM inference adapter
│   │   │   ├── meeting/    # SRE Copilot, hazard rules, transcript store, prompts
│   │   │   ├── voice/      # Hindi/Hinglish intent parser, domain lexicon, voice bridge
│   │   │   ├── voice-ledger# PostgreSQL / Neon persistent command ledger
│   │   │   ├── chaos/      # Toxiproxy physical fault injection client
│   │   │   ├── sandbox/    # Multi-process execution sandbox
│   │   │   └── repair/     # ML diagnosis & baseline auto-repair orchestrator
│   ├── web/                # React 19 whiteboard studio, audio capture, PiP meeting
│   │   ├── src/audio/      # 16kHz PCM AudioWorklet, WAV encoder, audio playback
│   │   ├── src/features/
│   │   │   ├── board/      # Canvas, neon red hazard links, topology mutations
│   │   │   ├── meeting/    # Floating PiP conference stage, Echma voice controller
│   │   │   ├── experiments/# Simulation diagnostics, vertical invariant cards
│   │   │   ├── runs/       # Past chaos execution history with vertical cards
│   │   │   └── voice/      # Push-to-talk & hands-free streaming controls
│   └── loadgen/            # Open-loop synthetic traffic generator
├── packages/
│   ├── contracts/          # Zod domain schemas, topology definitions, metrics
│   └── shared/             # Resilience queueing models, seeded random generators
├── benchmarks/             # Calibrated empirical failure scenarios & predictions
└── scripts/smoke/          # End-to-end smoke test probes (gnani.ts, toxiproxy.ts)
```

---

## License

Distributed under the **MIT License**. Built with passion for the **Gnani.ai Great Indian AI Challenge**.
