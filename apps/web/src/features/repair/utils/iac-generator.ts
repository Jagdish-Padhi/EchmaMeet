import type { EdgePolicy, Topology } from '@chaosboard/contracts';

/**
 * Generates production-ready Istio DestinationRule and VirtualService YAML
 * encoding the exact resilience timeouts, retry storms protection, and circuit breakers.
 */
export function generateIstioResilienceManifest(topology: Topology): string {
  const manifests: string[] = [];

  for (const edge of topology.edges) {
    const targetNode = topology.nodes.find((n) => n.id === edge.target);
    const targetHost = `${targetNode?.label.toLowerCase().replace(/[^a-z0-9]/g, '-') ?? edge.target}.production.svc.cluster.local`;

    const timeoutSec =
      edge.policy.timeoutMs !== null ? `${(edge.policy.timeoutMs / 1000).toFixed(2)}s` : '2.00s';
    const maxAttempts = String(edge.policy.retry.maxAttempts);
    const baseInterval = `${String(edge.policy.retry.backoffBaseMs)}ms`;

    const virtualService = `apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: vs-${edge.source}-to-${edge.target}
  namespace: production
  labels:
    managed-by: chaosboard-autonomous-sre
    resilience-calibrated: "true"
spec:
  hosts:
    - "${targetHost}"
  http:
    - route:
        - destination:
            host: "${targetHost}"
      timeout: ${timeoutSec}
      retries:
        attempts: ${maxAttempts}
        perTryTimeout: ${timeoutSec}
        retryOn: "5xx,connect-failure,refused-stream"
        retryBackOff:
          baseInterval: ${baseInterval}
          maxInterval: ${String(edge.policy.retry.maxBackoffMs)}ms`;

    manifests.push(virtualService);

    // DestinationRule with Circuit Breaker (Connection Pool & Outlier Detection)
    if (edge.policy.breaker.enabled) {
      const destinationRule = `---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: dr-${edge.target}-circuit-breaker
  namespace: production
  labels:
    managed-by: chaosboard-autonomous-sre
spec:
  host: "${targetHost}"
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: ${String(edge.policy.pool.maxConnections)}
      http:
        http1MaxPendingRequests: 100
        maxRequestsPerConnection: 10
    outlierDetection:
      consecutive5xxErrors: 3
      interval: 10s
      baseEjectionTime: ${String(edge.policy.breaker.cooldownMs)}ms
      maxEjectionPercent: ${String(edge.policy.breaker.failureThresholdPct)}`;

      manifests.push(destinationRule);
    }
  }

  return manifests.join('\n\n');
}

/**
 * Generates an Envoy Proxy HTTP connection manager cluster config snippet.
 */
export function generateEnvoyClusterSnippet(edgePolicy: EdgePolicy, targetName: string): string {
  const timeoutMs = edgePolicy.timeoutMs ?? 1000;
  return `name: ${targetName.toLowerCase()}_cluster
connect_timeout: ${(timeoutMs / 1000).toFixed(2)}s
type: STRICT_DNS
lb_policy: ROUND_ROBIN
circuit_breakers:
  thresholds:
    - priority: DEFAULT
      max_connections: ${String(edgePolicy.pool.maxConnections)}
      max_pending_requests: 100
      max_requests: 1024
      max_retries: ${String(edgePolicy.retry.maxAttempts)}
typed_extension_protocol_options:
  envoy.extensions.upstreams.http.v3.HttpProtocolOptions:
    "@type": type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions
    use_downstream_protocol_config: {}`;
}
