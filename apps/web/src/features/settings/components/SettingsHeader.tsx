import { EchmaLogo } from '../../../components/ui/EchmaLogo';

interface SettingsHeaderProps {
  readonly onBack: () => void;
  readonly shortTitle: string;
  readonly hasUnsavedChanges: boolean;
  readonly theme: 'dark' | 'light';
  readonly onToggleTheme: () => void;
  readonly onResetToDefaults: () => void;
  readonly onSave: () => void;
}

export function SettingsHeader({
  onBack,
  shortTitle,
  hasUnsavedChanges,
  theme,
  onToggleTheme,
  onResetToDefaults,
  onSave,
}: SettingsHeaderProps) {
  return (
    <header className="settings-topbar">
      <div className="settings-topbar-left">
        <button
          type="button"
          className="settings-back-btn"
          onClick={onBack}
          aria-label="Return to Studio Workspace"
          title="Return to Studio Workspace"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back to Studio</span>
        </button>

        <div className="settings-breadcrumb-separator" aria-hidden="true">
          /
        </div>

        <div className="settings-brand-pill">
          <EchmaLogo size={20} />
          <span className="settings-brand-name">EchmaMeet</span>
          <span className="settings-breadcrumb-sub">Settings</span>
        </div>

        <div className="settings-active-section-tag">
          <span>{shortTitle}</span>
        </div>
      </div>

      <div className="settings-topbar-right">
        {hasUnsavedChanges && (
          <div className="settings-unsaved-badge" role="status">
            <span className="unsaved-dot" />
            <span>Unsaved changes</span>
          </div>
        )}

        <button
          type="button"
          className="btn-icon-toggle"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
          aria-label="Toggle visual theme"
        >
          {theme === 'dark' ? (
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <button type="button" className="btn btn-ghost btn-sm" onClick={onResetToDefaults}>
          Reset Defaults
        </button>

        <button type="button" className="btn btn-primary btn-sm settings-save-btn" onClick={onSave}>
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Save Configuration</span>
        </button>
      </div>
    </header>
  );
}
