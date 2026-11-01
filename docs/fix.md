# EchmaMeet --- Engineering Remediation & World-Class Implementation Plan

> **Purpose:** A phase-wise, implementation-oriented engineering brief
> for Claude, Antigravity, or another coding agent to turn the current
> EchmaMeet MVP into a reliable, demonstrably real collaborative
> architecture-review and executable-resilience platform.
>
> **Primary rule:** Improve the system behind the existing product
> experience. Do not redesign, restyle, replace, simplify, or regress
> the current architecture canvas or its interactions. Preserve the ML
> pipeline required for college evaluation.

------------------------------------------------------------------------

## 0. Mission, product definition, and non-negotiable constraints

### 0.1 Product definition

EchmaMeet is an **AI-assisted collaborative architecture review
environment with executable resilience experiments**.

Engineers should be able to:

1.  Join a real, room-isolated review session.
2.  Communicate using real-time audio/video and screen sharing.
3.  Collaboratively inspect and edit a shared architecture canvas.
4.  Give the agent meeting context and architecture context.
5.  Ask the agent to identify architectural risks and explain them.
6.  Convert a proposed change into a typed, constrained patch.
7.  Execute a real experiment against controlled worker processes and
    injected network faults.
8.  Compare measured baseline and post-change results.
9.  Accept, reject, or revise a proposed change based on evidence.

The differentiator is **not** "Google Meet + Excalidraw + chatbot". It
is:

> EchmaMeet turns architecture-review discussion into testable
> engineering hypotheses, executes controlled experiments, and verifies
> whether proposed resilience changes improve measured system behaviour.

Do not describe the system as executing arbitrary production
microservices. The current workers are controlled service stand-ins that
implement selected behaviours. Be explicit about this boundary.

### 0.2 Non-negotiable constraints

These constraints override all implementation convenience:

-   **Canvas UI freeze:** Do not change the canvas visual design,
    layout, styling, node appearance, edge appearance, interaction
    model, keyboard behaviour, selection behaviour, drag behaviour,
    zoom/pan behaviour, or existing canvas workflow.
-   **No canvas replacement:** Do not replace the current canvas library
    or rewrite its components to make collaboration easier.
-   **No visual redesign:** Do not change global styles, typography,
    theme, spacing, colours, component library, navigation, or unrelated
    page layouts. Only add the minimum UI needed to expose a real
    capability, using existing design patterns.
-   **ML pipeline preservation:** Do not delete, rename, move, bypass,
    or break `ml/`, its models, training/evaluation scripts, datasets,
    feature definitions, prediction interfaces, or college-facing
    outputs.
-   **Backward compatibility:** Preserve current API contracts unless a
    versioned migration is explicitly designed and tested.
-   **No fake capability:** No hardcoded successful AI output,
    fabricated telemetry, canned transcript presented as transcription,
    fallback topology presented as image understanding, synthetic
    "remote participant" presented as real video, or invented benchmark
    results.
-   **No silent fallback:** If a provider is unavailable, show a clear
    degraded/unavailable state and record the reason. Do not silently
    substitute a fake result.
-   **No unsafe autonomy:** The model may propose. Deterministic
    application code validates, authorizes, executes, and verifies.
-   **Evidence over claims:** Every feature called "real", "live",
    "collaborative", "transcribed", "measured", "distributed", or
    "Meta-powered" must have a reproducible test proving it.
-   **Do not expose secrets:** No API keys, tokens, passwords, private
    meeting data, or raw sensitive recordings in logs or committed
    fixtures.

### 0.3 Work style for the coding agent

Before changing code:

1.  Read the repository structure, root package scripts, README,
    architecture docs, limitations docs, `.env.example`, and existing
    tests.
2.  Trace the actual runtime composition from `apps/server/src/main.ts`
    → `apps/server/src/app.ts` → module constructors.
3.  Trace frontend feature entry points and state ownership before
    changing them.
4.  Trace the ML pipeline end-to-end before touching any adjacent
    interfaces.
5.  Write a short implementation map identifying the exact files to
    change and the tests that protect them.
6.  Implement one phase at a time. Run the relevant tests after each
    phase.
7.  Do not do opportunistic refactors. Do not rename unrelated modules
    or "clean up" the canvas.
8.  If an existing implementation differs from this document, inspect it
    and adapt the plan without inventing behaviour.
9.  If a task cannot be safely completed within the available time,
    leave it explicitly unsupported rather than shipping a fake or
    half-connected implementation.

### 0.4 Definition of done

A feature is not complete because it compiles or appears in the UI. It
is complete only when:

-   The runtime composition actually wires it.
-   The provider or subsystem is real.
-   Authentication and authorization are enforced.
-   Failure and reconnect behaviour are handled.
-   Automated tests cover critical paths.
-   A manual end-to-end verification procedure exists.
-   Documentation accurately describes what is implemented and what is
    not.
-   No protected canvas or ML behaviour regresses.

------------------------------------------------------------------------

## 1. Repository areas to treat as protected / high-risk

The following paths were present in the reviewed repository. Re-check
exact current paths before editing.

### 1.1 Canvas --- protected

Likely relevant frontend areas include:

-   `apps/web/src/` architecture canvas components and hooks.
-   React Flow / node-edge state, canvas store, custom nodes, custom
    edges, toolbar, property panels, and canvas event handlers.
-   Existing architecture schema and API contracts in
    `packages/contracts` and `packages/shared`.

**Rule:** Treat existing canvas rendering and interaction components as
read-only unless a narrowly scoped change is unavoidable. Prefer adding
a separate collaboration adapter/hook that observes and synchronizes the
existing canonical graph state.

Before any canvas-related change, create or confirm regression coverage
for:

-   Add node.
-   Delete node.
-   Connect nodes.
-   Delete edge.
-   Select node/edge.
-   Drag node.
-   Multi-select, if supported.
-   Zoom and pan.
-   Undo/redo, if supported.
-   Node property editing.
-   Edge property editing.
-   Save/load.
-   Existing import/export.
-   Existing keyboard shortcuts.

Take baseline screenshots or recordings at representative canvas states
before changes. Compare after each collaboration phase. Screenshots are
a regression check, not a reason to restyle.

### 1.2 ML pipeline --- protected

The repository contains an `ml/` directory with models and source code.
Keep it intact.

Before work:

-   Inventory every ML entry point, training script, evaluation script,
    model file, dataset/feature contract, and expected output.
-   Record current commands and successful baseline outputs.
-   Identify whether the backend consumes ML predictions and document
    the interface.
