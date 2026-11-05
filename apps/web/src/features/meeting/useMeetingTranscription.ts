import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '../../api/client';
import { startPcmCapture, type PcmCaptureHandle } from './audio/pcm-capture';

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
}

export interface UseMeetingTranscriptionReturn {
  readonly transcripts: readonly TranscriptItem[];
  readonly isTranscribing: boolean;
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
  initialConsent = false,
}: UseMeetingTranscriptionOptions): UseMeetingTranscriptionReturn {
  const [transcripts, setTranscripts] = useState<readonly TranscriptItem[]>([]);
  const [hasConsent, setHasConsent] = useState(initialConsent);

  // The consent chosen when the meeting was started always wins over stale state.
  useEffect(() => {
    setHasConsent(initialConsent);
  }, [initialConsent]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState(0);

  const chunkIndexRef = useRef(0);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
  }, []);

  // Poll initial or existing transcripts when entering room
  useEffect(() => {
    if (!isMeetingActive || !roomId) return;
    let isCancelled = false;

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

    return () => {
      isCancelled = true;
    };
  }, [api, isMeetingActive, roomId]);

  // Speech capture: PCM -> utterance segmentation -> WAV upload. Only speech is ever sent.
  useEffect(() => {
    if (!isMeetingActive || !localStream || !hasConsent) {
      setIsTranscribing(false);
      return;
    }
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0 || typeof window === 'undefined') {
      setIsTranscribing(false);
      return;
    }

    const audioOnlyStream = new MediaStream([audioTracks[0] as MediaStreamTrack]);
    let handle: PcmCaptureHandle | null = null;
    let cancelled = false;
    const uploads = new Set<Promise<void>>();

    const upload = (wavBase64: string): Promise<void> => {
      const chunkIndex = chunkIndexRef.current++;
      const chunkId = `chunk-${currentUser.userId}-${Date.now().toString(36)}-${String(chunkIndex)}`;
      setIsTranscribing(true);
      return api
        .sendMeetingTranscriptChunk(roomId, {
          chunkId,
          audioBase64: wavBase64,
          speakerId: currentUser.userId,
          speakerName: currentUser.name,
          timestampMs: Date.now(),
          recordingConsent: true,
        })
        .then((res) => {
          if (res?.text && res.text.trim().length > 0) {
            setTranscripts((prev) =>
              prev.some((t) => t.id === res.id)
                ? prev
                : [
                    ...prev,
                    {
                      id: res.id,
                      speakerId: currentUser.userId,
                      speakerName: res.speakerName || currentUser.name,
                      text: res.text,
                      timestampMs: res.timestampMs || Date.now(),
                    },
                  ],
            );
            if (res.latencyMs) setLastLatencyMs(res.latencyMs);
          }
        })
        .catch(() => {
          // A dropped utterance is not fatal; the next one proceeds independently.
        })
        .finally(() => {
          if (uploads.size <= 1) setIsTranscribing(false);
        });
    };

    startPcmCapture(audioOnlyStream, (wav) => {
      const task = upload(wav);
      uploads.add(task);
      void task.finally(() => uploads.delete(task));
    })
      .then((started) => {
        if (cancelled) {
          started.stop();
          return;
        }
        handle = started;
        setIsTranscribing(true);
      })
      .catch(() => {
        setIsTranscribing(false);
      });

    return () => {
      cancelled = true;
      const tail = handle?.stop();
      handle = null;
      if (tail) {
        const task = upload(tail);
        uploads.add(task);
        void task.finally(() => uploads.delete(task));
      }
    };
  }, [api, currentUser, hasConsent, isMeetingActive, localStream, roomId]);

  return {
    transcripts,
    isTranscribing,
    hasConsent,
    setHasConsent,
    lastLatencyMs,
    clearTranscripts,
  };
}
