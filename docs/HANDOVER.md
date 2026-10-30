# Handover

Read this first when you pick the project up in a new tool or a new session. It says what is built, what has and has not been verified, what you must do yourself, and which prompt to paste next.

## 1. State of the build

| Phase | Scope | State |
|---|---|---|
| 0 | Workspace, tooling, module boundary enforcement, platform layer, web shell, docs, smoke scripts | Code and docs done. Three items need you (section 3). |
| 1 | Contracts and the `topology` module | Done and tested. |
| 2 | Data plane runtime: `apps/worker` and the `sandbox` module | Not started. This is the next phase. |
| 3 to 11 | Chaos and load generation, experiments and runs, repair, benchmarks, UI, vision, voice, reporting, packaging | Not started. Specified in `docs/plan.md`. |

What exists:

- `packages/contracts`: zod schemas for topology, fault, invariant, trial configuration, health, problem details, and the catalog of numeric bounds. 26 tests.
- `packages/shared`: typed errors, result type, clock and random ports, seeded random. 12 tests.
- `apps/server`: platform layer (configuration, logging, SQLite through `node:sqlite`, per-module migrations, problem-details HTTP kit with an event stream helper, graceful shutdown) and the `topology` module (validation, naive defaults, draft normalization, six scenario fixtures, `POST /api/topologies/validate`). 100 tests.
- `apps/web`: shell that shows the real result of `GET /api/health` through a typed client. 7 tests.
- `scripts/smoke`: provider smoke scripts and their small library. 8 tests.
- `tools`: module boundary tests against a throwaway tree with forbidden imports, the module graph generator, the contracts catalog table generator. 29 tests.
- `docs`: every markdown file except `README.md`.

Not built yet: `apps/worker`, `apps/loadgen`, the modules `sandbox`, `chaos`, `measurement`, `runs`, `experiments`, `meta-ai`, `repair`, `benchmarks`, `vision`, `voice`, `reporting`, the Docker image for the application, end-to-end tests.

## 2. What was verified and what was not

Verified in the planning sandbox (Linux x86_64, Node 22.22.2, pnpm 12.13.0):

- `pnpm check` passes: type check, lint with the boundary and purity rules, module boundary check, generated graph and catalog table up to date, 182 tests.
- The server starts, answers `GET /api/health`, validates a scenario topology, returns problem details for bad input and unknown routes, and exits with code 0 after SIGTERM, logging the shutdown.
- The web app builds.
- `pnpm smoke:toxiproxy` ran against a native Toxiproxy 2.13.0 server. Observations are in `docs/api-notes.md` section 8, labeled as planning sandbox observations.

Not verified. Confirm each on your machine before relying on it:

- Docker was not available. `infra/docker-compose.yml` has never been run, and the image tag `ghcr.io/shopify/toxiproxy:2.13.0` has not been pulled. Container addressing is untested.
- Your operating system. Phase 2 spawns and tears down child processes, which differs on Windows, macOS, and Linux. Test teardown of whole process trees on your system.
- Every partner and Meta API (Spark Open on a partner host, SAM 3.1, Muse Voice Transcribe, Muse Image, Muse Wonder). No credentials were available. Every status in `docs/api-notes.md` section 1 stays NOT TESTED until you run the scripts.
- Other Node versions. `engines` says 22.13 or newer. Only 22.22.2 was exercised.
- `node:sqlite` prints an ExperimentalWarning. It works on Node 22.22.2. If it misbehaves on your Node version, swap the driver inside `apps/server/src/platform/db.ts` only and record it in `docs/DECISIONS.md`.

Version pins you should not change casually:

- TypeScript is 6.0.3 because `typescript-eslint` 8.71.2 declares support for TypeScript below 6.1. Newer TypeScript majors exist. Upgrade only when `typescript-eslint` supports them.
- pnpm is 12.13.0 (a recent major). The workspace file uses `allowBuilds` to skip esbuild's install script. If your pnpm differs, adapt that one setting.

## 3. What you must do yourself (finishes Phase 0)

1. Create the git repository and make the first commit yourself, so the history starts on or after Oct 27 and shows your authorship.
2. Install and check: Node 22.13 or newer, `npm install -g pnpm@12.13.0`, `pnpm install`, `pnpm check`. Report any failure to the agent exactly as printed.
3. Fill in `.env` (copy `.env.example`) and run the smoke scripts you can: `pnpm smoke:spark-open`, `pnpm smoke:toxiproxy` (start Toxiproxy with `docker compose -f infra/docker-compose.yml up -d`), and `pnpm smoke:probe` or `pnpm smoke:ws` for SAM, Muse Image, Muse Wonder, and Muse Voice Transcribe using request files you write from the provider documentation. See `docs/smoke-tests.md`.
4. Claim your Meta credits and request partner credits. Record which partner host works. This is operational, not code.
5. Choose a license before submission. It was left to you on purpose.

