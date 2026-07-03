const SVG_PRESENTATION_ATTRS = [
  "stroke",
  "fill",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
] as const;

const HTML_EXPORT_PROPS = [
  "color",
  "background-color",
  "border-color",
  "border-width",
  "border-style",
  "font-size",
  "font-weight",
  "line-height",
  "text-align",
] as const;

type StyleSnapshot = {
  node: Element;
  attr: string;
  previous: string | null;
  previousStyle: string | null;
};

type SvgProbeTag = "polygon" | "line" | "circle" | "path" | "text";

const svgClassStyleCache = new Map<string, Partial<Record<(typeof SVG_PRESENTATION_ATTRS)[number], string>>>();

const SVG_CLASS_FILL_VARS: Partial<Record<string, string>> = {
  "chart-bloom-gap-area": "--chart-gap-band-fill",
  "chart-radar-class": "--chart-radar-series-a-fill",
  "chart-radar-student": "--chart-radar-series-b-fill",
};

function readRootCssColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function chartCssColor(varName: string, fallback: string) {
  return readRootCssColor(varName, fallback);
}

function isDefaultSvgFill(value: string) {
  return value === "rgb(0, 0, 0)" || value === "#000000" || value === "black";
}

function resolveSvgClassPaint(
  className: string,
  attr: "fill" | "stroke",
  value: string
) {
  if (attr === "fill") {
    const cssVar = SVG_CLASS_FILL_VARS[className];
    if (cssVar && (!value || isDefaultSvgFill(value) || value.includes("color-mix"))) {
      return readRootCssColor(cssVar, value);
    }
  }
  return value;
}

function applySvgPresentation(node: SVGElement, attr: string, value: string) {
  node.setAttribute(attr, value);
  node.style.setProperty(attr, value);
}

function clearSvgPresentation(
  node: Element,
  attr: string,
  previous: string | null,
  previousStyle: string | null
) {
  if (!(node instanceof SVGElement)) return;

  if (previous === null) {
    node.removeAttribute(attr);
  } else {
    node.setAttribute(attr, previous);
  }

  if (previousStyle === null) {
    node.style.removeProperty(attr);
  } else {
    node.style.setProperty(attr, previousStyle);
  }
}

export function probeSvgClassStyles(
  className: string,
  tag: SvgProbeTag = "polygon"
): Partial<Record<(typeof SVG_PRESENTATION_ATTRS)[number], string>> {
  const cacheKey = `v2:${tag}:${className}`;
  const cached = svgClassStyleCache.get(cacheKey);
  if (cached) return cached;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "10");
  svg.setAttribute("height", "10");
  svg.style.cssText = "position:fixed;left:-9999px;visibility:hidden;pointer-events:none";

  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  element.setAttribute("class", className);
  if (tag === "polygon") element.setAttribute("points", "0,0 10,0 10,10");
  if (tag === "line") {
    element.setAttribute("x1", "0");
    element.setAttribute("y1", "0");
    element.setAttribute("x2", "10");
    element.setAttribute("y2", "10");
  }
  if (tag === "circle") {
    element.setAttribute("cx", "5");
    element.setAttribute("cy", "5");
    element.setAttribute("r", "4");
  }
  if (tag === "path") element.setAttribute("d", "M0,0 L10,10");
  if (tag === "text") element.textContent = "A";

  svg.appendChild(element);
  document.body.appendChild(svg);

  const computed = getComputedStyle(element);
  const styles: Partial<Record<(typeof SVG_PRESENTATION_ATTRS)[number], string>> = {};
  for (const attr of SVG_PRESENTATION_ATTRS) {
    let value = computed.getPropertyValue(attr).trim();
    if (!value || value === "none") continue;
    if (attr === "fill" || attr === "stroke") {
      value = resolveSvgClassPaint(className, attr, value);
    }
    if (!value || value === "none") continue;
    styles[attr] = value;
  }

  document.body.removeChild(svg);
  svgClassStyleCache.set(cacheKey, styles);
  return styles;
}

export function svgPresentationProps(
  styles: Partial<Record<(typeof SVG_PRESENTATION_ATTRS)[number], string>>
) {
  const props: Record<string, string> = {};
  for (const [attr, value] of Object.entries(styles)) {
    if (!value) continue;
    if (attr === "stroke-width") props.strokeWidth = value;
    else if (attr === "stroke-linecap") props.strokeLinecap = value;
    else if (attr === "stroke-linejoin") props.strokeLinejoin = value;
    else if (attr === "stroke-dasharray") props.strokeDasharray = value;
    else if (attr === "stroke-dashoffset") props.strokeDashoffset = value;
    else if (attr === "fill-opacity") props.fillOpacity = value;
    else if (attr === "stroke-opacity") props.strokeOpacity = value;
    else props[attr] = value;
  }
  return props;
}

export function findChartExportRoot(element: HTMLElement) {
  return (
    element.querySelector<HTMLElement>(
      ".analytics-chart-card, .overview-hero-card, .overview-panel, .analytics-panel, .individual-student-section, .analytics-trends-step-summary"
    ) ?? element
  );
}

export function chartExportTitle(element: HTMLElement) {
  return element.querySelector("h3, h2")?.textContent?.trim() ?? "";
}

export function measureChartExportSize(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const width = Math.max(320, Math.ceil(rect.width || element.scrollWidth || element.clientWidth));
  const height = Math.max(
    280,
    Math.ceil(Math.max(element.scrollHeight, element.offsetHeight, rect.height))
  );
  return { width, height };
}

