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

  it('fails loudly (not silently) when audio arrives and Gnani is not configured', async () => {
    await expect(
      service.parseCommand({
        audioBase64: Buffer.from('fake-audio').toString('base64'),
        audioDurationMs: 1500,
        edges: [],
        nodes: [],
      }),
    ).rejects.toMatchObject({ code: 'gnani_not_configured' });
  });

  it('transcribes with Gnani STT, passes keyterms and parses the result', async () => {
    const calls: { keyterms?: readonly string[] | undefined; language?: string | undefined }[] = [];
    const stt = {
      model: 'prisma-v3.0',
      transcribe: async (req: {
        keyterms?: readonly string[] | undefined;
        language?: string | undefined;
      }) => {
        calls.push({ keyterms: req.keyterms, language: req.language });
        return {
          transcript: 'inject latency on edge from api to db',
          model: 'prisma-v3.0',
          language: 'en-IN',
          latencyMs: 80,
        };
      },
    };
    const speechService = new VoiceService({ stt });
    const result = await speechService.parseCommand({
      audioBase64: Buffer.from('audio-bytes').toString('base64'),
      language: 'hi-IN,en-IN',
      edges: [{ id: 'api-db', source: 'api', target: 'db' }],
      nodes: [
        { id: 'api', label: 'api' },
        { id: 'db', label: 'db' },
      ],
    });
    expect(result.status).toBe('parsed');
    expect(result.command?.command).toBe('inject_fault');
    expect(result.timings.transcriptMs).toBe(80);
    expect(calls[0]?.language).toBe('hi-IN,en-IN');
    expect(calls[0]?.keyterms).toContain('circuit breaker');
  });

  it('speaks the localised reply with Timbre in the speaker language', async () => {
    const synth: { text: string; language: string }[] = [];
    const tts = {
      synthesize: async (req: { text: string; language: string }) => {
        synth.push(req);
        return {
          audio: new Uint8Array([1]),
          contentType: 'audio/wav',
          voice: 'Nalini',
          model: 'timbre-v2.5',
          latencyMs: 5,
        };
      },
    };
    const svc = new VoiceService({ tts: tts as never });
    const parsed = await svc.parseCommand({
      transcript: 'experiment chalao 3 trials',
      language: 'hi-IN',
      edges: [],
      nodes: [],
    });
    const speech = await svc.speak(parsed);
    expect(speech?.voice).toBe('Nalini');
    expect(synth[0]?.language).toBe('hi-IN');
    expect(synth[0]?.text).toContain('ट्रायल');
  });
});
