import type { Topology } from '@chaosboard/contracts';

export type HazardSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RuleHazard {
  readonly id: string;
  readonly title: string;
  readonly severity: HazardSeverity;
  readonly risk: string;
  readonly recommendation: string;
  readonly targetNodeId?: string;
  readonly targetEdgeId?: string;
  readonly patch?: {
    readonly mode?: 'sync_call' | 'async_enqueue';
    readonly retry?: {
      maxAttempts?: number;
      jitter?: 'none' | 'full' | 'equal';
      backoffBaseMs?: number;
    };
    readonly breaker?: { enabled?: boolean; failureThresholdPct?: number; cooldownMs?: number };
    readonly timeoutMs?: number | null;
    readonly fallback?: 'none' | 'fail_fast_503' | 'serve_stale';
    readonly idempotency?: { sendKey: boolean };
    readonly queue?: { mode: 'bounded' | 'unbounded'; maxDepth?: number };
    readonly concurrency?: { maxWorkers?: number };
  };
  /** Short Hindi rendering used for spoken replies. */
  readonly riskHi: string;
}

const SEVERITY_RANK: Record<HazardSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/**
 * Deterministic distributed-systems hazard rules. These are the ground truth the review agent
 * speaks from when no language model is configured, and the guard rail when one is.
 */
