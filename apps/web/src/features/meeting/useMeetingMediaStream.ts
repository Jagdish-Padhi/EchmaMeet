import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseMeetingMediaStreamOptions {
  readonly autoStart?: boolean;
  readonly onPermissionError?: (errorMsg: string) => void;
}

export interface UseMeetingMediaStreamReturn {
  readonly localStream: MediaStream | null;
  readonly screenStream: MediaStream | null;
  readonly isMuted: boolean;
  readonly isVideoOn: boolean;
  readonly isScreenSharing: boolean;
  readonly isSpeaking: boolean;
  readonly audioLevel: number;
  readonly permissionDenied: boolean;
  readonly toggleAudio: () => void;
  readonly toggleVideo: () => Promise<void>;
  readonly toggleScreenShare: () => Promise<void>;
  readonly stopAllMedia: () => void;
}

export function useMeetingMediaStream(
  options: UseMeetingMediaStreamOptions = {},
): UseMeetingMediaStreamReturn {
  const { autoStart = true, onPermissionError } = options;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Initialize camera and microphone
  useEffect(() => {
    let isCancelled = false;

    if (!autoStart) return;

    async function initMedia() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        onPermissionError?.('Camera and microphone are not supported in this browser environment.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsVideoOn(true);
        setIsMuted(false);
        setPermissionDenied(false);

        // Setup real Web Audio API channelization for speaking detection
        setupAudioChannel(stream);
      } catch (err: unknown) {
        if (isCancelled) return;
        setPermissionDenied(true);
        setIsVideoOn(false);
        setIsMuted(true);

        const errorMsg =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Camera or microphone access was denied. You can still participate in listen-only mode.'
            : 'No active camera or microphone found. Continuing in listen-only mode.';
        onPermissionError?.(errorMsg);
      }
    }

    void initMedia();

    return () => {
      isCancelled = true;
      stopAudioAnalysis();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      setLocalStream(null);
      setScreenStream(null);
      setIsVideoOn(false);
      setIsMuted(true);
      setIsScreenSharing(false);
    };
  }, [autoStart]);

  // Audio Channelization Analyzer
  const setupAudioChannel = (stream: MediaStream) => {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!analyserRef.current || !localStreamRef.current) return;

        // If user muted mic, don't indicate speaking
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (!audioTrack || !audioTrack.enabled) {
          setIsSpeaking(false);
          setAudioLevel(0);
          animFrameRef.current = requestAnimationFrame(checkVolume);
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] ?? 0;
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));

        setAudioLevel(normalized);
        setIsSpeaking(normalized > 14);

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      animFrameRef.current = requestAnimationFrame(checkVolume);
    } catch {
      // AudioContext failure gracefully falls back
    }
  };

  const stopAudioAnalysis = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        void audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    setIsSpeaking(false);
    setAudioLevel(0);
  };

  // Toggle Microphone (Audio)
  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    const nextMuted = !isMuted;
    audioTracks.forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsMuted(nextMuted);
    if (nextMuted) {
      setIsSpeaking(false);
      setAudioLevel(0);
    }
  }, [isMuted]);

  // Toggle Camera (Video) - Directly halts the camera hardware sensor when turned off
  const toggleVideo = useCallback(async () => {
    const stream = localStreamRef.current;

    // If currently on, halt the hardware sensor and extinguish camera LED light
    if (isVideoOn) {
      if (stream) {
        stream.getVideoTracks().forEach((track) => {
          track.stop(); // Releases camera device hardware lock at the OS level
          stream.removeTrack(track);
        });
        setLocalStream(new MediaStream(stream.getTracks()));
      }
      setIsVideoOn(false);
      return;
    }

    // Turning ON - Request fresh hardware video track
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });

        const newVideoTrack = videoStream.getVideoTracks()[0];
        if (newVideoTrack) {
          if (stream) {
            stream.addTrack(newVideoTrack);
            setLocalStream(new MediaStream(stream.getTracks()));
          } else {
            localStreamRef.current = videoStream;
            setLocalStream(videoStream);
          }
          setIsVideoOn(true);
        }
      } catch {
        onPermissionError?.(
          'Could not activate camera. Please check your browser device permissions.',
        );
      }
    }
  }, [isVideoOn, onPermissionError]);

  // Toggle Screen Share
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      setScreenStream(null);
      setIsScreenSharing(false);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      onPermissionError?.('Screen sharing is not supported in this browser.');
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = displayStream;
      setScreenStream(displayStream);
      setIsScreenSharing(true);

      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
          }
          setScreenStream(null);
          setIsScreenSharing(false);
        };
      }
    } catch {
      // User cancelled picker
    }
  }, [isScreenSharing, onPermissionError]);

  // Clean stop for all media - guarantees all hardware devices and indicator lights turn off immediately
  const stopAllMedia = useCallback(() => {
    stopAudioAnalysis();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setLocalStream(null);
    setScreenStream(null);
    setIsVideoOn(false);
    setIsMuted(true);
    setIsScreenSharing(false);
    setIsSpeaking(false);
    setAudioLevel(0);
  }, []);

  return {
    localStream,
    screenStream,
    isMuted,
    isVideoOn,
    isScreenSharing,
    isSpeaking,
    audioLevel,
    permissionDenied,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    stopAllMedia,
  };
}
