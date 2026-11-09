import { createPortal } from 'react-dom';
import type { AppSettings } from './types';
export type { AppSettings } from './types';
export {
  DEFAULT_SETTINGS,
  loadSettingsFromStorage,
  saveSettingsToStorage,
  SETTINGS_STORAGE_KEY,
} from './types';

export { SettingsPage, type SettingsPageProps } from './SettingsPage';

export interface SettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (settings: AppSettings) => void;
  readonly currentSettings: AppSettings;
}

/**
 * Legacy modal wrapper. Prefer using the dedicated full-page `<SettingsPage />`.
 */
export function SettingsModal({ isOpen, onClose, onSave, currentSettings }: SettingsModalProps) {
  if (!isOpen) return null;
  const modalElement = (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <div className="settings-header-title">
            <span>Settings Configuration</span>
          </div>
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            aria-label="Close settings"
          >
            &times;
          </button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
            Full system settings are now displayed in full-page mode. Click below to apply your
            current settings.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onSave(currentSettings);
              onClose();
            }}
          >
            Confirm &amp; Close
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalElement, document.body);
  }

  return modalElement;
}
