import type { Topology, Fault, InvariantVerdict } from '@chaosboard/contracts';

export interface DiagramOptions {
  topology: Topology;
  faults: Fault[];
  verdicts?: InvariantVerdict[];
  width?: number;
  height?: number;
}

export function generateDeterministicTopologySvg(options: DiagramOptions): string {
  const { topology, faults, verdicts = [], width = 800, height = 450 } = options;

  const nodeCount = Math.max(1, topology.nodes.length);
  const paddingX = 80;
  const paddingY = 80;
  const usableWidth = width - 2 * paddingX;
  const usableHeight = height - 2 * paddingY;

  // Calculate node positions deterministically
  const nodePositions = new Map<string, { x: number; y: number }>();
  topology.nodes.forEach((node, index) => {
    let x: number;
    let y: number;

    if (nodeCount === 1) {
      x = width / 2;
      y = height / 2;
    } else {
      // Horizontal spread or simple 2-row layout if > 4 nodes
      if (nodeCount <= 4) {
        x = paddingX + (index / (nodeCount - 1)) * usableWidth;
        y = height / 2;
      } else {
        const col = index % Math.ceil(nodeCount / 2);
        const row = Math.floor(index / Math.ceil(nodeCount / 2));
        const cols = Math.ceil(nodeCount / 2);
        x = paddingX + (col / Math.max(1, cols - 1)) * usableWidth;
        y = paddingY + row * (usableHeight / 2) + 60;
      }
    }
    nodePositions.set(node.id, { x, y });
  });

  // Map of faults by edgeId
  const faultByEdge = new Map<string, Fault>();
  for (const fault of faults) {
    faultByEdge.set(fault.edgeId, fault);
  }

  const svgParts: string[] = [];

  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(width)} ${String(height)}" width="100%" height="100%" style="background-color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">`,
  );

  // Definitions: Markers
  svgParts.push(`  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
    </marker>
    <marker id="arrow-fault" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
    </marker>
  </defs>`);

  // Title & Metadata
  svgParts.push(
    `  <text x="24" y="36" fill="#f8fafc" font-size="16" font-weight="bold">${escapeXml(topology.name)}</text>`,
  );
  svgParts.push(
    `  <text x="24" y="56" fill="#64748b" font-size="12">Topology ID: ${escapeXml(topology.id)}</text>`,
  );

  // Draw Edges
  for (const edge of topology.edges) {
    const srcPos = nodePositions.get(edge.source);
    const tgtPos = nodePositions.get(edge.target);

    if (srcPos && tgtPos) {
      const isFaulted = faultByEdge.has(edge.id);
      const strokeColor = isFaulted ? '#ef4444' : '#64748b';
      const markerId = isFaulted ? 'url(#arrow-fault)' : 'url(#arrow)';
      const strokeWidth = isFaulted ? 3 : 2;
      const strokeDasharray = edge.mode === 'async_enqueue' ? '6,4' : 'none';

      svgParts.push(
        `  <line x1="${String(srcPos.x)}" y1="${String(srcPos.y)}" x2="${String(tgtPos.x)}" y2="${String(tgtPos.y)}" stroke="${strokeColor}" stroke-width="${String(strokeWidth)}" stroke-dasharray="${strokeDasharray}" marker-end="${markerId}" />`,
      );

      // Edge label
      const midX = (srcPos.x + tgtPos.x) / 2;
      const midY = (srcPos.y + tgtPos.y) / 2 - 12;
      const fault = faultByEdge.get(edge.id);
      let faultLabel = '';
      if (fault) {
        const extra = fault.type === 'latency' ? ` +${String(fault.latencyMs)}ms` : '';
        faultLabel = `[${fault.type.toUpperCase()}${extra}]`;
      } else if (edge.policy.timeoutMs !== null) {
        faultLabel = `${String(edge.policy.timeoutMs)}ms`;
      }

      if (faultLabel) {
        svgParts.push(
          `  <rect x="${String(midX - 45)}" y="${String(midY - 12)}" width="90" height="18" rx="4" fill="${isFaulted ? '#450a0a' : '#1e293b'}" stroke="${strokeColor}" stroke-width="1" />`,
        );
        svgParts.push(
          `  <text x="${String(midX)}" y="${String(midY + 1)}" fill="${isFaulted ? '#fca5a5' : '#cbd5e1'}" font-size="10" text-anchor="middle">${escapeXml(faultLabel)}</text>`,
        );
      }
    }
  }

  // Draw Nodes
  for (const node of topology.nodes) {
    const pos = nodePositions.get(node.id);
    if (!pos) continue;

    const isEntry = topology.entry.nodeId === node.id;
    const boxWidth = 140;
    const boxHeight = 70;
    const boxX = pos.x - boxWidth / 2;
    const boxY = pos.y - boxHeight / 2;

    const strokeColor = isEntry ? '#b45309' : '#334155';
    const bgColor = isEntry ? '#1e1b4b' : '#1e293b';

    svgParts.push(
      `  <rect x="${String(boxX)}" y="${String(boxY)}" width="${String(boxWidth)}" height="${String(boxHeight)}" rx="8" fill="${bgColor}" stroke="${strokeColor}" stroke-width="${isEntry ? '2' : '1'}" />`,
    );

    // Node Title & Label
    svgParts.push(
      `  <text x="${String(pos.x)}" y="${String(boxY + 22)}" fill="#f1f5f9" font-size="12" font-weight="bold" text-anchor="middle">${escapeXml(node.label)}</text>`,
    );
    svgParts.push(
      `  <text x="${String(pos.x)}" y="${String(boxY + 40)}" fill="#94a3b8" font-size="10" text-anchor="middle">${escapeXml(node.kind)} (${String(node.concurrency.maxWorkers)} workers)</text>`,
    );

    const queueStr = node.queue.mode === 'bounded' ? `q:${String(node.queue.maxDepth)}` : 'q:inf';
    const procStr =
      node.processing.distribution === 'constant'
        ? `proc:${String(node.processing.ms)}ms`
        : `proc:${String(node.processing.medianMs)}ms`;
    svgParts.push(
      `  <text x="${String(pos.x)}" y="${String(boxY + 56)}" fill="#64748b" font-size="9" text-anchor="middle">${escapeXml(`${queueStr} ${procStr}`.trim())}</text>`,
    );
  }

  // Invariant verdicts banner if present
  if (verdicts.length > 0) {
    const violatedCount = verdicts.filter((v) => v.status === 'VIOLATED').length;
    const bannerColor = violatedCount > 0 ? '#ef4444' : '#22c55e';
    const bannerText =
      violatedCount > 0
        ? `${String(violatedCount)} OF ${String(verdicts.length)} INVARIANTS VIOLATED`
        : `ALL ${String(verdicts.length)} INVARIANTS PASSED`;

    svgParts.push(
      `  <rect x="${String(width - 240)}" y="20" width="220" height="28" rx="6" fill="#0f172a" stroke="${bannerColor}" stroke-width="2" />`,
    );
    svgParts.push(
      `  <text x="${String(width - 130)}" y="38" fill="${bannerColor}" font-size="10" font-weight="bold" text-anchor="middle">${escapeXml(bannerText)}</text>`,
    );
  }

  svgParts.push('</svg>');

  return svgParts.join('\n');
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
