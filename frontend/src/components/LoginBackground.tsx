import Grainient from "./Grainient";
import { useTheme } from "../lib/theme";

const LOGIN_GRAINIENT = {
  light: {
    color1: "#d4dbe6",
    color2: "#ff9a3c",
    color3: "#812294",
  },
  dark: {
    color1: "#3a1f42",
    color2: "#9d4aab",
    color3: "#2a0d31",
  },
} as const;

export default function LoginBackground() {
  const { theme } = useTheme();
  const palette = LOGIN_GRAINIENT[theme];
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="login-background" aria-hidden>
      <Grainient
        timeSpeed={reducedMotion ? 0 : 0.18}
        colorBalance={0}
        warpStrength={0.85}
        warpFrequency={4}
        warpSpeed={reducedMotion ? 0 : 1.2}
        warpAmplitude={60}
        blendAngle={0}
        blendSoftness={0.14}
        rotationAmount={reducedMotion ? 0 : 280}
        noiseScale={1.2}
        grainAmount={0}
        grainScale={2}
        grainAnimated={false}
        contrast={1.15}
        gamma={1}
        saturation={1}
        zoom={0.9}
        color1={palette.color1}
        color2={palette.color2}
        color3={palette.color3}
      />
    </div>
  );
}