export function detectHazards(topology: Topology): RuleHazard[] {
  const hazards: RuleHazard[] = [];
  const byId = new Map(topology.nodes.map((n) => [n.id, n]));

  // 1. Critical Circular Synchronous Dependency Cycles (Deadlock Risk)
  const syncAdj = new Map<string, { target: string; edgeId: string }[]>();
  for (const edge of topology.edges) {
    const isSync = (edge as { mode?: string }).mode === undefined || edge.mode === 'sync_call';
    if (isSync) {
      const list = syncAdj.get(edge.source) ?? [];
      list.push({ target: edge.target, edgeId: edge.id });
      syncAdj.set(edge.source, list);
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const detectedCycles: { path: string[]; edgeIds: string[] }[] = [];

  function dfsCycle(curr: string, path: string[], edgeIds: string[]) {
    visited.add(curr);
    inStack.add(curr);
    path.push(curr);

    const neighbors = syncAdj.get(curr) ?? [];
    for (const { target, edgeId } of neighbors) {
      if (!visited.has(target)) {
        dfsCycle(target, [...path], [...edgeIds, edgeId]);
      } else if (inStack.has(target)) {
        const startIdx = path.indexOf(target);
        if (startIdx >= 0) {
          detectedCycles.push({
            path: [...path.slice(startIdx), target],
            edgeIds: [...edgeIds.slice(startIdx), edgeId],
          });
        }
      }
    }

    inStack.delete(curr);
  }

  for (const node of topology.nodes) {
    if (!visited.has(node.id)) {
      dfsCycle(node.id, [], []);
    }
  }

  for (const cycle of detectedCycles) {
    const cycleLabels = cycle.path.map((nid) => byId.get(nid as unknown as import('@chaosboard/contracts').NodeId)?.label || nid);
    const primaryEdgeId = cycle.edgeIds[cycle.edgeIds.length - 1];
    hazards.push({
      id: `cycle-${cycle.path[0]}-${cycle.path[1]}`,
      title: 'Critical Circular Call Dependency',
      severity: 'critical',
      risk: `Circular synchronous RPC chain detected: [${cycleLabels.join(' -> ')}]. Cyclic sync RPCs cause distributed thread pool deadlocks and cascading timeouts under load.`,
      riskHi: `${cycleLabels.join(' -> ')} के बीच सर्कुलर डिपेंडेंसी है, इससे डिस्ट्रीब्यूटेड डेडलॉक और कैस्केडिंग फेलियर हो सकता है।`,
      recommendation:
        'Break the sync call cycle by decoupling with an asynchronous event queue or isolating state.',
      ...(cycle.path[0] ? { targetNodeId: cycle.path[0] } : {}),
      ...(primaryEdgeId ? { targetEdgeId: primaryEdgeId } : {}),
      patch: {
        mode: 'async_enqueue',
        breaker: {
          enabled: true,
          failureThresholdPct: 50,
          cooldownMs: 3000,
        },
      },
    });
  }

  for (const edge of topology.edges) {
    const target = byId.get(edge.target);
    const source = byId.get(edge.source);

    // Critical Self-Loop
    if (edge.source === edge.target) {
      hazards.push({
        id: `self-loop-${edge.id}`,
        title: 'Self-Loop Recursion Hazard',
        severity: 'critical',
        risk: `Edge "${edge.id}" connects node "${source?.label ?? edge.source}" to itself. Recursive self-calls cause immediate thread starvation deadlocks.`,
        riskHi: `एज "${edge.id}" नोड को खुद से जोड़ती है, जिससे रिकर्सिव डेडलॉक हो सकता है।`,
        recommendation: 'Delete the self-loop connection.',
        targetEdgeId: edge.id,
      });
      continue;
    }

    // Preflight Role Incompatibility: Consumer requires async edge
    if (target?.kind === 'queue_consumer' && edge.mode !== 'async_enqueue') {
      hazards.push({
        id: `consumer-sync-${edge.id}`,
        title: 'Queue Worker Ingestion Mode Mismatch',
        severity: 'critical',
        risk: `Node "${target.label ?? target.id}" is an asynchronous Queue Worker, but edge "${edge.id}" into it uses synchronous call mode. Queue workers only ingest via asynchronous enqueueing.`,
        riskHi: `${target.label ?? target.id} एक क्यू कंज्यूमर है, इसमें आने वाली कॉल एसिंक्रोनस होनी चाहिए।`,
        recommendation: 'Configure edge mode to async_enqueue.',
        targetEdgeId: edge.id,
        targetNodeId: target.id,
        patch: { mode: 'async_enqueue' },
      });
    }

    // Preflight Role Incompatibility: Async enqueue target must be a consumer
    if (edge.mode === 'async_enqueue' && target && target.kind !== 'queue_consumer') {
      hazards.push({
        id: `async-target-${edge.id}`,
        title: 'Async Enqueue Target Role Mismatch',
        severity: 'critical',
        risk: `Edge "${edge.id}" enqueues asynchronously, but target "${target.label ?? target.id}" is a ${target.kind} node rather than a Queue Worker.`,
        riskHi: `एज "${edge.id}" एसिंक्रोनस है, लेकिन टारगेट ${target.label ?? target.id} क्यू कंज्यूमर नहीं है।`,
        recommendation: 'Switch edge mode to sync_call or change target role to queue_consumer.',
        targetEdgeId: edge.id,
        targetNodeId: target.id,
        patch: { mode: 'sync_call' },
      });
    }

    const policy = edge.policy ?? {
      retry: { maxAttempts: 0, jitter: 'none', backoffBaseMs: 100 },
      breaker: { enabled: false, failureThresholdPct: 50, cooldownMs: 3000 },
      timeoutMs: null,
      idempotency: false,
    };
    const retry = policy.retry ?? { maxAttempts: 0, jitter: 'none', backoffBaseMs: 100 };
    const breaker = policy.breaker ?? { enabled: false, failureThresholdPct: 50, cooldownMs: 3000 };
    const timeoutMs = policy.timeoutMs ?? null;
    const idempotency = policy.idempotency ?? false;
    const link = `${source?.label ?? edge.source} to ${target?.label ?? edge.target}`;
    const isSync = (edge as { mode?: string }).mode === undefined || edge.mode === 'sync_call';

    if (
      isSync &&
      retry.maxAttempts >= 2 &&
      (retry.jitter === 'none' || !breaker.enabled)
    ) {
      const isCritical = retry.maxAttempts >= 3 && !breaker.enabled;
      hazards.push({
        id: `retry-storm-${edge.id}`,
        title: isCritical ? 'Critical Retry Storm Hazard' : 'Retry Storm Vulnerability',
        severity: isCritical ? 'critical' : 'high',
        risk: `${link} retries ${String(retry.maxAttempts)} times with ${retry.jitter === 'none' ? 'no jitter' : retry.jitter} and ${breaker.enabled ? 'circuit breaker' : 'no circuit breaker'}, so downstream latency will cause lockstep retry storms and thread exhaustion.`,
        riskHi: `${source?.label ?? edge.source} से ${target?.label ?? edge.target} पर ${String(retry.maxAttempts)} बार रिट्राई बिना जिटर और सर्किट ब्रेकर के है, इससे रिट्राई स्टॉर्म हो सकता है।`,
        recommendation: 'Enable full jitter and a circuit breaker with 2s cooldown.',
        targetEdgeId: edge.id,
        patch: {
          timeoutMs: 500,
          fallback: 'fail_fast_503',
          retry: { maxAttempts: 2, jitter: 'full', backoffBaseMs: 100 },
          breaker: { enabled: true, failureThresholdPct: 50, cooldownMs: 3000 },
        },
      });
    }

    if (isSync && (timeoutMs === null || timeoutMs > 2000)) {
      const isExcessive = timeoutMs === null || timeoutMs >= 5000;
      hazards.push({
        id: `timeout-${edge.id}`,
        title: isExcessive ? 'Critical Stalled Thread Timeout' : 'Excessive Latency Timeout',
        severity: isExcessive ? 'high' : 'medium',
        risk: `${link} has ${timeoutMs === null ? 'no timeout' : `a ${String(timeoutMs)} ms timeout`}, so stalled calls tie up workers and cascade upstream.`,
        riskHi: `${source?.label ?? edge.source} से ${target?.label ?? edge.target} पर ${timeoutMs === null ? 'कोई टाइमआउट नहीं है' : `${String(timeoutMs)} मिलीसेकंड का टाइमआउट बहुत लंबा है`}, इससे अटके कॉल वर्कर्स रोक सकते हैं।`,
        recommendation: 'Set a timeout of about 500 to 1000 ms with fail-fast fallback.',
        targetEdgeId: edge.id,
        patch: {
          timeoutMs: 500,
          fallback: 'fail_fast_503',
          retry: { maxAttempts: retry.maxAttempts > 0 ? retry.maxAttempts : 2, jitter: 'full', backoffBaseMs: 100 },
          breaker: { enabled: true, failureThresholdPct: 50, cooldownMs: 3000 },
        },
      });
    }

    if (target?.kind === 'ledger_sink' && retry.maxAttempts > 1 && !idempotency.sendKey) {
      hazards.push({
        id: `idempotency-${edge.id}`,
        title: 'Retried writes without idempotency key',
        severity: 'critical',
        risk: `${link} retries writes into a ledger without an idempotency key, so a retry can double-commit.`,
        riskHi: `${source?.label ?? edge.source} से ${target.label} लेजर में रिट्राई बिना आइडेम्पोटेंसी की के है, इससे डुप्लिकेट कमिट हो सकता है।`,
        recommendation: 'Send an idempotency key on every write.',
        targetEdgeId: edge.id,
        targetNodeId: target.id,
        patch: {
          timeoutMs: 800,
          fallback: 'fail_fast_503',
          breaker: { enabled: true, failureThresholdPct: 40, cooldownMs: 3000 },
          idempotency: { sendKey: true },
        },
      });
    }

    const sourceWorkers = (source as { concurrency?: { maxWorkers?: number } })?.concurrency?.maxWorkers;
    const targetWorkers = (target as { concurrency?: { maxWorkers?: number } })?.concurrency?.maxWorkers;
    if (
      isSync &&
      sourceWorkers !== undefined &&
      targetWorkers !== undefined &&
      sourceWorkers >= targetWorkers * 3 &&
      targetWorkers <= 10
    ) {
      hazards.push({
        id: `capacity-bottleneck-${edge.id}`,
        title: 'Downstream Worker Capacity Bottleneck',
        severity: 'high',
        risk: `${source?.label ?? edge.source} (${String(sourceWorkers)} workers) connects into ${target?.label ?? edge.target} which only has ${String(targetWorkers)} workers. Upstream concurrency can easily saturate downstream queue capacity under burst load.`,
        riskHi: `${source?.label ?? edge.source} में ${String(sourceWorkers)} वर्कर्स हैं जबकि ${target?.label ?? edge.target} में केवल ${String(targetWorkers)} वर्कर्स हैं, इससे डाउनस्ट्रीम वर्कर्स जाम हो सकते हैं।`,
        recommendation: `Scale ${target?.label ?? edge.target} concurrency to at least ${String(sourceWorkers)} workers or bound queue depth with backpressure.`,
        targetEdgeId: edge.id,
        ...(target?.id ? { targetNodeId: target.id } : {}),
        patch: {
          timeoutMs: 500,
          fallback: 'fail_fast_503',
          breaker: { enabled: true, failureThresholdPct: 50, cooldownMs: 3000 },
          concurrency: { maxWorkers: Math.max(sourceWorkers, 20) },
        },
      });
    }
  }

  for (const node of topology.nodes) {
    if (node.queue?.mode === 'unbounded' && node.kind !== 'cache') {
      hazards.push({
        id: `queue-${node.id}`,
        title: 'Unbounded queue depth',
        severity: 'high',
        risk: `${node.label} has an unbounded queue, so a traffic surge grows memory until it crashes instead of shedding load.`,
        riskHi: `${node.label} की क्यू अनबाउंडेड है, ट्रैफिक बढ़ने पर मेमोरी भरकर क्रैश हो सकता है।`,
        recommendation: 'Bound the queue depth and shed load.',
        targetNodeId: node.id,
        patch: { queue: { mode: 'bounded', maxDepth: 100 } },
      });
    }
  }

  return hazards.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

export function composeSpokenOpinion(
  hazards: readonly RuleHazard[],
  language: 'en' | 'hi',
  nodeCount: number,
): string {
  const top = hazards[0];
  if (!top) {
    return language === 'hi'
      ? `आपके इन ${String(nodeCount)} सर्विसेज़ का आर्किटेक्चर संतुलित है। जब आप चाहें, हम केऑस ट्रायल चलाकर इसे टेस्ट कर सकते हैं।`
      : `Looking over these ${String(nodeCount)} services, the topology is clean and balanced. Whenever you are ready, we can run a short chaos trial to verify resilience.`;
  }
  const more = hazards.length - 1;
  if (language === 'hi') {
    return `${top.riskHi}${more > 0 ? ` इसके अलावा ${String(more)} अन्य रिस्क भी हैं।` : ''} सलाह है: ${top.recommendation}`;
  }
  return `${top.risk} ${more > 0 ? `There ${more === 1 ? 'is also 1 other issue' : `are also ${String(more)} other issues`} on the board.` : ''} I recommend: ${top.recommendation}`;
}
