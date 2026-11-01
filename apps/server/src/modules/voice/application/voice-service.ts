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
          // If speech provider fails, proceed with empty transcript
          transcript = '';
        }
      } else {
        // Attempt live Whisper transcription if an API key is present
        const partnerKey =
          process.env['PARTNER_API_KEY'] ||
          process.env['GROQ_API_KEY'] ||
          process.env['OPENAI_API_KEY'];
        const baseUrl = process.env['PARTNER_BASE_URL'] || 'https://api.groq.com/openai/v1';

        if (partnerKey) {
          const start = Date.now();
          try {
            const formData = new FormData();
            const blob = new Blob([buffer], { type: 'audio/webm' });
            formData.append('file', blob, 'audio.webm');
            formData.append(
              'model',
              baseUrl.includes('groq') ? 'whisper-large-v3-turbo' : 'whisper-1',
            );
            const res = await fetch(`${baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${partnerKey}` },
              body: formData,
              signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
              const data = (await res.json()) as { text?: string };
              transcript = data.text?.trim() ?? '';
              transcriptLatencyMs = Date.now() - start;
            }
          } catch {
            transcript = '';
          }
        }
      }
    }

    return parseVoiceIntent(transcript, request.edges, request.nodes, {
      captureMs,
      transcriptMs: transcriptLatencyMs,
    });
  }
}
