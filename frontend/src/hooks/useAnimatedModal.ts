import { useCallback, useState } from "react";

const CLOSE_MS = 280;

export function useAnimatedModal(onClose: () => void) {
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (closing) return;

    setClosing(true);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : CLOSE_MS;
    window.setTimeout(onClose, duration);
  }, [closing, onClose]);

  const overlayClass = closing ? "modal-overlay is-closing" : "modal-overlay";
  const panelClass = (...extra: string[]) =>
    ["modal", "card", ...extra, closing ? "is-closing" : ""].filter(Boolean).join(" ");

  return { requestClose, overlayClass, panelClass };
}
