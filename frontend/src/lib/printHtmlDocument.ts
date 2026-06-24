function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PRINT_STYLES = `
  @page { margin: 0.6in; size: auto; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12px;
    line-height: 1.45;
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { margin: 0 0 0.35rem; font-size: 1.35rem; }
  h2 { margin: 0 0 0.35rem; font-size: 1.05rem; }
  h3 { margin: 1rem 0 0.5rem; font-size: 0.95rem; }
  p { margin: 0.15rem 0; }
  .muted { color: #555; }
  .success { color: #0a7a43; font-weight: 600; }
  .error { color: #c0392b; font-weight: 600; }
  .report-header {
    margin-bottom: 1rem;
    padding-bottom: 0.65rem;
    border-bottom: 1px solid #ccc;
  }
  .summary-box {
    margin-bottom: 1rem;
    padding: 0.75rem 0.85rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #f8f8f8;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0.35rem;
  }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th, td {
    border: 1px solid #ccc;
    padding: 0.45rem 0.5rem;
    text-align: left;
    vertical-align: top;
  }
  th { background: #f0f0f0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; }
  .question-text { max-width: 28rem; white-space: normal; }
  .topic { color: #666; font-size: 0.85em; margin-top: 0.15rem; }
  ul { margin: 0.25rem 0 0; padding-left: 1.2rem; }
  li { margin: 0.2rem 0; }
  .area-strong strong { color: #0a7a43; }
  .area-weak strong { color: #c0392b; }
  .bloom-row {
    display: grid;
    grid-template-columns: 7rem 1fr 5rem;
    gap: 0.5rem;
    align-items: center;
    margin: 0.35rem 0;
  }
  .bloom-track {
    height: 0.55rem;
    background: #e5e5e5;
    border-radius: 999px;
    overflow: hidden;
  }
  .bloom-fill { display: block; height: 100%; border-radius: 999px; }
  .bloom-fill-strong { background: #0a7a43; }
  .bloom-fill-moderate { background: #d68910; }
  .bloom-fill-weak { background: #c0392b; }
  .bloom-tone-strong { color: #0a7a43; }
  .bloom-tone-moderate { color: #d68910; }
  .bloom-tone-weak { color: #c0392b; }
  .preview-section {
    margin-top: 1.25rem;
    padding-top: 0.75rem;
    border-top: 1px solid #ddd;
  }
  .section-meta { margin-bottom: 0.75rem; }
  .question-block {
    margin: 0 0 1rem;
    padding: 0.75rem 0.85rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .question-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }
  .question-heading .difficulty {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #555;
  }
  .question-text {
    margin: 0 0 0.5rem;
    white-space: pre-wrap;
  }
  .question-options {
    margin: 0.35rem 0 0.5rem;
    padding-left: 1.1rem;
  }
  .option-correct {
    font-weight: 700;
    color: #0a7a43;
  }
  .answer-key {
    margin: 0;
    font-size: 0.85rem;
  }
  .question-image {
    display: block;
    max-width: 100%;
    max-height: 14rem;
    margin: 0.5rem 0;
    object-fit: contain;
  }
  .validation-list {
    margin: 0.35rem 0 0;
    padding-left: 1.2rem;
    color: #c0392b;
  }
`;

function buildPrintDocument(title: string, bodyHtml: string) {
  const printedAt = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  ${bodyHtml}
  <p class="muted" style="margin-top: 1rem;">Printed ${escapeHtml(printedAt)}</p>
</body>
</html>`;
}

function printViaIframe(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.title = "Print preview";
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";

  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    return false;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    iframe.remove();
    frameWindow.removeEventListener("afterprint", cleanup);
  };

  frameWindow.addEventListener("afterprint", cleanup);
  window.setTimeout(cleanup, 60_000);

  window.setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
  }, 150);

  return true;
}

function printViaPopup(html: string, title: string) {
  // Do not pass noopener — it prevents writing document content from the opener.
  const printWindow = window.open("about:blank", "_blank", "width=960,height=720");
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = title;

  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    printWindow.close();
    printWindow.removeEventListener("afterprint", cleanup);
  };

  printWindow.addEventListener("afterprint", cleanup);
  window.setTimeout(cleanup, 60_000);

  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 150);

  return true;
}

export function printHtmlDocument(title: string, bodyHtml: string) {
  const html = buildPrintDocument(title, bodyHtml);

  if (printViaIframe(html)) {
    return;
  }

  if (printViaPopup(html, title)) {
    return;
  }

  window.alert("Unable to open print preview. Please try again.");
}

export { escapeHtml };
