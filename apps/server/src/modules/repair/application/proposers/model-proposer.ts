import { repairPatchSchema } from '@chaosboard/contracts';
import type { ChatMessage, StructuredModelPort, ToolCapableModelPort } from '../../../meta-ai';
import { AgentRepairProposer } from './agent-proposer';
import { buildTelemetrySummary } from '../../domain/summarizer';
import type { ProposeRepairParams, ProposeRepairResult, RepairProposerPort } from '../ports';

const REPAIR_SYSTEM_PROMPT = `You are ChaosBoard's resilience repair agent.
Your task is to analyze real measured experiment telemetry and propose a valid RepairPatch that mitigates violated invariants.
Constraints:
- You must ONLY return a valid JSON object matching the RepairPatch schema.
- Operations can adjust edge retry policies (maxAttempts, backoffBaseMs, backoffMultiplier, maxBackoffMs, jitter), timeouts, circuit breakers, fallback modes, and node concurrency/rate limits within catalog bounds.
- Provide a clear, honest rationale for each operation.
- Do not invent nodes or edges that do not exist in the topology.`;

function supportsTools(model: unknown): model is ToolCapableModelPort {
  return typeof (model as Partial<ToolCapableModelPort>).chatWithTools === 'function';
}

/**
 * Preferred path: a tool-calling agent that inspects measured state and learns from rejected
 * attempts. If the provider rejects tool calling, the proposer degrades to a single structured
 * call and says so in the result (`mode: single_shot`) instead of pretending to be agentic.
 */
export class ModelRepairProposer implements RepairProposerPort {
  private readonly agent: AgentRepairProposer | null;

  constructor(
    private readonly model: StructuredModelPort,
    options: { readonly agentMode?: boolean | undefined } = {},
  ) {
    this.agent =
      options.agentMode !== false && supportsTools(model) ? new AgentRepairProposer(model) : null;
  }

  async propose(params: ProposeRepairParams): Promise<ProposeRepairResult> {
    if (this.agent) {
      const agentResult = await this.agent.propose(params);
      const toolsRejected =
        agentResult.error !== undefined &&
        agentResult.error !== null &&
        /HTTP error 40[0-9]|Bad request|tools?/i.test(agentResult.error) &&
        (agentResult.trace?.length ?? 0) === 0;
      if (!toolsRejected) return agentResult;
    }
    return this.proposeSingleShot(params);
  }

  private async proposeSingleShot(params: ProposeRepairParams): Promise<ProposeRepairResult> {
    const { topology, record, signal, history = [] } = params;
    const summary = buildTelemetrySummary(topology, record);
    const attempts =
      history.length === 0
        ? ''
        : `\n\nPREVIOUS ATTEMPTS THIS SESSION (do not repeat rejected patches):\n${history
            .map(
              (it) =>
                `- iteration ${String(it.iterationIndex)}: ${it.decision} (${it.decisionReason}); operations: ${(
                  it.patch?.operations ?? []
                )
                  .map((op) => op.op)
                  .join(', ')}`,
            )
            .join('\n')}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: REPAIR_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Here is the measured telemetry from the latest experiment run:\n\n${summary}${attempts}\n\nPlease propose a RepairPatch to fix the violated invariants.`,
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
        mode: 'single_shot',
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
