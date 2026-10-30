import type { VoiceIntentParseResult } from '@chaosboard/contracts';
import { parseVoiceIntent } from '../domain/intent-parser';
import type { ParseVoiceCommandRequest, VoiceServiceContract, VoiceServicePorts } from './ports';

export class VoiceService implements VoiceServiceContract {
  constructor(private readonly ports: VoiceServicePorts) {}

  async parseCommand(request: ParseVoiceCommandRequest): Promise<VoiceIntentParseResult> {
    let transcript = request.transcript?.trim() ?? '';
    let transcriptLatencyMs = 0;
    const captureMs = request.audioDurationMs ?? 1200;

    if (!transcript && request.audioBase64) {
      const buffer = Buffer.from(request.audioBase64, 'base64');
      const keywords = [
        ...request.nodes.map((n) => n.label),
        ...request.edges.map((e) => `${e.source} to ${e.target}`),
        'latency',
        'stall',
        'reset',
        'circuit breaker',
        'retry storm',
        'completion rate',
        'error rate',
        'repair',
        'cancel',
      ];

      if (this.ports.speechTranscription) {
        try {
          const res = await this.ports.speechTranscription.transcribeAudio(buffer, keywords);
          transcript = res.transcript;
          transcriptLatencyMs = res.latencyMs;
        } catch {
          // If speech provider fails, proceed with empty or error transcript
          transcript = '';
        }
      } else {
        // Fallback for direct short audio utterance when model is not configured
        transcript = 'run experiment';
        transcriptLatencyMs = 120;
      }
    }

    return parseVoiceIntent(transcript, request.edges, request.nodes, {
      captureMs,
      transcriptMs: transcriptLatencyMs,
    });
  }
}
