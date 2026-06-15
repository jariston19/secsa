import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";

export type ConfirmTone = "danger" | "warning" | "default";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

function defaultTitle(tone: ConfirmTone) {
  switch (tone) {
    case "danger":
      return "Delete item?";
    case "warning":
      return "Are you sure?";
    default:
      return "Confirm action";
  }
}

function defaultConfirmLabel(tone: ConfirmTone, label?: string) {
  if (label) return label;
  switch (tone) {
    case "danger":
      return "Delete";
    case "warning":
      return "Continue";
    default:
      return "Confirm";
  }
}

function ConfirmMessage({ message }: { message: string }) {
  const parts = message.split("\n\n").filter(Boolean);

  return (
    <div className="confirm-dialog-message">
      {parts.map((part, index) => (
        <p key={index} className={index === 0 ? "confirm-dialog-lead" : "confirm-dialog-detail muted"}>
          {part}
        </p>
      ))}
    </div>
  );
}

function ConfirmDialog({
  request,
  onComplete,
}: {
  request: PendingConfirm;
  onComplete: (value: boolean) => void;
}) {
  const tone = request.tone ?? "danger";
  const confirmedRef = useRef(false);
  const handleClose = useCallback(() => onComplete(confirmedRef.current), [onComplete]);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(handleClose, true);

  return portal(
    <div className={overlayClass} onClick={requestClose} role="presentation">
      <div
        className={panelClass("confirm-dialog", `confirm-dialog-${tone}`)}
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <div className={`confirm-dialog-icon confirm-dialog-icon-${tone}`} aria-hidden="true">
          {tone === "danger" ? "!" : tone === "warning" ? "?" : "i"}
        </div>
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">
          {request.title ?? defaultTitle(tone)}
        </h2>
        <div id="confirm-dialog-description">
          <ConfirmMessage message={request.message} />
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn secondary" onClick={requestClose}>
            {request.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn danger" : "btn"}
            onClick={() => {
              confirmedRef.current = true;
              requestClose();
            }}
          >
            {defaultConfirmLabel(tone, request.confirmLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const handleComplete = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending ? <ConfirmDialog request={pending} onComplete={handleComplete} /> : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return context.confirm;
}
