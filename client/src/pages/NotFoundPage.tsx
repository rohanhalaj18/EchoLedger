import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="not-found">
      <p className="not-found__code">404</p>
      <h1>This page is not in the ledger.</h1>
      <p>
        The route may have changed, or the record was removed from this browser&apos;s local archive.
        Your other research material is untouched.
      </p>
      <div className="not-found__actions">
        <Link to="/" className="button button--primary">
          <ArrowLeft size={16} aria-hidden="true" /> Back to overview
        </Link>
        <Link to="/library" className="button button--ghost">
          <Compass size={16} aria-hidden="true" /> Browse the archive
        </Link>
      </div>
    </div>
  );
}
