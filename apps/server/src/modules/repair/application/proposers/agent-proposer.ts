import { z } from 'zod';
import { repairPatchSchema, type RepairPatch } from '@chaosboard/contracts';
import type { AgentMessage, ToolCapableModelPort, ToolDefinition } from '../../../meta-ai';
import { ModelCallError } from '../../../meta-ai';
import type { ModelCallMetadata } from '../../../meta-ai';
import { buildTelemetrySummary } from '../../domain/summarizer';
import { validateRepairPatch } from '../../domain/validator';
import { diagnoseRunRecord } from '../ml-diagnosis-service';
import type { ProposeRepairParams, ProposeRepairResult } from '../ports';

const AGENT_SYSTEM_PROMPT = `You are the resilience repair agent inside a chaos-engineering sandbox.
A real experiment was just measured. Your job is to produce ONE typed RepairPatch that makes the
violated invariants pass without breaking the ones that already pass.

You do not get to declare success: the sandbox re-runs the experiment with your patch and decides.
Work like an SRE:
1. Inspect before you act. Call get_invariant_verdicts, then the policies of the edges/nodes involved.
2. Call get_ml_diagnosis for the project's Random Forest classifier as a second opinion on the failure archetype; weigh it against the verdicts, it can be wrong.
3. Call get_failed_attempts so you never repeat a patch the sandbox already rejected.
4. Call get_catalog_bounds when you are unsure of a numeric limit.
5. Call submit_patch with the smallest change that addresses the measured mechanism. If submit_patch
   reports validation problems, fix them and submit again.
Only reference edges and nodes that exist. Explain every operation's rationale in terms of the
measured numbers.`;

const MAX_AGENT_TURNS = 8;
const MAX_TOOL_RESULT_CHARS = 6_000;

export interface AgentProposerOptions {
  readonly maxTurns?: number | undefined;
}

type TraceEntry = { tool: string; args: unknown; result: string };

