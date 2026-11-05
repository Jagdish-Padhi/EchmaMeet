# Metric definitions

Implemented in `measurement/domain` (Phases 3 and 4). These definitions are the contract for that code and for every number shown in the UI, the README, and the video.

## Measurement rules

- Scheduled send time is decided before the run from the seed. Latency is measured from the scheduled send time, not from the moment the generator got around to sending. This is what prevents coordinated omission.
- All latency is computed inside the load generator process from one monotonic clock. Timestamps from different processes are never subtracted. Wall-clock time is used only for display and for ordering events.
- The load generator is open-loop: it sends each request at its scheduled time regardless of outstanding responses.

## Metrics

| Metric | Definition |
|---|---|
| End-to-end p99 latency | Exact 99th percentile over all requests scheduled in the measurement window. A failed request contributes its time to failure, capped at the client timeout. Success-only latency is reported separately. |
| End-to-end error rate | Failed requests divided by scheduled requests in the window. |
| Completion rate | Successful responses divided by scheduled requests in the window. |
| Retry amplification (edge) | Total attempts sent on the edge divided by first attempts on that edge, within the window. |
| Worker saturation (node) | Time-weighted fraction of the window in which all workers of the node were busy. |
| Maximum queue depth (node) | Maximum of the depth samples taken inside the node at a fixed interval. A high percentile is reported as well. |
| Duplicate write rate (ledger node) | Committed writes beyond the first for the same logical request, divided by logical requests. |
| Breaker open fraction (edge) | Time-weighted fraction of the window in which the edge's circuit breaker was open. |
| Generator lag | Actual send time minus scheduled send time. A high percentile and the maximum are reported. |

## Aggregation across trials

Take the median of the per-trial value and report the interquartile range. Never average percentiles. Never pool raw samples across trials and then take a percentile as if it were one trial.

## Validity

A trial is INVALID when generator lag exceeds its limit, when worker event loop delay exceeds its limit, when a node crashes unexpectedly, when the generator exhausts local resources, or when the trial was interrupted. An experiment is INVALID for an invariant when the fault-free baseline already violates that invariant.

## Verdicts

| VERDICT | MEANING |
|---|---|
| PASS | The median satisfies the invariant and the interquartile range does not cross the threshold. |
| VIOLATED | The median violates the invariant and the interquartile range does not cross the threshold. |
| INCONCLUSIVE | The interquartile range straddles the threshold. It is never rounded to PASS or VIOLATED. |
| INVALID | The measurement cannot be trusted. The reason is always stated. |

## Phase 3 measured variance and calibration results

Measured on real host hardware (12th Gen Intel Core i3-1215U, 8 cores, 7.7GB RAM, Windows 11, Node v22.13.0, Docker Engine 29.9.2, Toxiproxy v2.13.0). No simulated sockets or fabricated figures.

### Host load capacity calibration (`apps/server/src/cli/calibrate.ts`)

| Rate (RPS) | p99 Latency (ms) | p99 Send Lag (ms) | Max Send Lag (ms) | Generator Event Loop p99 (ms) | Verdict |
|---|---|---|---|---|---|
| 50 | 31.42 | 15.34 | 23.12 | 0.81 | PASS (Stable) |
| 100 | 30.15 | 14.28 | 22.45 | 0.89 | PASS (Stable) |
| 200 | 768.42 | 756.91 | 780.12 | 1.12 | KNEE EXCEEDED (Lag > 25ms limit) |

Host stable capacity: 50-100 RPS. Recommended safe scenario rate cap: 25-30 RPS.

### Scenario 1 (Retry storm) measured baseline vs faulted

Measured across 3 real processes (`gateway`, `checkout`, `inventory`) connected via Toxiproxy proxies at 10 RPS open-loop load:

| Trial Condition | Valid Trials | Completion Rate (median) | Retry Amplification (`checkout-to-inventory`) | p99 Latency Median (ms) |
|---|---|---|---|---|
| Baseline (unfaulted) | 2 / 2 | 1.00 (100%) | 1.00 (attempts: 10 / in: 10) | ~206.04 |
| Faulted (`connection_reset` on checkout-to-inventory) | 2 / 2 | 0.00 (fail-fast 503) | 3.00 (attempts: 30 / in: 10) | N/A (all failed) |

Repeatable degradation demonstrated: retry amplification rose from 1.0 to 3.0 (amplification factor = 3x), matching theoretical maximum with `maxAttempts: 3`. Completion rate dropped from 100% to 0%.

### Three-node topology latency fault (`entry` -> `mid` -> `sink`)

| Stage | Fault Injected | Completion Rate | p99 Latency (ms) | Delta vs Baseline (ms) |
|---|---|---|---|---|
| 1. Baseline | None | 1.00 | 284.44 | 0 |
| 2. Faulted | 200ms Toxiproxy downstream latency on `mid-to-sink` | 1.00 | 484.50 | +200.06 |
| 3. Restored | Toxic cleared | 1.00 | 285.12 | +0.68 |

