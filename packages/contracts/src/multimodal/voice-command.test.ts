import { describe, expect, it } from 'vitest';
import {
  voiceClientMessageSchema,
  voiceCommandSchema,
  voiceIntentParseResultSchema,
  voiceServerMessageSchema,
} from './voice-command';

describe('Voice contracts', () => {
  it('validates inject_fault voice command fixture', () => {
    const valid = {
      command: 'inject_fault' as const,
      source: 'gateway',
      target: 'backend',
      faultType: 'latency' as const,
      parameters: {
        latencyMs: 300,
        jitterMs: 50,
      },
    };
    expect(() => voiceCommandSchema.parse(valid)).not.toThrow();
  });

  it('validates set_invariant voice command fixture', () => {
    const valid = {
      command: 'set_invariant' as const,
      metric: 'e2e_p99_ms' as const,
      comparator: 'lt' as const,
      threshold: 500,
    };
    expect(() => voiceCommandSchema.parse(valid)).not.toThrow();
  });

  it('validates intent parse result with plain text confirmation', () => {
    const valid = {
      transcript: 'inject latency on the link from gateway to backend',
      timings: {
        captureMs: 1200,
        transcriptMs: 350,
        parseMs: 45,
      },
      status: 'parsed' as const,
      command: {
        command: 'inject_fault' as const,
        source: 'gateway',
        target: 'backend',
        faultType: 'latency' as const,
        parameters: { latencyMs: 300 },
      },
      plainTextConfirmation: 'Inject 300ms latency on edge gateway -> backend',
    };
    expect(() => voiceIntentParseResultSchema.parse(valid)).not.toThrow();
  });

  it('validates client and server websocket message schemas', () => {
    const clientMsg = {
      type: 'parse_intent' as const,
      transcript: 'start repair with model proposer',
      audioDurationMs: 1500,
    };
    expect(() => voiceClientMessageSchema.parse(clientMsg)).not.toThrow();

    const serverMsg = {
      type: 'transcript_partial' as const,
      text: 'start repair...',
    };
    expect(() => voiceServerMessageSchema.parse(serverMsg)).not.toThrow();
  });
});
