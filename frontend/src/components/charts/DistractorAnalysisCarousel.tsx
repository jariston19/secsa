import { useEffect, useMemo, useState } from "react";
import { DistractorBarChart } from "./AnalyticsCharts";

const DISTRACTOR_PAGE_SIZE = 3;

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
  const [page, setPage] = useState(0);

  const itemSignature = useMemo(
    () => items.map((item) => item.questionId).join("|"),
    [items]
  );

  useEffect(() => {
    setPage(0);
  }, [resetKey, itemSignature]);

  const pageCount = Math.max(1, Math.ceil(items.length / DISTRACTOR_PAGE_SIZE));

  const pages = useMemo(
    () =>
      Array.from({ length: pageCount }, (_, pageIndex) =>
        items.slice(
          pageIndex * DISTRACTOR_PAGE_SIZE,
          pageIndex * DISTRACTOR_PAGE_SIZE + DISTRACTOR_PAGE_SIZE
        )
      ),
    [items, pageCount]
  );

  useEffect(() => {
    const maxPage = Math.max(0, pageCount - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, pageCount]);

  if (items.length === 0) return null;

  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * DISTRACTOR_PAGE_SIZE;
  const pageEnd = pageStart + (pages[safePage]?.length ?? 0);

  const canGoPrevious = safePage > 0;
  const canGoNext = safePage < pageCount - 1;

  return (
    <>
      <div className="chart-distractor-carousel analytics-chart-screen-only">
        <div className="chart-distractor-carousel-body analytics-no-print">
          <button
            type="button"
            className="chart-distractor-carousel-arrow btn secondary btn-sm"
            disabled={!canGoPrevious}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            aria-label="Previous questions"
          >
            ‹
          </button>

          <div className="chart-distractor-carousel-viewport">
            <div
              className="chart-distractor-carousel-track"
              style={{ transform: `translate3d(-${safePage * 100}%, 0, 0)` }}
            >
              {pages.map((pageItems, pageIndex) => (
                <div
                  key={pageItems.map((item) => item.questionId).join("|") || `page-${pageIndex}`}
                  className="chart-distractor-carousel-slide"
                  aria-hidden={pageIndex !== safePage}
                >
                  {pageItems.map((item) => (
                    <DistractorQuestionSlide
                      key={item.questionId}
                      item={item}
                      yearLabel={yearLabel}
                      truncate={truncate}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="chart-distractor-carousel-arrow btn secondary btn-sm"
            disabled={!canGoNext}
            onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            aria-label="Next questions"
          >
            ›
          </button>
        </div>

        <p className="muted chart-distractor-carousel-label analytics-no-print" aria-live="polite">
          Questions {pageStart + 1}–{pageEnd} of {items.length}
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
