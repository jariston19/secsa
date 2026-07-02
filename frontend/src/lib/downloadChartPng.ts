import { toBlob, toPng } from "html-to-image";
import {
  createChartExportClone,
  findChartExportRoot,
  inlineSvgPresentationStyles,
  measureChartExportSize,
} from "./chartExportStyles";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function chartBackgroundColor(element: HTMLElement) {
  const background = getComputedStyle(element).backgroundColor;
  if (background && background !== "rgba(0, 0, 0, 0)" && background !== "transparent") {
    return background;
  }
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--ios-bg-elevated").trim() ||
    "#ffffff"
  );
}

function shouldIncludeNode(node: Node) {
  if (!(node instanceof HTMLElement)) return true;
  if (node.dataset.chartExportWrapper === "true") return true;
  return !node.classList.contains("analytics-no-print");
}

function blobFromDataUrl(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Chart image export returned invalid data.");
  const header = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: mime });
  if (!blob.size) throw new Error("Chart image export returned empty data.");
  return blob;
}

async function renderChartBlob(node: HTMLElement, width: number, height: number) {
  const options = {
    cacheBust: true,
    pixelRatio: 2,
    width,
    height,
    backgroundColor: chartBackgroundColor(node),
    skipFonts: true,
    skipAutoScale: false,
    filter: shouldIncludeNode,
  };

  const blob = await toBlob(node, options);
  if (blob && blob.size > 0) return blob;

  const dataUrl = await toPng(node, options);
  return blobFromDataUrl(dataUrl);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadChartPng(element: HTMLElement, fallbackName = "chart") {
  const exportRoot = findChartExportRoot(element);
  const title = exportRoot.querySelector("h3")?.textContent?.trim();
  const filename = `secsa-${slugify(title || fallbackName) || "chart"}.png`;
  const { width, height } = measureChartExportSize(exportRoot);

  const restoreLiveStyles = inlineSvgPresentationStyles(exportRoot);
  try {
    const blob = await renderChartBlob(exportRoot, width, height);
    triggerDownload(blob, filename);
    return;
  } catch (liveError) {
    console.warn("Live chart export failed, retrying with off-screen clone.", liveError);
  } finally {
    restoreLiveStyles();
  }

  const { clone, cleanup } = createChartExportClone(exportRoot, width, height);
  try {
    const blob = await renderChartBlob(clone, width, height);
    triggerDownload(blob, filename);
  } finally {
    cleanup();
  }
}
