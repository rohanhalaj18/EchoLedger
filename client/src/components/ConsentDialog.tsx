import { useEffect, useState } from "react";
import { Check, ExternalLink, LoaderCircle, ShieldAlert } from "lucide-react";
import { Modal } from "@/components/Modal";
import { cn } from "@/lib/utils";

type ConsentDialogProps = {
  open: boolean;
  title: string;
  operation: string;
  dataSummary: string[];
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  confirmLabel?: string;
};

export function ConsentDialog({
  open,
  title,
  operation,
  dataSummary,
  onCancel,
  onConfirm,
  busy = false,
  confirmLabel = "I consent — send to Gemini",
}: ConsentDialogProps) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (open) setChecked(false);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title={title}
      description="This step uses the Google Gemini API. It requires an internet connection and is not part of the local-only workflow."
      size="md"
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={onConfirm}
            disabled={!checked || busy}
          >
            {busy ? <LoaderCircle size={16} className="spin" /> : <ShieldAlert size={16} />}
            {busy ? "Sending to Gemini…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="consent">
        <div className="consent__notice">
          <ShieldAlert size={20} aria-hidden="true" />
          <div>
            <strong>{operation}</strong>
            <p>
              EchoLedger will send the material listed below to Google Gemini for processing. Google's
              terms and data-handling policies apply. Do not send recordings you are not authorised to
              share.
            </p>
          </div>
        </div>

        <div>
          <h3 className="consent__heading">What leaves this device</h3>
          <ul className="consent__list">
            {dataSummary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="consent__columns">
          <div>
            <h3 className="consent__heading">What EchoLedger keeps local</h3>
            <p className="small muted">
              Your recordings, transcripts, claims, comparisons and notes stay in this browser's
              IndexedDB. The local server deletes temporary audio uploads after the request.
            </p>
          </div>
          <div>
            <h3 className="consent__heading">What to expect</h3>
            <p className="small muted">
              AI output can be incomplete, inaccurate or biased. Every claim and relationship is
              provisional and must be checked against the original quotation and audio.
            </p>
          </div>
        </div>

        <label className={cn("checkbox-card", checked && "checkbox-card--checked")}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            disabled={busy}
          />
          <span className="checkbox-card__box" aria-hidden="true">
            {checked ? <Check size={14} /> : null}
          </span>
          <span>
            I understand that this material will be sent to Google Gemini, and I have the right to
            share it.
          </span>
        </label>

        <a
          className="inline-link small"
          href="https://ai.google.dev/gemini-api/terms"
          target="_blank"
          rel="noreferrer"
        >
          Read the Gemini API terms <ExternalLink size={13} />
        </a>
      </div>
    </Modal>
  );
}
