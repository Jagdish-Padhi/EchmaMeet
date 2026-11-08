import type { VoiceIntentParseResult } from '@chaosboard/contracts';
import {
  GnaniError,
  isGnaniLanguage,
  type GnaniLanguageCode,
  type SynthesizeResult,
} from '../../gnani';
import { randomUUID } from 'node:crypto';
import { parseVoiceIntent } from '../domain/intent-parser';
import type { ParseVoiceCommandRequest, VoiceServiceContract, VoiceServicePorts } from './ports';

/** Words that make Prisma more likely to hear infrastructure vocabulary correctly. */
const DOMAIN_KEYTERMS = [
  'latency',
  'timeout',
  'retry',
  'circuit breaker',
  'experiment',
  'repair',
  'invariant',
  'scenario',
  'stall',
  'throughput',
];

export function buildKeyterms(
  nodes: readonly { readonly label: string }[],
  edges: readonly { readonly source: string; readonly target: string }[],
): string[] {
  const labels = nodes.map((n) => n.label.trim()).filter(Boolean);
  const ids = edges.flatMap((e) => [e.source, e.target]);
  return [...new Set([...labels, ...ids, ...DOMAIN_KEYTERMS])].slice(0, 200);
}

export class VoiceService implements VoiceServiceContract {
  constructor(private readonly ports: VoiceServicePorts) {}

  async parseCommand(request: ParseVoiceCommandRequest): Promise<VoiceIntentParseResult> {
    let transcript = request.transcript?.trim() ?? '';
    let transcriptLatencyMs = 0;
    // A single explicit language from the client (e.g. hi-IN) is trusted until STT reports one.
    let language: string | undefined =
      request.language && isGnaniLanguage(request.language) ? request.language : undefined;
    const captureMs = request.audioDurationMs ?? 1200;

    if (!transcript && request.audioBase64) {
      if (!this.ports.stt) {
        throw new GnaniError(
          'not_configured',
          'Speech-to-text is not configured. Set GNANI_API_KEY to enable Gnani Prisma.',
        );
      }
      const result = await this.ports.stt.transcribe({
        audio: Buffer.from(request.audioBase64, 'base64'),
        language: request.language,
        format: 'transcribe',
        keyterms: buildKeyterms(request.nodes, request.edges),
        topic: 'Voice commands for a distributed-systems chaos engineering tool',
      });
      transcript = result.transcript;
      transcriptLatencyMs = result.latencyMs;
      language = result.language ?? language;
    }

    const started = performance.now();
    const parsed = parseVoiceIntent(transcript, request.edges, request.nodes, {
      captureMs,
      transcriptMs: transcriptLatencyMs,
      language,
    });
    const parseMs = Math.max(1, Math.round(performance.now() - started));
    return { ...parsed, timings: { ...parsed.timings, parseMs } };
  }

  async speak(result: VoiceIntentParseResult): Promise<SynthesizeResult | undefined> {
    const text = result.spokenReply?.trim();
    if (!this.ports.tts || !text) return undefined;
    const tag = result.language?.split(',')[0]?.trim() ?? '';
    const language: GnaniLanguageCode = isGnaniLanguage(tag) ? tag : 'en-IN';
    try {
      return await this.ports.tts.synthesize({ text, language });
    } catch {
      // Speech output is an enhancement; the on-screen confirmation is authoritative.
      return undefined;
    }
  }

  /** Best-effort audit record; a ledger outage must never break a voice command. */
  async log(
    result: VoiceIntentParseResult,
    meta: { source: 'websocket' | 'http'; ttsMs?: number | undefined },
  ): Promise<void> {
    if (!this.ports.ledger) return;
    try {
      await this.ports.ledger.record({
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        source: meta.source,
        language: result.language ?? 'unknown',
        transcript: result.transcript,
        status: result.status,
        commandType: result.command?.command ?? null,
        sttModel: this.ports.stt?.model ?? null,
        sttMs: result.timings.transcriptMs,
        parseMs: result.timings.parseMs,
        ttsMs: meta.ttsMs ?? null,
      });
    } catch {
      // intentionally ignored
    }
  }
}
