import { AppError } from '@chaosboard/shared';
import type { VisionExtraction } from '@chaosboard/contracts';
import type { SqlDatabase } from '../../../platform/db';
import type {
  ModelCallMetadata,
  SamSegmentationPort,
  SamSegmentationResult,
  StructuredModelCallOptions,
  StructuredModelPort,
  StructuredModelResult,
  ToolCapableModelPort,
  ToolChatOptions,
  ToolChatResult,
} from '../application/ports';

/** USD per 1M tokens, from the Meta Model API catalogue supplied for the hackathon. */
export interface TokenPrice {
  readonly input: number;
  readonly cachedInput: number;
  readonly output: number;
}

export const MODEL_PRICES: Readonly<Record<string, TokenPrice>> = {
  'muse-wonder-1.0': { input: 4, cachedInput: 0.2, output: 20 },
  'muse-spark-1.3': { input: 1.25, cachedInput: 0.15, output: 4.25 },
  'muse-spark-1.2': { input: 1.25, cachedInput: 0.15, output: 4.25 },
  'muse-spark-1.1': { input: 1.25, cachedInput: 0.15, output: 4.25 },
  'muse-spark-1.3-contributor': { input: 0.1, cachedInput: 0.002, output: 0.2 },
  'muse-spark-1.2-contributor': { input: 0.1, cachedInput: 0.002, output: 0.2 },
};
export const SAM_USD_PER_IMAGE = 2.5 / 1000;
export const VOICE_USD_PER_HOUR = 0.18;

export class BudgetExhaustedError extends AppError {
  constructor(spentUsd: number, ceilingUsd: number) {
    super(
      'unavailable',
      'model_budget_exhausted',
      `Meta API spend guard: $${spentUsd.toFixed(2)} spent of the $${ceilingUsd.toFixed(2)} usable ceiling. ` +
        'The remaining reserve is held back for the final demo.',
    );
    this.name = 'BudgetExhaustedError';
  }
}

export interface UsageSummary {
  readonly totalUsd: number;
  readonly budgetUsd: number;
  readonly reserveUsd: number;
  readonly usableCeilingUsd: number;
  readonly remainingUsableUsd: number;
  /** Calls billed at the conservative fallback because the model has no catalogue price. */
  readonly unpricedCalls: number;
  /** Spend reserved for calls currently in flight. */
  readonly reservedUsd: number;
  readonly byCapability: readonly {
    capability: string;
    calls: number;
    costUsd: number;
    promptTokens: number;
    completionTokens: number;
  }[];
}

/**
 * Rates applied to a model that is not in the catalogue. Deliberately the most expensive known
 * model: an unknown model must never look free, and a guard that under-counts is worse than one
 * that over-counts.
 */
export const FALLBACK_PRICE: TokenPrice = { input: 4, cachedInput: 0.2, output: 20 };

