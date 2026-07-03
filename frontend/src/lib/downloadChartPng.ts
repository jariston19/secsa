import { domToBlob } from "modern-screenshot";
import { chartExportTitle, findChartExportRoot } from "./chartExportStyles";

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

function shouldCaptureNode(node: Node) {
  if (!(node instanceof HTMLElement)) return true;
  return !node.classList.contains("analytics-no-print");
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
  const title = chartExportTitle(exportRoot);
  const filename = "secsa-" + (slugify(title || fallbackName) || "chart") + ".png";

  await document.fonts.ready;

  const blob = await domToBlob(exportRoot, {
    scale: 2,
    type: "image/png",
    backgroundColor: chartBackgroundColor(exportRoot),
    filter: shouldCaptureNode,
  });

  if (!blob?.size) {
    throw new Error("Chart image export returned empty data.");
  }

  triggerDownload(blob, filename);
}
