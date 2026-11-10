import type { RunRecord, ReportExport, TradeOffReport } from '@chaosboard/contracts';

export interface GenerateReportOptions {
  runRecord: RunRecord;
  tradeOffReport?: TradeOffReport | null;
  diagramSvg?: string;
  generatedAt: string;
}

export function generateMarkdownReport(options: GenerateReportOptions): string {
  const { runRecord, tradeOffReport } = options;
  const lines: string[] = [];

  lines.push(`# EchmaMeet Experiment Report: ${runRecord.id}`);
  lines.push('');
  lines.push(`- **Status**: ${runRecord.status}`);
  lines.push(`- **Overall Verdict**: ${runRecord.overallStatus}`);
  lines.push(`- **Topology**: ${runRecord.topology.name} (${runRecord.topology.id})`);
  lines.push(`- **Started At**: ${runRecord.provenance.startedAt}`);
  lines.push(`- **Git Commit**: \`${runRecord.provenance.gitCommit}\``);
  lines.push(`- **Host**: ${runRecord.provenance.hostDescription}`);
  lines.push(`- **Node Version**: ${runRecord.provenance.nodeVersion}`);
  lines.push(`- **Toxiproxy Version**: ${runRecord.provenance.toxiproxyVersion}`);
  lines.push('');

  lines.push('## 1. System Topology');
  lines.push('');
  lines.push('| Node ID | Label | Kind | Max Workers | Queue Depth | Processing |');
  lines.push('|---|---|---|---|---|---|');
  for (const node of runRecord.topology.nodes) {
    const queueDepth = node.queue.mode === 'bounded' ? String(node.queue.maxDepth) : 'unbounded';
    const procMs =
      node.processing.distribution === 'constant'
        ? `${String(node.processing.ms)}ms`
        : `${String(node.processing.medianMs)}ms (lognormal)`;
    lines.push(
      `| \`${node.id}\` | ${node.label} | ${node.kind} | ${String(node.concurrency.maxWorkers)} | ${queueDepth} | ${procMs} |`,
    );
  }
  lines.push('');

  lines.push('### Edges and Policies');
  lines.push('');
  if (runRecord.topology.edges.length === 0) {
    lines.push('*(No edges configured)*');
  } else {
    lines.push('| Edge | Mode | Timeout | Max Attempts | Backoff Base | Breaker Threshold |');
    lines.push('|---|---|---|---|---|---|');
    for (const edge of runRecord.topology.edges) {
      const timeout =
        edge.policy.timeoutMs !== null ? `${String(edge.policy.timeoutMs)}ms` : 'none';
      const maxAtt = String(edge.policy.retry.maxAttempts);
      const backoff = `${String(edge.policy.retry.backoffBaseMs)}ms`;
      const breaker = edge.policy.breaker.enabled
        ? `${String(edge.policy.breaker.failureThresholdPct)}%`
        : 'disabled';
      lines.push(
        `| \`${edge.source}\` -> \`${edge.target}\` | ${edge.mode} | ${timeout} | ${maxAtt} | ${backoff} | ${breaker} |`,
      );
    }
  }
  lines.push('');

  lines.push('## 2. Injected Faults');
  lines.push('');
  if (runRecord.faults.length === 0) {
    lines.push('*(No chaos faults injected)*');
  } else {
    lines.push('| ID | Type | Edge Target | Latency | Jitter |');
    lines.push('|---|---|---|---|---|');
    for (const fault of runRecord.faults) {
      const lat = fault.type === 'latency' ? `${String(fault.latencyMs)}ms` : 'N/A';
      const jit = fault.type === 'latency' ? `${String(fault.jitterMs)}ms` : 'N/A';
      lines.push(`| \`${fault.id}\` | ${fault.type} | \`${fault.edgeId}\` | ${lat} | ${jit} |`);
    }
  }
  lines.push('');

  lines.push('## 3. Empirical Invariant Verdicts');
  lines.push('');
  if (runRecord.verdicts.length === 0) {
    lines.push('*(No invariants evaluated)*');
  } else {
    lines.push('| Invariant ID | Metric | Comparator | Threshold | Status | Evidence / Reason |');
    lines.push('|---|---|---|---|---|---|');
    for (const verdict of runRecord.verdicts) {
      const fMed = verdict.evidence.faultedAggregate?.median;
      const comp = verdict.evidence.comparator;
      const thresh = verdict.evidence.threshold;
      const reason =
        verdict.reason ??
        (fMed !== null && fMed !== undefined
          ? `Measured ${verdict.evidence.metric} = ${fMed.toFixed(1)} (${comp} ${String(thresh)})`
          : `${verdict.evidence.metric} ${comp} ${String(thresh)}`);
      lines.push(
        `| \`${verdict.invariantId}\` | ${verdict.evidence.metric} | ${verdict.evidence.comparator} | ${String(verdict.evidence.threshold)} | **${verdict.status}** | ${reason} |`,
      );
    }
  }
  lines.push('');

  lines.push('## 4. Empirical Performance Distribution');
  lines.push('');
  lines.push('| Metric | Baseline Median | Baseline IQR | Faulted Median | Faulted IQR |');
  lines.push('|---|---|---|---|---|');

  const b = runRecord.baselineAggregate?.metrics;
  const f = runRecord.faultedAggregate?.metrics;

  const fmt = (val: number | null | undefined) =>
    val !== null && val !== undefined ? String(val) : 'N/A';

  lines.push(
    `| p50 Latency (ms) | ${fmt(b?.p50LatencyMs.median)} | ${fmt(b?.p50LatencyMs.iqr)} | ${fmt(f?.p50LatencyMs.median)} | ${fmt(f?.p50LatencyMs.iqr)} |`,
  );
  lines.push(
    `| p99 Latency (ms) | ${fmt(b?.p99LatencyMs.median)} | ${fmt(b?.p99LatencyMs.iqr)} | ${fmt(f?.p99LatencyMs.median)} | ${fmt(f?.p99LatencyMs.iqr)} |`,
  );
  lines.push(
    `| Completion Rate | ${fmt(b?.completionRate.median)} | ${fmt(b?.completionRate.iqr)} | ${fmt(f?.completionRate.median)} | ${fmt(f?.completionRate.iqr)} |`,
  );
  lines.push(
    `| Duplicate Write Rate | ${fmt(b?.duplicateWriteRate.median)} | ${fmt(b?.duplicateWriteRate.iqr)} | ${fmt(f?.duplicateWriteRate.median)} | ${fmt(f?.duplicateWriteRate.iqr)} |`,
  );
  lines.push('');

  if (tradeOffReport) {
    lines.push('## 5. Trade-Off Analysis');
    lines.push('');
    lines.push(`- **Iterations Tried**: ${String(tradeOffReport.iterationsTried)}`);
    lines.push(`- **Bottleneck Reason**: ${tradeOffReport.bottleneckReason}`);
    lines.push(`- **Satisfied Invariants**: ${String(tradeOffReport.satisfiedInvariants.length)}`);
    lines.push(
      `- **Unsatisfied Invariants**: ${String(tradeOffReport.unsatisfiedInvariants.length)}`,
    );
    lines.push('');
    lines.push('### Recommendations');
    lines.push('');
    for (const rec of tradeOffReport.humanRecommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(
    '*Generated deterministically by ChaosBoard. All numbers derived from empirical trial execution.*',
  );

  return lines.join('\n');
}

export function generateReportExport(options: GenerateReportOptions): ReportExport {
  const { runRecord, tradeOffReport, diagramSvg = '', generatedAt } = options;

  const markdown = generateMarkdownReport(options);

  return {
    runId: runRecord.id,
    status: runRecord.status,
    generatedAt,
    provenance: runRecord.provenance,
    topology: runRecord.topology,
    faults: runRecord.faults,
    invariants: runRecord.invariants,
    baselineMetrics: runRecord.baselineAggregate,
    faultedMetrics: runRecord.faultedAggregate,
    repairedMetrics: null,
    verdicts: runRecord.verdicts,
    repairTimeline: [],
    tradeOffReport: tradeOffReport ?? null,
    markdown,
    diagramSvg,
  };
}
