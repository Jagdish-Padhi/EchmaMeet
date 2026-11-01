import { useState, useCallback, useRef, useEffect } from 'react';
import type { BoardState } from '../board';
import type { ApiClient } from '../../api/client';
import type { SreHazard } from './types';
import { meetingAudio } from './services/audioAlert';

export interface UseMeetingAgentProps {
  readonly board: BoardState;
  readonly api: ApiClient;
  readonly hostName: string;
  readonly isMeetingActive: boolean;
  readonly roomId?: string | undefined;
  readonly transcripts?: readonly { speakerName: string; text: string; timestampMs?: number }[] | undefined;
  readonly experimentSummary?: unknown | undefined;
}

export function useMeetingAgent({
  board,
  api,
  hostName,
  isMeetingActive,
  roomId,
  transcripts,
  experimentSummary,
}: UseMeetingAgentProps) {
  const [hazards, setHazards] = useState<SreHazard[]>([]);
  const [aiRaisedHand, setAiRaisedHand] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [spokenOpinion, setSpokenOpinion] = useState<string>('');
  const [identifiedRisk, setIdentifiedRisk] = useState<string | undefined>();
  const [supportingReferences, setSupportingReferences] = useState<readonly any[]>([]);
  const [affectedNodeIds, setAffectedNodeIds] = useState<readonly string[]>([]);
  const [affectedEdgeIds, setAffectedEdgeIds] = useState<readonly string[]>([]);
  const [facts, setFacts] = useState<readonly string[]>([]);
  const [assumptions, setAssumptions] = useState<readonly string[]>([]);
  const [confidence, setConfidence] = useState<number>(0.85);
  const [proposedExperiment, setProposedExperiment] = useState<any | undefined>();
  const [lastEvaluatedHash, setLastEvaluatedHash] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<{
    promptTokens?: number | undefined;
    completionTokens?: number | undefined;
    totalTokens?: number | undefined;
  } | null>(null);

  const prevRaisedHandRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Compute lightweight deterministic signature of canvas topology to avoid redundant LLM calls
  const currentHash = `${board.nodes.length}-${board.edges.length}-${board.nodes
    .map((n) => `${n.id}:${n.queue.mode}`)
    .join('|')}-${board.edges.map((e) => `${e.id}:${e.policy.retry.maxAttempts}:${e.policy.timeoutMs}`).join('|')}`;

  // In-call permission state for Echma speaking up
  const [permissionRequested, setPermissionRequested] = useState(false);

  // Evaluate topology with Meta Llama 3 via backend
  const evaluateTopology = useCallback(
    async (manualPrompt?: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsEvaluating(true);

      try {
        const topologyPayload = {
          nodes: board.nodes.map((n) => ({
            id: n.id,
            label: n.label,
            kind: n.kind,
            queue: n.queue,
          })),
          edges: board.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            policy: e.policy,
          })),
          entryNodeId: board.entryNodeId,
        };

        const res = await api.getMeetingAiOpinion(
          {
            topology: topologyPayload,
            hostName: hostName || 'Engineer',
            userPrompt: manualPrompt,
            roomId,
            transcriptSegments: transcripts,
            experimentSummary,
          },
          abortControllerRef.current.signal,
        );

        setHazards(res.hazards as SreHazard[]);
        setAiRaisedHand(res.handRaised);
        setSpokenOpinion(res.spokenOpinion);
        setIdentifiedRisk(res.identifiedRisk);
        setSupportingReferences(res.supportingTranscriptReferences ?? []);
        setAffectedNodeIds(res.affectedNodeIds ?? []);
        setAffectedEdgeIds(res.affectedEdgeIds ?? []);
        setFacts(res.facts ?? []);
        setAssumptions(res.assumptions ?? []);
        setConfidence(res.confidence ?? 0.85);
        setProposedExperiment(res.proposedExperiment);
        if (res.tokenUsage) {
          setTokenUsage(res.tokenUsage);
        }
        setLastEvaluatedHash(currentHash);

        if (manualPrompt) {
          // If the host or engineer explicitly clicked "Ask Echma" or chatted, speak immediately
          setPermissionRequested(false);
          setIsSpeaking(true);
          meetingAudio.speakNaturally(res.spokenOpinion, () => {
            setIsSpeaking(false);
          });
        } else if (res.handRaised) {
          // Automated background watcher identified a genuine hazard:
          // Sound alarm chime and present discrete allow badge next to drawing tools.
          // Smart silence: Agent DOES NOT interrupt engineers until permission is granted!
          if (!prevRaisedHandRef.current) {
            meetingAudio.playAlertChime();
          }
          setPermissionRequested(true);
        } else {
          // No critical risk: smart quiet monitoring
          setPermissionRequested(false);
        }

        prevRaisedHandRef.current = res.handRaised;
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          // graceful fallback - don't crash meeting
        }
      } finally {
        setIsEvaluating(false);
      }
    },
    [api, board, currentHash, experimentSummary, hostName, roomId, transcripts],
  );

  // Allow handler: Host/engineer clicks "Allow" on Echma's request
  const allowSpeaking = useCallback(() => {
    setPermissionRequested(false);
    if (spokenOpinion) {
      setIsSpeaking(true);
      meetingAudio.speakNaturally(spokenOpinion, () => {
        setIsSpeaking(false);
      });
    }
  }, [spokenOpinion]);

  const dismissPermission = useCallback(() => {
    setPermissionRequested(false);
  }, []);

  // Debounced auto-watcher: only re-evaluates when topology actually changes and meeting is active
  useEffect(() => {
    if (!isMeetingActive) return;

    // Don't burn tokens continuously while user is rapidly clicking/dragging
    const timer = setTimeout(() => {
      if (currentHash !== lastEvaluatedHash && !isEvaluating) {
        void evaluateTopology();
      }
    }, 2500); // 2.5s debounce to preserve hackathon credits

    return () => clearTimeout(timer);
  }, [currentHash, lastEvaluatedHash, isEvaluating, isMeetingActive, evaluateTopology]);

  // Manual trigger for the "Ask AI" button in the call
  const askOpinion = useCallback(
    (prompt?: string) => {
      void evaluateTopology(prompt || 'Please provide your live evaluation of our architecture.');
    },
    [evaluateTopology],
  );

  const stopSpeaking = useCallback(() => {
    meetingAudio.stopSpeaking();
    setIsSpeaking(false);
  }, []);

  return {
    hazards,
    primaryHazard: hazards[0] ?? null,
    aiRaisedHand,
    hazardCount: hazards.length,
    isEvaluating,
    spokenOpinion,
    identifiedRisk,
    supportingReferences,
    affectedNodeIds,
    affectedEdgeIds,
    facts,
    assumptions,
    confidence,
    proposedExperiment,
    isSpeaking,
    tokenUsage,
    permissionRequested,
    allowSpeaking,
    dismissPermission,
    askOpinion,
    stopSpeaking,
  };
}

