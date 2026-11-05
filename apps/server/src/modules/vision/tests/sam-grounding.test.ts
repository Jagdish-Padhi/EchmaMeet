import { describe, expect, it } from 'vitest';
import {
  boxIou,
  cropImage,
  groundNodesWithSam,
  remapCropPoints,
  unionBox,
} from '../domain/sam-grounding';
import { detectRedStrokePixels, type RawImageData } from '../domain/color-threshold';

const node = (id: string, x: number, y: number, w: number, h: number, confidence = 0.6) => ({
  id,
  label: id,
  confidence,
  box: { x, y, width: w, height: h },
});

describe('SAM grounding', () => {
  it('snaps model boxes to the best-overlapping SAM shape, once per shape', () => {
    const shapes = [
      { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      { x: 0.6, y: 0.6, width: 0.2, height: 0.2 },
    ];
    const report = groundNodesWithSam(
      [
        node('api', 0.12, 0.11, 0.2, 0.2),
        node('db', 0.58, 0.62, 0.2, 0.2),
        node('ghost', 0.9, 0.05, 0.05, 0.05),
      ],
      shapes,
    );
    expect(report.snapped).toBe(2);
    expect(report.unmatched).toBe(1);
    expect(report.nodes[0]?.box).toEqual(shapes[0]);
    expect(report.nodes[0]?.confidence).toBeGreaterThan(0.6);
    expect(report.nodes[2]?.box).toEqual({ x: 0.9, y: 0.05, width: 0.05, height: 0.05 });
  });

  it('does not reuse a SAM shape for two nodes', () => {
    const shapes = [{ x: 0.1, y: 0.1, width: 0.3, height: 0.3 }];
    const report = groundNodesWithSam(
      [node('a', 0.1, 0.1, 0.3, 0.3), node('b', 0.12, 0.12, 0.3, 0.3)],
      shapes,
    );
    expect(report.snapped).toBe(1);
    expect(report.unmatched).toBe(1);
  });

  it('computes IoU and union boxes', () => {
    expect(
      boxIou({ x: 0, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 0.5, height: 1 }),
    ).toBeCloseTo(0.5, 6);
    expect(unionBox([], 0)).toBeNull();
    expect(unionBox([{ x: 0.2, y: 0.2, width: 0.1, height: 0.1 }], 0.05)).toEqual({
      x: 0.15000000000000002,
      y: 0.15000000000000002,
      width: 0.2,
      height: 0.2,
    });
  });

  it('isolates a red stroke inside the SAM region and ignores red ink elsewhere', () => {
    const width = 200;
    const height = 200;
    const data = new Uint8Array(width * height * 4).fill(255); // white board
    const paint = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      data[i] = 230;
      data[i + 1] = 20;
      data[i + 2] = 20;
    };
    for (let x = 100; x < 180; x += 1) paint(x, 100); // the stroke SAM localises
    for (let y = 10; y < 40; y += 1) for (let x = 10; x < 40; x += 1) paint(x, y); // unrelated red blob
    const image: RawImageData = { width, height, channels: 4, data };
    const region = { x: 0.45, y: 0.4, width: 0.5, height: 0.2 };
    const traced = remapCropPoints(detectRedStrokePixels(cropImage(image, region)), region);
    expect(traced.length).toBeGreaterThanOrEqual(2);
    for (const [px, py] of traced) {
      expect(px).toBeGreaterThan(0.45);
      expect(py).toBeGreaterThan(0.4);
      expect(py).toBeLessThan(0.62);
    }
  });
});
