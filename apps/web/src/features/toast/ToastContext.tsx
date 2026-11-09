import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  const recentToastsRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const now = Date.now();
      const cleanMsg = (item.message || '').trim().toLowerCase();
      const cleanTitle = (item.title || '').trim().toLowerCase();
      const key = `${item.kind}:${cleanTitle}:${cleanMsg}`;

      // 1. Exact Duplicate Throttle (prevent identical toasts within 2000ms)
      const lastShown = recentToastsRef.current.get(key);
      if (lastShown && now - lastShown < 2000) {
        return '';
      }

      // 2. Semantic Meeting Exit Throttle (prevents duplicate leave toasts from PiP + Navbar + Root)
      const isMeetingLeave =
        cleanMsg.includes('left the') ||
        cleanTitle.includes('session ended') ||
        cleanTitle.includes('meeting ended') ||
        cleanMsg.includes('meeting ended');
      if (isMeetingLeave) {
        const lastLeave = recentToastsRef.current.get('semantic:meeting-exit');
        if (lastLeave && now - lastLeave < 2500) {
          return '';
        }
        recentToastsRef.current.set('semantic:meeting-exit', now);
      }

      // 3. Media Device Permission Duplicate Throttle
      const isMediaDevice =
        cleanTitle.includes('media') ||
        cleanMsg.includes('camera') ||
        cleanMsg.includes('microphone');
      if (isMediaDevice) {
        const lastMedia = recentToastsRef.current.get('semantic:media-device');
        if (lastMedia && now - lastMedia < 3000) {
          return '';
        }
        recentToastsRef.current.set('semantic:media-device', now);
      }

      recentToastsRef.current.set(key, now);

      // Periodically clean up expired entries from the map
      if (recentToastsRef.current.size > 50) {
        for (const [k, time] of recentToastsRef.current.entries()) {
          if (now - time > 10000) recentToastsRef.current.delete(k);
        }
      }

      const id = `toast_${now}_${++toastCounter}`;
      const durationMs = item.durationMs ?? (item.kind === 'error' ? 5000 : 3500);
      const newToast: ToastItem = { ...item, id, durationMs };

      // Keep at most 3 simultaneous toasts to prevent viewport cluttering
      setToasts((prev) => [...prev.slice(-2), newToast]);

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

    window.addEventListener('echmameet:toast', handleGlobalToast);
    window.addEventListener('resilio:toast', handleGlobalToast);
    return () => {
      window.removeEventListener('echmameet:toast', handleGlobalToast);
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
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="8 12 11 15 16 9" />
                </svg>
              )}
              {toast.kind === 'error' && (
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
              {toast.kind === 'info' && (
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              )}
              {toast.kind === 'warning' && (
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
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
