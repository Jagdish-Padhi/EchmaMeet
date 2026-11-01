import { repairPatchSchema } from '@chaosboard/contracts';
import type { ChatMessage, StructuredModelPort } from '../../../meta-ai';
import { buildTelemetrySummary } from '../../domain/summarizer';
import type { ProposeRepairParams, ProposeRepairResult, RepairProposerPort } from '../ports';

const REPAIR_SYSTEM_PROMPT = `You are ChaosBoard's resilience repair agent.
Your task is to analyze real measured experiment telemetry and propose a valid RepairPatch that mitigates violated invariants.
Constraints:
- You must ONLY return a valid JSON object matching the RepairPatch schema.
- Operations can adjust edge retry policies (maxAttempts, backoffBaseMs, backoffMultiplier, maxBackoffMs, jitter), timeouts, circuit breakers, fallback modes, and node concurrency/rate limits within catalog bounds.
- Provide a clear, honest rationale for each operation.
- Do not invent nodes or edges that do not exist in the topology.`;

export class ModelRepairProposer implements RepairProposerPort {
  constructor(private readonly model: StructuredModelPort) {}

  async propose(params: ProposeRepairParams): Promise<ProposeRepairResult> {
    const { topology, record, signal } = params;
    const summary = buildTelemetrySummary(topology, record);

    const messages: ChatMessage[] = [
      { role: 'system', content: REPAIR_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Here is the measured telemetry from the latest experiment run:\n\n${summary}\n\nPlease propose a RepairPatch to fix the violated invariants.`,
      },
    ];

    try {
      const result = await this.model.generateStructured({
        messages,
        responseSchema: repairPatchSchema,
        promptVersion: 'repair-v1',
        signal,
      });

      return {
        patch: result.data,
        rawOutput: result.rawOutput,
        metadata: result.metadata,
        error: null,
      };
    } catch (err) {
      return {
        patch: null,
        rawOutput: null,
        metadata: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
