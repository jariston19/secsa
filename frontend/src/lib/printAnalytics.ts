export function printAnalyticsArea(areaId: string) {
  const area = document.getElementById(areaId);
  if (!area) return;

  document.body.classList.add("printing-analytics");
  area.classList.add("analytics-print-target");

  const cleanup = () => {
    document.body.classList.remove("printing-analytics");
    area.classList.remove("analytics-print-target");
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);

  window.requestAnimationFrame(() => {
    window.print();
  });
}
