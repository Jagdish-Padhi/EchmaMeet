import { describe, expect, it } from 'vitest';
import { detectRedStrokePixels, type RawImageData } from '../domain/color-threshold';

describe('color-threshold detector', () => {
  it('detects a vertical red stroke in a synthetic image', () => {
    const width = 100;
    const height = 100;
    const data = new Uint8Array(width * height * 3);

    // Fill background with light gray (200, 200, 200)
    for (let i = 0; i < data.length; i += 3) {
      data[i] = 200;
      data[i + 1] = 200;
      data[i + 2] = 200;
    }

    // Draw vertical red line at x = 50, from y = 20 to y = 80
    for (let y = 20; y <= 80; y++) {
      for (let x = 48; x <= 52; x++) {
        const idx = (y * width + x) * 3;
        data[idx] = 220; // R
        data[idx + 1] = 30; // G
        data[idx + 2] = 30; // B
      }
    }

    const image: RawImageData = { width, height, channels: 3, data };
    const stroke = detectRedStrokePixels(image, { minRedPoints: 5 });

    expect(stroke.length).toBeGreaterThanOrEqual(2);
    const firstPoint = stroke[0];
    const lastPoint = stroke[stroke.length - 1];
    expect(firstPoint).toBeDefined();
    expect(lastPoint).toBeDefined();
    if (firstPoint && lastPoint) {
      expect(firstPoint[0]).toBeCloseTo(0.5, 1);
      expect(firstPoint[1]).toBeCloseTo(0.2, 1);
      expect(lastPoint[1]).toBeCloseTo(0.8, 1);
    }
  });

  it('returns empty array when image contains no red pixels', () => {
    const width = 50;
    const height = 50;
    const data = new Uint8Array(width * height * 3);
    // Blue image
    for (let i = 0; i < data.length; i += 3) {
      data[i] = 10;
      data[i + 1] = 20;
      data[i + 2] = 230;
    }

    const image: RawImageData = { width, height, channels: 3, data };
    const stroke = detectRedStrokePixels(image);
    expect(stroke).toEqual([]);
  });
});
