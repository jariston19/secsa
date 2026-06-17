const PRINT_SANDBOX_ID = "analytics-print-sandbox";

export function printAnalyticsArea(areaId: string) {
  const area = document.getElementById(areaId);
  if (!area) return;

  document.getElementById(PRINT_SANDBOX_ID)?.remove();

  const sandbox = document.createElement("div");
  sandbox.id = PRINT_SANDBOX_ID;
  sandbox.className = "analytics-print-sandbox";

  const clone = area.cloneNode(true) as HTMLElement;
  clone.classList.add("analytics-print-target");
  clone.removeAttribute("id");
  sandbox.appendChild(clone);
  document.body.appendChild(sandbox);
  document.body.classList.add("printing-analytics");

  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.body.classList.remove("printing-analytics");
    sandbox.remove();
    window.removeEventListener("afterprint", cleanup);
    printMedia.removeEventListener("change", onPrintChange);
  };

  const onPrintChange = (event: MediaQueryListEvent) => {
    if (!event.matches) {
      cleanup();
    }
  };

  const printMedia = window.matchMedia("print");
  printMedia.addEventListener("change", onPrintChange);
  window.addEventListener("afterprint", cleanup);

  window.requestAnimationFrame(() => {
    window.print();
  });
}
