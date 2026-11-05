import type { SettingsSectionId } from '../types';
import { SECTIONS_CATALOG } from '../types';

interface SettingsSidebarProps {
  readonly activeSection: SettingsSectionId;
  readonly onSelectSection: (sectionId: SettingsSectionId) => void;
}

const CATEGORIES = ['SYSTEM & ENGINE', 'STUDIO & ERGONOMICS', 'IDENTITY & ACCESS'] as const;

export function SettingsSidebar({ activeSection, onSelectSection }: SettingsSidebarProps) {
  return (
    <aside className="settings-left-sidebar" aria-label="Settings Categories">
      <div className="settings-nav-header">
        <span className="settings-nav-heading">CONFIGURATION</span>
      </div>

      <div className="settings-category-groups">
        {CATEGORIES.map((cat) => (
          <div key={cat} className="settings-nav-group">
            <div className="settings-group-label">{cat}</div>
            <div className="settings-group-items">
              {SECTIONS_CATALOG.filter((s) => s.category === cat).map((s) => {
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`settings-category-btn ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectSection(s.id)}
                  >
                    <span className="category-title">{s.shortTitle}</span>
                    {isActive && <div className="category-active-marker" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
