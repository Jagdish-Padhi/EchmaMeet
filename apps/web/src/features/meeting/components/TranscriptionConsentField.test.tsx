import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TranscriptionConsentField } from './TranscriptionConsentField';

describe('TranscriptionConsentField', () => {
  it('renders an unticked checkbox by default and states what is sent where', () => {
    const html = renderToStaticMarkup(
      <TranscriptionConsentField id="c" checked={false} onChange={() => undefined} />,
    );
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('checked');
    expect(html).toContain('Muse');
    expect(html).toContain('Off by default');
  });

  it('reflects an explicit opt-in', () => {
    const html = renderToStaticMarkup(
      <TranscriptionConsentField id="c" checked={true} onChange={() => undefined} />,
    );
    expect(html).toContain('checked');
  });
});
