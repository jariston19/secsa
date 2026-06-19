export function supportsFullscreenLockdown() {
  return document.fullscreenEnabled && window.isSecureContext;
}

export function isExamFullscreenActive(container: HTMLElement | null) {
  const active = document.fullscreenElement;
  if (!active) return false;
  if (container && active === container) return true;
  return active === document.documentElement;
}

/** Call synchronously inside a click handler, before any await. */
export function primeExamFullscreen(target: HTMLElement = document.documentElement) {
  if (!supportsFullscreenLockdown()) return;

  try {
    if (document.fullscreenElement !== target) {
      void target.requestFullscreen();
    }
  } catch {
    // Browser may still block if activation expired — fallback overlay handles this.
  }
}

export async function requestExamFullscreen(target: HTMLElement | null) {
  if (!supportsFullscreenLockdown() || !target) return false;

  try {
    if (document.fullscreenElement === target) return true;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }

    await target.requestFullscreen();
    return document.fullscreenElement === target;
  } catch {
    return false;
  }
}

export async function exitExamFullscreen() {
  if (!document.fullscreenElement) return;

  try {
    await document.exitFullscreen();
  } catch {
    // Ignore if the browser blocks exit.
  }
}