export function priceFor(modelId: string): { price: TokenPrice; known: boolean } {
  const key = modelId.replace(/^meta-models\//, '');
  const price = MODEL_PRICES[key];
  return price ? { price, known: true } : { price: FALLBACK_PRICE, known: false };
}

export function estimateTokenCostUsd(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  cachedPromptTokens = 0,
): number {
  const { price } = priceFor(modelId);
  const uncached = Math.max(0, promptTokens - cachedPromptTokens);
  return (
    (uncached * price.input +
      cachedPromptTokens * price.cachedInput +
      completionTokens * price.output) /
    1_000_000
  );
}

/** Worst-case cost of one call, reserved before it is made. ~3 characters per token. */
export function estimateCallCostUsd(
  modelId: string,
  promptChars: number,
  maxCompletionTokens: number,
): number {
  return estimateTokenCostUsd(modelId, Math.ceil(promptChars / 3), maxCompletionTokens);
}

/** Held spend for one in-flight call. Always settle or release it. */
export interface Reservation {
  readonly estimateUsd: number;
  /** Replace the reservation with the real cost. */
  settle(actual: {
    capability: string;
    provider: string;
    modelId: string;
    promptTokens?: number;
    completionTokens?: number;
    audioMs?: number;
    images?: number;
    costUsd: number;
    latencyMs?: number;
    /** True when the provider returned no usage and the reserved estimate was recorded. */
    estimated?: boolean;
  }): void;
  /** Give the reservation back without recording spend (the call failed before billing). */
  release(): void;
}

/**
 * Durable ledger of every billable Meta call.
 *
 * The ceiling (`budget - reserve`) is enforced against spent + in-flight reservations, so a burst of
 * concurrent calls cannot all pass the check before any of them has been recorded.
 */
export class UsageLedger {
  private pendingUsd = 0;
  private openReservations = 0;

  constructor(
    private readonly db: SqlDatabase,
    private readonly budgetUsd: number,
    private readonly reserveUsd: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get usableCeilingUsd(): number {
    return Math.max(0, this.budgetUsd - this.reserveUsd);
  }

  totalUsd(): number {
    const row = this.db.get('SELECT COALESCE(SUM(cost_usd), 0) AS total FROM model_usage');
    return Number(row?.['total'] ?? 0);
  }

  /** Throws if recorded spend plus in-flight reservations has already reached the ceiling. */
  assertWithinBudget(): void {
    const committed = this.totalUsd() + this.pendingUsd;
    if (committed >= this.usableCeilingUsd) {
      throw new BudgetExhaustedError(committed, this.usableCeilingUsd);
    }
  }

  /**
   * Reserves the worst-case cost of a call before it is made. Throws if the reservation would
   * push committed spend past the ceiling.
   */
  reserve(estimateUsd: number): Reservation {
    const committed = this.totalUsd() + this.pendingUsd;
    if (committed + estimateUsd > this.usableCeilingUsd) {
      throw new BudgetExhaustedError(committed + estimateUsd, this.usableCeilingUsd);
    }
    this.pendingUsd += estimateUsd;
    this.openReservations += 1;
    let open = true;
    const giveBack = () => {
      if (open) {
        open = false;
        this.openReservations -= 1;
        // With nothing in flight the pending total is exactly zero (no floating-point residue).
        this.pendingUsd =
          this.openReservations === 0 ? 0 : Math.max(0, this.pendingUsd - estimateUsd);
      }
    };
    return {
      estimateUsd,
      settle: (actual) => {
        giveBack();
        this.record(actual);
      },
      release: giveBack,
    };
  }

  record(entry: {
    capability: string;
    provider: string;
    modelId: string;
    promptTokens?: number;
    completionTokens?: number;
    audioMs?: number;
    images?: number;
    costUsd: number;
    latencyMs?: number;
    estimated?: boolean;
  }): void {
    const isToken =
      (entry.promptTokens ?? 0) + (entry.completionTokens ?? 0) > 0 || entry.estimated;
    const priced = !isToken || priceFor(entry.modelId).known;
    this.db.run(
      `INSERT INTO model_usage
         (at, capability, provider, model_id, prompt_tokens, completion_tokens, audio_ms, images, cost_usd, latency_ms, priced, estimated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.now().toISOString(),
        entry.capability,
        entry.provider,
        entry.modelId,
        entry.promptTokens ?? 0,
        entry.completionTokens ?? 0,
        entry.audioMs ?? 0,
        entry.images ?? 0,
        entry.costUsd,
        entry.latencyMs ?? 0,
        priced ? 1 : 0,
        entry.estimated ? 1 : 0,
      ],
    );
  }

  /** Settles a chat-style call. Without provider usage the reserved worst case is recorded. */
  settleModelCall(reservation: Reservation, capability: string, metadata: ModelCallMetadata): void {
    const counts = metadata.tokenCounts;
    if (counts) {
      const promptTokens = counts.promptTokens ?? 0;
      const completionTokens = counts.completionTokens ?? 0;
      reservation.settle({
        capability,
        provider: metadata.provider,
        modelId: metadata.modelId,
        promptTokens,
        completionTokens,
        costUsd: estimateTokenCostUsd(metadata.modelId, promptTokens, completionTokens),
        latencyMs: metadata.latencyMs,
      });
      return;
    }
    // The provider billed us but told us nothing: assume the worst case rather than zero.
    reservation.settle({
      capability,
      provider: metadata.provider,
      modelId: metadata.modelId,
      costUsd: reservation.estimateUsd,
      latencyMs: metadata.latencyMs,
      estimated: true,
    });
  }

  recordModelCall(capability: string, metadata: ModelCallMetadata): void {
    const prompt = metadata.tokenCounts?.promptTokens ?? 0;
    const completion = metadata.tokenCounts?.completionTokens ?? 0;
    this.record({
      capability,
      provider: metadata.provider,
      modelId: metadata.modelId,
      promptTokens: prompt,
      completionTokens: completion,
      costUsd: estimateTokenCostUsd(metadata.modelId, prompt, completion),
      latencyMs: metadata.latencyMs,
    });
  }

  summary(): UsageSummary {
    const rows = this.db.all(
      `SELECT capability, COUNT(*) AS calls, SUM(cost_usd) AS cost,
              SUM(prompt_tokens) AS pt, SUM(completion_tokens) AS ct
         FROM model_usage GROUP BY capability ORDER BY cost DESC`,
    );
    const unpriced = this.db.get(
      'SELECT COUNT(*) AS n FROM model_usage WHERE priced = 0 OR estimated = 1',
    );
    const total = this.totalUsd();
    return {
      totalUsd: total,
      budgetUsd: this.budgetUsd,
      reserveUsd: this.reserveUsd,
      usableCeilingUsd: this.usableCeilingUsd,
      remainingUsableUsd: Math.max(0, this.usableCeilingUsd - total - this.pendingUsd),
      unpricedCalls: Number(unpriced?.['n'] ?? 0),
      reservedUsd: this.pendingUsd,
      byCapability: rows.map((r) => ({
        capability: String(r['capability']),
        calls: Number(r['calls']),
        costUsd: Number(r['cost']),
        promptTokens: Number(r['pt']),
        completionTokens: Number(r['ct']),
      })),
    };
  }
}

function promptChars(messages: readonly unknown[]): number {
  return JSON.stringify(messages).length;
}

/** Decorator: reserve before, settle after, for structured and tool calls. */
export class MeteredModel implements StructuredModelPort, ToolCapableModelPort {
  constructor(
    private readonly inner: StructuredModelPort & Partial<ToolCapableModelPort>,
    private readonly ledger: UsageLedger,
    private readonly capability: string,
    /** Model the inner adapter calls; used to price the worst case before the call. */
    private readonly modelId: string,
  ) {}

  async generateStructured<T>(
    options: StructuredModelCallOptions<T>,
  ): Promise<StructuredModelResult<T>> {
    const reservation = this.ledger.reserve(
      estimateCallCostUsd(this.modelId, promptChars(options.messages), options.maxTokens ?? 2048),
    );
    try {
      const result = await this.inner.generateStructured(options);
      this.ledger.settleModelCall(reservation, this.capability, result.metadata);
      return result;
    } catch (error) {
      reservation.release();
      throw error;
    }
  }

  async chatWithTools(options: ToolChatOptions): Promise<ToolChatResult> {
    if (!this.inner.chatWithTools) {
      throw new AppError(
        'unavailable',
        'tool_calling_unsupported',
        'Model adapter has no tool calling.',
      );
    }
    const reservation = this.ledger.reserve(
      estimateCallCostUsd(this.modelId, promptChars(options.messages), options.maxTokens ?? 2048),
    );
    try {
      const result = await this.inner.chatWithTools(options);
      this.ledger.settleModelCall(reservation, this.capability, result.metadata);
      return result;
    } catch (error) {
      reservation.release();
      throw error;
    }
  }
}

export class MeteredSam implements SamSegmentationPort {
  constructor(
    private readonly inner: SamSegmentationPort,
    private readonly ledger: UsageLedger,
    private readonly modelId = 'sam-3.1',
  ) {}

  async segmentKeyframe(
    imageBase64: string,
    prompt: string,
    options?: { signal?: AbortSignal },
  ): Promise<SamSegmentationResult> {
    const reservation = this.ledger.reserve(SAM_USD_PER_IMAGE);
    const started = Date.now();
    try {
      const result = await this.inner.segmentKeyframe(imageBase64, prompt, options);
      reservation.settle({
        capability: 'segmentation',
        provider: 'meta',
        modelId: this.modelId,
        images: 1,
        costUsd: SAM_USD_PER_IMAGE,
        latencyMs: Date.now() - started,
      });
      return result;
    } catch (error) {
      reservation.release();
      throw error;
    }
  }
}

/** Metering for the vision-language extraction call (an image plus a structured-JSON reply). */
export class MeteredVision {
  constructor(
    private readonly inner: {
      extractTopologyFromImage(
        imageBase64: string,
        mimeType: string,
        options?: { signal?: AbortSignal },
      ): Promise<StructuredModelResult<VisionExtraction>>;
    },
    private readonly ledger: UsageLedger,
    private readonly modelId: string,
  ) {}

  async extractTopologyFromImage(
    imageBase64: string,
    mimeType: string,
    options?: { signal?: AbortSignal },
  ): Promise<StructuredModelResult<VisionExtraction>> {
    // Images are billed as input tokens; a generous fixed allowance bounds the worst case.
    const reservation = this.ledger.reserve(
      estimateTokenCostUsd(this.modelId, 8_000 + Math.ceil(imageBase64.length / 750), 3_000),
    );
    try {
      const result = await this.inner.extractTopologyFromImage(imageBase64, mimeType, options);
      this.ledger.settleModelCall(reservation, 'vision', result.metadata);
      return result;
    } catch (error) {
      reservation.release();
      throw error;
    }
  }
}
