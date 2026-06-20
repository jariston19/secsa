function readRootFontSize() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

export function parseCssLength(value: string, rootPx = readRootFontSize()) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (trimmed.endsWith("rem")) return parseFloat(trimmed) * rootPx;
  if (trimmed.endsWith("px")) return parseFloat(trimmed);
  const numeric = parseFloat(trimmed);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function readCssVarLength(
  element: HTMLElement,
  varName: string,
  fallbackPx: number
) {
  const raw = getComputedStyle(element).getPropertyValue(varName).trim();
  const parsed = parseCssLength(raw);
  return parsed > 0 ? parsed : fallbackPx;
}

interface MeasurePageSizeOptions {
  rowHeightVar?: string;
  rowHeightFallbackPx?: number;
  headerSelector?: string;
  reservedHeight?: number;
  minPageSize?: number;
}

export function measurePageSize(
  container: HTMLElement,
  {
    rowHeightVar = "--list-panel-row-height",
    rowHeightFallbackPx = 44,
    headerSelector = "thead",
    reservedHeight = 0,
    minPageSize = 1,
  }: MeasurePageSizeOptions = {}
) {
  const rowHeight = readCssVarLength(container, rowHeightVar, rowHeightFallbackPx);
  const header = headerSelector ? container.querySelector(headerSelector) : null;
  const headerHeight = header?.getBoundingClientRect().height ?? 0;
  const available = container.clientHeight - headerHeight - reservedHeight;

  if (available <= 0 || rowHeight <= 0) {
    return minPageSize;
  }

  return Math.max(minPageSize, Math.floor(available / rowHeight));
}
