import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '../../api/client';

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
  initialConsent = true,
}: UseMeetingTranscriptionOptions): UseMeetingTranscriptionReturn {
  const [transcripts, setTranscripts] = useState<readonly TranscriptItem[]>([]);
  const [hasConsent, setHasConsent] = useState(initialConsent);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef(0);
  const isProcessingChunkRef = useRef(false);

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

  // Real Meeting Audio Chunked Capture Pipeline
  useEffect(() => {
    if (!isMeetingActive || !localStream || !hasConsent) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsTranscribing(false);
      return;
    }

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0 || typeof MediaRecorder === 'undefined') {
      setIsTranscribing(false);
      return;
    }

    const audioOnlyStream = new MediaStream([audioTracks[0] as MediaStreamTrack]);
    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported('audio/webm') && MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    }

    try {
      const recorder = new MediaRecorder(audioOnlyStream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (event) => {
        if (event.data.size < 300) return; // Discard silence / sub-threshold noise
        if (isProcessingChunkRef.current) return;

        isProcessingChunkRef.current = true;
        setIsTranscribing(true);
        const chunkIndex = chunkIndexRef.current++;
        const chunkId = `chunk-${currentUser.userId}-${Date.now().toString(36)}-${chunkIndex}`;

        try {
          const buffer = await event.data.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
          );

          const res = await api.sendMeetingTranscriptChunk(roomId, {
            chunkId,
            audioBase64: base64,
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
            if (res.latencyMs) {
              setLastLatencyMs(res.latencyMs);
            }
          }
        } catch {
          // Non-fatal transcription chunk drop
        } finally {
          isProcessingChunkRef.current = false;
          setIsTranscribing(false);
        }
      };

      // 4-second chunked timeslices for real meeting audio processing
      recorder.start(4000);
      setIsTranscribing(true);
    } catch {
      setIsTranscribing(false);
    }

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      mediaRecorderRef.current = null;
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