-   Add or retain tests that ensure the backend can still call the ML
    service/interface.
-   Do not replace the ML model with an LLM response.
-   Do not relabel LLM-generated output as an ML prediction.
-   If integration needs improvement, add an adapter around the existing
    ML interface; do not rewrite the model pipeline.

If the ML pipeline currently runs separately, keep that separation. It
can be made more reproducible later with pinned dependencies,
deterministic seeds, model metadata, and evaluation reports, but not at
the expense of breaking college deliverables.

### 1.3 Core resilience and experiment engine --- protected from casual refactoring

Likely important areas:

-   `apps/worker/`
-   `apps/loadgen/`
-   `apps/server/src/modules/benchmarks/`
-   `apps/server/src/modules/repair/`
-   `apps/server/src/modules/experiments/`
-   `apps/server/src/modules/chaos/`
-   `packages/contracts/`
-   `packages/shared/`
-   `benchmarks/`

Do not simplify the load generator, measurement logic, invariant
evaluator, patch validator, or experiment lifecycle to make a demo
easier. Improve correctness and observability while preserving their
contracts.

------------------------------------------------------------------------

## 2. Phase 0 --- Baseline, audit, and safety net

**Priority:** P0 --- do this before feature work.

### Problems to address

-   Existing tests may pass without proving that the complete
    application runtime is wired correctly.
-   Some modules may be constructed with empty providers or default
    fallbacks.
-   Documentation may describe integrations that are not active in
    `app.ts`.
-   Test fixtures and benchmark fixtures may be mistaken for actual run
    evidence.
-   Canvas and ML regressions could occur during backend changes.

### Required implementation

1.  Record the current Git commit and working-tree status.
2.  Install dependencies using the repository's existing package manager
    and lockfile. Do not regenerate the lockfile without a reason.
3.  Run existing type checks, lint, unit tests, integration tests, and
    builds. Record exact commands and results.
4.  Run the current application using the documented local workflow.
5.  Trace dependency injection in:
    -   `apps/server/src/main.ts`
    -   `apps/server/src/app.ts`
    -   module constructors and provider adapters.
6.  Create a capability matrix with columns:
    -   Capability.
    -   UI entry point.
    -   API route / WebSocket event.
    -   Service.
    -   Provider.
    -   Runtime composition.
    -   Automated test.
    -   Current status: implemented / partial / stub / not wired.
7.  Explicitly inspect:
    -   Meeting media.
    -   Collaboration WebSocket.
    -   Meeting agent.
    -   Voice transcription.
    -   Vision/SAM.
    -   Meta-compatible model adapter.
    -   Repair proposer and patch validator.
    -   Benchmark runner and report generation.
    -   Database adapter.
    -   Queue/worker composition.
    -   ML pipeline.
8.  Add a `docs/implementation-status.md` report. It must be factual and
    distinguish code scaffolding from runtime-wired functionality.
9.  Add a protected-path regression checklist for canvas and ML.

### Acceptance criteria

-   Baseline commands and outputs are recorded.
-   The app starts with the documented setup.
-   Existing canvas regression checks pass.
-   Existing ML commands and expected outputs still work.
-   Every advertised capability has a verified runtime status.
-   No feature is marked "implemented" solely because a type, interface,
    component, or empty provider exists.

------------------------------------------------------------------------

## 3. Phase 1 --- Real authentication, room model, and authorization boundaries

**Priority:** P0 --- foundational for WebRTC and collaboration.

### Problems to solve

-   Meeting identity and room membership must not be based on
    client-supplied names or untrusted IDs.
-   A user must not be able to join another room by changing a URL or
    WebSocket payload.
-   Meeting endpoints and agent endpoints must not bypass authorization.
-   Development demo tokens and default secrets must never be accepted
    in production mode.
-   Room membership must be the source of truth for all later WebRTC,
    presence, canvas, transcript, and agent events.

### Design

Create or formalize a server-owned meeting domain:

-   `MeetingRoom`
-   `MeetingParticipant`
-   `MeetingRole` (host, reviewer, participant, observer if needed)
-   `MeetingMembership`
-   `MeetingSession` or equivalent session lifecycle
-   `RoomAccessPolicy`

Use the current database abstraction if it supports the required
persistence. If the existing SQLite adapter is the actual runtime store,
implement migrations there first. Do not claim PostgreSQL is active
unless a real PostgreSQL adapter is wired and used by startup.

### Required behaviour

1.  Create room:
    -   Authenticated user creates room.
    -   Server generates an unguessable room ID or invite token.
    -   Room owner/host is persisted.
    -   Optional expiry and room status are persisted.
2.  Join room:
    -   Server validates room exists and is joinable.
    -   Server authenticates the user.
    -   Server checks invite token / membership policy.
    -   Server creates or refreshes membership.
3.  Leave room:
    -   Membership becomes inactive or is removed according to retention
        policy.
    -   Active sockets and media sessions are closed.
4.  Revoke access:
    -   Host can remove participant or invalidate invite.
    -   Revoked participants cannot reconnect using an old token.
5.  Role checks:
    -   Only authorized roles can change room settings, end room, manage
        participants, or trigger expensive experiments.
6.  Every room-scoped endpoint derives `roomId` from a validated
    membership context, not merely from an arbitrary body field.

### Authentication requirements

-   Verify JWT signature, issuer, audience, expiry, and subject.
-   Use a strong environment-provided secret or asymmetric signing keys.
-   Reject development secrets in production.
-   Short-lived access tokens; refresh strategy only if needed.
-   Rate-limit login/token endpoints.
-   Never log bearer tokens.
-   Use secure, HTTP-only cookies if the existing auth design uses
    cookies; otherwise protect bearer tokens from browser storage risks
    and XSS.
-   Apply CSRF protections when cookie-authenticated state-changing
    endpoints require them.
-   Validate request schemas on every route.

### Acceptance tests

-   User A cannot join room B without authorization.
-   User A cannot subscribe to room B's events.
-   User A cannot request room B's WebRTC token.
-   Revoked user cannot reconnect.
-   Expired token is rejected.
-   Missing or invalid JWT is rejected on meeting-agent routes.
-   Development demo tokens are rejected in production mode.
-   A participant can only perform actions allowed by their room role.

------------------------------------------------------------------------

## 4. Phase 2 --- Real-time room collaboration without changing the canvas UI

**Priority:** P0.

### Main problem

The current collaboration layer must be room-scoped and must synchronize
actual shared architecture state, not merely show a global
presence/cursor signal.

### Critical architectural rule

