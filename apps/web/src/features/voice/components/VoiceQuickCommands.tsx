import React from 'react';
import { Button } from '../../../components/ui/Button';

export interface VoiceQuickCommandsProps {
  readonly onSelectPhrase: (phrase: string) => void;
  readonly isProcessing: boolean;
}

const RECOMMENDED_PHRASES = [
  { label: 'Inject 300ms Latency', phrase: 'inject latency 300ms from gateway to auth' },
  { label: 'Run 5s Sandbox Proof', phrase: 'run experiment with 5 trials' },
  { label: 'Start Autonomous Repair', phrase: 'start repair with model proposer' },
  { label: 'Cancel Active Run', phrase: 'cancel active run' },
];

export const VoiceQuickCommands: React.FC<VoiceQuickCommandsProps> = ({
  onSelectPhrase,
  isProcessing,
}) => {
  return (
    <div style={{ marginTop: 16 }}>
      <h4
        style={{
          margin: '0 0 8px 0',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-text-dim)',
        }}
      >
        Spoken Command Suggestions:
      </h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {RECOMMENDED_PHRASES.map((item) => (
          <Button
            key={item.label}
            variant="ghost"
            size="sm"
            disabled={isProcessing}
            onClick={() => onSelectPhrase(item.phrase)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
