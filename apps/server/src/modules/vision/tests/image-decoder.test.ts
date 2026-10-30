import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePngRgba, inspectImageHeader } from '../infrastructure/image-decoder';

function createMinimalPng(width: number, height: number, red = 255, green = 0, blue = 0): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = Buffer.alloc(4 + 4 + 13 + 4);
  ihdrChunk.writeUInt32BE(13, 0);
  ihdrChunk.write('IHDR', 4);
  ihdrData.copy(ihdrChunk, 8);

  // Raw pixel scanlines
  const rowBytes = 1 + width * 3;
  const rawScanlines = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawScanlines[rowOffset] = 0; // Filter 0 (None)
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      rawScanlines[pxOffset] = red;
      rawScanlines[pxOffset + 1] = green;
      rawScanlines[pxOffset + 2] = blue;
    }
  }

  const deflated = deflateSync(rawScanlines);
  const idatChunk = Buffer.alloc(4 + 4 + deflated.length + 4);
  idatChunk.writeUInt32BE(deflated.length, 0);
  idatChunk.write('IDAT', 4);
  deflated.copy(idatChunk, 8);

  // IEND
  const iendChunk = Buffer.alloc(4 + 4 + 0 + 4);
  iendChunk.writeUInt32BE(0, 0);
  iendChunk.write('IEND', 4);

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

describe('image-decoder infrastructure', () => {
  it('inspects PNG dimensions correctly', () => {
    const png = createMinimalPng(64, 48);
    const meta = inspectImageHeader(png);
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(64);
    expect(meta.height).toBe(48);
  });

  it('decodes raw pixels from PNG buffer', () => {
    const png = createMinimalPng(32, 32, 220, 20, 20);
    const raw = decodePngRgba(png);
    expect(raw.width).toBe(32);
    expect(raw.height).toBe(32);
    expect(raw.channels).toBe(3);
    // Check first pixel
    expect(raw.data[0]).toBe(220);
    expect(raw.data[1]).toBe(20);
    expect(raw.data[2]).toBe(20);
  });

  it('rejects oversized or malformed image buffers', () => {
    const tooSmall = Buffer.from([1, 2, 3]);
    expect(() => inspectImageHeader(tooSmall)).toThrow(/malformed/);

    const corruptFormat = Buffer.alloc(100);
    expect(() => inspectImageHeader(corruptFormat)).toThrow(/Unsupported image format/);
  });
});
