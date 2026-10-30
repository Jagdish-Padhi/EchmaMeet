import { useEffect, useRef, useState } from 'react';

export interface ImportDropdownProps {
  readonly onImportDiagram: () => void;
  readonly onScanWhiteboard: () => void;
}

export function ImportDropdown({ onImportDiagram, onScanWhiteboard }: ImportDropdownProps) {
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

  return (
    <div className="analysis-dropdown-wrapper" ref={menuRef}>
      <button
        type="button"
        className={`navbar-meeting-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Import architecture topology"
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
              <div className="menu-item-subtitle">Extract diagram via Vision SAM AI</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
