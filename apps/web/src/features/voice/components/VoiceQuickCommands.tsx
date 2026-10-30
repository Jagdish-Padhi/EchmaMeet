import React from 'react';
import { Button } from '../../../components/ui/Button';

export interface VoiceQuickCommandsProps {
  readonly onSelectPhrase: (phrase: string) => void;
  readonly isProcessing: boolean;
}

const TEST_PHRASES = [
  { label: 'Inject Latency', phrase: 'inject latency 300ms from gateway to backend' },
  { label: 'Set Invariant', phrase: 'set invariant completion rate at least 95 percent' },
  { label: 'Run Experiment', phrase: 'run experiment with 5 trials' },
  { label: 'Start Repair', phrase: 'start repair with model proposer' },
  { label: 'Cancel Run', phrase: 'cancel active run' },
  { label: 'Test Ambiguous', phrase: 'inject latency on backend' },
  { label: 'Test Unsupported', phrase: 'order a pepperoni pizza' },
];

export const VoiceQuickCommands: React.FC<VoiceQuickCommandsProps> = ({
  onSelectPhrase,
  isProcessing,
}) => {
  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: '#475569' }}>
        Quick Voice Command Testing Palette:
      </h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {TEST_PHRASES.map((item) => (
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
