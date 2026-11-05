import { z } from 'zod';
import type { ScenarioSpec, StaticPrediction } from '@chaosboard/contracts';
import type { StructuredModelPort } from '../../meta-ai';
import type { StaticPredictorPort } from './ports';

export const PROMPT_VERSION = 'prediction-v1';

export const staticPredictionOutputSchema = z.strictObject({
  predictedViolations: z.record(z.string(), z.boolean()),
  predictedMetrics: z.strictObject({
    p99LatencyMs: z.number().min(0).nullable(),
    errorRate: z.number().min(0).max(1).nullable(),
  }),
  predictedFailureMode: z.string().min(1),
  rationale: z.string().min(1),
});

export type StaticPredictionOutput = z.infer<typeof staticPredictionOutputSchema>;

export class StaticPredictor implements StaticPredictorPort {
  constructor(
    private readonly model: StructuredModelPort,
    private readonly modelId: string = 'meta-models/muse-spark-open-1026',
  ) {}

  async predict(scenario: ScenarioSpec, index: number): Promise<StaticPrediction> {
    const prompt = this.formatPrompt(scenario);

    const result = await this.model.generateStructured<StaticPredictionOutput>({
      promptVersion: PROMPT_VERSION,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert distributed systems reliability engineer. Analyze the following distributed system topology, injected faults, and resilience policies. Predict which invariants will be violated, estimate latency and error rates, and state the most likely failure mode.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      responseSchema: staticPredictionOutputSchema,
    });

    return {
      scenarioId: scenario.id,
      predictionIndex: index,
      modelId: this.modelId,
      promptVersion: PROMPT_VERSION,
      predictedViolations: result.data.predictedViolations,
      predictedMetrics: result.data.predictedMetrics,
      predictedFailureMode: result.data.predictedFailureMode,
      rationale: result.data.rationale,
      timestamp: new Date().toISOString(),
    };
  }

  private formatPrompt(scenario: ScenarioSpec): string {
    const nodes = scenario.topology.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      kind: n.kind,
      concurrency: n.concurrency.maxWorkers,
      queue: n.queue.mode,
    }));

    const edges = scenario.topology.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      mode: e.mode,
      policy: e.policy,
    }));

    const faults = scenario.faults.map((f) => ({
      id: f.id,
      edgeId: f.edgeId,
      type: f.type,
      parameters: f,
    }));

    const invariants = scenario.invariants.map((i) => ({
      id: i.id,
      metric: i.metric,
      scope: i.scope,
      comparator: i.comparator,
      threshold: i.threshold,
    }));

    return [
      `Scenario: ${scenario.name}`,
      `Description: ${scenario.description}`,
      '',
      `Topology Nodes:\n${JSON.stringify(nodes, null, 2)}`,
      '',
      `Topology Edges:\n${JSON.stringify(edges, null, 2)}`,
      '',
      `Injected Faults:\n${JSON.stringify(faults, null, 2)}`,
      '',
      `Invariants To Evaluate:\n${JSON.stringify(invariants, null, 2)}`,
      '',
      'Instructions: Predict whether each invariant (by id) will be violated (true = violated, false = satisfied). Estimate the p99 end-to-end latency in milliseconds and the error rate (0.0 to 1.0). Describe the likely failure mode.',
    ].join('\n');
  }
}
