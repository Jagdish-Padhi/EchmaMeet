import type { RedStrokePoint, VisionBox, VisionExtractedNode } from '@chaosboard/contracts';
import type { RawImageData } from './color-threshold';

/** Intersection-over-union of two normalised boxes. */
export function boxIou(a: VisionBox, b: VisionBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union <= 0 ? 0 : inter / union;
}

export function unionBox(boxes: readonly VisionBox[], margin = 0.02): VisionBox | null {
  if (boxes.length === 0) return null;
  const x1 = Math.max(0, Math.min(...boxes.map((b) => b.x)) - margin);
  const y1 = Math.max(0, Math.min(...boxes.map((b) => b.y)) - margin);
  const x2 = Math.min(1, Math.max(...boxes.map((b) => b.x + b.width)) + margin);
  const y2 = Math.min(1, Math.max(...boxes.map((b) => b.y + b.height)) + margin);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/** Crops raw pixels to a normalised box. */
export function cropImage(image: RawImageData, box: VisionBox): RawImageData {
  const x0 = Math.max(0, Math.floor(box.x * image.width));
  const y0 = Math.max(0, Math.floor(box.y * image.height));
  const w = Math.max(1, Math.min(image.width - x0, Math.ceil(box.width * image.width)));
  const h = Math.max(1, Math.min(image.height - y0, Math.ceil(box.height * image.height)));
  const out = new Uint8Array(w * h * image.channels);
  for (let row = 0; row < h; row += 1) {
    const src = ((y0 + row) * image.width + x0) * image.channels;
    out.set(image.data.subarray(src, src + w * image.channels), row * w * image.channels);
  }
  return { width: w, height: h, channels: image.channels, data: out };
}

/** Maps points detected inside a crop back to full-image normalised coordinates. */
export function remapCropPoints(
  points: readonly RedStrokePoint[],
  box: VisionBox,
): RedStrokePoint[] {
  return points.map(([px, py]) => [
    Math.max(0, Math.min(1, box.x + px * box.width)),
    Math.max(0, Math.min(1, box.y + py * box.height)),
  ]);
}

export interface GroundingReport {
  readonly nodes: VisionExtractedNode[];
  readonly snapped: number;
  readonly unmatched: number;
}

/**
 * Grounds language-model node boxes in SAM 3.1 shapes. A model box that overlaps a detected
 * shape (IoU >= minIou) is replaced by the shape's pixel-accurate box and its confidence is
 * raised; each SAM shape is used at most once. Nodes with no matching shape keep the model's
 * box, and are counted so the caller can warn the user instead of silently trusting them.
 */
export function groundNodesWithSam(
  nodes: readonly VisionExtractedNode[],
  shapes: readonly VisionBox[],
  minIou = 0.3,
): GroundingReport {
  const used = new Set<number>();
  let snapped = 0;
  const grounded = nodes.map((node) => {
    if (!node.box) return node;
    let best = -1;
    let bestIou = minIou;
    shapes.forEach((shape, index) => {
      if (used.has(index)) return;
      const iou = boxIou(node.box as VisionBox, shape);
      if (iou > bestIou) {
        best = index;
        bestIou = iou;
      }
    });
    if (best < 0) return node;
    used.add(best);
    snapped += 1;
    return {
      ...node,
      box: shapes[best],
      confidence: Math.min(1, Math.max(node.confidence, 0.5) + 0.2),
    };
  });
  return {
    nodes: grounded,
    snapped,
    unmatched: nodes.filter((n) => n.box).length - snapped,
  };
}
