import React from 'react';
import type { VoiceIntentParseResult } from '@chaosboard/contracts';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';

export interface ParsedCommandCardProps {
  readonly result: VoiceIntentParseResult | null;
  readonly autoConfirm: boolean;
  readonly onToggleAutoConfirm: () => void;
  readonly onConfirmAndExecute: () => void;
  readonly onClear: () => void;
  readonly onSelectCandidate?: (candidate: string) => void;
}

export const ParsedCommandCard: React.FC<ParsedCommandCardProps> = ({
  result,
  autoConfirm,
  onToggleAutoConfirm,
  onConfirmAndExecute,
  onClear,
  onSelectCandidate,
}) => {
  if (!result) return null;

  return (
    <Card title="Parsed Voice Command">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="auto-confirm-check"
            type="checkbox"
            checked={autoConfirm}
            onChange={onToggleAutoConfirm}
          />
          <label htmlFor="auto-confirm-check" style={{ fontSize: 12, color: '#94a3b8' }}>
            Auto-confirm voice actions (defaults to OFF for safety)
          </label>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>

      {result.status === 'parsed' && result.command && (
        <div>
          <Alert variant="success">
            <strong>Action:</strong> {result.plainTextConfirmation ?? result.command.command}
          </Alert>

          <div className="parsed-command-summary">
            <div className="parsed-command-row">
              <span className="parsed-command-key">Intent:</span>
              <span className="parsed-command-val">
                {result.command.command.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            {'source' in result.command && (
              <div className="parsed-command-row">
                <span className="parsed-command-key">Target Link:</span>
                <span className="parsed-command-val">
                  {result.command.source} -&gt; {result.command.target}
                </span>
              </div>
            )}
            {'faultType' in result.command && (
              <div className="parsed-command-row">
                <span className="parsed-command-key">Fault Type:</span>
                <span className="parsed-command-val">{result.command.faultType}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="primary" onClick={onConfirmAndExecute}>
              Confirm &amp; Execute Action
            </Button>
          </div>
        </div>
      )}

      {result.status === 'ambiguous' && (
        <Alert variant="warning">
          <strong>Ambiguous Command:</strong> {result.message}
          {result.candidates && result.candidates.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {result.candidates.map((cand) => (
                <Button
                  key={cand}
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectCandidate?.(cand)}
                >
                  Choose {cand}
                </Button>
              ))}
            </div>
          )}
        </Alert>
      )}

      {result.status === 'unsupported' && (
        <Alert variant="error">
          <strong>Unsupported Command:</strong> {result.message}
        </Alert>
      )}

      {result.status === 'empty' && <Alert variant="info">{result.message}</Alert>}
    </Card>
  );
};
