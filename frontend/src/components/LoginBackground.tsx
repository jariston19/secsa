import { useMemo, type CSSProperties } from "react";

type BlobColor = "silver" | "blue" | "orange";
type BlobShape = "circle" | "ellipse" | "blob";

interface Blob {
  id: number;
  color: BlobColor;
  shape: BlobShape;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
  rotate: number;
}

const BLOB_COUNT = 9;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createBlobs(): Blob[] {
  const colors: BlobColor[] = ["silver", "blue", "orange"];
  const shapes: BlobShape[] = ["circle", "ellipse", "blob"];

  return Array.from({ length: BLOB_COUNT }, (_, id) => ({
    id,
    color: colors[id % colors.length] ?? pick(colors),
    shape: pick(shapes),
    x: randomBetween(4, 82),
    y: randomBetween(6, 78),
    size: randomBetween(140, 340),
    duration: randomBetween(22, 42),
    delay: randomBetween(0, 12),
    driftX: randomBetween(-18, 18),
    driftY: randomBetween(-14, 14),
    rotate: randomBetween(-25, 25),
  }));
}

function BlobShapeGraphic({ shape }: { shape: BlobShape }) {
  if (shape === "ellipse") {
    return <ellipse cx="50" cy="50" rx="46" ry="34" />;
  }

  if (shape === "blob") {
    return (
      <path d="M48 6c14 2 28 10 36 24 9 16 8 34-2 48-11 15-30 24-48 22C16 97 4 82 4 62 4 40 18 18 36 10 40 8 44 7 48 6z" />
    );
  }

  return <circle cx="50" cy="50" r="42" />;
}

export default function LoginBackground() {
  const blobs = useMemo(() => createBlobs(), []);

  return (
    <div className="login-background" aria-hidden>
      {blobs.map((blob) => (
        <div
          key={blob.id}
          className={`login-blob login-blob-${blob.color}`}
          style={
            {
              "--blob-x": `${blob.x}%`,
              "--blob-y": `${blob.y}%`,
              "--blob-size": `${blob.size}px`,
              "--blob-duration": `${blob.duration}s`,
              "--blob-delay": `${blob.delay}s`,
              "--blob-drift-x": `${blob.driftX}vw`,
              "--blob-drift-y": `${blob.driftY}vh`,
              "--blob-rotate": `${blob.rotate}deg`,
            } as CSSProperties
          }
        >
          <svg viewBox="0 0 100 100" className="login-blob-svg" preserveAspectRatio="xMidYMid meet">
            <BlobShapeGraphic shape={blob.shape} />
          </svg>
        </div>
      ))}
    </div>
  );
}
