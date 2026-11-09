import { useEffect, useRef, useState } from 'react';

export type StudioDrawerTab =
  | 'none'
  | 'inspect'
  | 'chaos'
  | 'telemetry'
  | 'repair'
  | 'voice'
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
      case 'voice':
        return 'Voice Studio';
      case 'telemetry':
        return 'Telemetry';
      case 'chaos':
        return 'Chaos Faults';
      case 'repair':
        return 'Optimizer';
      case 'runs':
        return 'Run History';
      case 'benchmarks':
        return 'Benchmarks';
      case 'reports':
        return 'Reports';
      case 'inspect':
        return 'Inspector';
      case 'none':
      default:
        return 'Studio Panels';
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
        title="Open Studio Analysis & Control Panels"
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
          {/* Section: Speech & Copilot */}
          <div className="menu-section-header">Speech Intelligence (Gnani)</div>
          <button
            type="button"
            className={`meetings-menu-item ${activeTab === 'voice' ? 'active-item' : ''}`}
            role="menuitem"
            onClick={() => handleToggle('voice')}
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
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </div>
            <div className="menu-item-content">
              <div className="menu-item-title">Gnani Voice Studio</div>
              <div className="menu-item-subtitle">
                Push-to-talk, live streaming STT, and voice ledger
              </div>
            </div>
          </button>

          {/* Section: Resilience Simulation */}
          <div className="menu-divider" />
          <div className="menu-section-header">Resilience Simulation</div>
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
              <div className="menu-item-title">Live Telemetry &amp; Verdicts</div>
              <div className="menu-item-subtitle">
                p99 latency, throughput, error rates, and SLO checks
              </div>
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
              <div className="menu-item-title">Chaos Faults &amp; Rules</div>
              <div className="menu-item-subtitle">
                Inject downstream latency, packet loss, or stalls
              </div>
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
              <div className="menu-item-title">Resilience Policy Optimizer</div>
              <div className="menu-item-subtitle">
                Autonomous heuristic &amp; ML policy search
              </div>
            </div>
          </button>

          {/* Section: Observability & History */}
          <div className="menu-divider" />
          <div className="menu-section-header">Observability &amp; History</div>
          <button
            type="button"
            className={`meetings-menu-item ${activeTab === 'runs' ? 'active-item' : ''}`}
            role="menuitem"
            onClick={() => handleToggle('runs')}
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
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="menu-item-content">
              <div className="menu-item-title">Execution History</div>
              <div className="menu-item-subtitle">
                Inspect past trial logs, events, and replay
              </div>
            </div>
          </button>

          <button
            type="button"
            className={`meetings-menu-item ${activeTab === 'benchmarks' ? 'active-item' : ''}`}
            role="menuitem"
            onClick={() => handleToggle('benchmarks')}
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
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div className="menu-item-content">
              <div className="menu-item-title">Benchmark Suite</div>
              <div className="menu-item-subtitle">
                Compare baseline vs faulted architecture results
              </div>
            </div>
          </button>

          <button
            type="button"
            className={`meetings-menu-item ${activeTab === 'reports' ? 'active-item' : ''}`}
            role="menuitem"
            onClick={() => handleToggle('reports')}
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div className="menu-item-content">
              <div className="menu-item-title">Architecture Reports</div>
              <div className="menu-item-subtitle">
                Executive blueprint and resilience summary
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
