export interface AppSettings {
  // 1. Voice & Language (Gnani Prisma / Timbre)
  /** `indic-auto` or comma-separated BCP-47 codes, e.g. `hi-IN,en-IN`. */
  voiceLanguage: string;
  speakReplies: boolean;
  autonomousSreVoice: boolean;
  sreSeverityYieldFloor: 'medium' | 'high' | 'critical';

  // 2. Control Plane & Toxiproxy Chaos Engine
  serverUrl: string;
  toxiproxyUrl: string;
  toxiproxyUpstreamHost: string;
  defaultLatencyMs: number;
  defaultJitterMs: number;
  defaultToxicity: number;
  connectionResetCutoffMs: number;
  autoDrainProxiesOnExit: boolean;

  // 3. Empirical Trials & Guardrails
  defaultTrials: number;
  measurementMs: number;
  arrivalRateRps: number;
  autoRollback: boolean;
  strictInvariants: boolean;
  workerConcurrency: number;
  telemetrySampleRateMs: number;

  // 4. Studio Canvas Ergonomics & Appearance
  theme: 'dark' | 'light';
  gridStyle: 'dots' | 'cross' | 'plain';
  showLiveTelemetryBadges: boolean;
  snapToGrid: boolean;
  canvasAnimationSpeed: 'instant' | 'smooth' | 'cinematic';
  visionConfidenceThreshold: number;
  highlightBlastRadius: boolean;

  // 5. Review Rooms & Audio Sync
  defaultRoomPrefix: string;
  pushToTalkEnabled: boolean;
  noiseSuppression: boolean;
  broadcastPresence: boolean;
  adrExportFormat: 'markdown' | 'github_pr' | 'confluence';

  // 6. Cloud & Infrastructure as Code (IaC)
  redisCacheUrl: string;
  defaultIacTarget: 'terraform' | 'kubernetes' | 'helm' | 'pulumi';
  gitOpsAutoCommit: boolean;

  // 7. Reviewer Profile & SRE Identity
  reviewerName: string;
  reviewerEmail: string;
  reviewerRole: string;
  organization: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  // 1. Voice & Language (Gnani Prisma / Timbre)
  voiceLanguage: 'indic-auto',
  speakReplies: true,
  autonomousSreVoice: true,
  sreSeverityYieldFloor: 'high',

  // 2. Control Plane & Toxiproxy Chaos Engine
  serverUrl: 'http://127.0.0.1:8787',
  toxiproxyUrl: 'http://127.0.0.1:8474',
  toxiproxyUpstreamHost: 'host.docker.internal',
  defaultLatencyMs: 350,
  defaultJitterMs: 50,
  defaultToxicity: 1,
  connectionResetCutoffMs: 120,
  autoDrainProxiesOnExit: true,

  // 3. Empirical Trials & Guardrails
  defaultTrials: 3,
  measurementMs: 5000,
  arrivalRateRps: 20,
  autoRollback: true,
  strictInvariants: true,
  workerConcurrency: 4,
  telemetrySampleRateMs: 100,

  // 4. Studio Canvas Ergonomics & Appearance
  theme: 'dark',
  gridStyle: 'dots',
  showLiveTelemetryBadges: true,
  snapToGrid: true,
  canvasAnimationSpeed: 'smooth',
  visionConfidenceThreshold: 75,
  highlightBlastRadius: true,

  // 5. Review Rooms & Audio Sync
  defaultRoomPrefix: '#rfc-',
  pushToTalkEnabled: true,
  noiseSuppression: true,
  broadcastPresence: true,
  adrExportFormat: 'markdown',

  // 6. Cloud & Infrastructure as Code (IaC)
  redisCacheUrl: 'redis://127.0.0.1:6379',
  defaultIacTarget: 'terraform',
  gitOpsAutoCommit: false,

  // 7. Reviewer Profile & SRE Identity
  reviewerName: 'Platform Engineer',
  reviewerEmail: 'engineer@echmameet.local',
  reviewerRole: 'Staff Site Reliability Engineer',
  organization: 'Platform Reliability',
};

export const SETTINGS_STORAGE_KEY = 'chaosboard_settings';

export function loadSettingsFromStorage(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return { ...DEFAULT_SETTINGS, ...(parsed as Partial<AppSettings>) };
      }
    }
  } catch {
    // fallback to defaults on storage error
  }
  return DEFAULT_SETTINGS;
}

export function saveSettingsToStorage(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage write error
  }
}

export type SettingsSectionId =
  | 'ai-models'
  | 'chaos-engine'
  | 'trials-guardrails'
  | 'canvas-ergonomics'
  | 'review-rooms'
  | 'iac-cloud'
  | 'profile-identity';

