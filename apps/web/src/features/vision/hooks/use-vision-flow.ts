import { useState, useCallback } from 'react';
import type { ApiClient } from '../../../api/client';
import type { CandidateEdge, RedStrokePoint, TopologyDraft } from '@chaosboard/contracts';
import type { VisionDraftConfirmedCallback, VisionFlowState } from '../types';

export function useVisionFlow(api: ApiClient, onConfirmed?: VisionDraftConfirmedCallback) {
  const [state, setState] = useState<VisionFlowState>({
    imageBase64: null,
    imagePreviewUrl: null,
    extraction: null,
    confirmedTopology: null,
    gestureResult: null,
    isExtracting: false,
    isDetectingGesture: false,
    error: null,
  });

  const uploadImage = useCallback(
    async (file: File) => {
      setState((prev) => ({
        ...prev,
        error: null,
        isExtracting: true,
      }));

      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const commaIdx = result.indexOf(',');
            resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
          };
          reader.onerror = () => reject(new Error('Failed to read file.'));
        });
        reader.readAsDataURL(file);

        const base64 = await base64Promise;
        const previewUrl = URL.createObjectURL(file);

        const extraction = await api.extractVisionDraft(base64, file.type);

        setState((prev) => ({
          ...prev,
          imageBase64: base64,
          imagePreviewUrl: previewUrl,
          extraction,
          isExtracting: false,
        }));
      } catch (err: unknown) {
        setState((prev) => ({
          ...prev,
          isExtracting: false,
          error: err instanceof Error ? err.message : 'Vision extraction failed.',
        }));
      }
    },
    [api],
  );

  const confirmDraft = useCallback(
    async (draft: TopologyDraft) => {
      setState((prev) => ({ ...prev, error: null }));
      try {
        const topology = await api.confirmVisionDraft(draft);
        setState((prev) => ({ ...prev, confirmedTopology: topology }));
        onConfirmed?.(topology, draft);
      } catch (err: unknown) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Draft confirmation failed.',
        }));
      }
    },
    [api, onConfirmed],
  );

  const triggerGestureDetection = useCallback(
    async (strokePolyline: RedStrokePoint[], candidateEdges: CandidateEdge[]) => {
      setState((prev) => ({ ...prev, isDetectingGesture: true, error: null }));
      try {
        const result = await api.detectRedStrokeGesture({
          strokePolyline,
          candidateEdges,
          ...(state.imageBase64 ? { imageKeyframe: state.imageBase64 } : {}),
        });
        setState((prev) => ({
          ...prev,
          isDetectingGesture: false,
          gestureResult: result,
        }));
        return result;
      } catch (err: unknown) {
        setState((prev) => ({
          ...prev,
          isDetectingGesture: false,
          error: err instanceof Error ? err.message : 'Gesture detection failed.',
        }));
        return null;
      }
    },
    [api, state.imageBase64],
  );

  const reset = useCallback(() => {
    setState({
      imageBase64: null,
      imagePreviewUrl: null,
      extraction: null,
      confirmedTopology: null,
      gestureResult: null,
      isExtracting: false,
      isDetectingGesture: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    uploadImage,
    confirmDraft,
    triggerGestureDetection,
    reset,
  };
}
