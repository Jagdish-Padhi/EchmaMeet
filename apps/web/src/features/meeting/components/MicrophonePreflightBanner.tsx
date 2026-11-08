import type { UseMicrophonePreflightReturn } from '../useMicrophonePreflight';

export interface MicrophonePreflightBannerProps {
  readonly preflight: UseMicrophonePreflightReturn;
}

export function MicrophonePreflightBanner({ preflight }: MicrophonePreflightBannerProps) {
  const {
    status,
    audioLevel,
    deviceLabel,
    errorMessage,
    availableMics,
    selectedDeviceId,
    setSelectedDeviceId,
    startMicTest,
  } = preflight;

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: '8px',
        background: status === 'passed' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(30, 41, 59, 0.6)',
        border: `1px solid ${status === 'passed' ? 'rgba(16, 185, 129, 0.3)' : '#334155'}`,
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
            Microphone Check
          </span>
          {status === 'passed' && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '9999px',
                background: '#10b981',
                color: '#ffffff',
              }}
            >
              Ready
            </span>
          )}
          {status === 'testing' && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '9999px',
                background: '#3b82f6',
                color: '#ffffff',
              }}
            >
              Listening... Speak into mic
            </span>
          )}
          {(status === 'failed' || status === 'denied') && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '9999px',
                background: '#ef4444',
                color: '#ffffff',
              }}
            >
              Input Required
            </span>
          )}
        </div>

        {status === 'idle' && (
          <button
            type="button"
            onClick={() => void startMicTest()}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Test Mic
          </button>
        )}

        {(status === 'failed' || status === 'denied') && (
          <button
            type="button"
            onClick={() => void startMicTest()}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              background: '#334155',
              color: '#f8fafc',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
      </div>

      {/* Mic selector if multiple available */}
      {availableMics.length > 1 && (
        <div style={{ marginBottom: '8px' }}>
          <select
            value={selectedDeviceId}
            onChange={(e) => {
              setSelectedDeviceId(e.target.value);
              void startMicTest();
            }}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: '12px',
              borderRadius: '4px',
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#e2e8f0',
            }}
          >
            {availableMics.map((mic: MediaDeviceInfo) => (
              <option key={mic.deviceId} value={mic.deviceId}>
                {mic.label || `Microphone ${mic.deviceId.slice(0, 5)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Live Audio Level Meter */}
      {(status === 'testing' || status === 'passed') && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#94a3b8',
              marginBottom: '4px',
            }}
          >
            <span>{deviceLabel || 'Hardware Input'}</span>
            <span>{audioLevel}%</span>
          </div>
          <div
            style={{
              height: '6px',
              background: '#0f172a',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.max(4, audioLevel)}%`,
                background: status === 'passed' ? '#10b981' : '#3b82f6',
                transition: 'width 0.08s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Error state instructions */}
      {(status === 'failed' || status === 'denied') && (
        <div style={{ fontSize: '12px', color: '#f87171', marginTop: '6px', lineHeight: '1.4' }}>
          {errorMessage || 'No audio detected. Please connect your microphone or headset.'}
        </div>
      )}
    </div>
  );
}
