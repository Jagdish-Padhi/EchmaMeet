import type { TopologyProblem, TopologyProblemCode } from '@chaosboard/contracts';

interface ProblemRefs {
  readonly nodeId?: string;
  readonly edgeId?: string;
}

export function topologyProblem(
  code: TopologyProblemCode,
  message: string,
  refs: ProblemRefs = {},
): TopologyProblem {
  return {
    code,
    message,
    ...(refs.nodeId === undefined ? {} : { nodeId: refs.nodeId }),
    ...(refs.edgeId === undefined ? {} : { edgeId: refs.edgeId }),
  };
}
