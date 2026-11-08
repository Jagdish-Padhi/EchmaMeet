import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '../../../api/client';
import type { Topology, VoiceIntentParseResult, VoiceServerMessage } from '@chaosboard/contracts';
import { createPcmCapture, type PcmCapture } from '../../../audio/pcm-capture';
import { playBase64Audio, stopSpeech } from '../../../audio/playback';
import { bytesToBase64, concatInt16, encodeWav } from '../../../audio/wav';
import type { VoiceCommandAction, VoiceSessionState } from '../types';

const SAMPLE_RATE = 16000;
const MAX_CLIP_SECONDS = 28; // Gnani REST accepts clips up to 30 s

function topologyRefs(topology: Topology | null) {
  return {
    nodes: (topology?.nodes ?? []).map((n) => ({ id: n.id, label: n.label })),
    edges: (topology?.edges ?? []).map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

export function useVoiceSession(
  api: ApiClient,
  activeTopology: Topology | null,
  onExecuteCommand?: VoiceCommandAction,
  initial?: { readonly language?: string; readonly speakReplies?: boolean },
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
    language: initial?.language ?? 'indic-auto',
    speakReplies: initial?.speakReplies ?? true,
    isSpeaking: false,
    liveStatus: 'off',
  });

  // Latest values for long-lived callbacks (WebSocket handlers) without re-subscribing.
  const latest = useRef({ state, activeTopology, onExecuteCommand });
  latest.current = { state, activeTopology, onExecuteCommand };

  const streamRef = useRef<MediaStream | null>(null);
  const captureRef = useRef<PcmCapture | null>(null);
  const framesRef = useRef<Int16Array[]>([]);
  const startedAtRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);

  const speak = useCallback(async (base64: string, contentType: string) => {
    setState((p) => ({ ...p, isSpeaking: true }));
    await playBase64Audio(base64, contentType);
    setState((p) => ({ ...p, isSpeaking: false }));
  }, []);

  const applyResult = useCallback((result: VoiceIntentParseResult) => {
    setState((prev) => ({
      ...prev,
      isProcessing: false,
      finalTranscript: result.transcript,
      partialTranscript: '',
      parseResult: result,
      timings: result.timings,
    }));
    const { state: s, onExecuteCommand: exec } = latest.current;
    if (s.autoConfirm && result.status === 'parsed' && result.command) {
      void exec?.(result.command);
    }
  }, []);

  const releaseMic = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      releaseMic();
      wsRef.current?.close();
      stopSpeech();
    },
    [releaseMic],
  );

  /** Typed or quick-phrase command: no audio, but still answered in the speaker's language. */
  const submitTranscript = useCallback(
    async (transcript: string) => {
      setState((p) => ({ ...p, isProcessing: true, finalTranscript: transcript, error: null }));
      try {
        const { language, speakReplies } = latest.current.state;
        const result = await api.parseVoiceCommand({
          transcript,
          language: language.includes(',') || language === 'indic-auto' ? undefined : language,
          speakReply: speakReplies,
          ...topologyRefs(latest.current.activeTopology),
        });
        applyResult(result);
        if (result.speech) void speak(result.speech.audioBase64, result.speech.contentType);
      } catch (err: unknown) {
        setState((p) => ({
          ...p,
          isProcessing: false,
          error: err instanceof Error ? err.message : 'Failed to parse voice command.',
        }));
      }
    },
    [api, applyResult, speak],
  );

  const openMic = useCallback(async (onFrame: (pcm: Int16Array) => void) => {
    const md = navigator.mediaDevices as MediaDevices | undefined;
    if (typeof md?.getUserMedia !== 'function') {
      throw new Error('Microphone capture is not supported in this browser.');
    }
    const stream = await md.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    streamRef.current = stream;
    captureRef.current = await createPcmCapture(stream, onFrame, SAMPLE_RATE);
  }, []);

  /** Push-to-talk: record a clip, encode 16 kHz WAV, send to Gnani Prisma over REST. */
  const startRecording = useCallback(async () => {
    stopSpeech();
    framesRef.current = [];
    startedAtRef.current = performance.now();
    setState((p) => ({
      ...p,
      isRecording: true,
      error: null,
      partialTranscript: 'Listening…',
      finalTranscript: '',
      parseResult: null,
    }));
    try {
      await openMic((pcm) => {
        framesRef.current.push(pcm);
        const samples = framesRef.current.reduce((n, f) => n + f.length, 0);
        if (samples > SAMPLE_RATE * MAX_CLIP_SECONDS) {
          // Hard stop before the API's 30 s limit.
          captureRef.current?.stop();
        }
      });
    } catch (err: unknown) {
      releaseMic();
      setState((p) => ({
        ...p,
        isRecording: false,
        partialTranscript: '',
        error: err instanceof Error ? err.message : 'Microphone permission denied.',
      }));
    }
  }, [openMic, releaseMic]);

  const stopRecording = useCallback(() => {
    const captureMs = Math.round(performance.now() - startedAtRef.current);
    releaseMic();
    const pcm = concatInt16(framesRef.current);
    framesRef.current = [];
    if (pcm.length < SAMPLE_RATE * 0.25) {
      setState((p) => ({ ...p, isRecording: false, partialTranscript: '', isProcessing: false }));
      return;
    }
    setState((p) => ({ ...p, isRecording: false, isProcessing: true, partialTranscript: '' }));
    void (async () => {
      try {
        const { language, speakReplies } = latest.current.state;
        const result = await api.parseVoiceCommand({
          audioBase64: bytesToBase64(encodeWav(pcm, SAMPLE_RATE)),
          audioDurationMs: captureMs,
          language,
          speakReply: speakReplies,
          ...topologyRefs(latest.current.activeTopology),
        });
        applyResult(result);
        if (result.speech) void speak(result.speech.audioBase64, result.speech.contentType);
      } catch (err: unknown) {
        setState((p) => ({
          ...p,
          isProcessing: false,
          error: err instanceof Error ? err.message : 'Failed to process recorded audio.',
        }));
      }
    })();
  }, [api, applyResult, releaseMic, speak]);

  /** Hands-free: stream continuously to Gnani Prisma; its VAD segments each spoken command. */
  const stopLive = useCallback(() => {
    releaseMic();
    wsRef.current?.close();
    wsRef.current = null;
    setState((p) => ({ ...p, liveStatus: 'off', isRecording: false }));
  }, [releaseMic]);

  const startLive = useCallback(async () => {
    stopSpeech();
    setState((p) => ({ ...p, liveStatus: 'connecting', error: null, isRecording: false }));
    try {
      const token = localStorage.getItem('chaosboard_token') ?? '';
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        `${proto}//${window.location.host}/ws/voice?token=${encodeURIComponent(token)}`,
      );
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          const { state: s, activeTopology: topo } = latest.current;
          ws.send(
            JSON.stringify({
              type: 'start',
              language: s.language,
              sampleRate: SAMPLE_RATE,
              speakReplies: s.speakReplies,
              ...topologyRefs(topo),
            }),
          );
        };
        ws.onerror = () => reject(new Error('Live voice connection failed.'));
        ws.onclose = () => reject(new Error('Live voice connection closed.'));
        ws.onmessage = (event) => {
          let msg: VoiceServerMessage;
          try {
            msg = JSON.parse(event.data as string) as VoiceServerMessage;
          } catch {
            return;
          }
          switch (msg.type) {
            case 'ready':
              resolve();
              break;
            case 'transcript_partial':
              setState((p) => ({
                ...p,
                partialTranscript: msg.type === 'transcript_partial' ? msg.text : '',
              }));
              break;
            case 'transcript_final':
              setState((p) => ({
                ...p,
                finalTranscript: msg.type === 'transcript_final' ? msg.text : '',
                partialTranscript: '',
              }));
              break;
            case 'intent_parsed':
              applyResult(msg.result);
              break;
            case 'speech_reply':
              void speak(msg.audioBase64, msg.contentType);
              break;
            case 'error':
              setState((p) => ({ ...p, error: msg.type === 'error' ? msg.message : p.error }));
              reject(new Error(msg.message));
              break;
          }
        };
      });

      ws.onclose = () => setState((p) => ({ ...p, liveStatus: 'off', isRecording: false }));
      await openMic((pcm) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(pcm.buffer as ArrayBuffer);
      });
      setState((p) => ({ ...p, liveStatus: 'listening', isRecording: true }));
    } catch (err: unknown) {
      releaseMic();
      wsRef.current?.close();
      wsRef.current = null;
      setState((p) => ({
        ...p,
        liveStatus: 'unavailable',
        isRecording: false,
        error: err instanceof Error ? err.message : 'Live voice is unavailable.',
      }));
    }
  }, [applyResult, openMic, releaseMic, speak]);

  const setLanguage = useCallback((language: string) => {
    setState((p) => ({ ...p, language }));
  }, []);
  const setSpeakReplies = useCallback((value: boolean) => {
    if (!value) stopSpeech();
    setState((p) => ({ ...p, speakReplies: value, ...(value ? {} : { isSpeaking: false }) }));
  }, []);
  const toggleSpeakReplies = useCallback(() => {
    stopSpeech();
    setState((p) => ({ ...p, speakReplies: !p.speakReplies, isSpeaking: false }));
  }, []);
  const toggleAutoConfirm = useCallback(() => {
    setState((p) => ({ ...p, autoConfirm: !p.autoConfirm }));
  }, []);

  const confirmAndExecute = useCallback(async () => {
    const result = latest.current.state.parseResult;
    if (result?.status === 'parsed' && result.command) {
      await latest.current.onExecuteCommand?.(result.command);
      setState((p) => ({ ...p, parseResult: null }));
    }
  }, []);

  const clearSession = useCallback(() => {
    stopSpeech();
    setState((p) => ({
      ...p,
      partialTranscript: '',
      finalTranscript: '',
      parseResult: null,
      timings: null,
      error: null,
      isSpeaking: false,
    }));
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    startLive,
    stopLive,
    submitTranscript,
    setLanguage,
    setSpeakReplies,
    toggleSpeakReplies,
    toggleAutoConfirm,
    confirmAndExecute,
    clearSession,
  };
}
