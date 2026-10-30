import type { RunReaderPort, ImageGenerationPort } from './ports';
import { generateMarkdownReport, generateReportExport } from '../domain/report-generator';
import { generateDeterministicTopologySvg } from '../domain/diagram-generator';
import type { ReportExport, BlueprintCard } from '@chaosboard/contracts';

export class ReportingService {
  constructor(
    private readonly runReader: RunReaderPort,
    private readonly imageGen?: ImageGenerationPort,
  ) {}

  async getMarkdownReport(runId: string): Promise<string> {
    const runRecord = await this.runReader.getRunRecord(runId);
    if (!runRecord) {
      throw new Error(`Run not found: ${runId}`);
    }

    const tradeOff = this.runReader.getTradeOffReport
      ? await this.runReader.getTradeOffReport(runRecord.topology.id)
      : null;

    return generateMarkdownReport({
      runRecord,
      tradeOffReport: tradeOff,
      generatedAt: new Date().toISOString(),
    });
  }

  async getReportExport(runId: string): Promise<ReportExport> {
    const runRecord = await this.runReader.getRunRecord(runId);
    if (!runRecord) {
      throw new Error(`Run not found: ${runId}`);
    }

    const tradeOff = this.runReader.getTradeOffReport
      ? await this.runReader.getTradeOffReport(runRecord.topology.id)
      : null;

    const diagramSvg = generateDeterministicTopologySvg({
      topology: runRecord.topology,
      faults: runRecord.faults,
      verdicts: runRecord.verdicts,
    });

    return generateReportExport({
      runRecord,
      tradeOffReport: tradeOff,
      diagramSvg,
      generatedAt: new Date().toISOString(),
    });
  }

  async getDiagramSvg(runId: string): Promise<string> {
    const runRecord = await this.runReader.getRunRecord(runId);
    if (!runRecord) {
      throw new Error(`Run not found: ${runId}`);
    }

    return generateDeterministicTopologySvg({
      topology: runRecord.topology,
      faults: runRecord.faults,
      verdicts: runRecord.verdicts,
    });
  }

  async getBlueprintCard(runId: string): Promise<BlueprintCard> {
    const runRecord = await this.runReader.getRunRecord(runId);
    if (!runRecord) {
      throw new Error(`Run not found: ${runId}`);
    }

    const m = runRecord.faultedAggregate?.metrics ?? runRecord.baselineAggregate?.metrics;
    const completionMedian = m?.completionRate.median;
    const authoritativeMetrics = {
      p50Ms: m?.p50LatencyMs.median ?? undefined,
      p99Ms: m?.p99LatencyMs.median ?? undefined,
      errorRate:
        completionMedian !== null && completionMedian !== undefined
          ? Math.max(0, 1 - completionMedian)
          : undefined,
    };

    const promptSummary = `Topology ${runRecord.topology.name} with ${String(runRecord.topology.nodes.length)} nodes, ${String(runRecord.faults.length)} faults, ${String(runRecord.verdicts.length)} verdicts. Status: ${runRecord.overallStatus}`;

    // Deterministic diagram SVG fallback
    const fallbackSvg = generateDeterministicTopologySvg({
      topology: runRecord.topology,
      faults: runRecord.faults,
      verdicts: runRecord.verdicts,
    });

    if (!this.imageGen || !this.imageGen.isAvailable()) {
      return {
        runId: runRecord.id,
        status: 'fallback_to_diagram',
        label: 'illustrative_rendering',
        mimeType: 'image/svg+xml',
        content: fallbackSvg,
        promptSummary,
        authoritativeMetrics,
        fallbackReason:
          'Muse Image adapter not configured or unavailable; rendered deterministic SVG diagram',
      };
    }

    try {
      const generated = await this.imageGen.generateBlueprintCard(promptSummary);
      if (generated) {
        return {
          runId: runRecord.id,
          status: 'generated',
          label: 'illustrative_rendering',
          mimeType: generated.mimeType,
          content: generated.imageData,
          promptSummary,
          authoritativeMetrics,
        };
      }
      return {
        runId: runRecord.id,
        status: 'fallback_to_diagram',
        label: 'illustrative_rendering',
        mimeType: 'image/svg+xml',
        content: fallbackSvg,
        promptSummary,
        authoritativeMetrics,
        fallbackReason:
          'Image model returned empty response; fallback to deterministic SVG diagram',
      };
    } catch (err: unknown) {
      return {
        runId: runRecord.id,
        status: 'fallback_to_diagram',
        label: 'illustrative_rendering',
        mimeType: 'image/svg+xml',
        content: fallbackSvg,
        promptSummary,
        authoritativeMetrics,
        fallbackReason: `Image model generation failed (${err instanceof Error ? err.message : 'unknown error'}); fallback to deterministic SVG diagram`,
      };
    }
  }
}