**Do not rewrite the canvas.** Add a collaboration transport and state
adapter around the existing graph store.

Keep these concerns separate:

1.  Canvas rendering and local interaction.
2.  Canonical graph state.
3.  Collaboration transport.
4.  Server authorization and persistence.
5.  Conflict resolution and recovery.

The current canvas remains the visual and interaction layer.

### Recommended collaboration protocol

Use a room-scoped WebSocket connection for application events. WebRTC is
for media; it should not be used as the sole transport for authoritative
architecture graph persistence.

Example event envelope:

``` ts
type RoomEvent<TType extends string, TPayload> = {
  eventId: string;
  roomId: string;
  actorId: string;
  clientId: string;
  sequence: number;
  type: TType;
  timestamp: string;
  payload: TPayload;
  schemaVersion: number;
};
```

Do not trust `actorId` or room membership supplied by the client. The
server must overwrite/derive identity from the authenticated connection.

Events should be typed and validated. Suggested event families:

-   `room:joined`
-   `room:participant-joined`
-   `room:participant-left`
-   `presence:updated`
-   `cursor:moved`
-   `canvas:operation`
-   `canvas:snapshot`
-   `canvas:sync-request`
-   `canvas:sync-complete`
-   `agent:raised-hand`
-   `experiment:status`
-   `transcript:segment`
-   `room:error`

### Canvas synchronization strategy

Do not broadcast the entire graph on every mouse movement.

Recommended approach:

-   Use operation-based updates for discrete graph edits.
-   Use throttled ephemeral updates for cursor/selection/drag previews.
-   Persist canonical graph snapshots at controlled checkpoints.
-   Use a server-authoritative revision/sequence number.
-   On reconnect, request events after the last acknowledged sequence;
    if history is unavailable, send a full snapshot.
-   Deduplicate using `eventId`.
-   Reject stale or invalid operations.
-   Validate node/edge schemas server-side.
-   Keep operation payloads minimal.

For a short implementation window, a server-serialized operation log
with optimistic local UI and deterministic conflict handling is safer
than inventing a CRDT.

If concurrent editing is a core requirement and the graph model can be
represented safely, evaluate Yjs as a separate adapter. Do not directly
bind Yjs internals into canvas components. Test undo/redo, node IDs,
edge IDs, and save/load semantics before adopting it.

### Conflict handling

Define explicit rules:

-   Independent edits to different nodes should merge.
-   Two edits to the same property need a deterministic policy (server
    sequence / last accepted operation, or a conflict state).
-   Deleting a node must handle dependent edges.
-   An operation referencing a deleted node must be rejected or
    transformed safely.
-   Duplicate event delivery must not duplicate nodes/edges.
-   Reconnection must not replay stale local state over newer server
    state.

### Presence and cursor

-   Presence is room-scoped.
-   Cursor updates are ephemeral and throttled (e.g. 15--30
    updates/second maximum per participant).
-   Store last-seen timestamps.
-   Expire stale presence after disconnect/heartbeat timeout.
-   Do not persist every cursor movement.
-   Avoid broadcasting private user profile fields.

### Acceptance tests

Use two independent browser contexts and two authenticated users:

1.  Both join the same room.
2.  Each sees the other participant.
3.  A adds a node; B sees the same node without refresh.
4.  B edits a property; A sees the edit.
5.  A deletes an edge; B sees it.
6.  Both edit different nodes concurrently; both changes survive.
7.  Both edit the same property; deterministic conflict behaviour is
    visible and tested.
8.  Disconnect B, make an edit on A, reconnect B; B receives the missing
    update.
9.  Open a different room; no presence, cursor, canvas event,
    transcript, or agent event leaks across rooms.
10. Attempt malformed and unauthorized events; server rejects them.

------------------------------------------------------------------------

## 5. Phase 3 --- Real WebRTC audio/video and screen sharing

**Priority:** P0 if video collaboration is part of the promised product.
Implement as a distinct subsystem; do not mix it into canvas state.

### Recommendation: use an SFU, not browser-to-browser mesh

For a serious multi-participant product, use an SFU (Selective
Forwarding Unit). A peer mesh becomes expensive and unreliable as
participant count increases because each browser uploads multiple copies
of its media.

**Recommended implementation path:** LiveKit (managed cloud for fastest
reliable integration, or self-hosted when infrastructure and operations
are ready).

Alternative: mediasoup, but it requires more custom signaling, transport
lifecycle, deployment, TURN, and operational work. Do not choose it
merely to avoid a provider dependency if time is limited.

### Architecture

``` text
Browser A ─┐
Browser B ─┼── WebRTC/SRTP ──> LiveKit SFU ──> subscribed participants
Browser C ─┘                         |
                                     |
                         Server-issued room token
                                     |
                              EchmaMeet API
```

Application WebSocket and WebRTC media are separate:

-   Application WebSocket: presence, canvas operations, room events,
    agent status.
-   WebRTC via SFU: microphone, camera, screen-share media.
-   Server: authenticates user and issues short-lived room-scoped media
    token.

### Backend tasks

1.  Add a media-provider interface. Keep provider-specific SDK calls out
    of route handlers.
2.  Add a LiveKit provider implementation.
3.  Add a route such as `POST /api/rooms/:roomId/media-token`.
4.  Require authenticated room membership before issuing a token.
5.  Token claims must be restricted to:
    -   Correct room.
    -   Correct participant identity.
    -   Appropriate publish/subscribe permissions.
    -   Short expiration.
6.  Never accept a client-supplied arbitrary room name as authorization.
7.  Do not expose the LiveKit API secret to the browser.
8.  Validate webhook signatures if using provider webhooks.
9.  Handle participant join/leave events and reconcile them with room
    membership.
10. Add provider health/status checks without exposing secrets.

### Frontend tasks

Build a separate hook/provider, e.g. `useRoomMediaSession`, that owns:

-   Connecting and disconnecting.
-   Local microphone track.
-   Local camera track.
-   Remote participant tracks.
-   Screen-share track.
-   Mute/unmute.
-   Camera on/off.
-   Device selection.
-   Track subscription.
-   Connection state.
-   Reconnect state.
-   Permission-denied state.
-   Device-not-found state.
-   Cleanup on room leave/unmount.

Integrate its state into the existing meeting components with the
smallest possible changes. Do not redesign the meeting UI. If current
controls exist, wire those controls to real media actions instead of
replacing their appearance.

### Screen sharing

