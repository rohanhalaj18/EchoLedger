import { LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Opening your local archive…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle size={22} className="spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function InlineLoading({ label }: { label: string }) {
  return (
    <span className="inline-loading" role="status">
      <LoaderCircle size={14} className="spin" aria-hidden="true" />
      {label}
    </span>
  );
}
