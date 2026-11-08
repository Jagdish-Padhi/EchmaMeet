import type { GnaniLanguageCode } from '../domain/languages';

export interface TranscribeRequest {
  readonly audio: Uint8Array;
  /** `indic-auto` or 1-4 comma-separated codes. Defaults to `indic-auto`. */
  readonly language?: string | undefined;
  readonly format?: 'verbatim' | 'transcribe' | 'codemix' | 'transliterate' | undefined;
  /** Domain words to favour: node labels, "latency", "circuit breaker". Max 200. */
  readonly keyterms?: readonly string[] | undefined;
  readonly topic?: string | undefined;
}

export interface TranscribeResult {
  readonly transcript: string;
  readonly model: string;
  readonly language?: string | undefined;
  readonly requestId?: string | undefined;
  readonly latencyMs: number;
}

export interface SpeechToTextPort {
  readonly model: string;
  transcribe(request: TranscribeRequest): Promise<TranscribeResult>;
}

export interface SynthesizeRequest {
  readonly text: string;
  readonly language: GnaniLanguageCode;
  readonly voice?: string | undefined;
  readonly speed?: number | undefined;
}

export interface SynthesizeResult {
  readonly audio: Uint8Array;
  readonly contentType: string;
  readonly voice: string;
  readonly model: string;
  readonly latencyMs: number;
}

export interface TextToSpeechPort {
  synthesize(request: SynthesizeRequest): Promise<SynthesizeResult>;
}
