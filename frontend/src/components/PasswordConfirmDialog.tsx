import { useCallback, useRef, useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onComplete: (password: string | null) => void;
}

export default function PasswordConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onComplete,
}: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const confirmedRef = useRef(false);
  const passwordRef = useRef(password);
  passwordRef.current = password;

  const handleClose = useCallback(() => {
    onComplete(confirmedRef.current ? passwordRef.current : null);
  }, [onComplete]);

  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(handleClose, true);

  const parts = message.split("\n\n").filter(Boolean);

  return portal(
    <div className={overlayClass} onClick={requestClose} role="presentation">
      <div
        className={panelClass("confirm-dialog", "confirm-dialog-danger", "password-confirm-dialog")}
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="password-confirm-title"
        aria-describedby="password-confirm-description"
      >
        <div className="confirm-dialog-icon confirm-dialog-icon-danger" aria-hidden="true">
          !
        </div>
        <h2 id="password-confirm-title" className="confirm-dialog-title">
          {title}
        </h2>
        <div id="password-confirm-description">
          <div className="confirm-dialog-message">
            {parts.map((part, index) => (
              <p
                key={index}
                className={index === 0 ? "confirm-dialog-lead" : "confirm-dialog-detail muted"}
              >
                {part}
              </p>
            ))}
          </div>
          <label className="password-confirm-field">
            <span>Your password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              autoComplete="current-password"
              autoFocus
            />
          </label>
          {error ? (
            <p className="field-hint field-hint-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn secondary" onClick={requestClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (!password.trim()) {
                setError("Enter your password to continue.");
                return;
              }
              confirmedRef.current = true;
              requestClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
