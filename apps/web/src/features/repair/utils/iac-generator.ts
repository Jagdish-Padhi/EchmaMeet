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

/**
 * Generates a complete production Envoy Mesh bootstrap and static cluster configuration
 * representing the full topology mesh with connection pooling and circuit breakers.
 */
export function generateEnvoyMeshManifest(topology: Topology): string {
  const clusters: string[] = [];

  for (const edge of topology.edges) {
    const targetNode = topology.nodes.find((n) => n.id === edge.target);
    const targetName = targetNode?.label.toLowerCase().replace(/[^a-z0-9]/g, '_') ?? edge.target.replace(/-/g, '_');
    const clusterConfig = generateEnvoyClusterSnippet(edge.policy, targetName);
    const indented = clusterConfig
      .split('\n')
      .map((line) => `      ${line}`)
      .join('\n');
    clusters.push(`    - ${indented.trimStart()}`);
  }

  return `static_resources:
  listeners:
    - name: ingress_listener
      address:
        socket_address:
          address: 0.0.0.0
          port_value: 10000
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                stat_prefix: ingress_http
                route_config:
                  name: mesh_route
                  virtual_hosts:
                    - name: mesh_backend
                      domains: ["*"]
                      routes:
${topology.edges
  .map((e) => {
    const target = topology.nodes.find((n) => n.id === e.target);
    const targetName = target?.label.toLowerCase().replace(/[^a-z0-9]/g, '_') ?? e.target.replace(/-/g, '_');
    const timeoutSec = e.policy.timeoutMs !== null ? `${(e.policy.timeoutMs / 1000).toFixed(2)}s` : '2.00s';
    return `                        - match:
                            prefix: "/${e.source}-to-${e.target}"
                          route:
                            cluster: ${targetName}_cluster
                            timeout: ${timeoutSec}
                            retry_policy:
                              retry_on: "5xx,connect-failure,refused-stream"
                              num_retries: ${String(e.policy.retry.maxAttempts)}`;
  })
  .join('\n')}
  clusters:
${clusters.length > 0 ? clusters.join('\n') : '    []'}`;
}