The Phase 0 gate is met when `docs/api-notes.md` has a real entry or an explicit "does not work, fallback chosen" entry for every capability. If no open-weight host works by the end of Oct 28 IST, stop and decide before starting Phase 5.

## 4. How to work with the agent

- One phase per session. Paste the preamble, name the phase, and make the agent stop at the gate.
- The agent runs `pnpm check` and reports real output. You run the phase by hand and approve the gate before the next phase starts.
- Never let the agent weaken a lint, boundary, or type rule, disable a test, or edit generated sections of docs by hand.
- Keep the agent inside the module boundaries in `docs/plan.md` section 5. If it wants to import another module's internals, the design is wrong, not the rule.
- After each phase: commit, then ask the agent for the phase report from `docs/plan.md` Appendix B.
- If your tool supports persistent project instructions, put sections 0 to 3 of the prompt below there. Otherwise paste it every session.

## 5. Prompts to paste

### 5.1 Orientation (first session, no code changes)

```
Read README.md, docs/HANDOVER.md, docs/DECISIONS.md, and docs/plan.md sections 0 to 7.
Do not write or change any code in this session.
Run `pnpm install` and `pnpm check` and report the real output, including any failure.
Then check on this machine and report: the Node version, the pnpm version, whether Docker
is available, and whether the image in infra/docker-compose.yml pulls.
Finally, list anything in docs/HANDOVER.md section 2 that you can confirm or refute here.
Do not guess. If you could not verify something, say so. Stop after the report.
```

### 5.2 Finish the Phase 0 paperwork (after you ran the smoke scripts)

```
Read docs/smoke-tests.md and the rules at the top of docs/api-notes.md.
I ran the smoke scripts; the recordings are in .smoke-output/. Do not change any code.
For each recording, update the status table and the matching entry in docs/api-notes.md using
only what the recording shows. Leave anything I did not test as NOT TESTED. Record a fallback
decision wherever a capability does not work. Never copy a request shape from memory or from
docs/plan.md. Do not copy secrets. Then list what is still missing for the Phase 0 gate in
docs/plan.md. Stop there.
```

### 5.3 Phase 2 (the next build phase)

```
Read docs/plan.md sections 0 to 7 and Phase 2 (Data plane runtime: worker and sandbox).
Do not read ahead. Phases 0 and 1 are already built; read docs/DECISIONS.md and
docs/contracts.md for what exists, and docs/api-notes.md for verified external facts.
Restate the goal and the gate in your own words and list the files you will create or change.
Write the contract schemas for node configuration and worker control first, with valid and
invalid fixtures. Then implement only Phase 2: the pure worker policies with injected time and
randomness, the worker program on node:http and undici, the introspection and control endpoints,
and the sandbox module (network plan, configuration derivation, process supervision with
guaranteed teardown). Create only the apps, modules, and folders this phase needs.
Respect the module boundaries and layer rules in docs/plan.md section 5 and run `pnpm check`.
Obey the engineering charter in section 7: no fabricated numbers, no silent fallbacks, no
emojis, no placeholder data, no hardcoded ports or timings, typed validation at every boundary,
explicit timeouts, guaranteed cleanup, and no weakening of lint, boundary, or type rules.
Do not mock sockets between nodes. Run the slow integration tests with `pnpm test:integration`.
Teardown must leave no stray processes or ports on my operating system, including after a forced
kill of the server; test that, and say what you could not test.
Finish with the phase report from Appendix B. Stop at the Phase 2 gate.
```

### 5.4 Any later phase

Replace the phase name and keep everything else from 5.3:

```
Read docs/plan.md sections 0 to 7 and Phase <N> (<name>). Do not read ahead. Earlier phases
are already built; read docs/DECISIONS.md, docs/contracts.md, docs/metrics.md, and
docs/api-notes.md for what exists. Restate the goal and gate, list the files you will touch,
write contract schemas and tests first where the phase defines contracts, implement only
Phase <N>, create only what it needs, respect the module boundaries, run `pnpm check` and the
slow tests, obey the charter in section 7, finish with the Appendix B phase report, and stop
at the gate.
```

Phases in order: 3 Fault injection, open-loop load, trial measurement. 4 Verdicts, experiments, runs, API. 5 Repair agent and structured model adapter. 6 Benchmark suite. 7 Web UI. 8 Vision ingestion and gesture. 9 Voice. 10 Report export and card. 11 Packaging and submission. Cut order if behind is in `docs/plan.md` section 4.3.

## 6. Dates

Submission is due Nov 4, 9:00 PM Eastern, which is Nov 5, 07:30 AM IST because daylight saving ends Nov 1. Plan to submit by Nov 4, 20:00 IST. Feature freeze is Nov 3 evening IST. The schedule in `docs/plan.md` section 10 is aggressive; apply its slip rule early instead of late.
