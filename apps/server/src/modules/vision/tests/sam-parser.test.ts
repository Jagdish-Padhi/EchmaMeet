import { describe, expect, it } from 'vitest';
import { parseSamSegmentation } from '../domain/sam-parser';

describe('sam-parser domain', () => {
  it('parses node boxes and stroke polylines from SAM result', () => {
    const samResult = {
      masks: [
        {
          label: 'Service Box A',
          score: 0.94,
          box: [0.1, 0.2, 0.35, 0.4] as const,
        },
        {
          label: 'red marker stroke',
          score: 0.98,
          box: [0.3, 0.1, 0.4, 0.6] as const,
          points: [
            [0.35, 0.15],
            [0.35, 0.35],
            [0.35, 0.55],
          ] as const,
        },
      ],
    };

    const parsed = parseSamSegmentation(samResult);
    expect(parsed.boxes).toHaveLength(1);
    const box = parsed.boxes[0];
    expect(box).toBeDefined();
    if (box) {
      expect(box.label).toBe('Service Box A');
      expect(box.box).toEqual({
        x: 0.1,
        y: 0.2,
        width: 0.25,
        height: 0.2,
      });
    }

    const stroke = parsed.strokePolyline;
    expect(stroke).toBeDefined();
    if (stroke) {
      expect(stroke.length).toBeGreaterThanOrEqual(2);
    }
  });
});