export function probeDonutStrokeColors(variant: "default" | "risk" = "default") {
  const host = document.createElement("div");
  host.className = variant === "risk" ? "chart-donut chart-donut-risk" : "chart-donut";
  host.style.cssText =
    "position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;width:0;height:0;overflow:hidden;";
  host.innerHTML = `
    <svg viewBox="0 0 120 120" class="chart-donut-svg" aria-hidden="true">
      <circle class="chart-donut-ring-bg" stroke-width="14" fill="none" cx="60" cy="60" r="42"></circle>
      <circle class="chart-donut-ring-fill" stroke-width="14" fill="none" cx="60" cy="60" r="42"></circle>
    </svg>
  `;
  document.body.appendChild(host);

  const bg = host.querySelector(".chart-donut-ring-bg");
  const fill = host.querySelector(".chart-donut-ring-fill");
  const colors = {
    bg:
      (bg instanceof SVGElement ? getComputedStyle(bg).stroke : "") ||
      "rgba(60, 60, 67, 0.06)",
    fill:
      (fill instanceof SVGElement ? getComputedStyle(fill).stroke : "") ||
      (variant === "risk" ? "#ef4444" : "#007AFF"),
  };

  document.body.removeChild(host);
  return colors;
}

function mirrorComputedStyles(source: Element, target: Element) {
  if (source instanceof HTMLElement && target instanceof HTMLElement) {
    const computed = getComputedStyle(source);
    for (const prop of HTML_EXPORT_PROPS) {
      const value = computed.getPropertyValue(prop).trim();
      if (!value || value === "transparent" || value === "rgba(0, 0, 0, 0)") continue;
      target.style.setProperty(prop, value);
    }
  }

  const sourceChildren = [...source.children];
  const targetChildren = [...target.children];
  for (let index = 0; index < sourceChildren.length; index += 1) {
    const targetChild = targetChildren[index];
    if (targetChild) mirrorComputedStyles(sourceChildren[index]!, targetChild);
  }
}

function inlineSvgNodePresentationStyles(node: SVGElement, styleSource: Element) {
  const snapshots: StyleSnapshot[] = [];
  const computed = getComputedStyle(styleSource);
  const className = styleSource.getAttribute("class") ?? "";
  for (const attr of SVG_PRESENTATION_ATTRS) {
    let value = computed.getPropertyValue(attr).trim();
    if (!value || value === "none") continue;
    if (attr === "fill" || attr === "stroke") {
      value = resolveSvgClassPaint(className, attr, value);
    }
    if (!value || value === "none") continue;
    snapshots.push({
      node,
      attr,
      previous: node.getAttribute(attr),
      previousStyle: node.style.getPropertyValue(attr) || null,
    });
    applySvgPresentation(node, attr, value);
  }
  return snapshots;
}

export function inlineSvgPresentationStyles(root: HTMLElement, sourceRoot?: HTMLElement) {
  const snapshots: StyleSnapshot[] = [];
  const sourceNodes = sourceRoot?.querySelectorAll<SVGElement>("svg *");
  const targetNodes = root.querySelectorAll<SVGElement>("svg *");

  targetNodes.forEach((node, index) => {
    const styleSource = sourceNodes?.[index] ?? node;
    snapshots.push(...inlineSvgNodePresentationStyles(node, styleSource));
  });

  root
    .querySelectorAll<HTMLElement>(
      ".chart-legend-dot, .chart-horizontal-bar-fill, .chart-vertical-histogram-fill, .chart-grouped-bar-fill, .chart-heatmap-cell, .chart-topic-flag"
    )
    .forEach((node) => {
      const background = getComputedStyle(node).backgroundColor;
      if (!background || background === "transparent" || background === "rgba(0, 0, 0, 0)") {
        return;
      }
      snapshots.push({
        node,
        attr: "data-export-bg",
        previous: node.style.backgroundColor || null,
        previousStyle: null,
      });
      node.style.backgroundColor = background;
    });

  return () => {
    for (const snapshot of snapshots) {
      if (snapshot.attr === "data-export-bg") {
        if (snapshot.previous) {
          (snapshot.node as HTMLElement).style.backgroundColor = snapshot.previous;
        } else {
          (snapshot.node as HTMLElement).style.removeProperty("background-color");
        }
        continue;
      }

      clearSvgPresentation(
        snapshot.node,
        snapshot.attr,
        snapshot.previous,
        snapshot.previousStyle
      );
    }
  };
}

export function createChartExportClone(source: HTMLElement, width: number, height: number) {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-chart-export-wrapper", "true");
  wrapper.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${width}px`,
    `height:${height}px`,
    "overflow:visible",
    "pointer-events:none",
    "opacity:0",
    "z-index:-1",
    "background:#ffffff",
  ].join(";");

  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".analytics-no-print").forEach((node) => node.remove());
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.maxHeight = "none";
  clone.style.minHeight = `${height}px`;
  clone.style.overflow = "visible";
  clone.style.boxSizing = "border-box";

  clone
    .querySelectorAll<HTMLElement>(".chart-demographics-table-wrap, .analytics-chart-card-body")
    .forEach((node) => {
      node.style.overflow = "visible";
      node.style.maxHeight = "none";
    });

  mirrorComputedStyles(source, clone);
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  const restoreCloneStyles = inlineSvgPresentationStyles(clone, source);

  return {
    clone,
    cleanup() {
      restoreCloneStyles();
      wrapper.remove();
    },
  };
}
