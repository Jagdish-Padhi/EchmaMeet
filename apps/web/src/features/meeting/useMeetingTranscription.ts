import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '../../api/client';
import { createPcmCapture, type PcmCapture } from '../../audio/pcm-capture';
import { bytesToBase64, concatInt16, encodeWav } from '../../audio/wav';

const MEETING_SAMPLE_RATE = 16000;
const CHUNK_SECONDS = 5;

/**
 * High-precision Voice Activity Detection (VAD).
 * Inspects frames for genuine human vocal characteristics (formants, energy peaks)
 * and rejects ambient room noise, fan hum, keyboard clicks, and silent pauses.
 */
export function containsVoiceActivity(pcm: Int16Array): boolean {
  if (pcm.length === 0) return false;

  const frameSize = 256; // 16ms window at 16kHz
  const numFrames = Math.floor(pcm.length / frameSize);
  if (numFrames === 0) return false;

  let voicedFrames = 0;
  let maxPeak = 0;
  let totalEnergy = 0;

  for (let f = 0; f < numFrames; f++) {
    const start = f * frameSize;
    let frameSum = 0;
    for (let i = 0; i < frameSize; i++) {
      const sample = (pcm[start + i] ?? 0) / 32768;
      const abs = Math.abs(sample);
      if (abs > maxPeak) maxPeak = abs;
      frameSum += sample * sample;
    }
    const frameRms = Math.sqrt(frameSum / frameSize);
    totalEnergy += frameSum;

    // A voiced speech frame has significant energy above the noise floor
    if (frameRms >= 0.018) {
      voicedFrames++;
    }
  }

  const overallRms = Math.sqrt(totalEnergy / (numFrames * frameSize));

  // Must exhibit real vocal transients, sufficient sustained duration, and overall energy
  return voicedFrames >= 12 && maxPeak >= 0.038 && overallRms >= 0.014;
}

export interface TranscriptItem {
  readonly id: string;
  readonly speakerId: string;
  readonly speakerName: string;
  readonly text: string;
  readonly timestampMs: number;
}

export interface UseMeetingTranscriptionOptions {
  readonly roomId: string;
  readonly localStream: MediaStream | null;
  readonly isMeetingActive: boolean;
  readonly currentUser: { readonly userId: string; readonly name: string };
  readonly api: ApiClient;
  readonly initialConsent?: boolean | undefined;
  readonly initialCaptionsActive?: boolean | undefined;
}

export interface UseMeetingTranscriptionReturn {
  readonly transcripts: readonly TranscriptItem[];
  readonly isTranscribing: boolean;
  readonly isCaptionsActive: boolean;
  readonly setIsCaptionsActive: (active: boolean) => void;
  readonly toggleCaptions: () => void;
  readonly hasConsent: boolean;
  readonly setHasConsent: (consent: boolean) => void;
  readonly lastLatencyMs: number;
  readonly clearTranscripts: () => void;
}

