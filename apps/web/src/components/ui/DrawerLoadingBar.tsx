export interface DrawerLoadingBarProps {
  readonly label: string;
}

export function DrawerLoadingBar({ label }: DrawerLoadingBarProps) {
  return (
    <div className="drawer-loading-box">
      <div className="drawer-loading-header">
        <span className="agentic-pulse-spinner" />
        <span className="drawer-loading-label">{label}</span>
      </div>
      <div className="drawer-loading-indeterminate" />
    </div>
  );
}
