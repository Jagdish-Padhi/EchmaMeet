import { useEffect, useRef, useState } from 'react';

export type StudioDrawerTab =
  | 'none'
  | 'inspect'
  | 'chaos'
  | 'telemetry'
  | 'repair'
  | 'voice'
  | 'vision'
  | 'reports'
  | 'benchmarks'
  | 'runs';

export interface AnalysisDropdownProps {
  readonly activeTab: StudioDrawerTab;
  readonly onSelectTab: (tab: StudioDrawerTab) => void;
}

export function AnalysisDropdown({ activeTab, onSelectTab }: AnalysisDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const getLabel = () => {
    switch (activeTab) {
      case 'chaos':
        return 'Chaos Faults';
      case 'telemetry':
        return 'Telemetry';
      case 'repair':
        return 'AI Repair';
      case 'benchmarks':
      case 'inspect':
      case 'reports':
      case 'runs':
      case 'vision':
      case 'voice':
      case 'none':
      default:
        return 'Telemetry';
    }
  };

  const handleToggle = (tab: StudioDrawerTab) => {
    setIsOpen(false);
    onSelectTab(activeTab === tab ? 'none' : tab);
  };

  const isDrawerOpen = activeTab !== 'none';

  return (
    <div className="analysis-dropdown-wrapper" ref={menuRef}>
      <button
        type="button"
        className={`navbar-meeting-btn ${isDrawerOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Open Analysis & Telemetry Drawers"
      >
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span className="meeting-btn-label">{getLabel()}</span>
        <svg
          viewBox="0 0 24 24"
          width="11"
          height="11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`dropdown-chevron ${isOpen ? 'rotated' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="meetings-menu analysis-menu" role="menu">
          <button
            type="button"
            className={`meetings-menu-item ${activeTab === 'telemetry' ? 'active-item' : ''}`}
            role="menuitem"
            onClick={() => handleToggle('telemetry')}
          >
            <div className="menu-item-icon">
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div className="menu-item-content">
              <div className="menu-item-title">Telemetry &amp; Latency</div>
              <div className="menu-item-subtitle">Real-time p99 latency &amp; error stream</div>
            </div>
          </button>

          <button
            type="button"
            className={`meetings-menu-item ${activeTab === 'chaos' ? 'active-item' : ''}`}
            role="menuitem"
            onClick={() => handleToggle('chaos')}
          >
            <div className="menu-item-icon">
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div className="menu-item-content">
              <div className="menu-item-title">Chaos Faults &amp; Invariants</div>
              <div className="menu-item-subtitle">Latency, packet drop, and circuit trip rules</div>
            </div>
          </button>

          <button
            type="button"
            className={`meetings-menu-item ${activeTab === 'repair' ? 'active-item' : ''}`}
            role="menuitem"
            onClick={() => handleToggle('repair')}
          >
            <div className="menu-item-icon">
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div className="menu-item-content">
              <div className="menu-item-title">Autonomous AI Repair</div>
              <div className="menu-item-subtitle">Automated resilience patch exploration</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
