import type { NodeId, TopologyProblem } from '@chaosboard/contracts';

export interface ValidationBannerProps {
  readonly problems: readonly TopologyProblem[];
  readonly isValidating: boolean;
  readonly nodes?: readonly { id: string }[];
  readonly onSelectNode?: (id: NodeId) => void;
}

export function resolveNodeNumber(nodeId: string, nodes?: readonly { id: string }[]): number {
  if (nodes && nodes.length > 0) {
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx >= 0) return idx + 1;
  }
  const match = nodeId.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

function humanizeProblem(problem: TopologyProblem, nodes?: readonly { id: string }[]): string {
  const { code, message, nodeId, edgeId } = problem;
  const nodeRef = nodeId ? `Node #${String(resolveNodeNumber(nodeId, nodes))}` : 'component';

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
      return `Duplicate node detected (${nodeRef}). Every component must be unique.`;
    case 'duplicate_edge_id':
      return `Duplicate connection ID detected${edgeId ? ` (${edgeId})` : ''}.`;
    case 'unknown_edge_endpoint':
      return 'A connection points to a component that does not exist in the topology.';
    case 'self_loop':
      return `Self-loop detected on ${nodeRef}. Synchronous self-calls are not permitted.`;
    case 'duplicate_edge_pair':
      return 'Multiple redundant connections exist between the same two components.';
    case 'unknown_entry_node':
      return 'Designated ingress entry node is missing from the active architecture.';
    case 'entry_is_queue_consumer':
      return 'A background Queue Worker cannot serve as the primary ingress traffic entry point.';
    case 'cycle_detected':
      return 'Circular dependency detected along synchronous call paths. Break the loop or switch to an async queue link.';
    case 'unreachable_node':
      return `${nodeRef} has no route from the ingress entry point.`;
    case 'async_edge_target_not_consumer':
      return 'Asynchronous connections must terminate at a Queue Worker component.';
    case 'consumer_requires_async_edge':
      return 'Queue Workers require an asynchronous incoming connection.';
    case 'ledger_has_outgoing_edge':
      return 'Ledger Sink is a terminal persistence boundary and cannot make outbound calls.';
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
}: ValidationBannerProps) {
  if (isValidating || problems.length === 0) {
    return null;
  }

  return (
    <div className="validation-advisory-card" role="alert" aria-live="polite">
      <div className="validation-advisory-header">
        <div className="validation-advisory-title-group">
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="validation-advisory-title">
            Architecture Issues ({String(problems.length)})
          </span>
        </div>
      </div>

      <ul className="validation-advisory-list">
        {problems.map((p, idx) => (
          <li key={`${p.code}-${String(idx)}`} className="validation-advisory-item">
            <span className="validation-item-dot" />
            <div className="validation-item-body">
              <span className="validation-item-text">{humanizeProblem(p, nodes)}</span>
              {(p.nodeId || p.edgeId) && (
                <span
                  className="validation-target-chip"
                  onClick={p.nodeId && onSelectNode ? () => onSelectNode(p.nodeId as NodeId) : undefined}
                  title={p.nodeId ? `Highlight Node #${String(resolveNodeNumber(p.nodeId, nodes))} on canvas` : undefined}
                  role={p.nodeId && onSelectNode ? 'button' : undefined}
                  tabIndex={p.nodeId && onSelectNode ? 0 : undefined}
                  onKeyDown={
                    p.nodeId && onSelectNode
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectNode(p.nodeId as NodeId);
                          }
                        }
                      : undefined
                  }
                >
                  <span className="target-chip-type">{p.nodeId ? 'Node' : 'Edge'}</span>
                  <span className="target-chip-id">
                    {p.nodeId ? resolveNodeNumber(p.nodeId, nodes) : String(p.edgeId)}
                  </span>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
