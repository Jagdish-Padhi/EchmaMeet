import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FloatingMeetingPiP } from '../FloatingMeetingPiP';
import { ToastProvider } from '../../toast';
import { LeaveMeetingModal } from '../LeaveMeetingModal';
import { AlreadyInCallModal } from '../AlreadyInCallModal';
import { MeetingsDropdown } from '../MeetingsDropdown';

describe('FloatingMeetingPiP & LeaveMeetingModal', () => {
  const baseProps = {
    isActive: true,
    roomCode: '#test-room',
    aiRaisedHand: false,
    onOpenSreFinding: vi.fn(),
    onLeaveMeeting: vi.fn(),
  };

  it('renders floating window when active', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <FloatingMeetingPiP {...baseProps} />
      </ToastProvider>,
    );
    expect(html).toContain('#test-room');
    expect(html).toContain('Meta AI SRE');
    expect(html).toContain('pip-window-header');
    expect(html).toContain('pip-controls-bar');
  });

  it('does not render meeting window when inactive', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <FloatingMeetingPiP {...baseProps} isActive={false} />
      </ToastProvider>,
    );
    expect(html).not.toContain('pip-window');
    expect(html).not.toContain('#test-room');
  });

  it('renders LeaveMeetingModal with enterprise confirmation warning and room code', () => {
    const html = renderToStaticMarkup(
      <LeaveMeetingModal
        isOpen={true}
        roomCode="#rfc-checkout-v2"
        onConfirmLeave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(html).toContain('Leave Meeting?');
    expect(html).toContain('#rfc-checkout-v2');
    expect(html).toContain('Stay in Meeting');
    expect(html).toContain('Leave Meeting');
  });

  it('does not render LeaveMeetingModal when closed', () => {
    const html = renderToStaticMarkup(
      <LeaveMeetingModal
        isOpen={false}
        roomCode="#rfc-checkout-v2"
        onConfirmLeave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(html).toBe('');
  });

  it('renders AlreadyInCallModal with warning title and stay in call option', () => {
    const html = renderToStaticMarkup(
      <AlreadyInCallModal
        isOpen={true}
        roomCode="#rfc-checkout-v2"
        attemptedAction="create"
        onClose={vi.fn()}
        onLeaveAndProceed={vi.fn()}
      />,
    );
    expect(html).toContain('You are already in a meeting');
    expect(html).toContain('#rfc-checkout-v2');
    expect(html).toContain('Stay in Meeting');
    expect(html).toContain('Leave &amp; Create');
  });

  it('renders MeetingsDropdown with clean trigger button', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <MeetingsDropdown
          isMeetingActive={false}
          roomCode="#rfc-checkout-v2"
          onOpenCreate={vi.fn()}
          onOpenJoin={vi.fn()}
        />
      </ToastProvider>,
    );
    expect(html).toContain('Meetings');
    expect(html).toContain('navbar-meeting-btn');
  });
});
