function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function chartBackgroundColor(element: HTMLElement) {
  const card = element.querySelector<HTMLElement>(
    ".analytics-chart-card, .overview-hero-card, .overview-panel, .analytics-panel, .individual-student-section"
  );
  const target = card ?? element;
  const background = getComputedStyle(target).backgroundColor;
  if (background && background !== "rgba(0, 0, 0, 0)" && background !== "transparent") {
    return background;
  }
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--ios-bg-elevated").trim() ||
    "#ffffff"
  );
}

function inlineNodeStyles(source: Element, target: Element) {
  if (!(target instanceof HTMLElement) || !(source instanceof HTMLElement)) return;

  const computed = getComputedStyle(source);
  let cssText = "";
  for (const property of computed) {
    cssText += `${property}:${computed.getPropertyValue(property)};`;
  }
  target.style.cssText = cssText;

  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let index = 0; index < sourceChildren.length; index += 1) {
    const targetChild = targetChildren[index];
    if (targetChild) inlineNodeStyles(sourceChildren[index]!, targetChild);
  }
}

async function elementToPngDataUrl(element: HTMLElement) {
  const width = Math.max(1, Math.ceil(element.getBoundingClientRect().width));
  const height = Math.max(1, Math.ceil(element.getBoundingClientRect().height));
  const backgroundColor = chartBackgroundColor(element);

  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".analytics-no-print").forEach((node) => node.remove());
  inlineNodeStyles(element, clone);

  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.background = backgroundColor;
  wrapper.appendChild(clone);

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<foreignObject width="100%" height="100%">`,
    new XMLSerializer().serializeToString(wrapper),
    `</foreignObject>`,
    `</svg>`,
  ].join("");

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to render chart image."));
      img.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    const pixelRatio = 2;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");

    context.scale(pixelRatio, pixelRatio);
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export async function downloadChartPng(element: HTMLElement, fallbackName = "chart") {
  const title = element.querySelector("h3")?.textContent?.trim();
  const filename = `secsa-${slugify(title || fallbackName) || "chart"}.png`;
  const dataUrl = await elementToPngDataUrl(element);

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
