# Limitations

These limits are part of the product's honest description and must appear in the README.

## What the sandbox can and cannot tell you

The sandbox runs stand-in services configured from the topology. It exercises resilience policies faithfully: timeouts, retries, backoff, jitter, connection pools, bounded and unbounded queues, circuit breakers, rate limits, idempotency handling, and fallback behavior. It does not model database internals, garbage collection behavior of the user's real runtime, kernel behavior, real network topology, or the user's actual code.

Results come from one host. Before and after comparisons on the same host are meaningful. Absolute numbers are properties of that host and of the moment.

The tool never claims to prove correctness. It reports empirical results over a stated number of trials, with a spread, and it says INCONCLUSIVE or INVALID when the measurement does not support a verdict.

## Other known limits

- Version 1 topologies are acyclic, have one entry node, and allow at most 12 nodes and 24 edges.
- Faults are injected at the TCP level by Toxiproxy. Packet loss is not a Toxiproxy toxic; partial failure is expressed as a fraction of connections affected.
- The data plane runs on Node.js. Event loop delay in a worker or in the load generator can distort a measurement; the tool measures it and invalidates trials that exceed the configured limits.
- Only one experiment runs at a time on a host, because measurement needs uncontested CPU.
- Model-proposed repairs are limited to a typed catalog of policy changes. The model cannot write code or change anything outside that catalog.
- Model output is not deterministic. Stored run records explain how a result was produced; they do not guarantee identical numbers on a rerun.
