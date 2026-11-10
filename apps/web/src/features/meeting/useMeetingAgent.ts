import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { BoardState } from '../board';
import type { ApiClient } from '../../api/client';
import type { SreHazard } from './types';
import { meetingAudio, spokenLanguageFor } from './services/audioAlert';

/** Compute comprehensive deterministic signature of canvas topology to avoid redundant LLM calls */
export function computeTopologyHash(board: BoardState): string {
  const nodeSig = board.nodes
    .map((n) => `${n.id}:${n.kind}:${n.queue?.mode ?? ''}:${n.concurrency?.maxWorkers ?? ''}`)
    .sort()
    .join('|');
  const edgeSig = board.edges
    .map((e) => {
      const p = e.policy;
      return (
        `${e.id}:${e.source}->${e.target}:${e.mode ?? 'sync_call'}:` +
        `r=${p?.retry?.maxAttempts ?? 0}-${p?.retry?.jitter ?? 'none'}-${p?.retry?.backoffBaseMs ?? 0}:` +
        `b=${p?.breaker?.enabled ? 1 : 0}-${p?.breaker?.failureThresholdPct ?? 0}-${p?.breaker?.cooldownMs ?? 0}:` +
        `t=${p?.timeoutMs ?? 'null'}:` +
        `i=${p?.idempotency?.sendKey ? 1 : 0}:` +
        `f=${p?.fallback ?? ''}`
      );
    })
    .sort()
    .join('|');
  return `${board.entryNodeId}#${nodeSig}#${edgeSig}`;
}

export interface UseMeetingAgentProps {
  readonly board: BoardState;
  readonly api: ApiClient;
  readonly hostName: string;
  readonly isMeetingActive: boolean;
  readonly roomId?: string | undefined;
  readonly transcripts?:
    readonly { speakerName: string; text: string; timestampMs?: number }[] | undefined;
  readonly experimentSummary?: unknown | undefined;
  readonly autonomousVoice?: boolean | undefined;
}

