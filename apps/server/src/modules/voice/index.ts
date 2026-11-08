export { VoiceService, buildKeyterms } from './application/voice-service';
export type {
  ParseVoiceCommandRequest,
  VoiceServiceContract,
  VoiceServicePorts,
} from './application/ports';
export { parseVoiceIntent } from './domain/intent-parser';
export { resolveEdgeFromSpokenText } from './domain/name-resolution';
export type { ResolvedEdgeMatch, TopologyEdgeRef, TopologyNodeRef } from './domain/name-resolution';
export { registerVoiceRoutes } from './http/routes';
export { attachVoiceWebSocketBridge } from './infrastructure/voice-ws-bridge';
