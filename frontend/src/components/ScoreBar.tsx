interface Props {
  label: string;
  value: number;
  max?: number;
  tone?: "strong" | "moderate" | "weak" | "neutral";
  suffix?: string;
}

export default function ScoreBar({
  label,
  value,
  max = 100,
  tone = "neutral",
  suffix = "%",
}: Props) {
  const width = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="score-bar-row">
      <span className="score-bar-label">{label}</span>
      <div className="score-bar-track" role="presentation">
        <span
          className={`score-bar-fill score-bar-fill-${tone}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="score-bar-value">
        {value.toFixed(1)}
        {suffix}
      </span>
    </div>
  );
}
