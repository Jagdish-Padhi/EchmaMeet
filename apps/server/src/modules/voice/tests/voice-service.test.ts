import { describe, expect, it } from 'vitest';
import { VoiceService } from '../application/voice-service';

describe('VoiceService application', () => {
  const service = new VoiceService({});

  it('parses direct text command', async () => {
    const result = await service.parseCommand({
      transcript: 'run experiment',
      edges: [],
      nodes: [],
    });
    expect(result.status).toBe('parsed');
    expect(result.command?.command).toBe('run_experiment');
    expect(result.timings.parseMs).toBeGreaterThan(0);
  });

  it('handles fallback audio when speech provider is not configured', async () => {
    const fakeBase64 = Buffer.from('fake-audio-pcm-bytes').toString('base64');
    const result = await service.parseCommand({
      audioBase64: fakeBase64,
      audioDurationMs: 1500,
      edges: [],
      nodes: [],
    });
    expect(result.status).toBe('parsed');
    expect(result.command?.command).toBe('run_experiment');
    expect(result.timings.captureMs).toBe(1500);
  });
});
