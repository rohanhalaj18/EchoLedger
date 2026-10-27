import { Link } from "react-router-dom";
import { FlaskConical, X } from "lucide-react";
import { useState } from "react";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="demo-banner" role="note">
      <FlaskConical size={17} aria-hidden="true" />
      <p>
        <strong>Demonstration records are present.</strong> Records marked DEMO are fictional
        examples with synthetic audio. They are not historical evidence.{" "}
        <Link to="/settings">Manage demo data</Link>
      </p>
      <button
        type="button"
        className="icon-button icon-button--small"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss demonstration notice"
      >
        <X size={15} />
      </button>
    </div>
  );
}
