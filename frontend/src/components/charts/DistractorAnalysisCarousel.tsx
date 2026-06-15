import { useEffect, useMemo, useState } from "react";
import { DistractorBarChart } from "./AnalyticsCharts";

export interface DistractorAnalysisItem {
  questionId: string;
  text: string;
  subject: string;
  correctOption: string;
  correctRate: number;
  options: Array<{ option: string; count: number; rate: number; isCorrect: boolean }>;
}

interface Props {
  items: DistractorAnalysisItem[];
  resetKey?: string;
  yearLabel?: string;
  truncate?: (text: string, max?: number) => string;
}

function DistractorQuestionSlide({
  item,
  yearLabel,
  truncate,
}: {
  item: DistractorAnalysisItem;
  yearLabel?: string;
  truncate: (text: string, max?: number) => string;
}) {
  return (
    <div className="chart-distractor-item">
      <p className="chart-distractor-question" title={item.text}>
        {truncate(item.text, 120)}
      </p>
      <p className="muted chart-distractor-meta">
        {yearLabel ? `${yearLabel} · ` : ""}
        {item.subject} · {item.correctRate.toFixed(0)}% correct
      </p>
      <DistractorBarChart options={item.options} correctOption={item.correctOption} />
    </div>
  );
}

export default function DistractorAnalysisCarousel({
  items,
  resetKey = "",
  yearLabel,
  truncate = (text) => text,
}: Props) {
  const [index, setIndex] = useState(0);

  const itemSignature = useMemo(
    () => items.map((item) => item.questionId).join("|"),
    [items]
  );

  useEffect(() => {
    setIndex(0);
  }, [resetKey, itemSignature]);

  const safeIndex = items.length === 0 ? 0 : Math.min(index, items.length - 1);

  useEffect(() => {
    if (safeIndex !== index) {
      setIndex(safeIndex);
    }
  }, [index, safeIndex]);

  if (items.length === 0) return null;

  const current = items[safeIndex];
  if (!current) return null;

  const canGoPrevious = safeIndex > 0;
  const canGoNext = safeIndex < items.length - 1;

  return (
    <>
      <div className="chart-distractor-carousel analytics-chart-screen-only">
        <div className="chart-distractor-carousel-body analytics-no-print">
          <button
            type="button"
            className="chart-distractor-carousel-arrow btn secondary btn-sm"
            disabled={!canGoPrevious}
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            aria-label="Previous question"
          >
            ‹
          </button>

          <div className="chart-distractor-carousel-slide">
            <DistractorQuestionSlide
              item={current}
              yearLabel={yearLabel}
              truncate={truncate}
            />
          </div>

          <button
            type="button"
            className="chart-distractor-carousel-arrow btn secondary btn-sm"
            disabled={!canGoNext}
            onClick={() => setIndex((value) => Math.min(items.length - 1, value + 1))}
            aria-label="Next question"
          >
            ›
          </button>
        </div>

        <p className="muted chart-distractor-carousel-label analytics-no-print">
          Question {safeIndex + 1} of {items.length}
        </p>
      </div>

      <div className="chart-distractor-grid analytics-print-only">
        {items.map((item) => (
          <DistractorQuestionSlide
            key={item.questionId}
            item={item}
            yearLabel={yearLabel}
            truncate={truncate}
          />
        ))}
      </div>
    </>
  );
}
