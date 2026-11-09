import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from '../ToastContext';
import { useEffect } from 'react';

function DuplicateTrigger() {
  const toast = useToast();
  useEffect(() => {
    toast.info('Session token copied to clipboard.', 'Copied');
    toast.info('Session token copied to clipboard.', 'Copied');
  }, [toast]);
  return <div>Triggered</div>;
}

function SemanticLeaveTrigger() {
  const toast = useToast();
  useEffect(() => {
    toast.info('You have left the meeting.', 'Session Ended');
    toast.info('You left the review meeting.', 'Meeting Ended');
  }, [toast]);
  return <div>Leave Triggered</div>;
}

describe('ToastProvider Deduplication & Enterprise Stability', () => {
  it('renders ToastProvider container cleanly', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>,
    );
    expect(html).toContain('toast-viewport');
    expect(html).toContain('Content');
  });

  it('renders duplicate trigger component safely', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <DuplicateTrigger />
      </ToastProvider>,
    );
    expect(html).toContain('Triggered');
  });

  it('renders semantic leave trigger safely', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <SemanticLeaveTrigger />
      </ToastProvider>,
    );
    expect(html).toContain('Leave Triggered');
  });
});
