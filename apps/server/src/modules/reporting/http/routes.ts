import type { FastifyInstance } from 'fastify';
import { runIdSchema } from '@chaosboard/contracts';
import { AppError } from '@chaosboard/shared';
import type { ReportingService } from '../application/reporting-service';

export function registerReportingRoutes(
  app: FastifyInstance,
  reportingService: ReportingService,
): void {
  app.get('/api/reports/:runId/markdown', async (request, reply) => {
    const params = request.params as { runId: string };
    const runId = runIdSchema.parse(params.runId);

    try {
      const markdown = await reportingService.getMarkdownReport(runId);
      void reply.type('text/markdown; charset=utf-8');
      void reply.header('content-disposition', `inline; filename="report-${runId}.md"`);
      return await reply.send(markdown);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Run not found')) {
        throw new AppError('not_found', 'report_not_found', `Report for run ${runId} not found.`);
      }
      throw err;
    }
  });

  app.get('/api/reports/:runId/json', async (request, reply) => {
    const params = request.params as { runId: string };
    const runId = runIdSchema.parse(params.runId);

    try {
      const report = await reportingService.getReportExport(runId);
      void reply.header('content-disposition', `attachment; filename="report-${runId}.json"`);
      return report;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Run not found')) {
        throw new AppError('not_found', 'report_not_found', `Report for run ${runId} not found.`);
      }
      throw err;
    }
  });

  app.get('/api/reports/:runId/diagram', async (request, reply) => {
    const params = request.params as { runId: string };
    const runId = runIdSchema.parse(params.runId);

    try {
      const svg = await reportingService.getDiagramSvg(runId);
      void reply.type('image/svg+xml; charset=utf-8');
      void reply.header('content-disposition', `inline; filename="topology-${runId}.svg"`);
      return await reply.send(svg);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Run not found')) {
        throw new AppError('not_found', 'report_not_found', `Report for run ${runId} not found.`);
      }
      throw err;
    }
  });

  app.get('/api/reports/:runId/card', async (request) => {
    const params = request.params as { runId: string };
    const runId = runIdSchema.parse(params.runId);

    try {
      return await reportingService.getBlueprintCard(runId);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Run not found')) {
        throw new AppError('not_found', 'report_not_found', `Report for run ${runId} not found.`);
      }
      throw err;
    }
  });
}
