import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface Segment {
  id: string;
  label: string;
}

interface Props {
  segments: Segment[];
  value: string;
  onChange: (id: string) => void;
}

export default function SegmentedControl({ segments, value, onChange }: Props) {
  const controlRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<HTMLButtonElement[]>([]);
  const [thumb, setThumb] = useState({ width: 0, left: 0 });

  const activeIndex = segments.findIndex((segment) => segment.id === value);

  const updateThumb = useCallback(() => {
    const button = tabRefs.current[activeIndex];
    const control = controlRef.current;
    if (!button || !control || activeIndex < 0) return;

    const controlRect = control.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    setThumb({
      width: buttonRect.width,
      left: buttonRect.left - controlRect.left,
    });
  }, [activeIndex]);

  useLayoutEffect(() => {
    updateThumb();
  }, [updateThumb, value, segments]);

  useEffect(() => {
    window.addEventListener("resize", updateThumb);
    return () => window.removeEventListener("resize", updateThumb);
  }, [updateThumb]);

  return (
    <div className="segmented-control" ref={controlRef}>
      <span
        className="segmented-thumb"
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
            if (element) tabRefs.current[index] = element;
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