function clip(text: string): string {
  return text.length > MAX_TOOL_RESULT_CHARS
    ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}…[truncated]`
    : text;
}

/**
 * A genuine tool-calling repair agent. The model explores real measured state through tools,
 * reads the sandbox's verdict on its earlier attempts, and submits a patch that is validated
 * against the typed catalog before it ever reaches the experiment engine. Every tool result is
 * computed from the live run record, never from model-provided data.
 */
export class AgentRepairProposer {
  constructor(
    private readonly model: ToolCapableModelPort,
    private readonly options: AgentProposerOptions = {},
  ) {}

  async propose(params: ProposeRepairParams): Promise<ProposeRepairResult> {
    const { topology, record, history = [], signal } = params;
    const trace: TraceEntry[] = [];
    let submitted: RepairPatch | null = null;
    let lastValidationProblems: string[] = [];
    let promptTokens = 0;
    let completionTokens = 0;
    let latencyMs = 0;
    let lastMetadata: ModelCallMetadata | null = null;

    const edgeIds = new Set(topology.edges.map((e) => e.id as string));
    const nodeIds = new Set(topology.nodes.map((n) => n.id as string));

    const patchJsonSchema = z.toJSONSchema(repairPatchSchema) as Record<string, unknown>;
    const tools: ToolDefinition[] = [
      {
        name: 'get_invariant_verdicts',
        description:
          'Measured verdict for every invariant: status, threshold, baseline and faulted median/IQR.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'get_edge_policy',
        description: 'Current retry, timeout, breaker, fallback and mode of one edge.',
        parameters: {
          type: 'object',
          properties: { edgeId: { type: 'string' } },
          required: ['edgeId'],
          additionalProperties: false,
        },
      },
      {
        name: 'get_node_config',
        description: 'Current concurrency, queue and rate limit of one node.',
        parameters: {
          type: 'object',
          properties: { nodeId: { type: 'string' } },
          required: ['nodeId'],
          additionalProperties: false,
        },
      },
      {
        name: 'get_failed_attempts',
        description:
          'Every earlier patch in this session with the sandbox decision (accepted or rolled back) and why.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'get_ml_diagnosis',
        description:
          'Consult the Random Forest root-cause classifier trained in this project. Returns its predicted failure archetype, class probabilities, the metrics that drove the prediction and a conventional remediation hint. It is a second opinion computed from the measured aggregate, not ground truth.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'get_catalog_bounds',
        description: 'Numeric limits every patch operation must respect.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'submit_patch',
        description:
          'Submit the final RepairPatch. It is validated; if validation fails you receive the problems and may resubmit.',
        parameters: patchJsonSchema,
      },
    ];

    const execute = (name: string, args: unknown): string => {
      const a = (args ?? {}) as Record<string, unknown>;
      switch (name) {
        case 'get_invariant_verdicts':
          return buildTelemetrySummary(topology, record);
        case 'get_edge_policy': {
          const edge = topology.edges.find((e) => e.id === a['edgeId']);
          return edge
            ? JSON.stringify({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                mode: edge.mode,
                policy: edge.policy,
              })
            : JSON.stringify({ error: `Unknown edge. Known edges: ${[...edgeIds].join(', ')}` });
        }
        case 'get_node_config': {
          const node = topology.nodes.find((n) => n.id === a['nodeId']);
          return node
            ? JSON.stringify({
                id: node.id,
                kind: node.kind,
                concurrency: node.concurrency,
                queue: node.queue,
                ingressRateLimitRps: node.ingressRateLimitRps,
                processing: node.processing,
              })
            : JSON.stringify({ error: `Unknown node. Known nodes: ${[...nodeIds].join(', ')}` });
        }
        case 'get_failed_attempts':
          return JSON.stringify(
            history.map((it) => ({
              iteration: it.iterationIndex,
              decision: it.decision,
              reason: it.decisionReason,
              validationProblems:
                !it.validation || it.validation.valid
                  ? []
                  : it.validation.problems.map((p) => `${p.code}: ${p.message}`),
              operations: (it.patch?.operations ?? []).map((op) => ({ ...op })),
            })),
          );
        case 'get_ml_diagnosis': {
          const outcome = diagnoseRunRecord(record);
          return outcome.kind === 'ok'
            ? JSON.stringify(outcome.response)
            : JSON.stringify({ error: 'No measured telemetry is available to classify.' });
        }
        case 'get_catalog_bounds':
          return JSON.stringify({
            timeoutMs: '10..30000 or null',
            retry: {
              maxAttempts: '1..6',
              backoffBaseMs: '0..2000',
              backoffMultiplier: '1..4',
              maxBackoffMs: '0..10000',
            },
            breaker: {
              failureThresholdPct: '5..100',
              windowRequests: '5..200',
              cooldownMs: '100..30000',
              halfOpenProbes: '1..20',
            },
            node: {
              maxWorkers: '1..500',
              queueMaxDepth: '1..10000',
              ingressRateLimitRps: '1..5000 or null',
            },
          });
        default:
          return JSON.stringify({ error: `Unknown tool ${name}` });
      }
    };

    const messages: AgentMessage[] = [
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
      {
        role: 'user',
        content:
          `Iteration ${String(params.iterationIndex)}. Overall status: ${record.overallStatus ?? 'UNKNOWN'}. ` +
          `Topology ${topology.id} has ${String(topology.nodes.length)} nodes and ${String(topology.edges.length)} edges. ` +
          `Previous attempts this session: ${String(history.length)}. Investigate with the tools, then submit_patch.`,
      },
    ];

    const maxTurns = this.options.maxTurns ?? MAX_AGENT_TURNS;
    try {
      for (let turn = 0; turn < maxTurns && submitted === null; turn += 1) {
        const result = await this.model.chatWithTools({
          messages,
          tools,
          temperature: 0.2,
          maxTokens: 2_500,
          promptVersion: 'repair-agent-v1',
          signal,
        });
        lastMetadata = result.metadata;
        promptTokens += result.metadata.tokenCounts?.promptTokens ?? 0;
        completionTokens += result.metadata.tokenCounts?.completionTokens ?? 0;
        latencyMs += result.metadata.latencyMs;

        if (result.toolCalls.length === 0) {
          messages.push({ role: 'assistant', content: result.content ?? '' });
          messages.push({
            role: 'user',
            content: 'You must act through tools. Call submit_patch with your RepairPatch.',
          });
          continue;
        }

        messages.push({
          role: 'assistant',
          content: result.content,
          tool_calls: result.toolCalls.map((call) => ({
            id: call.id,
            type: 'function' as const,
            function: { name: call.name, arguments: JSON.stringify(call.arguments) },
          })),
        });

        for (const call of result.toolCalls) {
          let output: string;
          if (call.name === 'submit_patch') {
            const parsed = repairPatchSchema.safeParse(call.arguments);
            if (!parsed.success) {
              lastValidationProblems = parsed.error.issues
                .slice(0, 5)
                .map((i) => `${i.path.join('.')}: ${i.message}`);
              output = JSON.stringify({ accepted: false, schemaProblems: lastValidationProblems });
            } else {
              const validation = validateRepairPatch(topology, parsed.data);
              if (validation.valid) {
                submitted = parsed.data;
                output = JSON.stringify({ accepted: true });
              } else {
                lastValidationProblems = validation.problems.map((p) => `${p.code}: ${p.message}`);
                output = JSON.stringify({
                  accepted: false,
                  validationProblems: lastValidationProblems,
                });
              }
            }
          } else {
            output = clip(execute(call.name, call.arguments));
          }
          trace.push({ tool: call.name, args: call.arguments, result: output.slice(0, 500) });
          messages.push({ role: 'tool', tool_call_id: call.id, content: output });
          if (submitted) break;
        }
      }
    } catch (err) {
      if (err instanceof ModelCallError || err instanceof Error) {
        return {
          patch: null,
          rawOutput: JSON.stringify({ trace }),
          metadata: lastMetadata,
          error: err.message,
          mode: 'tool_agent',
          trace,
        };
      }
      throw err;
    }

    if (!submitted) {
      return {
        patch: null,
        rawOutput: JSON.stringify({ trace }),
        metadata: lastMetadata,
        error:
          lastValidationProblems.length > 0
            ? `Agent never produced a valid patch. Last problems: ${lastValidationProblems.join('; ')}`
            : `Agent did not submit a patch within ${String(maxTurns)} turns.`,
        mode: 'tool_agent',
        trace,
      };
    }

    return {
      patch: submitted,
      rawOutput: JSON.stringify({ trace, patch: submitted }),
      metadata: lastMetadata
        ? {
            ...lastMetadata,
            promptVersion: 'repair-agent-v1',
            latencyMs,
            tokenCounts: { promptTokens, completionTokens },
          }
        : null,
      mode: 'tool_agent',
      trace,
    };
  }
}
