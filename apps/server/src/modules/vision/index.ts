export { VisionService } from './application/vision-service';
export type {
  ExtractDraftRequest,
  GestureDetectionRequest,
  ImageDecoderPort,
  VisionServicePorts,
} from './application/ports';
export { registerVisionRoutes } from './http/routes';
export {
  doSegmentsIntersect,
  findPolylineIntersections,
  findSegmentIntersection,
  simplifyPolyline,
} from './domain/geometry';
export { detectRedStrokePixels } from './domain/color-threshold';
export type { RawImageData, RedStrokeDetectionOptions } from './domain/color-threshold';
export { parseSamSegmentation } from './domain/sam-parser';
export { decodePngRgba, inspectImageHeader } from './infrastructure/image-decoder';
