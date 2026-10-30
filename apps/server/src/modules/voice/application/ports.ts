import type { VoiceIntentParseResult } from '@chaosboard/contracts';
import type { TopologyEdgeRef, TopologyNodeRef } from '../domain/name-resolution';

export interface SpeechTranscriptionPort {
  transcribeAudio(
    audioBuffer: Buffer,
    biasingKeywords: readonly string[],
  ): Promise<{ transcript: string; latencyMs: number }>;
}

export interface VoiceServicePorts {
  readonly speechTranscription?: SpeechTranscriptionPort | undefined;
}

export interface ParseVoiceCommandRequest {
  readonly transcript?: string | undefined;
  readonly audioBase64?: string | undefined;
  readonly audioDurationMs?: number | undefined;
  readonly edges: readonly TopologyEdgeRef[];
  readonly nodes: readonly TopologyNodeRef[];
}

export interface VoiceServiceContract {
  parseCommand(request: ParseVoiceCommandRequest): Promise<VoiceIntentParseResult>;
}
