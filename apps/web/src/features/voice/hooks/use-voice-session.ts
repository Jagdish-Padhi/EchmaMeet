import { useState, useCallback, useRef, useEffect } from 'react';
import type { ApiClient } from '../../../api/client';
import type { Topology, VoiceIntentParseResult } from '@chaosboard/contracts';
import type { VoiceCommandAction, VoiceSessionState } from '../types';

export function useVoiceSession(
  api: ApiClient,
  activeTopology: Topology | null,
  onExecuteCommand?: VoiceCommandAction,
) {
  const [state, setState] = useState<VoiceSessionState>({
    isRecording: false,
    isProcessing: false,
    partialTranscript: '',
    finalTranscript: '',
    parseResult: null,
    timings: null,
    error: null,
    autoConfirm: false,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStartMsRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Setup WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/voice`;
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            text?: string;
            latencyMs?: number;
            result?: VoiceIntentParseResult;
            message?: string;
          };

          if (msg.type === 'transcript_partial' && typeof msg.text === 'string') {
            const partial = msg.text;
            setState((prev) => ({ ...prev, partialTranscript: partial }));
          } else if (msg.type === 'transcript_final' && typeof msg.text === 'string') {
            const final = msg.text;
            setState((prev) => ({
              ...prev,
              finalTranscript: final,
              partialTranscript: '',
            }));
          } else if (msg.type === 'intent_parsed' && msg.result) {
            const parseResult = msg.result;
            setState((prev) => ({
              ...prev,
              isProcessing: false,
              parseResult,
              timings: parseResult.timings,
            }));
          } else if (msg.type === 'error' && typeof msg.message === 'string') {
            const error = msg.message;
            setState((prev) => ({
              ...prev,
              isProcessing: false,
              error,
            }));
          }
        } catch {
          // ignore malformed ws messages
        }
      };
    } catch {
      // ws connection error, fallback to HTTP will be used
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const submitTranscript = useCallback(
    async (transcript: string) => {
      setState((prev) => ({
        ...prev,
        isProcessing: true,
        finalTranscript: transcript,
        error: null,
      }));

      try {
        const nodes = (activeTopology?.nodes ?? []).map((n: { id: string; label: string }) => ({
          id: n.id,
          label: n.label,
        }));
        const edges = (activeTopology?.edges ?? []).map(
          (e: { id: string; source: string; target: string }) => ({
            id: e.id,
            source: e.source,
            target: e.target,
          }),
        );

        const result = await api.parseVoiceCommand({
          transcript,
          nodes,
          edges,
        });

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          parseResult: result,
          timings: result.timings,
        }));

        if (state.autoConfirm && result.status === 'parsed' && result.command) {
          void onExecuteCommand?.(result.command);
        }
      } catch (err: unknown) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: err instanceof Error ? err.message : 'Failed to parse voice command.',
        }));
      }
    },
    [api, activeTopology, state.autoConfirm, onExecuteCommand],
  );

  const startRecording = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isRecording: true,
      error: null,
      partialTranscript: 'Listening...',
      finalTranscript: '',
      parseResult: null,
    }));

    try {
      if (typeof (navigator.mediaDevices as unknown as { getUserMedia?: unknown }).getUserMedia !== 'function') {
        throw new Error('Microphone audio capture is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      recordStartMsRef.current = performance.now();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200);
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        isRecording: false,
        error:
          err instanceof Error
            ? err.message
            : 'Microphone permission denied or microphone unavailable.',
      }));
    }
  }, []);

  const stopRecording = useCallback(() => {
    setState((prev) => ({ ...prev, isRecording: false, isProcessing: true }));

    const durationMs = Math.round(performance.now() - recordStartMsRef.current);
    const mediaRecorder = mediaRecorderRef.current;

    if (!mediaRecorder) {
      setState((prev) => ({ ...prev, isProcessing: false }));
      return;
    }

    mediaRecorder.onstop = () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();

        reader.onloadend = () => {
          void (async () => {
            try {
              const resultStr = reader.result as string;
              const commaIdx = resultStr.indexOf(',');
              const base64 = commaIdx >= 0 ? resultStr.slice(commaIdx + 1) : resultStr;

              const nodes = (activeTopology?.nodes ?? []).map((n: { id: string; label: string }) => ({
                id: n.id,
                label: n.label,
              }));
              const edges = (activeTopology?.edges ?? []).map(
                (e: { id: string; source: string; target: string }) => ({
                  id: e.id,
                  source: e.source,
                  target: e.target,
                }),
              );

              const parseRes = await api.parseVoiceCommand({
                audioBase64: base64,
                audioDurationMs: durationMs,
                nodes,
                edges,
              });

              setState((prev) => ({
                ...prev,
                isProcessing: false,
                finalTranscript: parseRes.transcript,
                partialTranscript: '',
                parseResult: parseRes,
                timings: parseRes.timings,
              }));

              if (state.autoConfirm && parseRes.status === 'parsed' && parseRes.command) {
                void onExecuteCommand?.(parseRes.command);
              }
            } catch (innerErr: unknown) {
              setState((prev) => ({
                ...prev,
                isProcessing: false,
                error: innerErr instanceof Error ? innerErr.message : 'Failed to process recorded audio.',
              }));
            }
          })();
        };

        reader.readAsDataURL(audioBlob);
      } catch (err: unknown) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: err instanceof Error ? err.message : 'Failed to process recorded audio.',
        }));
      }
    };

    mediaRecorder.stop();
  }, [api, activeTopology, state.autoConfirm, onExecuteCommand]);

  const toggleAutoConfirm = useCallback(() => {
    setState((prev) => ({ ...prev, autoConfirm: !prev.autoConfirm }));
  }, []);

  const confirmAndExecute = useCallback(async () => {
    if (state.parseResult?.status === 'parsed' && state.parseResult.command) {
      await onExecuteCommand?.(state.parseResult.command);
      setState((prev) => ({ ...prev, parseResult: null }));
    }
  }, [state.parseResult, onExecuteCommand]);

  const clearSession = useCallback(() => {
    setState((prev) => ({
      ...prev,
      partialTranscript: '',
      finalTranscript: '',
      parseResult: null,
      timings: null,
      error: null,
    }));
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    submitTranscript,
    toggleAutoConfirm,
    confirmAndExecute,
    clearSession,
  };
}
