# ChaosBoard

Design-time chaos testing. Draw a system, break it on purpose, measure what happens, and repair the design with changes that are validated and re-measured, not just described.

Built for the Meta Global AI Developer Hackathon (indie track).

## What it is, and what it is not

ChaosBoard turns a sketch of a system into real processes that talk over real sockets, injects faults between them with Toxiproxy under open-loop load, and checks stated invariants against measurements. An open-weight Meta model proposes repairs from a bounded, typed catalog of resilience policies. Code validates every proposal, the sandbox measures it, and the loop keeps a change only if the measurement improves without new violations. When a design cannot be repaired within the catalog, it reports the measured trade-off.

What it is not:

- It does not test your real system. The sandbox runs stand-in services configured from your topology. It exercises resilience policies (timeouts, retries, backoff, jitter, pools, queues, circuit breakers, rate limits, idempotency, fallbacks). It does not model database internals, your runtime's garbage collector, the kernel, a real network, or your code.
- It does not prove anything. It reports empirical results over a stated number of trials with a spread, and it says INCONCLUSIVE or INVALID when the measurement does not support a verdict.
- Results come from one host. Before and after comparisons on the same host are meaningful; absolute numbers belong to that host.

See `docs/limitations.md` for the full list.

## Prior art

ChaosEater (arXiv 2511.07865, ASE 2025) already automates the chaos engineering cycle with LLM agents for Kubernetes systems. ChaosBoard does not claim a new category. Its different input and timing is design time: it works from a sketch or a photo, with no cluster and no deployed system.

## Status

This repository is a scaffold plus the first two build phases. Everything below is implemented and tested; everything else is specified in `docs/plan.md` and not yet built.

| Area                                                                                                                                    | State                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Workspace, tooling, module boundary enforcement, generated module graph                                                                 | Done                                                                                       |
| Server platform: configuration, logging, SQLite and migrations, problem-details HTTP kit with an event stream helper, graceful shutdown | Done                                                                                       |
| Contracts: topology, fault, invariant, trial configuration, health, problem details, and the catalog of numeric bounds                  | Done                                                                                       |
| `topology` module: validation, naive defaults, draft normalization, six scenario fixtures, `POST /api/topologies/validate`              | Done                                                                                       |
| Web shell with a typed API client                                                                                                       | Done                                                                                       |
| Provider smoke scripts                                                                                                                  | Written; Toxiproxy exercised against a real server, the others still need your credentials |
| Worker, sandbox, chaos, load generator, measurement, experiments, repair, benchmarks, UI, vision, voice, reporting                      | Not built (Phases 2 to 10)                                                                 |

## Quick start

Requirements: Node.js 22.13 or newer and pnpm 12.13.0 (`npm install -g pnpm@12.13.0`).

```
pnpm install
cp .env.example .env
pnpm check          # type check, lint, module boundaries, generated docs, all tests
pnpm dev            # server on 127.0.0.1:8787, web on http://localhost:5173
```

The web page shows the server's real status from `GET /api/health`.

## Commands

| Command                                                               | Purpose                                                         |
| --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm check`                                                          | Everything that must pass before a change is done               |
| `pnpm dev` / `pnpm start`                                             | Run the server and web (dev) or the server only                 |
| `pnpm lint` / `pnpm format`                                           | ESLint plus a Prettier check / Prettier write                   |
| `pnpm boundaries`                                                     | Module boundary rules alone                                     |
| `pnpm graph` / `pnpm graph:check`                                     | Regenerate or verify the module graph in `docs/architecture.md` |
| `pnpm docs:sync` / `pnpm docs:check`                                  | Regenerate or verify the catalog table in `docs/contracts.md`   |
| `pnpm test:integration`                                               | Slow tests against real processes (none yet)                    |
| `pnpm smoke:spark-open`, `smoke:toxiproxy`, `smoke:probe`, `smoke:ws` | Provider smoke scripts; see `docs/smoke-tests.md`               |

## Layout

```
apps/server     control plane: platform/ and modules/ (modular monolith)
apps/web        React application
packages/contracts   zod schemas, inferred types, catalog of bounds
packages/shared      typed errors, result type, clock and random ports, seeded random
scripts         provider smoke scripts
tools           module boundary tests and graph generator
infra           Docker Compose for Toxiproxy
docs            every markdown file except this one
```

`apps/worker` and `apps/loadgen` (the data plane programs) arrive in Phases 2 and 3. The generated module graph and the allowed-dependency table are in `docs/architecture.md`.

## Documentation

| File                   | Contents                                                                      |
| ---------------------- | ----------------------------------------------------------------------------- |
| `docs/HANDOVER.md`     | Build state, what is verified, what you must do, and prompts for the agent    |
| `docs/plan.md`         | The build plan: product, architecture, contracts, charter, and phases 0 to 11 |
| `docs/DECISIONS.md`    | Every non-obvious decision, with reasons                                      |
| `docs/architecture.md` | Architecture summary and the generated module graph                           |
| `docs/contracts.md`    | The contracts in prose, plus the generated catalog table                      |
| `docs/metrics.md`      | Precise metric and verdict definitions                                        |
| `docs/limitations.md`  | What the tool cannot tell you                                                 |
| `docs/api-notes.md`    | Verified facts about external APIs (filled from real calls)                   |
| `docs/smoke-tests.md`  | How to run and read the smoke scripts                                         |

## Working with a coding agent

Build one phase at a time from `docs/plan.md`. Start each session with the preamble in Appendix C of that file, name the phase, and stop at its gate. `docs/plan.md` section 0 lists the rules the agent must follow, including never inventing API facts and never weakening a lint, boundary, or type rule to get a change through.

## Hackathon note

Everything presented for the hackathon must have been built during the event and be clearly identifiable as such. Start the git history on or after the first day of the building period, keep commits small and specific, and never reuse code from earlier projects.

## License

Not chosen yet. A public repository is required for the hackathon, so choose a license before submitting.
