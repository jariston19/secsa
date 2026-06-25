import { Info } from "lucide-react";

interface Props {
  text: string;
  label?: string;
}

export default function FieldInfoTip({ text, label = "More information" }: Props) {
  return (
    <span className="field-info-tip">
      <button
        type="button"
        className="field-info-tip-trigger"
        aria-label={label}
        aria-describedby={undefined}
      >
        <Info size={15} strokeWidth={2.25} aria-hidden />
      </button>
      <span className="field-info-tip-content" role="tooltip">
        {text}
      </span>
    </span>
  );
}
