import type { NodeId, TopologyProblem } from '@chaosboard/contracts';

export interface ValidationBannerProps {
  readonly problems: readonly TopologyProblem[];
  readonly isValidating: boolean;
  readonly nodes?: readonly { id: string; label?: string | undefined }[] | undefined;
  readonly onSelectNode?: ((id: NodeId) => void) | undefined;
  readonly entryNodeId?: NodeId | null | undefined;
  readonly onFixEntryNode?: (() => void) | undefined;
  readonly entryNodeCandidateLabel?: string | undefined;
}

export function resolveNodeNumber(nodeId: string, nodes?: readonly { id: string }[]): number {
  if (nodes && nodes.length > 0) {
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx >= 0) return idx + 1;
  }
  const match = nodeId.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

function resolveNodeLabel(
  nodeId: string,
  nodes?: readonly { id: string; label?: string | undefined }[] | undefined,
): string | null {
  if (nodes && nodes.length > 0) {
    const node = nodes.find((n) => n.id === nodeId);
    if (node?.label) return node.label;
  }
  return null;
}

function humanizeProblem(
  problem: TopologyProblem,
  nodes?: readonly { id: string; label?: string | undefined }[] | undefined,
): string {
  const { code, message, nodeId, edgeId } = problem;
  const num = nodeId ? resolveNodeNumber(nodeId, nodes) : null;
  const label = nodeId ? resolveNodeLabel(nodeId, nodes) : null;
  const nodeRef =
    num !== null ? (label ? `Node ${String(num)} (${label})` : `Node ${String(num)}`) : 'Component';

  switch (code) {
    case 'schema_violation': {
      if (message.includes('Unrecognized key')) {
        const match = /Unrecognized key: "([^"]+)"/.exec(message);
        const fieldName = match ? match[1] : 'field';
        return `Component has property "${fieldName ?? 'property'}" not permitted for its architecture role.`;
      }
      if (message.includes('Number must be')) {
        return 'A parameter value is outside allowed safe operational limits.';
      }
      return message.replace(/^nodes\.\d+\.?/, 'Node: ').replace(/^edges\.\d+\.?/, 'Edge: ');
    }
    case 'duplicate_node_id':
      return `Duplicate component detected (${nodeRef}). Every service must have a unique identifier.`;
    case 'duplicate_edge_id':
      return `Duplicate connection ID detected${edgeId ? ` (${edgeId})` : ''}.`;
    case 'unknown_edge_endpoint':
      return 'A connection points to a component that does not exist in the active architecture.';
    case 'self_loop':
      return `Self-loop detected on ${nodeRef}. Synchronous self-calls cause recursion deadlocks.`;
    case 'duplicate_edge_pair':
      return 'Multiple redundant connections exist between the same two components.';
    case 'unknown_entry_node':
      return 'Designated ingress entry node is missing from the active architecture.';
    case 'entry_is_queue_consumer':
      return `${nodeRef} is a Queue Worker and cannot serve as the primary ingress traffic entry point.`;
    case 'cycle_detected':
      return 'Circular dependency detected along synchronous call paths. Break the loop or switch to an asynchronous queue link.';
    case 'unreachable_node':
      return `${nodeRef} has no incoming path from the ingress entry point.`;
    case 'async_edge_target_not_consumer':
      return 'Asynchronous message links must terminate at an asynchronous Queue Worker.';
    case 'consumer_requires_async_edge':
      return `${nodeRef} is an asynchronous Queue Worker and requires an async_enqueue incoming connection.`;
    case 'ledger_has_outgoing_edge':
      return `Ledger Sink (${nodeRef}) is a terminal persistence boundary and cannot make outbound downstream calls.`;
    case 'stale_fallback_requires_cache_source':
      return 'Serve Stale fallback policy requires an in-memory Cache origin.';
    default:
      return message;
  }
}

export function ValidationBanner({
  problems,
  isValidating,
  nodes,
  onSelectNode,
  entryNodeId,
  onFixEntryNode,
  entryNodeCandidateLabel,
}: ValidationBannerProps) {
  if (isValidating || problems.length === 0) {
    return null;
  }

  const isEntryMissing = !entryNodeId && problems.some((p) => p.code === 'unknown_entry_node');

  return (
    <div className="validation-advisory-card" role="alert" aria-live="polite">
      <div className="validation-advisory-header">
        <div className="validation-advisory-title-group">
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="validation-icon"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="validation-advisory-title">
            Topology Incompatibilities ({String(problems.length)})
          </span>
        </div>
        <span className="validation-status-tag">Preflight Blocked</span>
      </div>

      <p className="validation-advisory-subtext">
        Simulation and resilience verification require a valid acyclic topology without role
        violations.
      </p>

      <ul className="validation-advisory-list">
        {problems.map((p, idx) => {
          const nodeNum = p.nodeId ? resolveNodeNumber(p.nodeId, nodes) : null;
          const nodeLabel = p.nodeId ? resolveNodeLabel(p.nodeId, nodes) : null;

          return (
            <li key={`${p.code}-${String(idx)}`} className="validation-advisory-item">
              <span className="validation-item-dot" />
              <div className="validation-item-content">
                <span className="validation-item-text">{humanizeProblem(p, nodes)}</span>
                {(p.nodeId || p.edgeId) && (
                  <button
                    type="button"
                    className="validation-target-chip"
                    onClick={
                      p.nodeId && onSelectNode ? () => onSelectNode(p.nodeId as NodeId) : undefined
                    }
                    title={
                      p.nodeId
                        ? `Focus Node #${String(nodeNum)} on canvas`
                        : `Connection ${String(p.edgeId)}`
                    }
                  >
                    <span className="target-chip-type">{p.nodeId ? 'Node' : 'Edge'}</span>
                    <span className="target-chip-id">
                      {nodeNum !== null
                        ? `${String(nodeNum)}${nodeLabel ? ` · ${nodeLabel}` : ''}`
                        : String(p.edgeId)}
                    </span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {isEntryMissing && onFixEntryNode && entryNodeCandidateLabel && (
        <div className="validation-quick-fix-row">
          <button type="button" className="btn-compatibility-fix" onClick={onFixEntryNode}>
            Designate &ldquo;{entryNodeCandidateLabel}&rdquo; as Ingress Entry
          </button>
        </div>
      )}
    </div>
  );
}