-   Publish screen-share track through the SFU.
-   Handle browser permission cancellation.
-   Stop publication when browser sharing ends.
-   Handle screen-share track replacement and participant departure.
-   Do not treat local screen capture preview as remote screen sharing.

### Network and device handling

-   Use HTTPS in deployed environments; browsers restrict
    camera/microphone APIs on insecure origins except localhost.
-   Configure TURN for restrictive NAT/firewall networks. Managed
    LiveKit may provide TURN; verify configuration rather than assuming
    it.
-   Test Chrome and Edge at minimum.
-   Handle audio output selection where browser support permits.
-   Handle camera/microphone permission denial gracefully.
-   Stop all local tracks on disconnect and page teardown.
-   Do not leave camera/microphone active after leaving the room.

### Reliability requirements

-   Show actual connection states: connecting, connected, reconnecting,
    disconnected, failed.
-   Reconnect with bounded exponential backoff and jitter.
-   Prevent duplicate participant sessions.
-   Avoid reconnect loops after explicit leave.
-   Clean up listeners and tracks.
-   Record non-sensitive diagnostics (connection state, provider error
    code, timestamps), not raw media.

### Acceptance tests

-   Two physically separate browsers join the same room and see/hear
    each other.
-   Third participant joins; all authorized participants receive media.
-   A participant mutes; remote audio stops.
-   Camera off/on works.
-   Screen share is visible remotely.
-   Screen share ends when browser sharing is stopped.
-   Device permission denied produces a clear recoverable state.
-   Network is interrupted and restored; participant reconnects.
-   Leaving room stops local media tracks.
-   Room B cannot join Room A's media room or subscribe to its media.
-   Token expiry and revoked membership prevent new media access.
-   No media API secret appears in frontend bundle or browser network
    responses.

**Do not claim WebRTC is complete until these tests pass.**

------------------------------------------------------------------------

## 6. Phase 4 --- Real meeting transcription and context-aware agent

**Priority:** P0 for the product's "agent in the room" proposition.

### Current issue to verify and fix

The voice path must not return a canned transcript such as
`"run experiment"` when no transcription provider exists. A default
transcript is a fake capability and must be removed.

### Desired data flow

``` text
Participant microphone
       |
       v
Authorized media/audio capture
       |
       v
Speech transcription provider
       |
       v
Timestamped transcript segments + speaker identity
       |
       v
Room-scoped transcript store/event stream
       |
       v
Agent context builder
       |
       v
Meta model reasoning / structured action proposal
       |
       v
Policy validation + human confirmation where required
```

### Audio capture design

Choose one of these approaches and document the trade-off:

**Option A --- client-side audio capture for transcription**

-   Capture an explicitly consented audio stream.
-   Send bounded audio chunks to the backend or transcription provider.
-   Use a supported audio encoding and chunk duration.
-   Do not record or transmit without visible participant consent.
-   Ensure only authorized room participants can access transcript
    results.

**Option B --- SFU/server-side recording or egress**

-   Use provider-supported recording/egress if available.
-   Keep recording authorization, consent, retention, and access control
    explicit.
-   Do not assume the SFU automatically provides a transcript.

For the hackathon, a simple consented push-to-transcribe or short
audio-segment workflow is acceptable if it genuinely works. Do not claim
continuous live transcription unless it is continuous and tested.

### Meta Voice Transcribe integration

If the Meta Voice Transcribe endpoint and account access are available:

1.  Implement a provider adapter using the documented endpoint,
    authentication, supported format, and response schema.
2.  Verify speaker diarization and start/stop timestamps from actual
    responses.
3.  Add timeout, retry, size limits, and error handling.
4.  Store transcript segments with room ID, participant ID, timestamps,
    provider/model metadata, and confidence if supplied.
5.  Do not invent confidence scores or speaker identity.
6.  If provider access is unavailable, expose "transcription
    unavailable" and permit a clearly labelled manual transcript input.
    Do not call manual text a transcript from audio.

### Context-aware agent

The agent should receive a compact, relevant context bundle:

-   Current room ID and authorized participant role.
-   Recent transcript segments.
-   Current architecture graph snapshot and revision.
-   Relevant node/edge configuration.
-   Active experiment and latest verified metrics.
-   Existing invariant definitions.
-   Previous agent proposals and their outcomes.
-   User's explicit question or command.

Use a context builder with token budgets and recency/relevance
selection. Do not send the entire meeting history and full graph on
every request.

### Agent behaviours

Support a small set of clear, typed behaviours:

1.  **Observe:** Summarize the current technical discussion.
2.  **Identify risk:** Raise a concern linked to a specific node, edge,
    policy, or invariant.
3.  **Explain:** Explain the mechanism and trade-offs.
4.  **Propose:** Generate a typed `RepairPatch` from the allowed
    catalog.
5.  **Request experiment:** Ask to run a named experiment.
6.  **Report:** Summarize actual experiment evidence.

The agent should not autonomously apply a topology-changing patch or
launch a costly experiment without the appropriate
authorization/confirmation.

### Structured output

Use a schema similar to:

``` ts
type AgentFinding = {
  findingId: string;
  roomId: string;
  graphRevision: number;
  severity: "info" | "warning" | "critical";
  title: string;
  explanation: string;
  affectedNodeIds: string[];
  affectedEdgeIds: string[];
  evidenceRefs: string[];
  suggestedAction?: string;
  requiresHumanApproval: boolean;
};
```

Validate every model response against a runtime schema. Reject unknown
node IDs, unsupported policy values, malformed patches, and references
to stale graph revisions.

### Hallucination controls

-   Model claims about metrics must cite experiment result IDs.
-   Model claims about graph properties must reference the supplied
    graph revision.
-   If no evidence exists, label the statement as a hypothesis.
-   Distinguish observed fact, inferred risk, and proposed action.
-   Never let the model fabricate telemetry.
-   Store model ID, provider, prompt/schema version, request ID, and
    latency for reproducibility.
-   Avoid storing hidden chain-of-thought. Store concise explanations
    and evidence references instead.

### Acceptance tests

-   Real audio produces a transcript through the selected provider.
-   Provider failure does not return a canned transcript.
-   Transcript segments are visible only to authorized room members.
-   Agent uses transcript plus current graph context.
-   Agent references actual node IDs and graph revision.
-   Agent detects a deliberately spoken risk scenario.
-   Agent distinguishes hypothesis from measured evidence.
-   Invalid structured output is rejected.
-   Agent cannot trigger an unauthorized experiment or apply an
    unapproved patch.
-   A room's transcript never appears in another room.

------------------------------------------------------------------------

