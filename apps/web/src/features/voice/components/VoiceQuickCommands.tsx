import React from 'react';
import { Button } from '../../../components/ui/Button';

export interface VoiceQuickCommandsProps {
  readonly onSelectPhrase: (phrase: string) => void;
  readonly isProcessing: boolean;
}

const RECOMMENDED_PHRASES = [
  { label: 'Inject 300ms Latency', phrase: 'inject latency 300ms from gateway to auth' },
  { label: 'Run 5 Trials', phrase: 'run experiment with 5 trials' },
  { label: 'Start Repair', phrase: 'start repair' },
  { label: '300ms लेटेंसी डालो', phrase: 'gateway se auth par 300 ms latency inject karo' },
  { label: '5 ट्रायल चलाओ', phrase: 'पाँच ट्रायल के साथ एक्सपेरिमेंट चलाओ' },
];

export const VoiceQuickCommands: React.FC<VoiceQuickCommandsProps> = ({
  onSelectPhrase,
  isProcessing,
}) => {
  return (
    <div style={{ marginTop: 12 }}>
      <h4
        style={{
          margin: '0 0 8px 0',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-text-dim)',
        }}
      >
        Quick Voice Prompts
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
