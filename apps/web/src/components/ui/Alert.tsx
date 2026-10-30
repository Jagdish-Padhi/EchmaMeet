import type { ReactNode } from 'react';

export interface AlertProps {
  readonly variant: 'info' | 'warning' | 'error' | 'success';
  readonly title?: string;
  readonly children: ReactNode;
  readonly onDismiss?: () => void;
}

export function Alert({ variant, title, children, onDismiss }: AlertProps) {
  return (
    <div className={`alert alert-${variant}`} role="alert">
      <div className="alert-content">
        {title && <strong className="alert-title">{title}</strong>}
        <div className="alert-message">{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="alert-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss alert"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
