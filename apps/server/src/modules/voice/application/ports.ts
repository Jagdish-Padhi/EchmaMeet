import type { VoiceIntentParseResult } from '@chaosboard/contracts';
import type { TopologyEdgeRef, TopologyNodeRef } from '../domain/name-resolution';
import type { VoiceLedgerPort } from '../../voice-ledger';
import type { SpeechToTextPort, SynthesizeResult, TextToSpeechPort } from '../../gnani';

export interface VoiceServicePorts {
  /** Gnani Prisma speech-to-text. When absent, audio requests fail with `gnani_not_configured`. */
  readonly stt?: SpeechToTextPort | undefined;
  /** Gnani Timbre text-to-speech. When absent, replies are text only. */
  readonly tts?: TextToSpeechPort | undefined;
  /** Audit trail and latency analytics (Postgres/Neon when DATABASE_URL is set). */
  readonly ledger?: VoiceLedgerPort | undefined;
}

export interface ParseVoiceCommandRequest {
  readonly transcript?: string | undefined;
  readonly audioBase64?: string | undefined;
  readonly audioDurationMs?: number | undefined;
  /** `indic-auto` or comma-separated BCP-47 codes. */
  readonly language?: string | undefined;
  readonly edges: readonly TopologyEdgeRef[];
  readonly nodes: readonly TopologyNodeRef[];
}

export interface VoiceServiceContract {
  parseCommand(request: ParseVoiceCommandRequest): Promise<VoiceIntentParseResult>;
  speak(result: VoiceIntentParseResult): Promise<SynthesizeResult | undefined>;
  log(
    result: VoiceIntentParseResult,
    meta: { source: 'websocket' | 'http'; ttsMs?: number | undefined },
  ): Promise<void>;
}
