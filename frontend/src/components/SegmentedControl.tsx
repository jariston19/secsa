import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface Segment {
  id: string;
  label: string;
}

interface Props {
  segments: Segment[];
  value: string;
  onChange: (id: string) => void;
  scrollable?: boolean;
}

export default function SegmentedControl({ segments, value, onChange, scrollable = false }: Props) {
  const controlRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [thumb, setThumb] = useState({ width: 0, left: 0 });
  const [ready, setReady] = useState(false);

  const activeIndex = segments.findIndex((segment) => segment.id === value);

  const updateThumb = useCallback(() => {
    const button = tabRefs.current[activeIndex];
    const control = controlRef.current;
    if (!button || !control || activeIndex < 0) return;

    setThumb({
      width: button.offsetWidth,
      left: button.offsetLeft,
    });
    setReady(true);
  }, [activeIndex]);

  useLayoutEffect(() => {
    updateThumb();
    if (scrollable) {
      const button = tabRefs.current[activeIndex];
      button?.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }, [activeIndex, scrollable, updateThumb, value, segments]);

  useEffect(() => {
    const control = controlRef.current;
    if (!control) return;

    const observer = new ResizeObserver(() => {
      updateThumb();
    });

    observer.observe(control);
    window.addEventListener("resize", updateThumb);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateThumb);
    };
  }, [updateThumb]);

  useEffect(() => {
    tabRefs.current = tabRefs.current.slice(0, segments.length);
  }, [segments.length]);

  return (
    <div
      className={`segmented-control${scrollable ? " segmented-control-scrollable" : ""}`}
      ref={controlRef}
    >
      <span
        className={`segmented-thumb${ready ? " segmented-thumb-ready" : ""}`}
        style={{
          width: thumb.width,
          transform: `translateX(${thumb.left}px)`,
        }}
        aria-hidden
      />
      {segments.map((segment, index) => (
        <button
          key={segment.id}
          ref={(element) => {
            tabRefs.current[index] = element;
          }}
          type="button"
          className={`tab ${value === segment.id ? "active" : ""}`}
          onClick={() => onChange(segment.id)}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