## 7. Phase 5 --- Make the Meta model integration real, explicit, and judge-verifiable

**Priority:** P0 --- essential to the hackathon.

### Current risk

A generic OpenAI-compatible adapter is not automatically proof that a
Meta model is being used. The runtime endpoint, model ID, provider, and
actual request must be verified.

### Required work

1.  Inspect the existing adapter and configuration flow in
    `apps/server/src/app.ts`, `config.ts`, and the model adapter files.
2.  Ensure configuration cannot combine a Meta API key with a stale Groq
    base URL or Groq model ID.
3.  Avoid implicit provider selection based on whichever key happens to
    be present.
4.  Require an explicit provider configuration:
    -   `AI_PROVIDER`
    -   `AI_BASE_URL`
    -   `AI_API_KEY`
    -   `AI_MODEL_ID`
5.  Validate configuration at startup. Fail fast if the provider/model
    combination is inconsistent.
6.  Keep provider names and model IDs accurate in logs and persisted run
    metadata.
7.  Do not log API keys or full authorization headers.
8.  Add a model health/smoke command that performs a real request and
    validates the response schema.
9.  Add integration tests with a mocked HTTP server for error cases, but
    separately run a real credentialed smoke test before submission.
10. Persist provider/model metadata for every agent proposal and repair
    attempt.

### Model role

Use the Meta model for meaningful work:

-   Interpret meeting discussion in architecture context.
-   Identify plausible architectural failure mechanisms.
-   Produce typed repair proposals from a constrained action catalog.
-   Explain trade-offs to engineers.
-   Summarize measured results with references to real evidence.

Keep deterministic logic in normal application code:

-   Schema validation.
-   Authorization.
-   Patch allow-list.
-   Experiment execution.
-   Metrics calculation.
-   Invariant evaluation.
-   Accept/reject decision.

### Provider configuration safety

The application must not silently fall back from Meta to Groq during the
final demo. If fallback is intentionally supported for development:

-   It must be explicitly enabled.
-   It must be visible in server startup logs and UI diagnostics.
-   The UI must show the actual active provider/model.
-   Production/demo mode must reject unintended fallback.
-   Never send a Meta credential to a Groq endpoint or vice versa.

### Cost controls for the \$150 credit budget

-   Use a lower-cost eligible model for routine reasoning where quality
    is sufficient.
-   Use the stronger model only for complex repair proposals or
    difficult cases.
-   Limit context size and transcript history.
-   Avoid repeated agent calls on every canvas movement.
-   Cache deterministic graph analysis, not model outputs that depend on
    changing context.
-   Use request timeouts, bounded retries, and per-room rate limits.
-   Add a hard spend/usage alert outside the app if the provider
    supports it.
-   Record token usage and estimated cost per request where provider
    responses expose usage.
-   Run a small number of high-value real end-to-end tests; do not burn
    credits on repeated prompt tweaking.
-   Never report estimated token cost as provider-billed cost unless the
    provider confirms usage and pricing.

### Acceptance criteria

-   A real request reaches the intended Meta endpoint.
-   The actual returned model ID is recorded where available.
-   A repair proposal is produced through the Meta model.
-   Structured output validation succeeds.
-   The proposal passes deterministic patch validation.
-   A real experiment runs and records results.
-   The model cannot bypass authorization or patch constraints.
-   No Groq fallback occurs when Meta is configured for final demo mode.
-   Provider failure is explicit and recoverable.

------------------------------------------------------------------------

## 8. Phase 6 --- Make the repair and experiment loop scientifically credible

**Priority:** P0 --- this is the core differentiator.

### Required end-to-end loop

``` text
Architecture graph revision
        |
        v
Baseline configuration snapshot
        |
        v
Experiment plan + seed + workload
        |
        v
Worker processes + load generator
        |
        v
Fault injection (e.g. Toxiproxy)
        |
        v
Raw measurements + validity checks
        |
        v
Invariant evaluation
        |
        v
Meta model diagnosis / typed patch proposal
        |
        v
Patch allow-list + schema + revision validation
        |
        v
Human approval
        |
        v
Apply patch to isolated experiment configuration
        |
        v
Repeat same controlled experiment
        |
        v
Compare results + evaluate invariants
        |
        v
Accept / reject / inconclusive
```

### Experiment reproducibility

Every experiment must record:

-   Unique experiment ID.
-   Git commit, if available.
-   Architecture graph snapshot and revision.
-   Worker configuration.
-   Load profile.
-   Duration and warm-up duration.
-   Random seed.
-   Fault profile and timing.
-   Runtime environment and host description.
-   Worker count and process versions.
-   Model provider/model ID if AI participated.
-   Start/end timestamps.
-   Raw metrics or a durable reference to them.
-   Validity status and invalidation reasons.
-   Invariant definitions and thresholds.
-   Final decision.

Do not label a fixture, test run, or sample JSON as a real benchmark
result.

### Measurement correctness

Preserve the load generator's scheduled-arrival measurement logic and
its coordinated-omission protections. Do not replace it with a simpler
"request duration only" metric.

Check:

-   p50, p90, p95, p99 and max latency.
-   Throughput.
-   Error rate.
-   Timeout rate.
-   Queue depth and queue wait.
-   Retry count and retry amplification.
-   Circuit breaker state transitions.
-   Event-loop delay.
-   Load-generator lag.
-   Worker restarts/crashes.
-   Fault injection timing.
-   Warm-up and steady-state windows.

A run should be marked invalid/inconclusive if the load generator itself
is overloaded, measurements are incomplete, or the experiment did not
apply the intended fault profile.

### Fair before/after comparison

-   Use the same workload profile, duration, seed, worker count, and
    fault schedule where possible.
-   Make the changed configuration the only intended variable.
-   Clearly disclose unavoidable environment differences.
-   Run multiple trials for high-variance cases if time permits.
-   Report median and spread across trials where meaningful.
-   Do not cherry-pick the best run.
-   Do not compare different workloads and call the difference a repair
    improvement.

### Invariant evaluation

Each invariant must be explicit and machine-evaluable. Examples:

-   p99 latency below threshold.
-   Error rate below threshold.
-   Queue depth bounded.
-   Retry amplification below threshold.
-   Circuit breaker opens under specified failure conditions.
-   Recovery occurs within a defined time window.

The system must distinguish:

-   `PASS`: all required measurements exist and thresholds are met.
-   `FAIL`: valid measurements demonstrate a threshold violation.
-   `INCONCLUSIVE`: experiment invalid, required metric missing, or
    confidence insufficient.

