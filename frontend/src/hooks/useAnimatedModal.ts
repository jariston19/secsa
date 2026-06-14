import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll, unlockBodyScroll } from "../lib/scrollLock";

const CLOSE_MS = 280;

export function useAnimatedModal(onClose: () => void, active = true) {
  const [closing, setClosing] = useState(false);

  useLayoutEffect(() => {
    if (active) {
      setClosing(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [active]);

  const requestClose = useCallback(() => {
    if (closing) return;

    setClosing(true);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : CLOSE_MS;
    window.setTimeout(onClose, duration);
  }, [closing, onClose]);

  const overlayClass = closing ? "modal-overlay is-closing" : "modal-overlay";
  const panelClass = (...extra: string[]) =>
    ["modal", "card", ...extra, closing ? "is-closing" : ""].filter(Boolean).join(" ");

  const portal = (node: ReactNode) => createPortal(node, document.body);

  return { requestClose, overlayClass, panelClass, portal };
}
