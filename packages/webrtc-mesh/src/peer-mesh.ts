/**
 * Full-mesh WebRTC peer management using the "perfect negotiation" pattern.
 *
 * The class is deliberately independent of the DOM: it talks to a minimal peer-connection
 * surface so the identical code runs in browsers and in Node (where it is verified against a
 * real WebRTC stack negotiating through the real signaling server).
 *
 * Properties it guarantees:
 *  - Glare-free: simultaneous offers are resolved deterministically (the lexicographically
 *    smaller user id is polite and rolls back).
 *  - Renegotiation: adding, replacing or removing local tracks after connect (camera on, screen
 *    share) triggers a fresh offer; nothing depends on tracks existing at connection time.
 *  - Candidate ordering: ICE candidates arriving before the remote description are buffered.
 *  - Recovery: failed connections restart ICE with bounded retries; disconnected ones get a grace
 *    period first.
 *  - Lifecycle: closing a peer releases every handler and reports the remote stream gone.
 */

export interface IceServerLike {
  readonly urls: string | readonly string[];
  readonly username?: string | undefined;
  readonly credential?: string | undefined;
}

export interface SessionDescriptionLike {
  readonly type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  readonly sdp?: string | undefined;
}

export interface TrackLike {
  readonly kind: string;
  readonly id: string;
}

export interface SenderLike {
  readonly track: TrackLike | null;
  replaceTrack(track: TrackLike | null): Promise<void>;
}

export interface StreamLike {
  getTracks(): TrackLike[];
}

