import type { VoiceCommand, VoiceIntentParseResult, VoiceTimings } from '@chaosboard/contracts';

export interface VoiceSessionState {
  readonly isRecording: boolean;
  readonly isProcessing: boolean;
  readonly partialTranscript: string;
  readonly finalTranscript: string;
  readonly parseResult: VoiceIntentParseResult | null;
  readonly timings: VoiceTimings | null;
  readonly error: string | null;
  readonly autoConfirm: boolean;
}

export type VoiceCommandAction = (command: VoiceCommand) => Promise<void> | void;
