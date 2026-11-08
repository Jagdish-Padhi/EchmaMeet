import { describe, expect, it } from 'vitest';
import { containsVoiceActivity } from '../useMeetingTranscription';

describe('Voice Activity Detection (Token Saver VAD)', () => {
  it('rejects pure silence and low-energy microphone hiss', () => {
    // 5 seconds of ambient fan / room hiss (~0.005 RMS)
    const silent = new Int16Array(16000 * 5);
    for (let i = 0; i < silent.length; i++) {
      silent[i] = Math.round((Math.random() - 0.5) * 300); // peak ~150, RMS ~0.003
    }
    expect(containsVoiceActivity(silent)).toBe(false);
  });

  it('rejects short transient clicks (mouse click, keyboard tap)', () => {
    const clicks = new Int16Array(16000 * 5);
    // Short 20ms click at second 1
    for (let i = 16000; i < 16000 + 320; i++) {
      clicks[i] = 10000;
    }
    expect(containsVoiceActivity(clicks)).toBe(false);
  });

  it('detects sustained human vocal speech', () => {
    const speech = new Int16Array(16000 * 5);
    // 1.5 seconds of simulated vocal phonemes (fundamental at ~150Hz + harmonics)
    for (let i = 16000; i < 16000 + 24000; i++) {
      const t = i / 16000;
      const wave = Math.sin(2 * Math.PI * 150 * t) * 0.4 + Math.sin(2 * Math.PI * 300 * t) * 0.2;
      speech[i] = Math.round(wave * 32767);
    }
    expect(containsVoiceActivity(speech)).toBe(true);
  });
});