Never turn missing data into a pass.

### Repair safety

-   Model proposes a patch; application validates it.
-   Patch is restricted to an allow-listed set of configuration paths
    and values.
-   Reject unknown fields and arbitrary code.
-   Bind patch to the graph/config revision it was generated for.
-   Reject stale patches.
-   Show exact before/after diff.
-   Require explicit approval before applying.
-   Apply to a new experiment configuration, not by mutating the
    baseline.
-   Keep rollback and audit trail.
-   Run the same experiment after patch.
-   Accept only if required invariants pass and no protected invariant
    regresses.

### Acceptance tests

-   A known fault causes a known invariant failure in a controlled
    scenario.
-   A valid patch changes only allowed fields.
-   Invalid patch is rejected.
-   Stale patch is rejected.
-   Baseline remains unchanged.
-   Post-patch run uses the intended changed configuration.
-   Before/after reports point to actual experiment IDs.
-   Missing metric yields inconclusive, never pass.
-   Load-generator overload invalidates the run.
-   A repair that improves latency but breaks another invariant is
    rejected or marked trade-off/needs review.

------------------------------------------------------------------------

## 9. Phase 7 --- Database, queue, and process orchestration truthfulness

**Priority:** P1.

### Database

Inspect actual startup and adapter usage. If `main.ts` opens SQLite,
document SQLite as the active database. A `DATABASE_URL` variable or log
message does not mean PostgreSQL is implemented.

Choose one:

-   Keep SQLite for the hackathon, use migrations, transactions,
    backups, and clear single-instance limitations; or
-   Implement a real PostgreSQL adapter with integration tests and use
    it in runtime composition.

Do not create a fake dual-database abstraction solely for the README.

### Queue

If Redis/BullMQ is advertised:

-   Instantiate the queue in startup.
-   Pass it into the modules that need it.
-   Define job schemas and versioning.
-   Add idempotency keys.
-   Configure retry/backoff and dead-letter handling.
-   Persist job status.
-   Handle worker shutdown and graceful draining.
-   Add health checks and queue metrics.
-   Test duplicate delivery and worker crash/restart.

If it is not required for the demo, remove the claim and keep the
existing in-process execution path. Do not add Redis just to increase
the technology list.

### Worker lifecycle

-   Start workers deterministically.
-   Track process IDs and health.
-   Handle unexpected exits.
-   Use bounded restart policies.
-   Ensure child processes are terminated on server shutdown.
-   Prevent orphan processes after experiment cancellation.
-   Add per-experiment resource/time limits.
-   Validate worker messages and reject malformed payloads.
-   Separate experiment IDs and worker IDs in telemetry.

### Acceptance criteria

-   Runtime logs match actual database and queue implementation.
-   Worker processes can be started, monitored, stopped, and cleaned up.
-   Duplicate jobs do not duplicate irreversible effects.
-   Server shutdown leaves no orphan workers.
-   Worker crash is reported and experiment is marked appropriately.

------------------------------------------------------------------------

## 10. Phase 8 --- Vision / diagram ingestion: real capability or clearly disabled

**Priority:** P2 unless it is a central demo feature.

### Current risk to remove

A fallback that returns a fixed three-node topology regardless of
uploaded image is not image understanding. It must never be presented as
such.

### Required design

1.  Keep image upload isolated from the existing canvas editing
    implementation.
2.  Validate MIME type, file size, dimensions, and image decoding.
3.  Store uploads safely with access control and retention limits.
4.  Use a real vision provider (Meta SAM 3.1 or another explicitly
    disclosed model) for the specific supported task.
5.  Understand that SAM is a segmentation/detection model; segmentation
    alone does not semantically understand a full architecture diagram.
6.  If extracting architecture topology, use a suitable vision-language
    model or a clearly defined multi-stage pipeline:
    -   Detect visual regions/boxes/arrows/text.
    -   OCR text.
    -   Infer component labels and relationships.
    -   Produce candidate nodes/edges with confidence/evidence.
    -   Validate schema and topology.
    -   Ask the user to review before importing into canvas.
7.  Do not automatically overwrite current canvas state.
8.  Keep imported graph as a preview/draft until user confirms.
9.  Store source image reference and extraction metadata for
    traceability.

### Acceptance criteria

-   Different test diagrams produce meaningfully different candidate
    structures.
-   Unsupported/ambiguous images return an honest uncertainty result.
-   No hardcoded topology is returned as model output.
-   User reviews import before it changes the graph.
-   Existing canvas behaviour remains unchanged.

If this cannot be completed properly, remove it from the primary demo
and mark it experimental.

------------------------------------------------------------------------

## 11. Phase 9 --- Security, privacy, and operational hardening

**Priority:** P0 for public deployment; P1 for controlled demo.

### Room and media security

-   Room membership checked for every event and API call.
-   Media tokens are short-lived and room-scoped.
-   Provider webhook signatures verified.
-   Participant revocation blocks reconnect.
-   No cross-room broadcast.
-   No public transcript or recording URL.
-   Screen share and audio capture require clear user action.
-   Show recording/transcription consent and state.

### Input and API security

-   Runtime schema validation for HTTP and WebSocket payloads.
-   Request body and upload size limits.
-   Rate limits per user and per room.
-   Timeouts on external provider calls.
-   SSRF protection for any URL-fetching feature.
-   File upload validation and safe storage.
-   CORS restricted to expected origins.
-   Security headers.
-   Production secrets from environment/secret manager.
-   No hardcoded demo secret in production.
-   Dependency audit and lockfile integrity.

### Experiment sandbox

Because experiments start processes and inject faults:

-   Never execute arbitrary model-generated shell commands.
-   Use a fixed executable and typed arguments.
-   Restrict worker configuration to known safe fields.
-   Set CPU, memory, process, duration, and concurrency limits.
-   Restrict network access to the experiment network.
-   Use dedicated test containers or isolated processes.
-   Ensure Toxiproxy targets are allow-listed.
-   Prevent user input from becoming arbitrary proxy targets.
-   Ensure cancellation terminates workers and fault proxies.
-   Record all experiment actions in an audit trail.

### Privacy and retention

-   Obtain consent before recording/transcribing.
-   Make recording/transcription state visible.
-   Define retention and deletion for audio, transcript, and reports.
-   Do not retain raw audio by default unless required.
-   Restrict transcript access to room members.
-   Avoid putting transcripts or personal information in model logs.
-   Provide a way to delete room artifacts according to the product's
    retention policy.

### Acceptance tests

