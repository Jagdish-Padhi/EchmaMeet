import { useCallback, useEffect, useRef, useState } from 'react';

export type MicTestStatus = 'idle' | 'testing' | 'passed' | 'failed' | 'denied';

export interface UseMicrophonePreflightReturn {
  readonly status: MicTestStatus;
  readonly audioLevel: number;
  readonly deviceLabel: string;
  readonly errorMessage: string | null;
  readonly availableMics: readonly MediaDeviceInfo[];
  readonly selectedDeviceId: string;
  readonly setSelectedDeviceId: (id: string) => void;
  readonly startMicTest: () => Promise<void>;
  readonly stopMicTest: () => void;
}

export function useMicrophonePreflight(): UseMicrophonePreflightReturn {
  const [status, setStatus] = useState<MicTestStatus>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [deviceLabel, setDeviceLabel] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Enumerate input devices
  const refreshDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === 'audioinput');
      setAvailableMics(mics);
      if (mics.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(mics[0]?.deviceId ?? '');
      }
    } catch {
      // ignore enumeration errors
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  const stopMicTest = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startMicTest = useCallback(async () => {
    stopMicTest();
    setStatus('testing');
    setErrorMessage(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('failed');
      setErrorMessage('Microphone API is not supported in this browser.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const track = stream.getAudioTracks()[0];
      if (track) {
        setDeviceLabel(track.label || 'Default Microphone');
      }

      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let framesWithSound = 0;

      const sampleAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] ?? 0;
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);

        // If audio input is detected (user speaks or ambient noise passes threshold)
        if (normalized > 5) {
          framesWithSound++;
          if (framesWithSound >= 3) {
            setStatus('passed');
          }
        }

        animFrameRef.current = requestAnimationFrame(sampleAudio);
      };

      sampleAudio();
      void refreshDevices();
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setStatus('denied');
        setErrorMessage('Microphone permission was denied. Please allow microphone access in browser settings.');
      } else {
        setStatus('failed');
        setErrorMessage(error.message || 'Could not access microphone hardware. Please check your connection.');
      }
    }
  }, [selectedDeviceId, stopMicTest, refreshDevices]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopMicTest();
    };
  }, [stopMicTest]);

  return {
    status,
    audioLevel,
    deviceLabel,
    errorMessage,
    availableMics,
    selectedDeviceId,
    setSelectedDeviceId,
    startMicTest,
    stopMicTest,
  };
}

