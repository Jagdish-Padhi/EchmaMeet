import type { RunRecord, TradeOffReport } from '@chaosboard/contracts';

export interface RunReaderPort {
  getRunRecord(runId: string): Promise<RunRecord | null>;
  getTradeOffReport?(scenarioId: string): Promise<TradeOffReport | null>;
}

export interface ImageGenerationPort {
  isAvailable(): boolean;
  generateBlueprintCard(prompt: string): Promise<{ imageData: string; mimeType: string } | null>;
}
