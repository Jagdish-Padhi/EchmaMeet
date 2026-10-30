import type { RedStrokePoint, VisionBox } from '@chaosboard/contracts';
import type { SamSegmentationResult } from '../../meta-ai';
import { simplifyPolyline } from './geometry';

export interface ParsedSamOutput {
  readonly boxes: readonly {
    readonly label: string;
    readonly confidence: number;
    readonly box: VisionBox;
  }[];
  readonly strokePolyline?: readonly RedStrokePoint[] | undefined;
}

/**
 * Pure parser for SAM 3.1 segmentation output records.
 * Extracts bounding boxes for nodes and identifies any prominent stroke mask.
 */
export function parseSamSegmentation(result: SamSegmentationResult): ParsedSamOutput {
  const boxes: { label: string; confidence: number; box: VisionBox }[] = [];
  let strokePolyline: RedStrokePoint[] | undefined;

  for (const mask of result.masks) {
    const isStroke =
      mask.label.toLowerCase().includes('stroke') ||
      mask.label.toLowerCase().includes('line') ||
      mask.label.toLowerCase().includes('red');

    const [x1, y1, x2, y2] = mask.box;
    const normX = Math.max(0, Math.min(1, Math.min(x1, x2)));
    const normY = Math.max(0, Math.min(1, Math.min(y1, y2)));
    const normW = Math.max(0, Math.min(1, Math.abs(x2 - x1)));
    const normH = Math.max(0, Math.min(1, Math.abs(y2 - y1)));

    if (isStroke && mask.points && mask.points.length >= 2) {
      const pts: RedStrokePoint[] = mask.points.map(([px, py]) => [
        Math.max(0, Math.min(1, px)),
        Math.max(0, Math.min(1, py)),
      ]);
      strokePolyline = simplifyPolyline(pts, 0.02);
    } else {
      boxes.push({
        label: mask.label,
        confidence: Math.max(0, Math.min(1, mask.score)),
        box: {
          x: Math.round(normX * 1000) / 1000,
          y: Math.round(normY * 1000) / 1000,
          width: Math.round(normW * 1000) / 1000,
          height: Math.round(normH * 1000) / 1000,
        },
      });
    }
  }

  return {
    boxes,
    strokePolyline,
  };
}