-   Cross-room access attempts fail.
-   Invalid WebSocket payloads fail safely.
-   Upload limits are enforced.
-   Arbitrary command execution is impossible.
-   Unapproved Toxiproxy targets are rejected.
-   Room deletion/expiry follows retention policy.
-   Secrets do not appear in logs, frontend bundles, or committed files.

------------------------------------------------------------------------

## 12. Phase 10 --- Observability, diagnostics, and real evidence

**Priority:** P1.

### Add structured observability

Use a request/trace correlation ID across:

-   HTTP request.
-   Room event.
-   Agent request.
-   Model provider call.
-   Repair proposal.
-   Patch validation.
-   Experiment.
-   Worker processes.
-   Load generator.
-   Toxiproxy.
-   Report generation.

Every major operation should have:

-   `requestId` / `traceId`.
-   `roomId` where applicable.
-   `experimentId` where applicable.
-   `actorId` where applicable.
-   operation name.
-   start/end time.
-   status.
-   duration.
-   safe error code.

Do not log raw audio, API keys, authorization headers, or complete
sensitive transcripts.

### Health endpoints

Separate:

-   Liveness: process is alive.
-   Readiness: required dependencies are usable.
-   Dependency health: database, queue, model provider, media provider,
    worker pool.

Do not make liveness fail merely because an optional AI provider is
temporarily unavailable. Readiness should clearly communicate which
critical features are degraded.

### Benchmark evidence

Regenerate actual benchmark output. Do not ship fixture IDs such as
`test-commit`, `test-environment`, or sample run IDs as real evidence.

For every published benchmark result include:

-   Exact scenario.
-   Run ID.
-   Commit.
-   Environment.
-   Workload.
-   Fault profile.
-   Trial count.
-   Measurement validity.
-   Actual values.
-   Invariant result.
-   Limitations.

Keep test fixtures in a clearly labelled fixture directory. Keep actual
reproducible experiment reports separate.

------------------------------------------------------------------------

## 13. Phase 11 --- Testing strategy and end-to-end proof

**Priority:** P0 before final demo.

### Test layers

1.  Unit tests:
    -   Schema validation.
    -   Room authorization policy.
    -   Event validation.
    -   Patch validation.
    -   Invariant evaluation.
    -   Provider configuration.
2.  Integration tests:
    -   Database migrations.
    -   Room lifecycle.
    -   WebSocket room isolation.
    -   Model adapter request/response parsing.
    -   Worker orchestration.
    -   Toxiproxy fault lifecycle.
3.  Browser tests:
    -   Two participants in one room.
    -   Different rooms isolated.
    -   Shared canvas changes.
    -   Media controls.
    -   Screen sharing.
    -   Reconnect.
4.  End-to-end tests:
    -   Create room.
    -   Join as second user.
    -   Collaboratively edit canvas.
    -   Discuss a risk.
    -   Transcribe real audio if enabled.
    -   Agent proposes typed patch.
    -   Human approves.
    -   Baseline experiment runs.
    -   Patch experiment runs.
    -   Evidence report compares actual runs.

### Required two-browser manual test

Use two independent browser profiles or machines, not two tabs sharing
one identity.

-   Browser A: host.
-   Browser B: reviewer.
-   Join same room.
-   Verify actual remote audio/video.
-   Share screen.
-   Edit canvas from A and observe B.
-   Edit canvas from B and observe A.
-   Disconnect and reconnect B.
-   Verify room isolation using a third room.
-   Run the same architecture experiment.
-   Verify both participants see the same experiment status and result
    references.

### Failure tests

-   Model API unavailable.
-   Media provider unavailable.
-   WebSocket disconnect.
-   Worker crash.
-   Database temporarily unavailable.
-   Transcription provider timeout.
-   Invalid model JSON.
-   Invalid patch.
-   Experiment cancellation.
-   Toxiproxy unavailable.
-   Participant revoked during session.

The application must fail clearly and safely. It must not silently
produce fake successful output.

------------------------------------------------------------------------

## 14. Phase 12 --- Documentation and hackathon submission truthfulness

**Priority:** P0.

Update documentation only after implementation is verified.

### Required documents

-   `README.md`: Product, actual capabilities, setup, architecture, demo
    flow.
-   `docs/architecture.md`: Control plane, media plane, collaboration
    plane, experiment plane, AI plane, ML pipeline.
-   `docs/implementation-status.md`: Implemented / partial /
    experimental / not implemented.
-   `docs/security-and-privacy.md`: Auth, room isolation, recording
    consent, retention, sandbox boundaries.
-   `docs/limitations.md`: What the simulator models and does not model.
-   `docs/benchmark-results.md`: Real experiment evidence only.
-   `docs/demo-runbook.md`: Exact steps, seed data, expected states,
    recovery plan.
-   `.env.example`: All required variables with safe placeholders and no
    secrets.

### Product claims to avoid unless proven

Do not claim:

-   Production microservices are executed if only controlled workers are
    run.
-   Real-time transcription if audio is only manually entered or
    transcribed on demand.
-   Real WebRTC if only local camera preview exists.
-   Collaborative canvas if only cursors/presence are synchronized.
-   Meta-powered vision if no Meta vision provider is wired.
-   PostgreSQL if runtime uses SQLite.
-   Redis/BullMQ if queue is not instantiated and used.
-   Accurate AI latency prediction without measured evaluation evidence.
-   Autonomous repair if the model only writes prose and no validated
    patch is executed.

### Submission evidence

Prepare:

-   Public repository with no secrets.
-   A short architecture diagram matching the real implementation.
-   One real benchmark report.
-   One reproducible repair case.
-   A clear list of hackathon-built contributions.
-   Three-minute demo video with actual working functionality.
-   Exact model/provider disclosure.
-   A clean `.env.example` and reproducible setup instructions.

------------------------------------------------------------------------

## 15. Suggested implementation order for an agentic coding team

Do not ask an agent to "make everything world-class" in one prompt.
Split work into bounded tasks and review each diff.

### Workstream A --- Core platform and security

1.  Phase 0 baseline.
2.  Phase 1 room/auth model.
3.  Phase 2 collaboration protocol.
4.  Phase 9 security checks.

### Workstream B --- Real-time media

1.  Provider selection and environment setup.
2.  Server-issued room media token.
3.  Frontend media session adapter.
4.  Remote audio/video.
5.  Screen sharing.
6.  Reconnect/device/error handling.
7.  Two-browser tests.

### Workstream C --- AI meeting intelligence

