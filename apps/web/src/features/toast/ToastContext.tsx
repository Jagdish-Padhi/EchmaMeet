import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  readonly id: string;
  readonly kind: ToastKind;
  readonly message: string;
  readonly title?: string | undefined;
  readonly durationMs?: number | undefined;
}

interface ToastContextValue {
  readonly showToast: (toast: Omit<ToastItem, 'id'>) => string;
  readonly dismissToast: (id: string) => void;
  readonly success: (message: string, title?: string | undefined) => string;
  readonly error: (message: string, title?: string | undefined) => string;
  readonly info: (message: string, title?: string | undefined) => string;
  readonly warning: (message: string, title?: string | undefined) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const id = `toast_${Date.now()}_${++toastCounter}`;
      const durationMs = item.durationMs ?? (item.kind === 'error' ? 5000 : 3800);
      const newToast: ToastItem = { ...item, id, durationMs };

      setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 toasts

      if (durationMs > 0) {
        window.setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }

      return id;
    },
    [dismissToast],
  );

  const success = useCallback(
    (message: string, title?: string) => showToast({ kind: 'success', message, title }),
    [showToast],
  );

  const error = useCallback(
    (message: string, title?: string) => showToast({ kind: 'error', message, title }),
    [showToast],
  );

  const info = useCallback(
    (message: string, title?: string) => showToast({ kind: 'info', message, title }),
    [showToast],
  );

  const warning = useCallback(
    (message: string, title?: string) => showToast({ kind: 'warning', message, title }),
    [showToast],
  );

  // Global event listener so non-react layers can also trigger a toast
  useEffect(() => {
    const handleGlobalToast = (event: Event) => {
      const customEvent = event as CustomEvent<Omit<ToastItem, 'id'>>;
      if (customEvent.detail?.message) {
        showToast(customEvent.detail);
      }
    };

    window.addEventListener('resilio:toast', handleGlobalToast);
    return () => {
      window.removeEventListener('resilio:toast', handleGlobalToast);
    };
  }, [showToast]);

  const value = useMemo(
    () => ({
      showToast,
      dismissToast,
      success,
      error,
      info,
      warning,
    }),
    [showToast, dismissToast, success, error, info, warning],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Overlay Container */}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-item toast-${toast.kind}`}
            role={toast.kind === 'error' ? 'alert' : 'status'}
          >
            <div className={`toast-indicator toast-dot-${toast.kind}`} aria-hidden="true">
              {toast.kind === 'success' && (
                <svg
                  viewBox="0 0 20 20"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="4 11 8 15 16 6" />
                </svg>
              )}
              {toast.kind === 'error' && (
                <svg
                  viewBox="0 0 20 20"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="5" y1="5" x2="15" y2="15" />
                  <line x1="15" y1="5" x2="5" y2="15" />
                </svg>
              )}
              {toast.kind === 'info' && (
                <svg
                  viewBox="0 0 20 20"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="10" cy="10" r="8" />
                  <line x1="10" y1="9" x2="10" y2="14" />
                  <circle cx="10" cy="6" r="0.5" fill="currentColor" />
                </svg>
              )}
              {toast.kind === 'warning' && (
                <svg
                  viewBox="0 0 20 20"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polygon points="10 3 18 17 2 17" />
                  <line x1="10" y1="8" x2="10" y2="12" />
                  <circle cx="10" cy="15" r="0.5" fill="currentColor" />
                </svg>
              )}
            </div>

            <div className="toast-body">
              {toast.title && <div className="toast-title">{toast.title}</div>}
              <div className="toast-message">{toast.message}</div>
            </div>

            <button
              type="button"
              className="toast-close-btn"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const fallbackToast: ToastContextValue = {
  showToast: () => '',
  dismissToast: () => {},
  success: () => '',
  error: () => '',
  info: () => '',
  warning: () => '',
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  return ctx ?? fallbackToast;
}
