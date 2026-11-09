/**
 * Synthesizes a clean, high-precision two-tone notification chime
 * using the Web Audio API. Zero dependencies, 0ms load latency, reliable on all browsers.
 */
export type Synthesizer = (
  text: string,
  language: string,
  options?: { speed?: number | undefined; voice?: string | undefined },
) => Promise<Blob>;

/** True when the text is mostly Devanagari, so it should be spoken with a Hindi voice. */
export function spokenLanguageFor(text: string): 'hi-IN' | 'en-IN' {
  return /[\u0900-\u097F]/.test(text) ? 'hi-IN' : 'en-IN';
}

/**
 * Strips Gnani embedded audio emotion tags (e.g. <Excited>, <Pauses>, <Giggle>)
 * so text displayed in chat bubbles and modals renders cleanly without raw markup.
 */
export function stripAudioTags(text: string): string {
  if (!text) return '';
  return text.replace(/<[A-Za-z\s]+>/g, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Repairs WAV headers where streaming encoders set chunk lengths to 0xFFFFFFFF (-1).
 * Standard browser AudioContext.decodeAudioData strictly requires valid chunk byte counts.
 */
function fixWavHeader(buffer: ArrayBuffer): ArrayBuffer {
  if (buffer.byteLength < 44) return buffer;
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    const view = new DataView(buffer);
    view.setUint32(4, buffer.byteLength - 8, true);
    for (let i = 12; i < buffer.byteLength - 8; i++) {
      if (
        bytes[i] === 0x64 &&
        bytes[i + 1] === 0x61 &&
        bytes[i + 2] === 0x74 &&
        bytes[i + 3] === 0x61
      ) {
        view.setUint32(i + 4, buffer.byteLength - (i + 8), true);
        break;
      }
    }
  }
  return buffer;
}

class MeetingAudioAlertService {
  private audioCtx: AudioContext | null = null;
  private synthesizer: Synthesizer | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private speakToken = 0;
  // Default speech speed: 1.0 (pure, unmodified native rate matching Gnani Lakshmi demo exactly)
  private speechSpeed = (() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('echma_speech_speed');
      if (saved) {
        const val = parseFloat(saved);
        // Reset legacy 0.94 fallback to 1.00 so Lakshmi's voice matches the native demo
        if (Math.abs(val - 0.94) < 0.01) {
          localStorage.setItem('echma_speech_speed', '1');
          return 1.0;
        }
        if (!isNaN(val) && val >= 0.85 && val <= 1.15) return val;
      }
    }
    return 1.0;
  })();
  private voiceOverride: string | undefined = (() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('echma_speech_voice');
      if (saved && saved !== 'undefined') return saved;
    }
    return 'Lakshmi';
  })();

  setSpeechSpeed(speed: number): void {
    this.speechSpeed = Math.max(0.85, Math.min(1.15, speed));
  }

  getSpeechSpeed(): number {
    return this.speechSpeed;
  }

  setVoiceOverride(voice: string | undefined): void {
    this.voiceOverride = voice;
  }

  getVoiceOverride(): string | undefined {
    return this.voiceOverride;
  }

  /** Pre-warms / unlocks the Web Audio AudioContext synchronously during a user click event. */
  unlock(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    // Play a 1-sample silent buffer synchronously during the user gesture to permanently unlock audio output
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // ignore
    }
  }

  /** Registers Gnani Timbre as the primary voice; browser speech remains the offline fallback. */
  setSynthesizer(synthesizer: Synthesizer | null): void {
    this.synthesizer = synthesizer;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Plays a subtle, pleasant architectural alert chime (two-tone rising harmonic: 520Hz -> 659.25Hz).
   */
  playAlertChime(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Tone 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.2, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.5);

      // Tone 2: G5 (783.99 Hz) for harmonic clarity
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.1);

      gain2.gain.setValueAtTime(0.001, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.18, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.1);
      osc2.stop(now + 0.65);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  /**
   * Speaks naturally with a warm, clear, medium-paced female voice.
   */
  speakNaturally(text: string, onEnd?: () => void): void {
    if (typeof window === 'undefined') return;
    this.stopSpeaking();
    const token = ++this.speakToken;
    const synthesizer = this.synthesizer;
    if (!synthesizer) {
      // eslint-disable-next-line no-console
      console.warn('[EchmaAudio] Gnani neural speech synthesizer not connected yet.');
      onEnd?.();
      return;
    }
    const cleanText = stripAudioTags(text);
    if (!cleanText) {
      onEnd?.();
      return;
    }
    void synthesizer(cleanText, spokenLanguageFor(cleanText), {
      speed: 1.0,
      voice: this.voiceOverride || 'Lakshmi',
    })
      .then(async (blob) => {
        if (token !== this.speakToken) return;

        const rawBuffer = await blob.arrayBuffer();
        const fixedBuffer = fixWavHeader(rawBuffer);

        // Priority 1: Direct HTMLAudioElement bitstream playback (exact bitstream match with Gnani.ai demo)
        let playedViaAudioElement = false;
        try {
          const fixedBlob = new Blob([fixedBuffer], { type: 'audio/wav' });
          const url = URL.createObjectURL(fixedBlob);
          const audio = new Audio(url);
          audio.playbackRate = 1.0; // 1:1 pure native playback with zero pitch or speed distortion
          audio.volume = 1.0;
          this.currentAudio = audio;

          const finish = (): void => {
            URL.revokeObjectURL(url);
            if (this.currentAudio === audio) this.currentAudio = null;
            onEnd?.();
          };

          audio.onended = finish;
          audio.onerror = () => {
            finish();
          };

          await audio.play();
          playedViaAudioElement = true;
          return;
        } catch (audioElementErr) {
          // If browser policy blocks autoplay on new Audio, fall through to Web Audio context
          // eslint-disable-next-line no-console
          console.info('[EchmaAudio] Direct audio playback deferred to Web Audio context:', audioElementErr);
        }

        // Priority 2: Web Audio context fallback (resilient to strict autoplay policies)
        if (!playedViaAudioElement) {
          const ctx = this.getContext();
          if (ctx && ctx.state !== 'closed') {
            try {
              if (ctx.state === 'suspended') {
                await ctx.resume();
              }
              const audioBuffer = await ctx.decodeAudioData(fixedBuffer.slice(0));
              if (token !== this.speakToken) return;
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.playbackRate.value = 1.0;
              source.connect(ctx.destination);
              this.currentSource = source;
              source.onended = () => {
                if (this.currentSource === source) {
                  this.currentSource = null;
                }
                onEnd?.();
              };
              source.start(0);
              return;
            } catch (audioCtxErr) {
              // eslint-disable-next-line no-console
              console.warn('[EchmaAudio] Web Audio context decode failed:', audioCtxErr);
            }
          }
        }
        onEnd?.();
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[EchmaAudio] Gnani neural TTS request failed:', err);
        onEnd?.();
      });
  }

  /**
   * Optional manual offline fallback. Never invoked automatically during live meetings
   * to guarantee only authentic Gnani neural speech is delivered.
   */
  speakWithOfflineVoice(rawText: string, onEnd?: () => void): void {
    if (!window.speechSynthesis) {
      onEnd?.();
      return;
    }

    try {
      window.speechSynthesis.cancel(); // cancel any active speech
      const text = stripAudioTags(rawText);

      const utterance = new SpeechSynthesisUtterance(text);
      // Pure 1.0 rate and pitch matching native speech with zero pitch alteration
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const getVoicesAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();

        // 1. Primary Priority: Indian English (en-IN) and Hindi (hi-IN) female voices
        const indianFemaleVoiceNames = [
          'Heera',
          'Kavya',
          'Kalpana',
          'Neerja',
          'Veena',
          'Swara',
          'Aditi',
          'India',
          'Indian',
        ];

        let selectedVoice = voices.find(
          (v) =>
            (v.lang === 'en-IN' || v.lang.startsWith('en-IN') || v.lang.startsWith('hi')) &&
            (indianFemaleVoiceNames.some((name) => v.name.toLowerCase().includes(name.toLowerCase())) ||
              v.name.toLowerCase().includes('female') ||
              v.name.toLowerCase().includes('natural')),
        );

        if (!selectedVoice) {
          selectedVoice = voices.find(
            (v) => v.lang === 'en-IN' || v.lang.startsWith('en-IN') || v.lang.startsWith('hi'),
          );
        }

        // 2. Secondary Priority: High-quality natural female voices
        if (!selectedVoice) {
          const fallbackFemaleVoiceNames = [
            'Samantha',
            'Victoria',
            'Karen',
            'Moira',
            'Fiona',
            'Tessa',
            'Zira',
            'Microsoft Jenny Online (Natural)',
            'Microsoft Aria Online (Natural)',
            'Google US English',
          ];

          selectedVoice = voices.find(
            (v) =>
              v.lang.startsWith('en') &&
              fallbackFemaleVoiceNames.some((name) => v.name.toLowerCase().includes(name.toLowerCase())),
          );
        }

        // 3. Fallback: Any available female or natural English voice
        if (!selectedVoice) {
          selectedVoice =
            voices.find(
              (v) =>
                v.lang.startsWith('en') &&
                (v.name.toLowerCase().includes('female') ||
                  v.name.toLowerCase().includes('natural') ||
                  v.name.toLowerCase().includes('woman')),
            ) || voices.find((v) => v.lang.startsWith('en'));
        }

        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        if (onEnd) {
          utterance.onend = onEnd;
          utterance.onerror = () => onEnd();
        }

        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length > 0) {
        getVoicesAndSpeak();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          getVoicesAndSpeak();
        };
      }
    } catch {
      if (onEnd) onEnd();
    }
  }

  stopSpeaking(): void {
    this.speakToken += 1;
    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
      } catch {
        // ignore
      }
      this.currentSource = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.pause();
        this.currentAudio.src = '';
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }
}

export const meetingAudio = new MeetingAudioAlertService();
