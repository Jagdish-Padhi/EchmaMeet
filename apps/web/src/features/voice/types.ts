import type { VoiceCommand, VoiceIntentParseResult, VoiceTimings } from '@chaosboard/contracts';

export type LiveStatus = 'off' | 'connecting' | 'listening' | 'unavailable';

export interface VoiceSessionState {
  readonly isRecording: boolean;
  readonly isProcessing: boolean;
  readonly partialTranscript: string;
  readonly finalTranscript: string;
  readonly parseResult: VoiceIntentParseResult | null;
  readonly timings: VoiceTimings | null;
  readonly error: string | null;
  readonly autoConfirm: boolean;
  /** `indic-auto` or comma-separated BCP-47 codes sent to Gnani Prisma. */
  readonly language: string;
  readonly speakReplies: boolean;
  readonly isSpeaking: boolean;
  readonly liveStatus: LiveStatus;
}

export type VoiceCommandAction = (command: VoiceCommand) => Promise<void> | void;

export interface VoiceLanguageOption {
  readonly value: string;
  readonly label: string;
}

/** Selection values accepted by Prisma v3.0 (`indic-auto`, or up to four codes). */
export const VOICE_LANGUAGE_OPTIONS: readonly VoiceLanguageOption[] = [
  { value: 'indic-auto', label: 'Auto-detect (Indic + English)' },
  { value: 'hi-IN,en-IN', label: 'Hinglish (Hindi + English)' },
  { value: 'hi-IN', label: 'हिन्दी (Hindi)' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'mr-IN,en-IN', label: 'मराठी + English' },
  { value: 'ta-IN,en-IN', label: 'தமிழ் + English' },
  { value: 'te-IN,en-IN', label: 'తెలుగు + English' },
  { value: 'kn-IN,en-IN', label: 'ಕನ್ನಡ + English' },
  { value: 'bn-IN,en-IN', label: 'বাংলা + English' },
];
