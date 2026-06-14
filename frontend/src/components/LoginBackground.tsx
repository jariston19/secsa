import { useMemo, type CSSProperties } from "react";

type BlobColor = "silver" | "blue" | "orange";
type BlobShape = "circle" | "ellipse";

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

const BLOB_COUNT = 14;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickRoundShape(): BlobShape {
  return Math.random() < 0.72 ? "circle" : "ellipse";
}

function pickBlobColor(): BlobColor {
  const roll = Math.random();
  if (roll < 0.6) return "orange";
  if (roll < 0.82) return "blue";
  return "silver";
}

function createBlobs(): Blob[] {
  return Array.from({ length: BLOB_COUNT }, (_, id) => ({
    id,
    color: pickBlobColor(),
    shape: pickRoundShape(),
    x: randomBetween(2, 88),
    y: randomBetween(4, 84),
    size: randomBetween(100, 320),
    duration: randomBetween(4, 9),
    delay: randomBetween(0, 2),
    driftX: randomBetween(-18, 18),
    driftY: randomBetween(-14, 14),
    rotate: randomBetween(-25, 25),
  }));
}

function BlobShapeGraphic({ shape }: { shape: BlobShape }) {
  if (shape === "ellipse") {
    return <ellipse cx="50" cy="50" rx="42" ry="38" />;
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
