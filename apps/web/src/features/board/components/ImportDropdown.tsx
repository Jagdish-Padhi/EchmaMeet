import { useEffect, useRef, useState } from 'react';
import type { ScenarioSpec } from '@chaosboard/contracts';

export interface ImportDropdownProps {
  readonly onImportDiagram: () => void;
  readonly onScanWhiteboard: () => void;
  readonly scenarios?: readonly ScenarioSpec[];
  readonly onSelectScenario?: (scenario: ScenarioSpec) => void;
}

export function ImportDropdown({
  onImportDiagram,
  onScanWhiteboard,
  scenarios = [],
  onSelectScenario,
}: ImportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScenarioSubmenuOpen, setIsScenarioSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsScenarioSubmenuOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div className="analysis-dropdown-wrapper" ref={menuRef}>
      <button
        type="button"
        className={`navbar-meeting-btn ${isOpen ? 'active' : ''}`}
        onClick={() => {
          setIsOpen((prev) => !prev);
          setIsScenarioSubmenuOpen(false);
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Import architecture topology or load scenario"
      >
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="meeting-btn-label">Import</span>
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
        <div className="meetings-menu import-menu" role="menu">
          <button
            type="button"
            className="meetings-menu-item"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onImportDiagram();
            }}
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
              <div className="menu-item-title">Import Diagram</div>
              <div className="menu-item-subtitle">Mermaid flowchart or JSON topology</div>
            </div>
          </button>

          <button
            type="button"
            className="meetings-menu-item"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onScanWhiteboard();
            }}
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
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div className="menu-item-content">
              <div className="menu-item-title">Scan Whiteboard Photo</div>
              <div className="menu-item-subtitle">
                Convert a whiteboard photo into nodes &amp; edges
              </div>
            </div>
          </button>

          {scenarios.length > 0 && onSelectScenario && (
            <>
              <div className="menu-divider" />
              <button
                type="button"
                className="meetings-menu-item"
                role="menuitem"
                onClick={() => setIsScenarioSubmenuOpen((prev) => !prev)}
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
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                </div>
                <div className="menu-item-content">
                  <div className="menu-item-title">Production Scenarios</div>
                  <div className="menu-item-subtitle">
                    Load pre-configured architectures &amp; failure models
                  </div>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  width="11"
                  height="11"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    marginLeft: 'auto',
                    transform: isScenarioSubmenuOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              {isScenarioSubmenuOpen && (
                <div className="scenario-inline-list">
                  {scenarios.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      className="scenario-subitem"
                      onClick={() => {
                        setIsOpen(false);
                        setIsScenarioSubmenuOpen(false);
                        onSelectScenario(sc);
                      }}
                    >
                      <span className="scenario-subitem-bullet" />
                      <span className="scenario-subitem-name">{sc.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
