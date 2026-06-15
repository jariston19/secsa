import { useMemo, type CSSProperties } from "react";

type BlobColor = "silver" | "blue" | "orange";
type BlobShape = "circle" | "ellipse";

interface Blob {
  id: number;
  color: BlobColor;
  shape: BlobShape;
  fast: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  ellipseRx: number;
  ellipseRy: number;
  circleR: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
  rotate: number;
  waypoints?: Array<{ x: number; y: number; rotate: number; scale: number }>;
}

const BLOB_COUNT = 18;
const FAST_BLOB_COUNT = 3;

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

function createSpreadPositions(count: number) {
  const cols = 6;
  const rows = Math.ceil(count / cols);
  const cellWidth = 100 / cols;
  const cellHeight = 100 / rows;

  const positions = Array.from({ length: count }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    return {
      x: (col + 0.5) * cellWidth + randomBetween(-cellWidth * 0.38, cellWidth * 0.38),
      y: (row + 0.5) * cellHeight + randomBetween(-cellHeight * 0.38, cellHeight * 0.38),
    };
  });

  for (let i = positions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  return positions;
}

function createFastWaypoints() {
  return Array.from({ length: 5 }, () => ({
    x: randomBetween(-12, 12),
    y: randomBetween(-10, 10),
    rotate: randomBetween(-8, 8),
    scale: randomBetween(0.96, 1.04),
  }));
}

function pickBlobDimensions() {
  const base = randomBetween(110, 520);
  const stretch = randomBetween(0.62, 1.55);
  const wide = Math.random() < 0.5;

  const width = Math.round(wide ? base * stretch : base);
  const height = Math.round(wide ? base : base * stretch);

  return {
    width,
    height,
    ellipseRx: randomBetween(34, 46),
    ellipseRy: randomBetween(30, 44),
    circleR: randomBetween(34, 44),
  };
}

function createBlobs(): Blob[] {
  const fastIds = new Set<number>();
  while (fastIds.size < FAST_BLOB_COUNT) {
    fastIds.add(Math.floor(Math.random() * BLOB_COUNT));
  }

  const positions = createSpreadPositions(BLOB_COUNT);

  return Array.from({ length: BLOB_COUNT }, (_, id) => {
    const fast = fastIds.has(id);
    const dimensions = pickBlobDimensions();
    const position = positions[id];

    return {
      id,
      fast,
      color: pickBlobColor(),
      shape: pickRoundShape(),
      x: position.x,
      y: position.y,
      width: dimensions.width,
      height: dimensions.height,
      ellipseRx: dimensions.ellipseRx,
      ellipseRy: dimensions.ellipseRy,
      circleR: dimensions.circleR,
      duration: fast ? randomBetween(55, 95) : randomBetween(4, 9),
      delay: randomBetween(0, 2),
      driftX: fast ? 0 : randomBetween(-24, 24),
      driftY: fast ? 0 : randomBetween(-20, 20),
      rotate: fast ? 0 : randomBetween(-25, 25),
      waypoints: fast ? createFastWaypoints() : undefined,
    };
  });
}

function blobStyle(blob: Blob): CSSProperties {
  const style: Record<string, string | number> = {
    "--blob-x": `${blob.x}%`,
    "--blob-y": `${blob.y}%`,
    "--blob-width": `${blob.width}px`,
    "--blob-height": `${blob.height}px`,
    "--blob-duration": `${blob.duration}s`,
    "--blob-delay": `${blob.delay}s`,
    "--blob-drift-x": `${blob.driftX}vw`,
    "--blob-drift-y": `${blob.driftY}vh`,
    "--blob-rotate": `${blob.rotate}deg`,
  };

  blob.waypoints?.forEach((point, index) => {
    const step = index + 1;
    style[`--blob-w${step}-x`] = `${point.x}vw`;
    style[`--blob-w${step}-y`] = `${point.y}vh`;
    style[`--blob-w${step}-rotate`] = `${point.rotate}deg`;
    style[`--blob-w${step}-scale`] = point.scale;
  });

  return style as CSSProperties;
}

function BlobShapeGraphic({
  shape,
  ellipseRx,
  ellipseRy,
  circleR,
}: {
  shape: BlobShape;
  ellipseRx: number;
  ellipseRy: number;
  circleR: number;
}) {
  if (shape === "ellipse") {
    return <ellipse cx="50" cy="50" rx={ellipseRx} ry={ellipseRy} />;
  }

  return <circle cx="50" cy="50" r={circleR} />;
}

export default function LoginBackground() {
  const blobs = useMemo(() => createBlobs(), []);

  return (
    <div className="login-background" aria-hidden>
      {blobs.map((blob) => (
        <div
          key={blob.id}
          className={`login-blob login-blob-${blob.color}${blob.fast ? " login-blob-fast" : ""}`}
          style={blobStyle(blob)}
        >
          <svg viewBox="0 0 100 100" className="login-blob-svg" preserveAspectRatio="xMidYMid meet">
            <BlobShapeGraphic
              shape={blob.shape}
              ellipseRx={blob.ellipseRx}
              ellipseRy={blob.ellipseRy}
              circleR={blob.circleR}
            />
          </svg>
        </div>
      ))}
    </div>
  );
}
