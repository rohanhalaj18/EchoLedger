import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  FileText,
  FlaskConical,
  GitCompareArrows,
  Info,
  Layers,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { DemoBadge } from "@/components/Badges";
import { ConsentDialog } from "@/components/ConsentDialog";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ConfirmDialog } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { useArchive } from "@/context/ArchiveContext";
import { useToast } from "@/context/ToastContext";
import { ApiError, compareRecordings } from "@/lib/api";
import { formatCount, formatDate, uid } from "@/lib/utils";
import {
  RELATIONSHIP_DESCRIPTIONS,
  RELATIONSHIP_LABELS,
  type Comparison,
  type RelationshipType,
} from "@/types";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

const relationshipOrder: RelationshipType[] = [
  "conflicting",
  "corroborating",
  "related",
  "unique",
  "uncertain",
];

export function ComparePage() {
  const {
    loading,
    recordings,
    claims,
    comparisons,
    aiStatus,
    aiStatusError,
    addComparison,
    deleteComparison,
  } = useArchive();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [consentOpen, setConsentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const initializedFromQuery = useRef(false);

  const eligible = useMemo(
    () =>
      recordings.filter(
        (recording) =>
          recording.transcriptSegments.length > 0 &&
          claims.some((claim) => claim.recordingId === recording.id),
      ),
    [recordings, claims],
  );

  useEffect(() => {
    if (loading || initializedFromQuery.current) return;
    initializedFromQuery.current = true;
    const requested = (searchParams.get("recordings") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (requested.length === 0) return;
    const valid = requested.filter((id) => eligible.some((recording) => recording.id === id));
    if (valid.length > 0) setSelectedIds(valid.slice(0, 8));
  }, [eligible, loading, searchParams]);

  const selectedRecordings = useMemo(
    () =>
      selectedIds
        .map((id) => recordings.find((recording) => recording.id === id))
        .filter((recording): recording is NonNullable<typeof recording> => Boolean(recording)),
    [selectedIds, recordings],
  );

  const selectedClaims = useMemo(
    () =>
      claims.filter(
        (claim) =>
          selectedIds.includes(claim.recordingId) && claim.evidenceStatus === "valid",
      ),
    [claims, selectedIds],
  );

  const mismatchedCount = useMemo(
    () =>
      claims.filter(
        (claim) =>
          selectedIds.includes(claim.recordingId) && claim.evidenceStatus === "quote-mismatch",
      ).length,
    [claims, selectedIds],
  );

  const totalSegments = selectedRecordings.reduce(
    (total, recording) => total + recording.transcriptSegments.length,
    0,
  );
  const aiConfigured = Boolean(aiStatus?.configured);
  const canCompare =
    selectedRecordings.length >= 2 && selectedClaims.length >= 2 && aiConfigured;

  const toggleRecording = (id: string) => {
    setSelectedIds((previous) => {
      if (previous.includes(id)) return previous.filter((value) => value !== id);
      if (previous.length >= 8) {
        notify("Compare at most eight recordings at a time.", "info");
        return previous;
      }
      return [...previous, id];
    });
  };

  const handleCompare = () => {
    if (!aiConfigured) {
      notify("Gemini is not configured. Add a server API key to generate a comparison.", "error");
      return;
    }
    if (selectedRecordings.length < 2) {
      notify("Select at least two recordings with claims.", "error");
      return;
    }
    if (selectedClaims.length < 2) {
      notify("At least two evidence-valid claims are needed for a comparison.", "error");
      return;
    }
    setConsentOpen(true);
  };

  const confirmCompare = async () => {
    setBusy(true);
    try {
      const result = await compareRecordings(selectedRecordings, selectedClaims);
      const warnings = [...result.warnings];
      if (selectedRecordings.some((recording) => recording.isDemo)) {
        warnings.push(
          "This comparison includes fictional demonstration records. Do not cite it as historical evidence.",
        );
      }
      const comparison: Comparison = {
        id: uid("comparison"),
        title: result.title,
        summary: result.summary,
        recordingIds: selectedRecordings.map((recording) => recording.id),
        groups: result.groups.map((group) => ({
          ...group,
          id: group.id ?? uid("group"),
        })),
        ungroupedClaimIds: result.ungroupedClaimIds,
        createdAt: new Date().toISOString(),
        model: result.model,
        isDemo: selectedRecordings.every((recording) => recording.isDemo),
        disclaimer: result.disclaimer,
        warnings: [...new Set(warnings)],
      };
      await addComparison(comparison);
      notify("Comparison saved as a provisional research note.", "success");
      navigate(`/comparisons/${comparison.id}`);
    } catch (compareError) {
      notify(errorMessage(compareError), "error");
    } finally {
      setBusy(false);
      setConsentOpen(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await deleteComparison(deletingId);
      notify("Comparison deleted. Source recordings and claims are unchanged.", "success");
      setDeletingId(null);
    } catch (deleteError) {
      notify(errorMessage(deleteError), "error");
    } finally {
      setDeleting(false);
    }
  };

  const relationshipCounts = (comparison: Comparison) => {
    const counts = new Map<RelationshipType, number>();
    for (const group of comparison.groups) {
      counts.set(group.relationship, (counts.get(group.relationship) ?? 0) + 1);
    }
    return relationshipOrder
      .map((relationship) => ({ relationship, count: counts.get(relationship) ?? 0 }))
      .filter((item) => item.count > 0);
  };

  if (loading) return <LoadingState />;

  return (
    <>
      <PageHeader
        eyebrow="Cross-account analysis"
        title="Compare accounts, not verdicts"
        description="Place claims from different narrators side by side. Gemini can propose relationships, but it does not decide who is right. Every grouping remains provisional and every quotation stays attached."
        actions={
          <>
            <Link to="/library" className="button button--ghost">
              <FileText size={15} aria-hidden="true" /> Browse sources
            </Link>
            <Link to="/recordings/new" className="button button--primary">
              <Plus size={16} aria-hidden="true" /> Add a recording
            </Link>
          </>
        }
        meta={
          <>
            <span>{formatCount(comparisons.length, "saved comparison")}</span>
            <span>{formatCount(eligible.length, "comparable recording")}</span>
          </>
        }
      />

      <div className="notice notice--info" style={{ marginBottom: 18 }}>
        <ShieldCheck size={17} aria-hidden="true" />
        <div className="notice__body">
          <strong className="notice__title">A relationship label is not a truth verdict</strong>
          <p>
            “Shared account” means the narrators broadly agree; “conflicting accounts” means their
            statements cannot both be true as stated. Neither label establishes historical fact, and a
            single account is not false simply because nobody else mentioned it.
          </p>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel">
            <div className="panel__header">
              <div>
                <h2>Choose recordings</h2>
                <p>Only recordings with at least one claim are eligible. Select two to eight.</p>
              </div>
              {selectedIds.length > 0 ? (
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => setSelectedIds([])}
                >
                  Clear selection
                </button>
              ) : null}
            </div>
            <div className="panel__body stack">
              {eligible.length === 0 ? (
                <EmptyState
                  compact
                  icon={<GitCompareArrows size={21} />}
                  title="No comparable recordings yet"
                  description="A recording becomes comparable once it has a transcript and at least one evidence-linked claim. Add a record or extract claims from an existing transcript."
                  actions={
                    <>
                      <Link to="/recordings/new" className="button button--primary button--small">
                        Add a recording
                      </Link>
                      <Link to="/library" className="button button--ghost button--small">
                        Open archive
                      </Link>
                    </>
                  }
                />
              ) : (
                <div className="compare-picker">
                  {eligible.map((recording) => {
                    const recordingClaims = claims.filter(
                      (claim) => claim.recordingId === recording.id,
                    );
                    const selected = selectedIds.includes(recording.id);
                    return (
                      <label
                        key={recording.id}
                        className={`picker-card ${selected ? "picker-card--selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRecording(recording.id)}
                        />
                        <span className="picker-card__body">
                          <strong>{recording.title}</strong>
                          <span>
                            {recording.speaker} · {recording.language}
                          </span>
                          <span className="picker-card__meta">
                            <span>{formatCount(recordingClaims.length, "claim")}</span>
                            <span>{formatCount(recording.transcriptSegments.length, "segment")}</span>
                            {recording.isDemo ? <DemoBadge compact /> : null}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="compare-summary">
                <div className="compare-summary__counts">
                  <div className="compare-summary__count">
                    <strong>{selectedRecordings.length}</strong>
                    <span>recordings selected</span>
                  </div>
                  <div className="compare-summary__count">
                    <strong>{selectedClaims.length}</strong>
                    <span>valid claims</span>
                  </div>
                  <div className="compare-summary__count">
                    <strong>{totalSegments}</strong>
                    <span>transcript segments</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={handleCompare}
                  disabled={!canCompare || busy}
                >
                  {busy ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
                  {busy ? "Comparing…" : "Compare with Gemini"}
                </button>
              </div>

              {mismatchedCount > 0 ? (
                <div className="notice notice--warning">
                  <TriangleAlert size={16} aria-hidden="true" />
                  <div className="notice__body">
                    <p>
                      {mismatchedCount} claim{mismatchedCount === 1 ? "" : "s"} in the selected records
                      no longer match their source transcript and will be excluded. Re-check them in the
                      claim explorer first.
                    </p>
                  </div>
                </div>
              ) : null}

              {!aiConfigured ? (
                <div className="notice notice--warning">
                  <Sparkles size={16} aria-hidden="true" />
                  <div className="notice__body">
                    <strong className="notice__title">
                      {aiStatusError ? "The local API server is unreachable" : "Gemini is not configured"}
                    </strong>
                    <p>
                      Saved comparisons remain readable. To generate a new one, add{" "}
                      <code>GEMINI_API_KEY</code> to the root <code>.env</code> and restart the server.{" "}
                      <Link to="/settings">AI settings</Link>.
                    </p>
                  </div>
                </div>
              ) : null}

              {selectedRecordings.length < 2 ? (
                <p className="help">
                  Select at least two recordings. A comparison of one account would only produce
                  “unique” labels, which the archive can already show.
                </p>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <h2>Saved comparisons</h2>
                <p>Provisional research notes. Re-open them to inspect every quotation.</p>
              </div>
              <span className="badge badge--neutral">{comparisons.length}</span>
            </div>
            <div className="panel__body">
              {comparisons.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Layers size={20} />}
                  title="No comparisons saved"
                  description="Select recordings above and generate a comparison. Nothing is saved until you review and the server returns validated claim IDs."
                />
              ) : (
                <div className="comparison-list">
                  {comparisons.map((comparison) => {
                    const counts = relationshipCounts(comparison);
                    return (
                      <div key={comparison.id} className="comparison-card">
                        <div className="comparison-card__top">
                          <div>
                            <Link to={`/comparisons/${comparison.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                              <h3>{comparison.title}</h3>
                            </Link>
                            <p className="comparison-card__summary">{comparison.summary}</p>
                          </div>
                          <div className="comparison-card__actions">
                            <button
                              type="button"
                              className="icon-button icon-button--small"
                              onClick={() => setDeletingId(comparison.id)}
                              aria-label={`Delete comparison ${comparison.title}`}
                            >
                              <Trash2 size={14} />
                            </button>
                            <Link
                              to={`/comparisons/${comparison.id}`}
                              className="button button--ghost button--small"
                            >
                              Open <ArrowRight size={12} aria-hidden="true" />
                            </Link>
                          </div>
                        </div>
                        <div className="comparison-card__meta">
                          <span>
                            {formatCount(comparison.recordingIds.length, "recording")}
                          </span>
                          <span>{formatCount(comparison.groups.length, "group")}</span>
                          {counts.slice(0, 3).map((item) => (
                            <span key={item.relationship}>
                              {item.count} {RELATIONSHIP_LABELS[item.relationship].toLowerCase()}
                            </span>
                          ))}
                          <span>{formatDate(comparison.createdAt)}</span>
                          {comparison.isDemo ? <DemoBadge compact /> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="detail-aside">
          <section className="panel">
            <div className="panel__header">
              <div>
                <h3>Relationship labels</h3>
                <p>Descriptive, never adjudicative.</p>
              </div>
            </div>
            <div className="panel__body">
              <div className="relationship-legend">
                {relationshipOrder.map((relationship) => (
                  <div key={relationship} className="relationship-legend__row">
                    <span className={`relationship-badge relationship-badge--${relationship}`}>
                      <span className="relationship-badge__dot" aria-hidden="true" />
                      {RELATIONSHIP_LABELS[relationship]}
                    </span>
                    <span>{RELATIONSHIP_DESCRIPTIONS[relationship]}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel panel--muted">
            <div className="panel__body stack stack--sm">
              <h3>What Gemini receives</h3>
              <ul className="integrity-list">
                <li>
                  <Info size={14} aria-hidden="true" /> Recording metadata: title, narrator, language,
                  place and period.
                </li>
                <li>
                  <Info size={14} aria-hidden="true" /> Selected transcript segments for context.
                </li>
                <li>
                  <Info size={14} aria-hidden="true" /> Claims with their verbatim quotations, basis and
                  uncertainty.
                </li>
                <li>
                  <Info size={14} aria-hidden="true" /> No audio files and no researcher notes.
                </li>
              </ul>
              <p className="help">
                The server checks every claim ID and quotation against the selected transcripts before
                and after the model responds. Invalid references are removed.
              </p>
            </div>
          </section>

          <div className="notice notice--warning">
            <FlaskConical size={16} aria-hidden="true" />
            <div className="notice__body">
              <strong className="notice__title">Demo comparisons are fictional</strong>
              <p>
                The Nilavari Lake comparison is invented to demonstrate conflicting origins and shared
                rituals. It is not a historical case study.
              </p>
            </div>
          </div>

          <section className="panel">
            <div className="panel__body stack stack--sm">
              <h3>What a good comparison does</h3>
              <p className="small muted">
                Keeps disagreement visible, distinguishes shared practice from shared explanation, and
                records uncertainty instead of forcing a synthesis. Export the comparison with its
                warnings so readers can see what was provisional.
              </p>
            </div>
          </section>
        </aside>
      </div>

      <ConsentDialog
        open={consentOpen}
        title="Send selected material to Gemini?"
        operation="Gemini will group claims and propose provisional relationship labels."
        dataSummary={[
          `${selectedRecordings.length} recordings: ${selectedRecordings.map((recording) => recording.title).join("; ")}`,
          `${selectedClaims.length} claims with verbatim quotations`,
          `${totalSegments} transcript segments used as context`,
          "No audio is sent. No researcher notes are sent.",
          ...(selectedRecordings.some((recording) => recording.isDemo)
            ? ["Selected material includes fictional demonstration records."]
            : []),
        ]}
        onCancel={() => {
          if (!busy) setConsentOpen(false);
        }}
        onConfirm={() => void confirmCompare()}
        busy={busy}
        confirmLabel="I consent — compare accounts"
      />

      <ConfirmDialog
        open={deletingId !== null}
        title="Delete this comparison?"
        description="The saved comparison and its provisional relationship labels will be removed. Source recordings, transcripts and claims are not affected."
        confirmLabel="Delete comparison"
        destructive
        busy={deleting}
        onCancel={() => setDeletingId(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
