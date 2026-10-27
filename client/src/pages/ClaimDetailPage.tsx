import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock3,
  FileText,
  FlaskConical,
  GitCompareArrows,
  Languages,
  LoaderCircle,
  MessageSquareQuote,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserRound,
  Volume2,
} from "lucide-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import {
  BasisBadge,
  ClaimTypeBadge,
  DemoBadge,
  RelationshipBadge,
  UncertaintyBadge,
} from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ConfirmDialog } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { useArchive } from "@/context/ArchiveContext";
import { useToast } from "@/context/ToastContext";
import {
  formatDate,
  formatDateTime,
  formatSeconds,
  revalidateClaim,
} from "@/lib/utils";
import { UNCERTAINTY_LEVELS, type Uncertainty } from "@/types";

const timestampSourceLabels = {
  "gemini-word": "Gemini word offsets",
  segment: "Transcript cue / segment timing",
  none: "No verified timing",
} as const;

export function ClaimDetailPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const { loading, recordings, claims, comparisons, updateClaim, deleteClaim } = useArchive();
  const { notify } = useToast();

  const claim = claims.find((item) => item.id === claimId);
  const recording = recordings.find((item) => item.id === claim?.recordingId);
  const relationships = comparisons.flatMap((comparison) =>
    comparison.groups
      .filter((group) => group.claimIds.includes(claimId ?? ""))
      .map((group) => ({
        comparisonId: comparison.id,
        comparisonTitle: comparison.title,
        topic: group.topic,
        relationship: group.relationship,
        rationale: group.rationale,
        confidence: group.confidence,
        isDemo: comparison.isDemo,
      })),
  );

  const [notes, setNotes] = useState(claim?.researcherNotes ?? "");
  const [uncertainty, setUncertainty] = useState<Uncertainty>(claim?.uncertainty ?? "medium");
  const [busy, setBusy] = useState<"review" | "recheck" | "delete" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setNotes(claim?.researcherNotes ?? "");
    setUncertainty(claim?.uncertainty ?? "medium");
  }, [claim?.id, claim?.researcherNotes, claim?.uncertainty]);

  if (loading) return <LoadingState />;

  if (!claim) {
    return (
      <EmptyState
        icon={<MessageSquareQuote size={22} />}
        title="Claim not found"
        description="This claim is not in the current local archive. It may have been deleted, or its recording may have been removed."
        actions={
          <Link to="/claims" className="button button--primary">
            <ArrowLeft size={15} aria-hidden="true" /> Back to claim explorer
          </Link>
        }
      />
    );
  }

  const evidenceIds = new Set([claim.evidence.segmentId, ...claim.evidence.segmentIds].filter(Boolean));
  const evidenceIndex = recording
    ? recording.transcriptSegments.findIndex((segment) => evidenceIds.has(segment.id))
    : -1;
  const contextSegments =
    recording && evidenceIndex >= 0
      ? recording.transcriptSegments.slice(
          Math.max(0, evidenceIndex - 1),
          Math.min(recording.transcriptSegments.length, evidenceIndex + 2),
        )
      : [];
  const evidenceSegment = recording?.transcriptSegments.find((segment) =>
    evidenceIds.has(segment.id),
  );
  const dirty = notes !== claim.researcherNotes || uncertainty !== claim.uncertainty;
  const hasVerifiedTiming = claim.evidence.startSeconds !== null;

  const saveReview = async () => {
    setBusy("review");
    try {
      await updateClaim({ ...claim, researcherNotes: notes.trim(), uncertainty });
      notify("Researcher review saved. The narrator's quotation was not changed.", "success");
    } catch (saveError) {
      notify(
        saveError instanceof Error ? saveError.message : "The review could not be saved.",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  const recheckEvidence = async () => {
    if (!recording) {
      notify("The source recording is not available, so the quotation cannot be re-checked.", "error");
      return;
    }
    setBusy("recheck");
    try {
      const updated = revalidateClaim(claim, recording);
      await updateClaim(updated);
      if (updated.evidenceStatus === "valid") {
        notify("Quotation found in the current transcript. Evidence status restored.", "success");
      } else {
        notify(
          "The quotation still does not appear in the current transcript. The claim remains flagged; edit the transcript or claim deliberately.",
          "error",
        );
      }
    } catch (recheckError) {
      notify(
        recheckError instanceof Error ? recheckError.message : "Evidence could not be re-checked.",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy("delete");
    try {
      await deleteClaim(claim.id);
      notify("Claim deleted. Any comparisons that referenced it were updated.", "success");
      navigate(recording ? `/recordings/${recording.id}` : "/claims");
    } catch (deleteError) {
      notify(
        deleteError instanceof Error ? deleteError.message : "The claim could not be deleted.",
        "error",
      );
    } finally {
      setBusy(null);
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={`Claim · ${claim.claimType}`}
        title={claim.claimText}
        description={
          recording
            ? `Attributed to ${recording.speaker} in “${recording.title}”. This is a record of what was said, not a verdict on what happened.`
            : "The source recording is no longer in this archive. The quotation and claim are preserved, but playback and context are unavailable."
        }
        actions={
          <>
            <Link to="/claims" className="button button--ghost">
              <ArrowLeft size={15} aria-hidden="true" /> Claims
            </Link>
            {recording ? (
              <Link to={`/recordings/${recording.id}`} className="button button--ghost">
                <FileText size={15} aria-hidden="true" /> Source record
              </Link>
            ) : null}
            {recording ? (
              <Link to={`/compare?recordings=${recording.id}`} className="button button--ghost">
                <GitCompareArrows size={15} aria-hidden="true" /> Compare
              </Link>
            ) : null}
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={15} aria-hidden="true" /> Delete
            </button>
          </>
        }
        meta={
          <>
            <ClaimTypeBadge claimType={claim.claimType} />
            <UncertaintyBadge uncertainty={claim.uncertainty} />
            <BasisBadge basis={claim.basis} />
            {claim.isDemo ? <DemoBadge /> : null}
            {claim.evidenceStatus === "quote-mismatch" ? (
              <span className="badge badge--danger">Evidence mismatch</span>
            ) : (
              <span className="badge badge--sage">
                <ShieldCheck size={12} aria-hidden="true" /> Quotation verified
              </span>
            )}
          </>
        }
      />

      {claim.isDemo ? (
        <div className="notice notice--warning" style={{ marginBottom: 18 }}>
          <FlaskConical size={17} aria-hidden="true" />
          <div className="notice__body">
            <strong className="notice__title">Fictional demonstration claim</strong>
            <p>
              This narrator, account and quotation are invented for the EchoLedger demo. Do not cite this
              as historical evidence.
            </p>
          </div>
        </div>
      ) : null}

      {claim.evidenceStatus === "quote-mismatch" ? (
        <div className="notice notice--danger" style={{ marginBottom: 18 }}>
          <TriangleAlert size={18} aria-hidden="true" />
          <div className="notice__body">
            <strong className="notice__title">This quotation no longer matches the transcript</strong>
            <p>
              The transcript was edited after this claim was saved. EchoLedger has not rewritten the
              quotation or invented a new timestamp. Re-check the evidence, then update the claim
              deliberately.
            </p>
            <button
              type="button"
              className="button button--ghost button--small mt-1"
              onClick={() => void recheckEvidence()}
              disabled={busy !== null || !recording}
            >
              {busy === "recheck" ? (
                <LoaderCircle size={13} className="spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              {busy === "recheck" ? "Re-checking…" : "Re-check against transcript"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="detail-layout">
        <div className="detail-main">
          <section className="claim-detail-quote">
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              Verbatim evidence
            </p>
            <blockquote>“{claim.evidence.quote}”</blockquote>
            {evidenceSegment?.translation ? (
              <p className="claim-detail-quote__translation">
                <span>English translation</span>
                {evidenceSegment.translation}
              </p>
            ) : null}
            <div className="claim-detail-quote__meta">
              <span>
                <UserRound size={13} aria-hidden="true" /> {recording?.speaker ?? "Unknown narrator"}
              </span>
              <span>
                <Clock3 size={13} aria-hidden="true" />
                {hasVerifiedTiming
                  ? `${formatSeconds(claim.evidence.startSeconds)}${
                      claim.evidence.endSeconds !== null
                        ? `–${formatSeconds(claim.evidence.endSeconds)}`
                        : ""
                    }`
                  : "No verified timestamp"}
              </span>
              <span>{timestampSourceLabels[claim.evidence.timestampSource]}</span>
              {recording ? (
                <span>
                  <Languages size={13} aria-hidden="true" /> {recording.language}
                </span>
              ) : null}
            </div>
          </section>

          {recording?.audio ? (
            <section className="panel">
              <div className="panel__header">
                <div>
                  <h2>Hear the source</h2>
                  <p>
                    {hasVerifiedTiming
                      ? "Playback starts at the verified evidence timestamp."
                      : "No verified timestamp exists, so playback begins at the start of the recording."}
                  </p>
                </div>
                <Volume2 size={18} aria-hidden="true" className="muted" />
              </div>
              <div className="panel__body">
                <AudioPlayer
                  recordingId={recording.id}
                  startSeconds={claim.evidence.startSeconds}
                  endSeconds={claim.evidence.endSeconds}
                  label="Claim evidence"
                />
                {!hasVerifiedTiming ? (
                  <p className="help mt-1">
                    Use the transcript below to locate the quotation manually. EchoLedger will not estimate
                    a playback position.
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {claim.interpretationNote ? (
            <div className="notice notice--warning">
              <MessageSquareQuote size={17} aria-hidden="true" />
              <div className="notice__body">
                <strong className="notice__title">AI interpretation note</strong>
                <p>{claim.interpretationNote}</p>
                <p className="tiny" style={{ marginTop: 4 }}>
                  This is an interpretation, not the narrator&apos;s wording. The quotation above remains
                  the evidence.
                </p>
              </div>
            </div>
          ) : null}

          <section className="panel">
            <div className="panel__header">
              <div>
                <h2>Source context</h2>
                <p>Surrounding transcript segments, shown exactly as stored.</p>
              </div>
            </div>
            <div className="panel__body">
              {contextSegments.length > 0 ? (
                <ul className="context-list">
                  {contextSegments.map((segment) => (
                    <li
                      key={segment.id}
                      className={`context-item ${
                        evidenceIds.has(segment.id) ? "context-item--evidence" : ""
                      }`}
                    >
                      <span className="context-item__label">
                        {segment.startSeconds !== null
                          ? formatSeconds(segment.startSeconds)
                          : "No timestamp"}
                        {evidenceIds.has(segment.id) ? " · supporting quotation" : ""}
                      </span>
                      {segment.text}
                      {segment.translation ? (
                        <span className="transcript-segment__translation">
                          <span>English</span> {segment.translation}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">
                  {recording
                    ? "The original segment could not be located in the current transcript. Re-check the evidence above."
                    : "The source recording is no longer available, so context cannot be displayed."}
                </p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <h2>Researcher review</h2>
                <p>Your assessment is separate from the AI extraction and the narrator&apos;s words.</p>
              </div>
              {dirty ? <span className="badge badge--amber">Unsaved changes</span> : null}
            </div>
            <div className="panel__body stack">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="claim-uncertainty">Uncertainty assessment</label>
                  <select
                    id="claim-uncertainty"
                    className="select"
                    value={uncertainty}
                    onChange={(event) => setUncertainty(event.target.value as Uncertainty)}
                  >
                    {UNCERTAINTY_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level[0]!.toUpperCase() + level.slice(1)} uncertainty
                      </option>
                    ))}
                  </select>
                  <p className="help">
                    Describes the strength and clarity of the evidence, not whether the claim is true.
                  </p>
                </div>
                <div className="field">
                  <span className="field-label">Evidence status</span>
                  <div>
                    {claim.evidenceStatus === "valid" ? (
                      <span className="badge badge--sage">
                        <ShieldCheck size={12} aria-hidden="true" /> Quotation verified
                      </span>
                    ) : (
                      <span className="badge badge--danger">Quotation mismatch</span>
                    )}
                  </div>
                  <p className="help">
                    Only a transcript edit or deliberate re-check changes this status.
                  </p>
                </div>
              </div>

              <div className="notes-area">
                <label htmlFor="researcher-notes">Researcher notes</label>
                <textarea
                  id="researcher-notes"
                  className="textarea"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Record your assessment, follow-up questions, corroborating sources or reasons for caution. Do not alter the narrator's quotation."
                />
                <p className="help">
                  These notes are local to this browser and are included in exports. They are not sent to
                  Gemini during comparison.
                </p>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => void saveReview()}
                  disabled={!dirty || busy !== null}
                >
                  {busy === "review" ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />}
                  {busy === "review" ? "Saving…" : "Save review"}
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => {
                    setNotes(claim.researcherNotes);
                    setUncertainty(claim.uncertainty);
                  }}
                  disabled={!dirty || busy !== null}
                >
                  Reset
                </button>
              </div>
            </div>
          </section>

          {relationships.length > 0 ? (
            <section className="panel">
              <div className="panel__header">
                <div>
                  <h2>Appears in comparisons</h2>
                  <p>Relationship labels are provisional and describe the accounts, not the truth.</p>
                </div>
              </div>
              <div className="panel__body stack stack--sm">
                {relationships.map((relationship) => (
                  <Link
                    key={`${relationship.comparisonId}-${relationship.topic}`}
                    to={`/comparisons/${relationship.comparisonId}`}
                    className="mini-claim"
                  >
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      <RelationshipBadge relationship={relationship.relationship} />
                      <strong style={{ display: "inline" }}>{relationship.topic}</strong>
                    </span>
                    <span>
                      {relationship.comparisonTitle} · comparison confidence {relationship.confidence}
                      {relationship.isDemo ? " · demo" : ""}
                    </span>
                    <span style={{ marginTop: 4, color: "var(--muted)" }}>{relationship.rationale}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="detail-aside">
          <section className="panel">
            <div className="panel__header">
              <div>
                <h3>Source record</h3>
              </div>
            </div>
            <div className="panel__body">
              {recording ? (
                <>
                  <dl className="meta-list">
                    <div>
                      <dt>Title</dt>
                      <dd>
                        <Link to={`/recordings/${recording.id}`}>{recording.title}</Link>
                      </dd>
                    </div>
                    <div>
                      <dt>Narrator</dt>
                      <dd>{recording.speaker}</dd>
                    </div>
                    <div>
                      <dt>Language</dt>
                      <dd>{recording.language}</dd>
                    </div>
                    <div>
                      <dt>Place</dt>
                      <dd>{recording.place || "Not supplied"}</dd>
                    </div>
                    <div>
                      <dt>Recorded</dt>
                      <dd>{formatDate(recording.createdAt)}</dd>
                    </div>
                  </dl>
                  <Link
                    to={`/recordings/${recording.id}`}
                    className="button button--ghost button--small mt-2"
                  >
                    <FileText size={13} aria-hidden="true" /> Open transcript
                  </Link>
                </>
              ) : (
                <p className="small muted">Source record unavailable.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <h3>Claim metadata</h3>
              </div>
            </div>
            <div className="panel__body">
              <dl className="meta-list">
                <div>
                  <dt>Type</dt>
                  <dd>{claim.claimType}</dd>
                </div>
                <div>
                  <dt>Basis</dt>
                  <dd>{claim.basis === "explicit" ? "Explicit statement" : "AI inference"}</dd>
                </div>
                <div>
                  <dt>Uncertainty</dt>
                  <dd>{claim.uncertainty}</dd>
                </div>
                <div>
                  <dt>Time period</dt>
                  <dd>
                    {claim.timePeriod.start || claim.timePeriod.end || "No explicit year"}
                    {claim.timePeriod.originalExpression
                      ? ` · “${claim.timePeriod.originalExpression}”`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{claim.model}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(claim.createdAt)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDateTime(claim.updatedAt)}</dd>
                </div>
                <div>
                  <dt>Claim ID</dt>
                  <dd>
                    <code className="tiny">{claim.id}</code>
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          {claim.entities.length > 0 ? (
            <section className="panel">
              <div className="panel__header">
                <div>
                  <h3>Entities</h3>
                  <p>Names as they appear in the evidence.</p>
                </div>
              </div>
              <div className="panel__body">
                <div className="entity-list">
                  {claim.entities.map((entity) => (
                    <span key={`${entity.name}-${entity.type}`} className="entity-pill">
                      {entity.name} <small>{entity.type}</small>
                    </span>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <div className="notice notice--info">
            <ShieldCheck size={16} aria-hidden="true" />
            <div className="notice__body">
              <strong className="notice__title">The quotation is the anchor</strong>
              <p>
                Claim wording can summarise; the quotation cannot. If the two diverge, trust the source
                and flag the claim for review.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this claim?"
        description="The claim will be removed from this browser. Any comparisons that reference it will be updated or deleted. The source recording and transcript are not affected."
        confirmLabel="Delete claim"
        destructive
        busy={busy === "delete"}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
