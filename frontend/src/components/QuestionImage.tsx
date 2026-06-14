import { useState } from "react";
import { useAnimatedModal } from "../hooks/useAnimatedModal";

interface Props {
  src: string;
  alt?: string;
}

export default function QuestionImage({ src, alt = "Question image" }: Props) {
  const [open, setOpen] = useState(false);
  const { requestClose, overlayClass, panelClass, portal } = useAnimatedModal(() => setOpen(false));

  return (
    <>
      <button
        type="button"
        className="question-image-button"
        onClick={() => setOpen(true)}
        aria-label={`View enlarged ${alt.toLowerCase()}`}
      >
        <img src={src} alt={alt} className="question-image-thumb" />
        <span className="question-image-hint">Tap to enlarge</span>
      </button>

      {open &&
        portal(
          <div className={overlayClass} onClick={requestClose}>
            <div
              className={panelClass("question-image-lightbox")}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="question-image-lightbox-header">
                <p className="muted">Question image</p>
                <button type="button" className="btn secondary btn-sm" onClick={requestClose}>
                  Close
                </button>
              </div>
              <img src={src} alt={alt} className="question-image-full" />
            </div>
          </div>
        )}
    </>
  );
}