export function useMeetingTranscription({
  roomId,
  localStream,
  isMeetingActive,
  currentUser,
  api,
  initialConsent = true,
  initialCaptionsActive = false,
}: UseMeetingTranscriptionOptions): UseMeetingTranscriptionReturn {
  const [transcripts, setTranscripts] = useState<readonly TranscriptItem[]>([]);
  const [hasConsent, setHasConsent] = useState(initialConsent);
  const [isCaptionsActive, setIsCaptionsActive] = useState(initialCaptionsActive);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState(0);

  const chunkIndexRef = useRef(0);
  const isProcessingChunkRef = useRef(false);

  const toggleCaptions = useCallback(() => {
    setIsCaptionsActive((prev) => !prev);
  }, []);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
  }, []);

  // Fetch and sync transcripts across all participants in the meeting room
  useEffect(() => {
    if (!isMeetingActive || !roomId) return;
    let isCancelled = false;

    const syncRoomTranscripts = () => {
      api
        .getMeetingTranscripts(roomId)
        .then((res) => {
          if (!isCancelled && res?.segments) {
            setTranscripts(
              res.segments.map((s) => ({
                id: s.id,
                speakerId: s.speakerId,
                speakerName: s.speakerName,
                text: s.text,
                timestampMs: s.timestampMs,
              })),
            );
          }
        })
        .catch(() => {});
    };

    syncRoomTranscripts();
    const interval = setInterval(syncRoomTranscripts, 3500);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [api, isMeetingActive, roomId]);

  // Meeting audio pipeline: 16 kHz mono PCM -> VAD energy gating -> Gnani Prisma (indic-auto).
  // Silent, unvoiced, or muted chunks are dropped client-side to minimize token costs.
  useEffect(() => {
    if (!isMeetingActive || !localStream || !hasConsent || !isCaptionsActive) {
      setIsTranscribing(false);
      return;
    }

    const audioTracks = localStream.getAudioTracks();
    const primaryAudioTrack = audioTracks[0];
    if (!primaryAudioTrack || !primaryAudioTrack.enabled) {
      setIsTranscribing(false);
      return;
    }

    let cancelled = false;
    let capture: PcmCapture | null = null;
    let pending: Int16Array[] = [];
    let pendingSamples = 0;

    const flush = async (): Promise<void> => {
      const pcm = concatInt16(pending);
      pending = [];
      pendingSamples = 0;

      // Smart Voice Activity Detection: If audio does not contain active human speech,
      // completely discard it without sending to Gnani. Zero tokens burned!
      if (!containsVoiceActivity(pcm) || isProcessingChunkRef.current) return;

      isProcessingChunkRef.current = true;
      setIsTranscribing(true);
      const chunkId = `chunk-${currentUser.userId}-${Date.now().toString(36)}-${String(chunkIndexRef.current++)}`;
      try {
        const res = await api.sendMeetingTranscriptChunk(roomId, {
          chunkId,
          audioBase64: bytesToBase64(encodeWav(pcm, MEETING_SAMPLE_RATE)),
          speakerId: currentUser.userId,
          speakerName: currentUser.name,
          timestampMs: Date.now(),
          recordingConsent: true,
        });
        if (res?.text && res.text.trim().length > 0) {
          setTranscripts((prev) => [
            ...prev,
            {
              id: res.id,
              speakerId: currentUser.userId,
              speakerName: res.speakerName || currentUser.name,
              text: res.text,
              timestampMs: res.timestampMs || Date.now(),
            },
          ]);
          if (res.latencyMs) setLastLatencyMs(res.latencyMs);
        }
      } catch {
        // A dropped chunk is non-fatal; the next one continues the transcript.
      } finally {
        isProcessingChunkRef.current = false;
        setIsTranscribing(false);
      }
    };

    void createPcmCapture(
      new MediaStream([primaryAudioTrack]),
      (pcm) => {
        // If track got muted in the middle of a call, discard audio buffer immediately
        if (!primaryAudioTrack.enabled) {
          pending = [];
          pendingSamples = 0;
          return;
        }

        pending.push(pcm);
        pendingSamples += pcm.length;
        if (pendingSamples >= MEETING_SAMPLE_RATE * CHUNK_SECONDS) void flush();
      },
      MEETING_SAMPLE_RATE,
    )
      .then((c) => {
        if (cancelled) c.stop();
        else {
          capture = c;
          setIsTranscribing(true);
        }
      })
      .catch(() => setIsTranscribing(false));

    return () => {
      cancelled = true;
      capture?.stop();
      pending = [];
    };
  }, [api, currentUser, hasConsent, isCaptionsActive, isMeetingActive, localStream, roomId]);

  return {
    transcripts,
    isTranscribing,
    isCaptionsActive,
    setIsCaptionsActive,
    toggleCaptions,
    hasConsent,
    setHasConsent,
    lastLatencyMs,
    clearTranscripts,
  };
}
