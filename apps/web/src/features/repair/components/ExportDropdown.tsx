import { useEffect, useRef, useState } from 'react';

export interface ExportDropdownProps {
  readonly onExportIac: () => void;
  readonly onExportRfc: () => void;
}

export function ExportDropdown({ onExportIac, onExportRfc }: ExportDropdownProps) {
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
    <div className="export-dropdown-wrapper" ref={menuRef}>
      <button
        type="button"
        className="navbar-meeting-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Export Architecture Artifacts"
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
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span className="meeting-btn-label">Export</span>
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
        <div className="meetings-menu export-menu" role="menu">
          <button
            type="button"
            className="meetings-menu-item"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onExportIac();
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
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <div className="menu-item-content">
              <div className="menu-item-title">Kubernetes &amp; Istio YAML</div>
              <div className="menu-item-subtitle">
                Export VirtualService &amp; DestinationRule configs
              </div>
            </div>
          </button>

          <button
            type="button"
            className="meetings-menu-item"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onExportRfc();
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
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="menu-item-content">
              <div className="menu-item-title">Markdown Architecture Doc (ADR)</div>
              <div className="menu-item-subtitle">
                Export summary document for engineering review
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
