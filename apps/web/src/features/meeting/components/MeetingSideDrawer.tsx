import { useState } from 'react';
import type { RemoteReviewer } from '../useCollaborationPresence';
import type { MeetingChatMessage } from '../agentTypes';
import { FemaleArchitectIcon } from '../../../components/ui/FemaleArchitectIcon';

export interface MeetingSideDrawerProps {
  readonly activeSideDrawer: 'people' | 'chat';
  readonly currentUser: {
    readonly name: string;
    readonly role: string;
    readonly avatar: string;
  };
  readonly remoteReviewers: readonly RemoteReviewer[];
  readonly isMuted: boolean;
  readonly chatMessages?: readonly MeetingChatMessage[] | undefined;
  readonly onSendMessage?: ((text: string) => void) | undefined;
  readonly isSendingChat?: boolean | undefined;
  readonly onClose: () => void;
  readonly onAutoRemediate?: (() => void) | undefined;
}

export function MeetingSideDrawer({
  activeSideDrawer,
  currentUser,
  remoteReviewers,
  isMuted,
  chatMessages = [],
  onSendMessage,
  isSendingChat = false,
  onClose,
  onAutoRemediate,
}: MeetingSideDrawerProps) {
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSend = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSendingChat || !onSendMessage) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const filteredChatMessages = chatMessages.filter((msg) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    if (q === '@echma' || q === 'echma') {
      return msg.isAi || msg.sender.toLowerCase().includes('echma');
    }
    return (
      msg.sender.toLowerCase().includes(q) ||
      msg.text.toLowerCase().includes(q) ||
      (msg.hazardBadge && msg.hazardBadge.title.toLowerCase().includes(q))
    );
  });

  const getDrawerTitle = () => {
    return activeSideDrawer === 'people' ? 'People in Call' : 'In-call Messages';
  };

  return (
    <aside className="meet-fs-side-drawer">
      <div className="meet-drawer-header">
        <h3>{getDrawerTitle()}</h3>
        <button
          type="button"
          className="meet-drawer-close"
          onClick={onClose}
          aria-label="Close drawer"
        >
          &times;
        </button>
      </div>

      <div className="meet-drawer-body">
        {activeSideDrawer === 'people' && (
          <div className="meet-people-list">
            <div className="meet-person-row">
              <span className="person-avatar host">{currentUser.avatar}</span>
              <div className="person-info">
                <span className="person-name">{currentUser.name} (You)</span>
                <span className="person-role">{currentUser.role} &bull; Host</span>
              </div>
              <span className="person-media-state">{isMuted ? 'Muted' : 'Speaking'}</span>
            </div>

            <div className="meet-person-row">
              <span className="person-avatar ai" title="Echma AI Principal SRE">
                <FemaleArchitectIcon size={18} strokeWidth={2} />
              </span>
              <div className="person-info">
                <span className="person-name">Echma</span>
                <span className="person-role">AI Principal SRE</span>
              </div>
            </div>

            {remoteReviewers.map((r) => (
              <div key={r.userId} className="meet-person-row">
                <span className="person-avatar">{r.avatar}</span>
                <div className="person-info">
                  <span className="person-name">{r.name}</span>
                  <span className="person-role">{r.role}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSideDrawer === 'chat' && (
          <div className="meet-chat-panel">
            {/* Top In-Call Search Bar */}
            <div className="meet-chat-search-bar">
              <div className="meet-chat-search-input-wrap">
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="meet-search-icon"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="meet-chat-search-input"
                  placeholder="Search messages, participants or tag @echma..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="meet-chat-search-clear"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    &times;
                  </button>
                )}
              </div>
              <div className="meet-chat-filter-pills">
                <button
                  type="button"
                  className={`chat-filter-pill ${searchQuery.toLowerCase() === '@echma' ? 'active' : ''}`}
                  onClick={() =>
                    setSearchQuery((prev) => (prev.toLowerCase() === '@echma' ? '' : '@echma'))
                  }
                >
                  <FemaleArchitectIcon size={11} strokeWidth={2} />
                  <span>@echma</span>
                </button>
                <button
                  type="button"
                  className={`chat-filter-pill ${searchQuery.toLowerCase() === 'risk' ? 'active' : ''}`}
                  onClick={() =>
                    setSearchQuery((prev) => (prev.toLowerCase() === 'risk' ? '' : 'risk'))
                  }
                >
                  <span>Risks</span>
                </button>
              </div>
            </div>

            <div className="meet-chat-thread">
              {filteredChatMessages.length === 0 ? (
                <div className="meet-chat-empty">
                  {searchQuery ? (
                    <p>No messages match &ldquo;{searchQuery}&rdquo;.</p>
                  ) : (
                    <>
                      <p>
                        Messages can only be seen by people in the call and are deleted when the
                        call ends.
                      </p>
                      <p className="meet-chat-hint">
                        Echma is live-casting architectural observations and listening for your
                        questions.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                filteredChatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`meet-chat-bubble ${msg.isAi ? 'ai-bubble' : 'user-bubble'}`}
                  >
                    <div className="meet-chat-bubble-header">
                      <div className="meet-chat-sender-wrap">
                        {msg.isAi && (
                          <span className="meet-chat-ai-ico">
                            <FemaleArchitectIcon size={13} strokeWidth={2} />
                          </span>
                        )}
                        <span className="meet-chat-sender">{msg.sender}</span>
                      </div>
                      <span className="meet-chat-time">{msg.timestamp}</span>
                    </div>

                    {msg.hazardBadge && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          marginBottom: '6px',
                        }}
                      >
                        <div className={`meet-chat-hazard-pill sev-${msg.hazardBadge.severity}`}>
                          <span className="hazard-pill-dot" />
                          <span className="hazard-pill-title">{msg.hazardBadge.title}</span>
                        </div>
                        {onAutoRemediate && (
                          <button
                            type="button"
                            onClick={onAutoRemediate}
                            title="Apply recommended resilience policy"
                            style={{
                              background: '#0284c7',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '2px 8px',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              <path d="m9 12 2 2 4-4" />
                            </svg>
                            Remediate
                          </button>
                        )}
                      </div>
                    )}

                    <div className="meet-chat-bubble-text">{msg.text}</div>
                  </div>
                ))
              )}
              {isSendingChat && (
                <div className="meet-chat-bubble ai-bubble ai-typing">
                  <div className="meet-chat-sender-wrap">
                    <FemaleArchitectIcon size={13} strokeWidth={2} />
                    <span className="meet-chat-sender">Echma</span>
                  </div>
                  <span className="meet-chat-typing-dots">Evaluating live canvas...</span>
                </div>
              )}
            </div>

            <form className="meet-chat-input-form" onSubmit={handleSend}>
              <input
                type="text"
                className="meet-chat-input"
                placeholder="Send a message to everyone..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isSendingChat}
              />
              <button
                type="submit"
                className="meet-chat-send-btn"
                disabled={!inputText.trim() || isSendingChat}
                aria-label="Send message"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