1.  Explicit Meta provider config.
2.  Real model smoke test.
3.  Transcription adapter.
4.  Transcript storage and room events.
5.  Context builder.
6.  Typed agent findings and repair proposals.
7.  Evidence references and approval flow.

### Workstream D --- Experiment and evidence

1.  Baseline run reproducibility.
2.  Experiment metadata.
3.  Invariant correctness.
4.  Patch revision and allow-list validation.
5.  Before/after run.
6.  Report generation.
7.  Real benchmark regeneration.

### Workstream E --- ML preservation

1.  Record baseline pipeline commands and outputs.
2.  Add/retain regression checks.
3.  Verify backend integration contract.
4.  Do not refactor or replace model logic during unrelated work.

Workstreams may proceed in parallel only after interfaces are agreed. Do
not let two agents modify the same central composition file or shared
contract concurrently without coordination.

------------------------------------------------------------------------

## 16. Agent task protocol --- copy this into Claude / Antigravity

Use this instruction at the beginning of every implementation task:

> You are working on EchmaMeet, an existing codebase. Your task is to
> implement the specific phase/task assigned, not redesign the product.
>
> **Hard constraints:**
>
> 1.  Do not change the existing architecture canvas UI, styles,
>     node/edge rendering, interactions, or behaviour. Treat canvas
>     presentation components as protected.
> 2.  Do not delete, replace, rename, move, or break the `ml/` pipeline.
>     It is required for college evaluation.
> 3.  Do not introduce fake fallbacks, hardcoded success, fabricated
>     metrics, canned transcripts, mock remote participants, or
>     placeholder model outputs in production paths.
> 4.  Do not claim a provider or technology is integrated until runtime
>     composition actually uses it and an end-to-end test proves it.
> 5.  Keep the existing modular architecture and contracts unless a
>     migration is necessary and tested.
> 6.  Never execute arbitrary model-generated commands. Use typed,
>     allow-listed actions.
> 7.  Do not make unrelated refactors.
>
> **Before coding:**
>
> -   Inspect the exact files and call paths involved.
> -   Explain the current behaviour from code, not assumptions.
> -   Identify the smallest safe change.
> -   Identify contracts and protected tests that must remain green.
> -   Propose the files to modify and any migration required.
>
> **While coding:**
>
> -   Implement production behaviour, including errors, timeouts,
>     cleanup, authorization, and reconnect where relevant.
> -   Add tests for success, failure, unauthorized access, and recovery.
> -   Keep provider credentials server-side.
> -   Keep room-scoped data isolated.
> -   Preserve canvas and ML behaviour.
>
> **After coding:**
>
> -   Run focused tests, then relevant full tests/type checks/build.
> -   Report exact commands and actual results.
> -   List changed files and explain why each changed.
> -   List any unimplemented part honestly.
> -   Provide manual verification steps.
> -   Do not say "done" if only scaffolding or mocks were added.
>
> If the requested change conflicts with a protected constraint, stop
> and explain the conflict before modifying protected code.

------------------------------------------------------------------------

## 17. Final acceptance checklist

Do not call the system ready until the relevant items are checked with
evidence.

### Product and room

-   [ ] Authenticated users can create and join rooms.
-   [ ] Room membership and roles are server-authoritative.
-   [ ] Different rooms are isolated.
-   [ ] Revoked/expired membership blocks access.

### Collaboration

-   [ ] Presence is room-scoped.
-   [ ] Canvas edits synchronize between two real clients.
-   [ ] Concurrent edits have deterministic behaviour.
-   [ ] Reconnect restores missing state.
-   [ ] Existing canvas UI and interaction behaviour are unchanged.

### WebRTC

-   [ ] Two separate clients exchange real audio.
-   [ ] Two separate clients exchange real video.
-   [ ] Screen sharing reaches remote participants.
-   [ ] Mute/camera controls affect real tracks.
-   [ ] Device and permission errors are handled.
-   [ ] Reconnect and cleanup work.
-   [ ] Media tokens are room-scoped and short-lived.

### AI and Meta

-   [ ] Actual Meta endpoint is configured.
-   [ ] Actual model ID is recorded.
-   [ ] Real request succeeds.
-   [ ] No accidental Groq fallback occurs.
-   [ ] Real transcription works if claimed.
-   [ ] Agent uses transcript and graph context.
-   [ ] Model output is schema-validated.
-   [ ] Findings cite graph revisions/evidence.
-   [ ] Human approval gates sensitive actions.

### Resilience engine

-   [ ] Baseline experiment is real and reproducible.
-   [ ] Fault injection is real and controlled.
-   [ ] Load generator validity is checked.
-   [ ] Metrics are measured, not fabricated.
-   [ ] Typed repair patch is validated.
-   [ ] Patch is revision-bound and allow-listed.
-   [ ] Post-patch experiment actually runs.
-   [ ] Invariants are evaluated deterministically.
-   [ ] Missing data becomes inconclusive, not pass.
-   [ ] Before/after report links to real experiment IDs.

### ML and regression protection

-   [ ] Existing ML pipeline still runs.
-   [ ] Existing models and required files remain intact.
-   [ ] Existing ML evaluation outputs remain valid.
-   [ ] Canvas interactions pass regression checks.
-   [ ] No unrelated UI redesign has occurred.

### Security and delivery

-   [ ] No secrets committed or exposed to frontend.
-   [ ] WebSocket and HTTP authorization are enforced.
-   [ ] Uploads and experiment execution are bounded.
-   [ ] Consent and transcript retention are documented.
-   [ ] Public repository builds from clean setup.
-   [ ] Demo runbook works from a clean environment.
-   [ ] README claims match verified runtime behaviour.

------------------------------------------------------------------------

## 18. Strategic priority: what makes EchmaMeet stand out

Do not optimize for the longest technology list. Optimize for one
complete, defensible engineering loop.

A judge should be able to challenge the product:

1.  "What happens if the downstream service slows down?"
2.  The team injects latency.
3.  EchmaMeet measures retry amplification and queue growth.
4.  The agent explains the likely mechanism and proposes a constrained
    correction.
5.  The team approves it.
6.  EchmaMeet reruns the same workload and fault profile.
7.  The system reports whether the original invariants now pass, fail,
    or remain inconclusive.

That is a real engineering demonstration.

WebRTC and collaborative editing make the review environment credible.
Real Meta integration makes the hackathon technology contribution
credible. The experiment and repair loop makes the product
differentiated. The protected ML pipeline remains available for its
academic purpose.

**Build depth, not feature count. Preserve what already works. Make
every claim reproducible.**
