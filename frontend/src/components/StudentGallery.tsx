import { useCallback, useEffect, useState } from "react";

const GALLERY_MANIFEST_URL = "/gallery/manifest.json";

type GalleryManifestEntry = string | { file: string; caption?: string };

type GallerySlide = {
  src: string;
  caption?: string;
};

function normalizeManifest(entries: unknown): GallerySlide[] {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry): GallerySlide | null => {
      if (typeof entry === "string" && entry.trim()) {
        const file = entry.trim();
        return { src: `/gallery/${file}` };
      }

      if (entry && typeof entry === "object" && "file" in entry) {
        const file = String((entry as { file: string }).file).trim();
        if (!file) return null;
        const caption =
          "caption" in entry && typeof entry.caption === "string"
            ? entry.caption.trim()
            : undefined;
        return { src: `/gallery/${file}`, caption: caption || undefined };
      }

      return null;
    })
    .filter((slide): slide is GallerySlide => slide !== null);
}

export default function StudentGallery() {
  const [slides, setSlides] = useState<GallerySlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    fetch(GALLERY_MANIFEST_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Gallery manifest not found.");
        }
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (cancelled) return;
        setSlides(normalizeManifest(data));
        setIndex(0);
      })
      .catch((err) => {
        if (cancelled) return;
        setSlides([]);
        setError(err instanceof Error ? err.message : "Failed to load gallery.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const safeIndex = slides.length === 0 ? 0 : Math.min(index, slides.length - 1);
  const current = slides[safeIndex];

  const goPrevious = useCallback(() => {
    setIndex((value) => Math.max(0, value - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((value) => Math.min(slides.length - 1, value + 1));
  }, [slides.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (slides.length <= 1) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrevious, slides.length]);

  return (
    <section className="card student-gallery-card">
      <header className="student-gallery-header">
        <div>
          <h2>Gallery</h2>
          <p className="muted section-desc">Photos and highlights from SECSA.</p>
        </div>
      </header>

      {loading ? <p className="muted">Loading gallery...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error && slides.length === 0 ? (
        <p className="muted student-gallery-empty">
          No gallery images yet. Add files to <code>frontend/public/gallery/</code> and list them in{" "}
          <code>frontend/public/gallery/manifest.json</code>.
        </p>
      ) : null}

      {!loading && current ? (
        <div className="student-gallery-carousel" role="region" aria-label="Image gallery carousel">
          <div className="student-gallery-carousel-body">
            <button
              type="button"
              className="student-gallery-arrow btn secondary btn-sm"
              disabled={safeIndex === 0}
              onClick={goPrevious}
              aria-label="Previous image"
            >
              ‹
            </button>

            <figure className="student-gallery-slide">
              <img src={current.src} alt={current.caption ?? `Gallery image ${safeIndex + 1}`} />
              {current.caption ? (
                <figcaption className="student-gallery-caption">{current.caption}</figcaption>
              ) : null}
            </figure>

            <button
              type="button"
              className="student-gallery-arrow btn secondary btn-sm"
              disabled={safeIndex >= slides.length - 1}
              onClick={goNext}
              aria-label="Next image"
            >
              ›
            </button>
          </div>

          <p className="muted student-gallery-counter">
            Image {safeIndex + 1} of {slides.length}
          </p>

          {slides.length > 1 ? (
            <div className="student-gallery-dots" role="tablist" aria-label="Gallery slides">
              {slides.map((slide, dotIndex) => (
                <button
                  key={slide.src}
                  type="button"
                  role="tab"
                  className={`student-gallery-dot${dotIndex === safeIndex ? " is-active" : ""}`}
                  aria-label={`Go to image ${dotIndex + 1}`}
                  aria-selected={dotIndex === safeIndex}
                  onClick={() => setIndex(dotIndex)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
