export interface TranscriptionConsentFieldProps {
  readonly id: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

/**
 * Explicit, opt-in recording consent. It is unticked by default and nothing is captured or
 * uploaded unless the participant ticks it. The meeting is fully usable without it.
 */
export function TranscriptionConsentField({
  id,
  checked,
  onChange,
}: TranscriptionConsentFieldProps) {
  return (
    <div className="meeting-form-field">
      <label
        htmlFor={id}
        className="meeting-form-label"
        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          Allow transcription of my microphone for this meeting. Speech is sent to Meta&apos;s Muse
          Voice Transcribe so the AI copilot can follow the discussion. Off by default.
        </span>
      </label>
    </div>
  );
}
