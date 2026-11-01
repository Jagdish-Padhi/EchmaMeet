/**
 * Synthesizes a clean, high-precision two-tone notification chime
 * using the Web Audio API. Zero dependencies, 0ms load latency, reliable on all browsers.
 */
class MeetingAudioAlertService {
  private audioCtx: AudioContext | null = null;

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
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel(); // cancel any active speech

      const utterance = new SpeechSynthesisUtterance(text);
      // Measured, crystal-clear medium pace with pleasant tone
      utterance.rate = 0.94;
      utterance.pitch = 1.08;

      const getVoicesAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();

        // Priority list of premium natural/neural female English voices
        const femaleVoiceNames = [
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

        let selectedVoice = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            femaleVoiceNames.some((name) => v.name.toLowerCase().includes(name.toLowerCase())),
        );

        // Fallback: any voice explicitly marked female or with natural English
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
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

export const meetingAudio = new MeetingAudioAlertService();
