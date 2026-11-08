import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AgentSettingsModal } from '../components/AgentSettingsModal';

describe('AgentSettingsModal', () => {
  it('shows the Gnani speech stack, the rule engine and token consumption', () => {
    const html = renderToStaticMarkup(
      <AgentSettingsModal
        isOpen={true}
        onClose={() => {}}
        tokenUsage={{ promptTokens: 150, completionTokens: 50, totalTokens: 200 }}
      />,
    );
    expect(html).toContain('Echma SRE Agent');
    expect(html).toContain('Gnani Prisma');
    expect(html).toContain('Gnani Timbre');
    expect(html).toContain('Deterministic rule engine');
    expect(html).toContain('200');
    expect(html).not.toMatch(/Meta|Llama|Groq/);
  });

  it('renders null when not open', () => {
    expect(renderToStaticMarkup(<AgentSettingsModal isOpen={false} onClose={() => {}} />)).toBe('');
  });
});
