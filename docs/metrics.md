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

| Verdict | Meaning |
|---|---|
| PASS | The median satisfies the invariant and the interquartile range does not cross the threshold. |
| VIOLATED | The median violates the invariant and the interquartile range does not cross the threshold. |
| INCONCLUSIVE | The interquartile range straddles the threshold. It is never rounded to PASS or VIOLATED. |
| INVALID | The measurement cannot be trusted. The reason is always stated. |
