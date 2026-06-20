export function canRequestExamFullscreen() {
  return document.fullscreenEnabled;
}

export function isExamContainerFullscreen(container: HTMLElement | null) {
  return Boolean(container && document.fullscreenElement === container);
}

export async function requestExamContainerFullscreen(container: HTMLElement | null) {
  if (!canRequestExamFullscreen() || !container) return false;

  try {
    if (document.fullscreenElement === container) return true;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    await container.requestFullscreen();
    return document.fullscreenElement === container;
  } catch {
    return false;
  }
}

export async function exitExamContainerFullscreen() {
  if (!document.fullscreenElement) return;
  try {
    await document.exitFullscreen();
  } catch {
    // Ignore if the browser blocks exit.
  }
}

/** Call synchronously inside a click handler, before any await. */
export function primeExamContainerFullscreen(container: HTMLElement | null) {
  if (!canRequestExamFullscreen() || !container) return;
  try {
    if (document.fullscreenElement !== container) {
      void container.requestFullscreen();
    }
  } catch {
    // Browser may block without a fresh gesture — prompt handles fallback.
  }
}