export interface PeerConnectionLike {
  readonly signalingState: string;
  readonly connectionState: string;
  readonly remoteDescription: unknown;
  onicecandidate: ((event: { candidate: unknown }) => void) | null;
  ontrack: ((event: { track: TrackLike; streams: readonly StreamLike[] }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  onnegotiationneeded: (() => void) | null;
  createOffer(options?: { iceRestart?: boolean }): Promise<SessionDescriptionLike>;
  createAnswer(): Promise<SessionDescriptionLike>;
  setLocalDescription(description: SessionDescriptionLike): Promise<void>;
  setRemoteDescription(description: SessionDescriptionLike): Promise<void>;
  addIceCandidate(candidate: unknown): Promise<void>;
  addTrack(track: TrackLike, stream: StreamLike): SenderLike;
  getSenders(): SenderLike[];
  removeTrack?(sender: SenderLike): void;
  close(): void;
}

export interface PeerMeshOptions {
  readonly selfId: string;
  readonly send: (message: Record<string, unknown>) => void;
  readonly createPeerConnection: (iceServers: readonly IceServerLike[]) => PeerConnectionLike;
  /** Resolved for each new peer connection, so TURN credentials are always fresh. */
  readonly getIceServers: () => Promise<readonly IceServerLike[]> | readonly IceServerLike[];
  readonly getLocalStream: () => StreamLike | null;
  readonly onRemoteTrack: (
    peerId: string,
    track: TrackLike,
    streams: readonly StreamLike[],
  ) => void;
  readonly onPeerClosed: (peerId: string) => void;
  readonly onPeerState?: ((peerId: string, state: string) => void) | undefined;
  readonly maxIceRestarts?: number | undefined;
  readonly disconnectGraceMs?: number | undefined;
  readonly setTimer?: ((fn: () => void, ms: number) => unknown) | undefined;
  readonly clearTimer?: ((handle: unknown) => void) | undefined;
}

interface PeerEntry {
  readonly peerId: string;
  readonly polite: boolean;
  pc: PeerConnectionLike;
  makingOffer: boolean;
  ignoreOffer: boolean;
  remoteReady: boolean;
  pendingCandidates: unknown[];
  iceRestarts: number;
  disconnectTimer: unknown;
  /** True when this side dialled the peer and therefore sends the first offer. */
  initiator: boolean;
  closed: boolean;
}

export type MeshSignal =
  | { type: 'webrtc_offer'; fromUserId: string; offer?: unknown; sdp?: unknown }
  | { type: 'webrtc_answer'; fromUserId: string; answer?: unknown; sdp?: unknown }
  | { type: 'webrtc_ice_candidate'; fromUserId: string; candidate: unknown };

function asDescription(
  type: 'offer' | 'answer',
  primary: unknown,
  sdp: unknown,
): SessionDescriptionLike | null {
  if (primary && typeof primary === 'object' && 'type' in primary) {
    return primary as SessionDescriptionLike;
  }
  if (typeof sdp === 'string') return { type, sdp };
  return null;
}

export class PeerMesh {
  private readonly peers = new Map<string, PeerEntry>();
  private readonly creating = new Map<string, Promise<PeerEntry>>();
  private readonly maxIceRestarts: number;
  private readonly disconnectGraceMs: number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private closed = false;
  private lastIceServers: readonly IceServerLike[] = [];

  constructor(private readonly options: PeerMeshOptions) {
    this.maxIceRestarts = options.maxIceRestarts ?? 3;
    this.disconnectGraceMs = options.disconnectGraceMs ?? 4_000;
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer =
      options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  get peerIds(): string[] {
    return [...this.peers.keys()];
  }

  connectionState(peerId: string): string | undefined {
    return this.peers.get(peerId)?.pc.connectionState;
  }

  /** Begin (or join) a connection with a peer. Safe to call repeatedly. */
  async connectTo(peerId: string): Promise<void> {
    if (this.closed || peerId === this.options.selfId) return;
    const dialled = await this.ensurePeer(peerId);
    if (!dialled.remoteReady) dialled.initiator = true;
    // Tracks added inside ensurePeer fire negotiationneeded; with no tracks we still need a
    // connection so remote media can arrive, so request one explicitly.
    const entry = this.peers.get(peerId);
    if (entry && entry.initiator && !entry.remoteReady) {
      // Dialling attaches tracks (queueing the first offer) or, with none, offers explicitly.
      this.syncTracks(entry, this.options.getLocalStream());
    }
    const hasTracks = (this.options.getLocalStream()?.getTracks().length ?? 0) > 0;
    // With local tracks, addTrack already queued a negotiation; avoid a duplicate offer.
    if (
      entry &&
      !entry.closed &&
      !hasTracks &&
      entry.pc.signalingState === 'stable' &&
      !entry.remoteReady
    ) {
      await this.negotiate(entry);
    }
  }

  async handleSignal(signal: MeshSignal): Promise<void> {
    if (this.closed) return;
    const peerId = signal.fromUserId;
    if (!peerId || peerId === this.options.selfId) return;
    // An incoming offer creates the peer without local tracks: they are attached after the
    // remote description is applied so they reuse the offerer's transceivers instead of
    // triggering a second, colliding negotiation.
    const entry = await this.ensurePeer(peerId, signal.type !== 'webrtc_offer');
    if (entry.closed) return;

    if (signal.type === 'webrtc_ice_candidate') {
      if (!entry.remoteReady) {
        entry.pendingCandidates.push(signal.candidate);
        return;
      }
      try {
        await entry.pc.addIceCandidate(signal.candidate);
      } catch (error) {
        if (!entry.ignoreOffer) throw error;
      }
      return;
    }

    const description =
      signal.type === 'webrtc_offer'
        ? asDescription('offer', signal.offer, signal.sdp)
        : asDescription('answer', signal.answer, signal.sdp);
    if (!description) return;

    if (signal.type === 'webrtc_answer') {
      if (entry.pc.signalingState !== 'have-local-offer') return;
      await entry.pc.setRemoteDescription(description);
      await this.markRemoteReady(entry);
      return;
    }

    const collision = entry.makingOffer || entry.pc.signalingState !== 'stable';
    entry.ignoreOffer = !entry.polite && collision;
    if (entry.ignoreOffer) return;
    if (collision) {
      try {
        await entry.pc.setLocalDescription({ type: 'rollback' });
      } catch {
        // The stack cannot roll back (older engines): discard the connection and start clean.
        this.resetConnection(entry);
      }
    }
    await entry.pc.setRemoteDescription(description);
    await this.markRemoteReady(entry);
    this.syncTracks(entry, this.options.getLocalStream());
    const answer = await entry.pc.createAnswer();
    await entry.pc.setLocalDescription(answer);
    this.options.send({ type: 'webrtc_answer', toUserId: entry.peerId, answer });
  }

  /** Reconcile every connection with the current local stream (add / replace / remove tracks). */
  syncLocalStream(): void {
    const stream = this.options.getLocalStream();
    for (const entry of this.peers.values()) {
      if (!entry.closed) this.syncTracks(entry, stream);
    }
  }

  peerLeft(peerId: string): void {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    this.closeEntry(entry);
    this.peers.delete(peerId);
  }

  close(): void {
    this.closed = true;
    for (const entry of this.peers.values()) this.closeEntry(entry);
    this.peers.clear();
    this.creating.clear();
  }

  // ------------------------------------------------------------------ internals

  private ensurePeer(peerId: string, attachTracks = true): Promise<PeerEntry> {
    const existing = this.peers.get(peerId);
    if (existing && !existing.closed) return Promise.resolve(existing);
    const inflight = this.creating.get(peerId);
    if (inflight) return inflight;

    const promise = (async () => {
      const iceServers = await this.options.getIceServers();
      this.lastIceServers = iceServers;
      const entry: PeerEntry = {
        peerId,
        polite: this.options.selfId < peerId,
        pc: this.options.createPeerConnection(iceServers),
        makingOffer: false,
        ignoreOffer: false,
        remoteReady: false,
        pendingCandidates: [],
        iceRestarts: 0,
        disconnectTimer: null,
        initiator: false,
        closed: false,
      };
      this.peers.set(peerId, entry);
      this.wire(entry);
      if (attachTracks) this.syncTracks(entry, this.options.getLocalStream());
      return entry;
    })().finally(() => {
      this.creating.delete(peerId);
    });
    this.creating.set(peerId, promise);
    return promise;
  }

  private wire(entry: PeerEntry): void {
    const { pc } = entry;
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.options.send({
          type: 'webrtc_ice_candidate',
          toUserId: entry.peerId,
          candidate: event.candidate,
        });
      }
    };
    pc.ontrack = (event) => {
      this.options.onRemoteTrack(entry.peerId, event.track, event.streams);
    };
    pc.onnegotiationneeded = () => {
      void this.negotiate(entry);
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      this.options.onPeerState?.(entry.peerId, state);
      if (state === 'connected') {
        entry.iceRestarts = 0;
        this.cancelDisconnectTimer(entry);
      } else if (state === 'disconnected') {
        this.cancelDisconnectTimer(entry);
        entry.disconnectTimer = this.setTimer(() => {
          if (pc.connectionState === 'disconnected') void this.restartIce(entry);
        }, this.disconnectGraceMs);
      } else if (state === 'failed') {
        void this.restartIce(entry);
      }
    };
  }

  private async negotiate(entry: PeerEntry, iceRestart = false): Promise<void> {
    if (entry.closed || entry.makingOffer) return;
    // Before the first exchange only the dialling side offers; the answering side waits so the
    // two never open with colliding offers.
    if (!entry.initiator && !entry.remoteReady) return;
    try {
      entry.makingOffer = true;
      const offer = await entry.pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      if (entry.pc.signalingState !== 'stable') return;
      await entry.pc.setLocalDescription(offer);
      this.options.send({ type: 'webrtc_offer', toUserId: entry.peerId, offer });
    } finally {
      entry.makingOffer = false;
    }
  }

  /** Replaces the underlying connection (same peer identity) after an unrecoverable state. */
  private resetConnection(entry: PeerEntry): void {
    const old = entry.pc;
    old.onicecandidate = null;
    old.ontrack = null;
    old.onconnectionstatechange = null;
    old.onnegotiationneeded = null;
    try {
      old.close();
    } catch {
      // already closed
    }
    entry.pc = this.options.createPeerConnection(this.lastIceServers);
    entry.remoteReady = false;
    entry.pendingCandidates = [];
    entry.makingOffer = false;
    this.wire(entry);
  }

  private async restartIce(entry: PeerEntry): Promise<void> {
    if (entry.closed || entry.iceRestarts >= this.maxIceRestarts) {
      if (!entry.closed && entry.iceRestarts >= this.maxIceRestarts) {
        this.options.onPeerState?.(entry.peerId, 'gave_up');
      }
      return;
    }
    entry.iceRestarts += 1;
    await this.negotiate(entry, true);
  }

  private async markRemoteReady(entry: PeerEntry): Promise<void> {
    entry.remoteReady = true;
    const queued = entry.pendingCandidates.splice(0);
    for (const candidate of queued) {
      try {
        await entry.pc.addIceCandidate(candidate);
      } catch {
        // A stale candidate from a superseded negotiation is harmless.
      }
    }
  }

  private syncTracks(entry: PeerEntry, stream: StreamLike | null): void {
    const wanted = stream ? stream.getTracks() : [];
    const senders = entry.pc.getSenders();
    for (const sender of senders) {
      if (!sender.track) continue;
      const replacement = wanted.find((t) => t.kind === sender.track?.kind);
      if (!replacement) {
        void sender.replaceTrack(null);
      } else if (replacement !== sender.track) {
        void sender.replaceTrack(replacement);
      }
    }
    if (!stream) return;
    let addedTrack = false;
    for (const track of wanted) {
      const covered = senders.some((s) => s.track?.kind === track.kind);
      if (!covered) {
        // addTrack lets the stack reuse a compatible idle transceiver or create a new one;
        // we never guess an idle sender's media kind ourselves.
        entry.pc.addTrack(track, stream);
        addedTrack = true;
      }
    }
    // Not every stack raises negotiationneeded reliably for tracks added to a live connection.
    // Requesting the offer explicitly is idempotent: a second request while an offer is
    // outstanding is a no-op because negotiate() requires a stable signaling state.
    if (addedTrack && (entry.remoteReady || entry.initiator)) {
      void this.negotiate(entry);
    }
  }

  private cancelDisconnectTimer(entry: PeerEntry): void {
    if (entry.disconnectTimer !== null) {
      this.clearTimer(entry.disconnectTimer);
      entry.disconnectTimer = null;
    }
  }

  private closeEntry(entry: PeerEntry): void {
    if (entry.closed) return;
    entry.closed = true;
    this.cancelDisconnectTimer(entry);
    entry.pc.onicecandidate = null;
    entry.pc.ontrack = null;
    entry.pc.onconnectionstatechange = null;
    entry.pc.onnegotiationneeded = null;
    try {
      entry.pc.close();
    } catch {
      // already closed
    }
    this.options.onPeerClosed(entry.peerId);
  }
}
