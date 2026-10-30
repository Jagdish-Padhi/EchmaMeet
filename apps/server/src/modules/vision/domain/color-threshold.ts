import type { RedStrokePoint } from '@chaosboard/contracts';
import { simplifyPolyline } from './geometry';

export interface RawImageData {
  readonly width: number;
  readonly height: number;
  readonly channels: 3 | 4;
  readonly data: Uint8Array;
}

export interface RedStrokeDetectionOptions {
  readonly minRedPoints?: number | undefined;
  readonly redThreshold?: number | undefined;
  readonly tolerance?: number | undefined;
}

/**
 * Deterministic color-threshold detector that finds red marker strokes in raw pixel data.
 * Pure domain logic: operates directly on in-memory pixel arrays with zero native dependencies.
 */
export function detectRedStrokePixels(
  image: RawImageData,
  options?: RedStrokeDetectionOptions,
): RedStrokePoint[] {
  const minRed = options?.redThreshold ?? 130;
  const minPoints = options?.minRedPoints ?? 5;
  const tolerance = options?.tolerance ?? 0.03;

  const { width, height, channels, data } = image;
  const redPoints: [number, number][] = [];

  // Sample grid to identify red marker strokes
  const step = Math.max(1, Math.floor(Math.min(width, height) / 200));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * channels;
      const r = data[idx] ?? 0;
      const g = data[idx + 1] ?? 0;
      const b = data[idx + 2] ?? 0;

      // Check for prominent red stroke: high R, significantly lower G and B
      if (r >= minRed && g < 110 && b < 110 && r > 1.35 * Math.max(g, b) + 20) {
        redPoints.push([x / width, y / height]);
      }
    }
  }

  if (redPoints.length < minPoints) {
    return [];
  }

  // Sort points along primary axis of variation (X or Y) to construct a coherent polyline
  const xSpan = Math.max(...redPoints.map((p) => p[0])) - Math.min(...redPoints.map((p) => p[0]));
  const ySpan = Math.max(...redPoints.map((p) => p[1])) - Math.min(...redPoints.map((p) => p[1]));

  const sorted = [...redPoints].sort((a, b) =>
    xSpan >= ySpan ? a[0] - b[0] || a[1] - b[1] : a[1] - b[1] || a[0] - b[0],
  );

  // Downsample to consecutive segment anchors
  const stride = Math.max(1, Math.floor(sorted.length / 12));
  const sampled: RedStrokePoint[] = [];
  for (let i = 0; i < sorted.length; i += stride) {
    const pt = sorted[i];
    if (pt) {
      sampled.push([Math.round(pt[0] * 1000) / 1000, Math.round(pt[1] * 1000) / 1000]);
    }
  }
  const last = sorted[sorted.length - 1];
  if (last && sampled[sampled.length - 1] !== last) {
    sampled.push([Math.round(last[0] * 1000) / 1000, Math.round(last[1] * 1000) / 1000]);
  }

  return simplifyPolyline(sampled, tolerance);
}
