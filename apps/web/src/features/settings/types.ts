export interface AppSettings {
  // 1. Meta AI & LLM Inference
  partnerBaseUrl: string;
  partnerApiKey: string;
  partnerModelId: string;
  modelTemperature: number;
  maxTokens: number;
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
  databaseProvider: 'neon' | 'sqlite';
  neonDatabaseUrl: string;
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
  // 1. Meta AI & LLM Inference
  partnerBaseUrl: 'http://127.0.0.1:8000/v1',
  partnerApiKey: '',
  partnerModelId: 'muse-wonder-1.0',
  modelTemperature: 0.2,
  maxTokens: 2048,
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
  databaseProvider: 'neon',
  neonDatabaseUrl: '',
  redisCacheUrl: 'redis://127.0.0.1:6379',
  defaultIacTarget: 'terraform',
  gitOpsAutoCommit: false,

  // 7. Reviewer Profile & SRE Identity
  reviewerName: 'Alex Chen',
  reviewerEmail: 'alex.chen@meta.internal',
  reviewerRole: 'Staff Site Reliability Engineer',
  organization: 'Meta Infrastructure Core',
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

