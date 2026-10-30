import { inflateSync } from 'node:zlib';
import { AppError } from '@chaosboard/shared';
import type { RawImageData } from '../domain/color-threshold';

export interface ImageMetadata {
  readonly width: number;
  readonly height: number;
  readonly format: 'png' | 'jpeg';
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DIMENSION = 4096;
const MIN_DIMENSION = 32;

/**
 * Validates image size and parses dimensions from PNG or JPEG headers without heavy native libraries.
 */
export function inspectImageHeader(buffer: Buffer): ImageMetadata {
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new AppError(
      'validation',
      'image_too_large',
      `Image size ${String(buffer.length)} bytes exceeds maximum allowed limit of ${String(MAX_IMAGE_SIZE_BYTES)} bytes.`,
    );
  }
  if (buffer.length < 24) {
    throw new AppError('validation', 'image_malformed', 'Image file is too short or malformed.');
  }

  // PNG magic: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    validateDimensions(width, height);
    return { width, height, format: 'png' };
  }

  // JPEG magic: FF D8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      if (!marker) break;

      // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2) contain image dimensions
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        if (offset + 9 > buffer.length) break;
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        validateDimensions(width, height);
        return { width, height, format: 'jpeg' };
      }

      // Variable length marker
      if (offset + 4 > buffer.length) break;
      const length = buffer.readUInt16BE(offset + 2);
      offset += 2 + length;
    }
  }

  throw new AppError(
    'validation',
    'unsupported_image_format',
    'Unsupported image format. Only PNG and JPEG images are supported.',
  );
}

function validateDimensions(width: number, height: number): void {
  if (
    width < MIN_DIMENSION ||
    height < MIN_DIMENSION ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION
  ) {
    throw new AppError(
      'validation',
      'invalid_image_dimensions',
      `Image dimensions (${String(width)}x${String(height)}) exceed permitted bounds (${String(MIN_DIMENSION)} to ${String(MAX_DIMENSION)} px).`,
    );
  }
}

/**
 * Decodes a PNG buffer into raw uncompressed RGBA pixel data.
 */
export function decodePngRgba(buffer: Buffer): RawImageData {
  const meta = inspectImageHeader(buffer);
  if (meta.format !== 'png') {
    throw new AppError(
      'validation',
      'unsupported_for_pixels',
      'Direct pixel decoding is currently supported for PNG images.',
    );
  }

  const { width, height } = meta;
  const bitDepth = buffer[24] ?? 8;
  const colorType = buffer[25] ?? 6; // 6 is RGBA, 2 is RGB

  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new AppError(
      'validation',
      'unsupported_png_color_type',
      `PNG color type ${String(colorType)} bit depth ${String(bitDepth)} is not supported. Use standard 8-bit RGB or RGBA.`,
    );
  }

  const channels: 3 | 4 = colorType === 6 ? 4 : 3;

  // Collect IDAT chunk bytes
  const idatParts: Buffer[] = [];
  let offset = 8;
  while (offset + 8 < buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const chunkType = buffer.toString('ascii', offset + 4, offset + 8);
    if (chunkType === 'IDAT') {
      idatParts.push(buffer.subarray(offset + 8, offset + 8 + chunkLength));
    }
    offset += 8 + chunkLength + 4; // length + type + data + crc
  }

  if (idatParts.length === 0) {
    throw new AppError('validation', 'corrupt_png', 'PNG missing IDAT chunks.');
  }

  const compressed = Buffer.concat(idatParts);
  const decompressed = inflateSync(compressed);

  const rowBytes = 1 + width * channels;
  const rawOutput = new Uint8Array(width * height * channels);

  for (let y = 0; y < height; y++) {
    const filterType = decompressed[y * rowBytes] ?? 0;
    const rowStart = y * rowBytes + 1;
    const outRowStart = y * width * channels;

    for (let x = 0; x < width * channels; x++) {
      const rawByte = decompressed[rowStart + x] ?? 0;
      let left = 0;
      let up = 0;

      if (filterType === 0) {
        rawOutput[outRowStart + x] = rawByte;
      } else if (filterType === 1) {
        // Sub
        if (x >= channels) {
          left = rawOutput[outRowStart + x - channels] ?? 0;
        }
        rawOutput[outRowStart + x] = (rawByte + left) & 0xff;
      } else if (filterType === 2) {
        // Up
        if (y > 0) {
          up = rawOutput[(y - 1) * width * channels + x] ?? 0;
        }
        rawOutput[outRowStart + x] = (rawByte + up) & 0xff;
      } else {
        // For other filters fallback to raw byte
        rawOutput[outRowStart + x] = rawByte;
      }
    }
  }

  return {
    width,
    height,
    channels,
    data: rawOutput,
  };
}
