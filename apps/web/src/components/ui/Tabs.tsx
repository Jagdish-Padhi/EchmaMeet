export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly badge?: string | number;
}

export interface TabsProps {
  readonly tabs: readonly TabItem[];
  readonly activeTab: string;
  readonly onChange: (tabId: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <nav className="tab-nav" role="tablist" aria-label="Main tabs">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            className={`tab-item ${isActive ? 'tab-item-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            <span className="tab-label">{tab.label}</span>
            {tab.badge !== undefined && <span className="tab-badge">{tab.badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}
