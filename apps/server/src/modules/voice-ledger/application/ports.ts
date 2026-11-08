export type LedgerSource = 'websocket' | 'http';

export interface VoiceLedgerEntry {
  readonly id: string;
  readonly createdAt: string;
  readonly source: LedgerSource;
  /** BCP-47 tag reported by Gnani Prisma, or `unknown`. */
  readonly language: string;
  readonly transcript: string;
  readonly status: 'parsed' | 'ambiguous' | 'unsupported' | 'empty';
  readonly commandType: string | null;
  readonly sttModel: string | null;
  readonly sttMs: number;
  readonly parseMs: number;
  readonly ttsMs: number | null;
}

export interface LedgerAnalytics {
  readonly total: number;
  readonly byLanguage: readonly { readonly language: string; readonly count: number }[];
  readonly byStatus: readonly { readonly status: string; readonly count: number }[];
  readonly byCommand: readonly { readonly command: string; readonly count: number }[];
  readonly sttLatencyMs: { readonly p50: number; readonly p95: number } | null;
  readonly successRatePct: number | null;
}

export interface VoiceLedgerPort {
  readonly backend: 'postgres' | 'memory';
  record(entry: VoiceLedgerEntry): Promise<void>;
  recent(limit: number): Promise<readonly VoiceLedgerEntry[]>;
  analytics(): Promise<LedgerAnalytics>;
  close(): Promise<void>;
}
