import type {
  RedStrokeDetectionResult,
  Topology,
  TopologyDraft,
  VisionExtraction,
} from '@chaosboard/contracts';

export interface VisionFlowState {
  readonly imageBase64: string | null;
  readonly imagePreviewUrl: string | null;
  readonly extraction: VisionExtraction | null;
  readonly confirmedTopology: Topology | null;
  readonly gestureResult: RedStrokeDetectionResult | null;
  readonly isExtracting: boolean;
  readonly isDetectingGesture: boolean;
  readonly error: string | null;
}

export type VisionDraftConfirmedCallback = (topology: Topology, draft: TopologyDraft) => void;
