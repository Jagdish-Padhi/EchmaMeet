/**
 * Time and randomness are injected so that domain code stays deterministic and testable.
 * Implementations live in the composition layer (clock) or in this package (seeded random).
 */
export interface Clock {
  /** Wall-clock time in milliseconds since the Unix epoch. For display and ordering only. */
  nowMs(): number;
  /** Monotonic time in nanoseconds. For durations within one process only. */
  monotonicNs(): bigint;
}

export interface RandomSource {
  /** A float in the half-open interval [0, 1). */
  next(): number;
}
