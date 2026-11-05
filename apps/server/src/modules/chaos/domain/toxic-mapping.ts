import type { Fault } from '@chaosboard/contracts';
import { AppError } from '@chaosboard/shared';

export interface ToxiproxyToxicRequest {
  name: string;
  type: string;
  stream: 'upstream' | 'downstream';
  toxicity: number;
  attributes: Record<string, number | string | boolean>;
}

export function mapFaultToToxic(fault: Fault, toxicName = 'chaos-fault'): ToxiproxyToxicRequest {
  const stream: 'upstream' | 'downstream' =
    fault.direction === 'upstream' ? 'upstream' : 'downstream';
  const toxicity = fault.toxicity;

  switch (fault.type) {
    case 'latency': {
      return {
        name: toxicName,
        type: 'latency',
        stream,
        toxicity,
        attributes: {
          latency: fault.latencyMs,
          jitter: fault.jitterMs,
        },
      };
    }

    case 'stall': {
      return {
        name: toxicName,
        type: 'timeout',
        stream,
        toxicity,
        attributes: {
          timeout: fault.holdMs ?? 0,
        },
      };
    }

    case 'connection_reset': {
      return {
        name: toxicName,
        type: 'reset_peer',
        stream,
        toxicity,
        attributes: {
          timeout: fault.afterMs,
        },
      };
    }

    case 'slow_close': {
      return {
        name: toxicName,
        type: 'slow_close',
        stream,
        toxicity,
        attributes: {
          delay: fault.delayMs,
        },
      };
    }

    case 'bandwidth_limit': {
      return {
        name: toxicName,
        type: 'bandwidth',
        stream,
        toxicity,
        attributes: {
          rate: fault.rateKbPerSec,
        },
      };
    }

    case 'data_limit': {
      return {
        name: toxicName,
        type: 'limit_data',
        stream,
        toxicity,
        attributes: {
          bytes: fault.maxBytes,
        },
      };
    }

    case 'dependency_down': {
      return {
        name: toxicName,
        type: 'timeout',
        stream,
        toxicity: 1,
        attributes: {
          timeout: 0,
        },
      };
    }

    default: {
      const exhaustiveCheck: never = fault;
      throw new AppError(
        'internal',
        'unsupported_fault_type',
        `Unsupported fault: ${JSON.stringify(exhaustiveCheck)}`,
      );
    }
  }
}
