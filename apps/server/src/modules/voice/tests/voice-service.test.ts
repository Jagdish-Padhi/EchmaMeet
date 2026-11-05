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

  it('truthfully handles audio when speech provider is not configured without fake canned transcript', async () => {
    const fakeBase64 = Buffer.from('fake-audio-pcm-bytes').toString('base64');
    const result = await service.parseCommand({
      audioBase64: fakeBase64,
      audioDurationMs: 1500,
      edges: [],
      nodes: [],
    });
    expect(result.status).toBe('empty');
    expect(result.timings.captureMs).toBe(1500);
  });

  it('transcribes and parses audio using configured speech transcription provider', async () => {
    const mockSpeech = {
      transcribeAudio: async () => ({
        transcript: 'inject latency on edge from api to db',
        confidence: 0.95,
        latencyMs: 80,
      }),
    };
    const speechService = new VoiceService({ speechTranscription: mockSpeech });
    const result = await speechService.parseCommand({
      audioBase64: Buffer.from('audio-bytes').toString('base64'),
      edges: [{ id: 'api-db', source: 'api', target: 'db' } as any],
      nodes: [{ id: 'api', label: 'api' } as any, { id: 'db', label: 'db' } as any],
    });
    expect(result.status).toBe('parsed');
    expect(result.command?.command).toBe('inject_fault');
  });
});