export function useMeetingAgent({
  board,
  api,
  hostName,
  isMeetingActive,
  roomId,
  transcripts,
  experimentSummary,
  autonomousVoice = false,
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
  const isMeetingActiveRef = useRef(isMeetingActive);
  isMeetingActiveRef.current = isMeetingActive;

  // Compute comprehensive deterministic signature of canvas topology to avoid redundant LLM calls
  const currentHash = useMemo(() => computeTopologyHash(board), [board]);

  // Echma speaks with Gnani Timbre; the browser voice is only the offline fallback.
  useEffect(() => {
    meetingAudio.setSynthesizer((text, language, options) =>
      api.synthesizeSpeech({
        text,
        language,
        speed: options?.speed,
        voice: options?.voice,
      }),
    );
    return () => meetingAudio.setSynthesizer(null);
  }, [api]);

  // In-call permission state for Echma speaking up
  const [permissionRequested, setPermissionRequested] = useState(false);

  // Complete reset to prevent audio or badge leaks after leaving a meeting
  const reset = useCallback(() => {
    meetingAudio.stopSpeaking();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsSpeaking(false);
    setPermissionRequested(false);
    setAiRaisedHand(false);
    setHazards([]);
    setSpokenOpinion('');
    setIdentifiedRisk(undefined);
    setAffectedNodeIds([]);
    setAffectedEdgeIds([]);
    prevRaisedHandRef.current = false;
  }, []);

  // Evaluate the topology with the review agent (rule engine, plus Gnani Evon when configured)
  const evaluateTopology = useCallback(
    async (manualPrompt?: string, boardOverride?: BoardState) => {
      if (!isMeetingActiveRef.current) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsEvaluating(true);

      const targetBoard = boardOverride || board;
      try {
        const topologyPayload = {
          nodes: targetBoard.nodes,
          edges: targetBoard.edges,
          entryNodeId: targetBoard.entryNodeId,
        };

        const res = await api.getMeetingAiOpinion(
          {
            topology: topologyPayload,
            hostName: hostName || 'Engineer',
            userPrompt: manualPrompt,
            // Reply in the language the room is speaking (Hindi transcripts get a Hindi answer).
            language: spokenLanguageFor(
              [manualPrompt ?? '', ...(transcripts ?? []).slice(-3).map((t) => t.text)].join(' '),
            ),
            roomId,
            transcriptSegments: transcripts,
            experimentSummary,
          },
          abortControllerRef.current.signal,
        );

        // Strict guard: if meeting ended while API request was in flight, discard response immediately
        if (!isMeetingActiveRef.current) return;

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
        setLastEvaluatedHash(computeTopologyHash(targetBoard));

        if (manualPrompt) {
          // If the host or engineer explicitly clicked "Ask Echma" or chatted, speak immediately
          if (!isMeetingActiveRef.current) return;
          setPermissionRequested(false);
          setIsSpeaking(true);
          meetingAudio.speakNaturally(res.spokenOpinion, () => {
            setIsSpeaking(false);
          });
        } else if (res.handRaised) {
          // Automated background watcher identified a genuine hazard:
          // Sound alarm chime and present discrete allow badge next to drawing tools.
          if (!isMeetingActiveRef.current) return;
          if (!prevRaisedHandRef.current) {
            meetingAudio.playAlertChime();
          }
          if (autonomousVoice) {
            setPermissionRequested(false);
            setIsSpeaking(true);
            meetingAudio.speakNaturally(res.spokenOpinion, () => {
              setIsSpeaking(false);
            });
          } else {
            setPermissionRequested(true);
          }
        } else {
          // No critical risk: smart quiet monitoring
          setPermissionRequested(false);
        }

        prevRaisedHandRef.current = res.handRaised;
        return res;
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          // graceful fallback - don't crash meeting
        }
        return null;
      } finally {
        setIsEvaluating(false);
      }
    },
    [api, autonomousVoice, board, experimentSummary, hostName, roomId, transcripts],
  );

  // Allow handler: Host/engineer clicks "Allow" on Echma's request
  const allowSpeaking = useCallback(() => {
    meetingAudio.unlock();
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

  const dismissFinding = useCallback(() => {
    setAiRaisedHand(false);
  }, []);

  // Stop speaking and cancel in-flight analysis immediately when call ends
  useEffect(() => {
    if (!isMeetingActive) {
      reset();
    }
  }, [isMeetingActive, reset]);

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

  // Conversational Voice Agent: Automatically responds when any speaker addresses Echma by name
  const lastProcessedTranscriptKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isMeetingActive || !transcripts || transcripts.length === 0) return;
    const latest = transcripts[transcripts.length - 1];
    if (!latest || !latest.text) return;
    const key = `${latest.speakerName || ''}-${latest.timestampMs ?? 0}-${latest.text.trim()}`;
    if (key === lastProcessedTranscriptKeyRef.current) return;
    lastProcessedTranscriptKeyRef.current = key;

    const lower = latest.text.toLowerCase();
    const addressedEchma =
      lower.includes('echma') ||
      lower.includes('ekma') ||
      lower.includes('ishma') ||
      lower.includes('copilot') ||
      lower.includes('ai opinion') ||
      lower.includes('hey ai');

    if (addressedEchma && !isEvaluating) {
      void evaluateTopology(latest.text);
    }
  }, [isMeetingActive, transcripts, isEvaluating, evaluateTopology]);

  // Manual trigger for the "Ask AI" button in the call
  const askOpinion = useCallback(
    (prompt?: unknown) => {
      meetingAudio.unlock();
      const cleanPrompt =
        typeof prompt === 'string' && prompt.trim()
          ? prompt.trim()
          : 'Please provide your live evaluation of our architecture.';
      void evaluateTopology(cleanPrompt);
    },
    [evaluateTopology],
  );

  const evictHazard = useCallback(
    (hazardIdOrTargetId?: string, explicitEdgeId?: string, explicitNodeId?: string) => {
      if (!hazardIdOrTargetId && !explicitEdgeId && !explicitNodeId) return;
      const cleanTarget = (hazardIdOrTargetId || '').replace(/^hazard-/, '');
      setHazards((prev) => {
        const next = prev.filter((h) => {
          const cleanHId = h.id.replace(/^hazard-/, '');
          if (cleanTarget && (cleanHId === cleanTarget || h.id === hazardIdOrTargetId)) {
            return false;
          }
          if (
            (hazardIdOrTargetId &&
              (h.targetEdgeId === hazardIdOrTargetId || h.targetNodeId === hazardIdOrTargetId)) ||
            (explicitEdgeId && h.targetEdgeId === explicitEdgeId) ||
            (explicitNodeId && h.targetNodeId === explicitNodeId)
          ) {
            return false;
          }
          return true;
        });
        if (next.length === 0) {
          setAiRaisedHand(false);
          setPermissionRequested(false);
        }
        return next;
      });
    },
    [],
  );

  const reEvaluate = useCallback(
    async (prospectiveBoard?: BoardState) => {
      return evaluateTopology(undefined, prospectiveBoard);
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
    dismissFinding,
    askOpinion,
    stopSpeaking,
    reset,
    evictHazard,
    reEvaluate,
  };
}
