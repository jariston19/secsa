import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ToastType = "success" | "error";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  closing: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4000;
const FADE_MS = 280;

function createToastId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // randomUUID may be unavailable on some hosts.
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((toast) => (toast.id === id ? { ...toast, closing: true } : toast))
    );

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      timersRef.current.delete(id);
    }, FADE_MS);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      if (!message.trim()) return;

      const id = createToastId();
      setToasts((prev) => [...prev, { id, message, type, closing: false }]);

      const timer = window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    showToast,
    success: (message) => showToast(message, "success"),
    error: (message) => showToast(message, "error"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast toast-${toast.type}${toast.closing ? " is-closing" : ""}`}
              role="status"
            >
              {toast.message}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
