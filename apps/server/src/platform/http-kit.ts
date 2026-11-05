import { PROBLEM_CONTENT_TYPE, type ProblemDetails } from '@chaosboard/contracts';
import { AppError, isAppError, type ErrorKind } from '@chaosboard/shared';
import type { FastifyError, FastifyInstance, FastifyReply } from 'fastify';
import type { z } from 'zod';

const STATUS_BY_KIND: Readonly<Record<ErrorKind, number>> = {
  validation: 400,
  not_found: 404,
  conflict: 409,
  busy: 409,
  unavailable: 503,
  timeout: 504,
  internal: 500,
};

const TITLE_BY_STATUS: Readonly<Record<number, string>> = {
  400: 'Bad request',
  404: 'Not found',
  409: 'Conflict',
  413: 'Payload too large',
  415: 'Unsupported media type',
  500: 'Internal server error',
  503: 'Service unavailable',
  504: 'Gateway timeout',
};

function titleFor(status: number): string {
  return TITLE_BY_STATUS[status] ?? 'Request failed';
}

/**
 * Parses untrusted input with a contract schema and throws a validation AppError that lists every
 * field problem. Controllers call this at the edge so nothing downstream sees unvalidated data.
 */
export function parseWith<S extends z.ZodType>(
  schema: S,
  input: unknown,
  subject: string,
): z.output<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return parsed.data;
  }
  throw new AppError('validation', 'validation_failed', `The ${subject} is invalid.`, {
    details: parsed.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    })),
  });
}

export function toProblem(error: unknown, instance: string): ProblemDetails {
  if (isAppError(error)) {
    const status = STATUS_BY_KIND[error.kind];
    const fieldErrors = Array.isArray(error.details)
      ? (error.details as { path: string; message: string }[])
      : undefined;
    return {
      type: 'about:blank',
      title: titleFor(status),
      status,
      detail: error.message,
      code: error.code,
      instance,
      ...(fieldErrors === undefined ? {} : { errors: fieldErrors }),
    };
  }
  const framework = error as Partial<FastifyError>;
  if (
    typeof framework.statusCode === 'number' &&
    framework.statusCode >= 400 &&
    framework.statusCode < 500
  ) {
    return {
      type: 'about:blank',
      title: titleFor(framework.statusCode),
      status: framework.statusCode,
      detail: framework.message ?? 'The request could not be processed.',
      code: (framework.code ?? 'bad_request').toLowerCase(),
      instance,
    };
  }
  return {
    type: 'about:blank',
    title: titleFor(500),
    status: 500,
    detail: 'An unexpected error occurred.',
    code: 'internal_error',
    instance,
  };
}

function sendProblem(reply: FastifyReply, problem: ProblemDetails): FastifyReply {
  return reply.status(problem.status).header('content-type', PROBLEM_CONTENT_TYPE).send(problem);
}

/** Maps every failure to RFC 9457 problem details. Unexpected errors are logged, never leaked. */
export function registerProblemHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const problem = toProblem(error, request.url);
    if (problem.status >= 500) {
      request.log.error({ err: error }, 'request failed');
    }
    return sendProblem(reply, problem);
  });
  app.setNotFoundHandler((request, reply) =>
    sendProblem(reply, {
      type: 'about:blank',
      title: titleFor(404),
      status: 404,
      detail: `No route matches ${request.method} ${request.url}.`,
      code: 'route_not_found',
      instance: request.url,
    }),
  );
}

export interface EventStream {
  send(event: { readonly id?: string; readonly event: string; readonly data: unknown }): void;
  close(): void;
  /** Resolves when the client disconnects or the stream is closed. */
  readonly closed: Promise<void>;
}

/**
 * Opens a server-sent event stream on a reply. The caller owns the lifetime: it sends events and
 * calls `close`. The stream also ends when the client disconnects.
 */
export function openEventStream(reply: FastifyReply): EventStream {
  reply.hijack();
  const raw = reply.raw;
  raw.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  raw.write(': stream open\n\n');

  let finished = false;
  let resolveClosed: () => void = () => undefined;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  const finish = (): void => {
    if (!finished) {
      finished = true;
      resolveClosed();
    }
  };
  raw.on('close', finish);

  return {
    closed,
    send({ id, event, data }) {
      if (finished) {
        return;
      }
      const lines = [
        ...(id === undefined ? [] : [`id: ${id}`]),
        `event: ${event}`,
        `data: ${JSON.stringify(data)}`,
        '',
        '',
      ];
      raw.write(lines.join('\n'));
    },
    close() {
      if (!finished) {
        raw.end();
        finish();
      }
    },
  };
}
