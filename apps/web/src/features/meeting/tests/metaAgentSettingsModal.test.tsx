import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MetaAgentSettingsModal } from '../components/MetaAgentSettingsModal';

describe('MetaAgentSettingsModal', () => {
  it('renders modal with pipeline status and token consumption', () => {
    const html = renderToStaticMarkup(
      <MetaAgentSettingsModal
        isOpen={true}
        onClose={() => {}}
        tokenUsage={{ promptTokens: 150, completionTokens: 50, totalTokens: 200 }}
      />,
    );

    expect(html).toContain('Echma SRE Agent');
    expect(html).toContain('Llama 3.3 70B');
    expect(html).toContain('200');
    expect(html).toContain('Protection Mode');
  });

  it('renders null when not open', () => {
    const html = renderToStaticMarkup(<MetaAgentSettingsModal isOpen={false} onClose={() => {}} />);
    expect(html).toBe('');
  });
});
