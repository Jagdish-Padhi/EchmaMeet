import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VoiceTranscriptStream } from '../components/VoiceTranscriptStream';
import { ParsedCommandCard } from '../components/ParsedCommandCard';
import type { VoiceIntentParseResult } from '@chaosboard/contracts';

describe('Voice Feature components', () => {
  it('renders transcript stream with timings', () => {
    const html = renderToStaticMarkup(
      <VoiceTranscriptStream
        partialTranscript=""
        finalTranscript="run experiment with 5 trials"
        isRecording={false}
        isProcessing={false}
        timings={{
          captureMs: 1200,
          transcriptMs: 250,
          parseMs: 15,
        }}
      />,
    );

    expect(html).toContain('run experiment with 5 trials');
    expect(html).toContain('Capture: 1200ms');
    expect(html).toContain('STT: 250ms');
    expect(html).toContain('Parse: 15ms');
  });

  it('renders parsed command card with confirm button', () => {
    const result: VoiceIntentParseResult = {
      transcript: 'start repair with model proposer',
      timings: { captureMs: 1000, transcriptMs: 200, parseMs: 10 },
      status: 'parsed',
      command: {
        command: 'start_repair',
        proposer: 'model',
        maxIterations: 3,
      },
      plainTextConfirmation: 'Start autonomous repair loop with Meta model proposer',
    };

    const html = renderToStaticMarkup(
      <ParsedCommandCard
        result={result}
        autoConfirm={false}
        onToggleAutoConfirm={() => {}}
        onConfirmAndExecute={() => {}}
        onClear={() => {}}
      />,
    );

    expect(html).toContain('Start autonomous repair loop with Meta model proposer');
    expect(html).toContain('Confirm &amp; Execute Action');
  });

  it('renders ambiguous command warning with candidates', () => {
    const result: VoiceIntentParseResult = {
      transcript: 'inject fault on backend',
      timings: { captureMs: 1000, transcriptMs: 200, parseMs: 10 },
      status: 'ambiguous',
      message: 'Node connects to 2 edges. Please specify downstream target.',
      candidates: ['edge-1', 'edge-2'],
    };

    const html = renderToStaticMarkup(
      <ParsedCommandCard
        result={result}
        autoConfirm={false}
        onToggleAutoConfirm={() => {}}
        onConfirmAndExecute={() => {}}
        onClear={() => {}}
      />,
    );

    expect(html).toContain('Ambiguous Command:');
    expect(html).toContain('Choose edge-1');
    expect(html).toContain('Choose edge-2');
  });
});