export interface SubsectionMeta {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export interface SectionMeta {
  readonly id: SettingsSectionId;
  readonly title: string;
  readonly shortTitle: string;
  readonly category: 'SYSTEM & ENGINE' | 'STUDIO & ERGONOMICS' | 'IDENTITY & ACCESS';
  readonly description: string;
  readonly subsections: readonly SubsectionMeta[];
}

export const SECTIONS_CATALOG: readonly SectionMeta[] = [
  {
    id: 'ai-models',
    title: 'Voice & Language (Gnani AI)',
    shortTitle: 'Voice & Language',
    category: 'SYSTEM & ENGINE',
    description:
      'Choose the spoken language for Gnani Prisma speech-to-text and Timbre text-to-speech, and set how Echma speaks up in calls.',
    subsections: [
      {
        id: 'sub-active-model',
        title: 'Spoken Language',
        description: 'Language hint for Gnani Prisma: Hinglish, Hindi, English or auto-detect.',
      },
      {
        id: 'sub-api-credentials',
        title: 'Gnani Connection',
        description: 'Live handshake with the speech APIs configured on the server.',
      },
      {
        id: 'sub-autonomous-voice',
        title: 'Autonomous Meeting SRE Intervention',
        description: 'Allow Echma to verbally interject when critical design hazards are detected.',
      },
    ],
  },
  {
    id: 'chaos-engine',
    title: 'Chaos Injection & Toxiproxy',
    shortTitle: 'Chaos & Toxiproxy',
    category: 'SYSTEM & ENGINE',
    description:
      'Control plane bindings, Toxiproxy degradation harness, and default fault injection settings.',
    subsections: [
      {
        id: 'sub-control-plane',
        title: 'Control Plane & Daemon Endpoints',
        description: 'Fastify server and Toxiproxy REST/WebSocket binding ports.',
      },
      {
        id: 'sub-default-faults',
        title: 'Default Toxic Injection Baseline',
        description: 'Fallback latency, packet drop rates, and connection reset windows.',
      },
      {
        id: 'sub-daemon-safety',
        title: 'Network Safety & Auto-Drain',
        description: 'Automatic socket cleanup and circuit trip safety limits.',
      },
    ],
  },
  {
    id: 'trials-guardrails',
    title: 'Empirical Trials & SRE Guardrails',
    shortTitle: 'Trials & Guardrails',
    category: 'SYSTEM & ENGINE',
    description:
      'Configure repetition counts, load traffic arrival rates, and automated regression rollbacks.',
    subsections: [
      {
        id: 'sub-trial-params',
        title: 'Workload & Duration Parameters',
        description: 'Synthetic arrival rate (RPS), measurement time, and parallel worker pools.',
      },
      {
        id: 'sub-rollback-guard',
        title: 'Autonomous Rollback & Regression Guards',
        description: 'Revert candidate patches immediately if p99 latency or error rate degrades.',
      },
      {
        id: 'sub-telemetry-sampling',
        title: 'Telemetry Resolution & Invariant Criteria',
        description: 'High-frequency telemetry recording interval and strict SLA boundaries.',
      },
    ],
  },
  {
    id: 'canvas-ergonomics',
    title: 'Canvas & Interface',
    shortTitle: 'Canvas & Appearance',
    category: 'STUDIO & ERGONOMICS',
    description:
      'Appearance themes, grid snapping, topology blast radius, and SAM 3.1 gesture thresholds.',
    subsections: [
      {
        id: 'sub-visual-theme',
        title: 'Theme & Blueprint Matrix',
        description: 'Obsidian dark vs Studio light, and canvas background grid style.',
      },
      {
        id: 'sub-canvas-interactions',
        title: 'Spatial Ergonomics & Blast Radius',
        description:
          'Node grid snapping, downstream blast radius highlighting, and telemetry badges.',
      },
      {
        id: 'sub-vision-gestures',
        title: 'Multimodal Vision & SAM 3.1 Thresholds',
        description: 'Confidence sensitivity for whiteboard red-stroke pen gesture parsing.',
      },
    ],
  },
  {
    id: 'review-rooms',
    title: 'Review Rooms & Voice',
    shortTitle: 'Review Rooms & Voice',
    category: 'STUDIO & ERGONOMICS',
    description:
      'Peer cursor sync, WebRTC spatial push-to-talk, and architecture decision record format.',
    subsections: [
      {
        id: 'sub-room-presence',
        title: 'Real-Time Presence & Collaboration',
        description: 'Default room prefix and multi-reviewer cursor coordinate broadcasting.',
      },
      {
        id: 'sub-voice-webrtc',
        title: 'Spatial Push-to-Talk & Audio Filtering',
        description: 'Spacebar push-to-talk mode and AI voice activity noise suppression.',
      },
      {
        id: 'sub-adr-export',
        title: 'ADR Architecture RFC Generation',
        description: 'Default export target format for architecture decision records.',
      },
    ],
  },
  {
    id: 'iac-cloud',
    title: 'Cloud Backends & Infrastructure as Code',
    shortTitle: 'Cloud & IaC',
    category: 'STUDIO & ERGONOMICS',
    description:
      'Serverless database, message queues, and Terraform or Kubernetes manifest compilation.',
    subsections: [
      {
        id: 'sub-database-backend',
        title: 'Database & Cache Storage Engine',
        description: 'Neon Serverless Postgres connection string and Redis BullMQ queues.',
      },
      {
        id: 'sub-iac-targets',
        title: 'Infrastructure as Code Generation Target',
        description:
          'Default format for auto-repair patches: Terraform, Kubernetes CRDs, Helm, or Pulumi.',
      },
      {
        id: 'sub-gitops-sync',
        title: 'GitOps Continuous Sync',
        description: 'Auto-commit verified resilience patches directly to repository branch.',
      },
    ],
  },
  {
    id: 'profile-identity',
    title: 'Reviewer Profile & Identity',
    shortTitle: 'Profile & SRE Team',
    category: 'IDENTITY & ACCESS',
    description:
      'Reviewer identity, organization workspace, and active session authentication credentials.',
    subsections: [
      {
        id: 'sub-reviewer-credentials',
        title: 'Staff Identity & Role Title',
        description: 'Full name, internal corporate email, and architecture review authority.',
      },
      {
        id: 'sub-org-badge',
        title: 'Team & Organization Workspace',
        description: 'Departmental grouping and badge customization.',
      },
      {
        id: 'sub-session-token',
        title: 'Active Cryptographic Session Token',
        description: 'Inspect and manage your current Bearer authentication JWT.',
      },
    ],
  },
];
