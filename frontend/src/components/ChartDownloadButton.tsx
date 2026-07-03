import { Download } from "lucide-react";
import { type RefObject, useState } from "react";
import { downloadChartPng } from "../lib/downloadChartPng";

interface Props {
  targetRef: RefObject<HTMLElement | null>;
  fallbackName?: string;
  className?: string;
}

export default function ChartDownloadButton({
  targetRef,
  fallbackName = "chart",
  className = "chart-slot-download",
}: Props) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!targetRef.current || downloading) return;
    setDownloading(true);
    try {
      await downloadChartPng(targetRef.current, fallbackName);
    } catch (error) {
      console.error(error);
      window.alert("Could not download this chart. Try again in a moment.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      aria-label="Download chart as PNG"
      title="Download PNG"
      disabled={downloading}
      onClick={() => void handleDownload()}
    >
      <Download aria-hidden size={14} strokeWidth={2} />
    </button>
  );
}
