import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  FileJson,
  FileText,
  FlaskConical,
  GitCompareArrows,
  Layers,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { ClaimCard } from "@/components/ClaimCard";
import { DemoBadge, RelationshipBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ConfirmDialog } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { useArchive } from "@/context/ArchiveContext";
import { useToast } from "@/context/ToastContext";
import { exportComparisonJson, exportComparisonMarkdown } from "@/lib/export";
import { formatCount, formatDate } from "@/lib/utils";
import type { Claim } from "@/types";

export function ComparisonDetailPage() {
  const { comparisonId } = useParams<{ comparisonId: string }>();
  const navigate = useNavigate();
  const { loading, recordings, claims, comparisons, deleteComparison } = useArchive();
  const { notify } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const comparison = comparisons.find((item) => item.id === comparisonId);

  const resolvedGroups = useMemo(() => {
    if (!comparison) return [];
    return comparison.groups
      .map((group) => ({
        ...group,
        claims: group.claimIds
          .map((claimId) => claims.find((claim) => claim.id === claimId))
          .filter((claim): claim is Claim => Boolean(claim)),
      }))
      .filter((group) => group.claims.length > 0);
  }, [comparison, claims]);

  const ungroupedClaims = useMemo(() => {
    if (!comparison) return [];
    return comparison.ungroupedClaimIds
      .map((claimId) => claims.find((claim) => claim.id === claimId))
      .filter((claim): claim is Claim => Boolean(claim));
  }, [comparison, claims]);

  const sourceRecordings = useMemo(
    () =>
      (comparison?.recordingIds ?? [])
        .map((id) => recordings.find((recording) => recording.id === id))
        .filter((recording): recording is NonNullable<typeof recording> => Boolean(recording)),
    [comparison, recordings],
  );

  const totalClaims = new Set([
    ...resolvedGroups.flatMap((group) => group.claims.map((claim) => claim.id)),
    ...ungroupedClaims.map((claim) => claim.id),
  ]).size;

  if (loading) return <LoadingState />;

  if (!comparison) {
    return (
      <EmptyState
        icon={<GitCompareArrows size={22} />}
        title="Comparison not found"
        description="This provisional comparison is not in the current local archive. It may have been deleted, or a dependent recording or claim may have been removed."
        actions={
          <Link to="/compare" className="button button--primary">
            <ArrowLeft size={15} aria-hidden="true" /> Back to comparisons
          </Link>
        }
      />
    );
  }

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteComparison(comparison.id);
      notify("Comparison deleted. Source material is unchanged.", "success");
      navigate("/compare");
    } catch (deleteError) {
      notify(
        deleteError instanceof Error ? deleteError.message : "The comparison could not be deleted.",
        "error",
      );
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Provisional comparison"
        title={comparison.title}
        description={comparison.summary}
        actions={
          <>
            <Link to="/compare" className="button button--ghost">
              <ArrowLeft size={15} aria-hidden="true" /> Comparisons
            </Link>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                exportComparisonJson(comparison, recordings, claims);
                notify("Comparison JSON exported with provenance and warnings.", "success");
              }}
            >
              <FileJson size={15} aria-hidden="true" /> JSON
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                exportComparisonMarkdown(comparison, recordings, claims);
                notify("Comparison report exported as Markdown.", "success");
              }}
            >
              <FileText size={15} aria-hidden="true" /> Markdown
            </button>
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
            <span>{formatCount(sourceRecordings.length, "recording")}</span>
            <span>{formatCount(totalClaims, "claim")}</span>
            <span>{formatCount(resolvedGroups.length, "group")}</span>
            <span>Model: {comparison.model}</span>
            <span>{formatDate(comparison.createdAt)}</span>
            {comparison.isDemo ? <DemoBadge /> : null}
          </>
        }
      />

      {comparison.isDemo ? (
        <div className="notice notice--warning" style={{ marginBottom: 18 }}>
          <FlaskConical size={17} aria-hidden="true" />
          <div className="notice__body">
            <strong className="notice__title">Fictional demonstration comparison</strong>
            <p>
              These accounts and relationships are invented to demonstrate the interface. They are not
              historical evidence and must not be cited as history.
            </p>
          </div>
        </div>
      ) : null}

      <div className="notice notice--info" style={{ marginBottom: 18 }}>
        <ShieldCheck size={17} aria-hidden="true" />
        <div className="notice__body">
          <strong className="notice__title">Read the quotations before the labels</strong>
          <p>{comparison.disclaimer}</p>
        </div>
      </div>

      {comparison.warnings.length > 0 ? (
        <div className="notice notice--warning" style={{ marginBottom: 18 }}>
          <TriangleAlert size={17} aria-hidden="true" />
          <div className="notice__body">
            <strong className="notice__title">Warnings from this comparison</strong>
            <ul className="consent__list" style={{ marginTop: 4 }}>
              {comparison.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="detail-layout">
        <div className="detail-main">
          <section className="section" style={{ marginTop: 0 }}>
            <div className="section__header">
              <div>
                <h2>Relationship groups</h2>
                <p>
                  Claims are grouped by subject. Labels describe the relationship between accounts, not
                  their truth.
                </p>
              </div>
            </div>

            {resolvedGroups.length === 0 ? (
              <EmptyState
                icon={<Layers size={22} />}
                title="No groups remain"
                description="The claims referenced by this comparison are no longer in the archive. Source claims may have been deleted or re-extracted."
                actions={
                  <Link to="/compare" className="button button--primary">
                    Create a new comparison
                  </Link>
                }
              />
            ) : (
              <div className="group-list">
                {resolvedGroups.map((group) => (
                  <article key={group.id} className="group-card">
                    <div className="group-card__header">
                      <div>
                        <RelationshipBadge relationship={group.relationship} />
                        <h3>{group.topic}</h3>
                      </div>
                      <span className="badge badge--neutral">
                        Comparison confidence: {group.confidence}
                      </span>
                    </div>
                    <p className="group-card__rationale">{group.rationale}</p>
                    <div className="group-card__claims">
                      {group.claims.map((claim) => (
                        <ClaimCard
                          key={claim.id}
                          claim={claim}
                          recording={recordings.find((recording) => recording.id === claim.recordingId)}
                          relationships={[
                            {
                              relationship: group.relationship,
                              topic: group.topic,
                              comparisonId: comparison.id,
                              comparisonTitle: comparison.title,
                            },
                          ]}
                          compact
                        />
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {ungroupedClaims.length > 0 ? (
            <section className="section">
              <div className="section__header">
                <div>
                  <h2>Ungrouped claims</h2>
                  <p>These remain available for manual review. They were not forced into a group.</p>
                </div>
              </div>
              <div className="notice notice--warning" style={{ marginBottom: 12 }}>
                <TriangleAlert size={16} aria-hidden="true" />
                <div className="notice__body">
                  <p>
                    An ungrouped claim is not unimportant. The model may have lacked comparable material,
                    or the connection may be too uncertain to assert. Missing evidence is not evidence of
                    absence.
                  </p>
                </div>
              </div>
              <div className="claim-grid">
                {ungroupedClaims.map((claim) => (
                  <ClaimCard
                    key={claim.id}
                    claim={claim}
                    recording={recordings.find((recording) => recording.id === claim.recordingId)}
                    compact
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="detail-aside">
          <section className="panel">
            <div className="panel__header">
              <div>
                <h3>Source recordings</h3>
                <p>Open a source to inspect its full transcript.</p>
              </div>
            </div>
            <div className="panel__body stack stack--sm">
              {sourceRecordings.map((recording) => (
                <Link key={recording.id} to={`/recordings/${recording.id}`} className="mini-claim">
                  <strong>{recording.title}</strong>
                  <span>
                    {recording.speaker} · {recording.language} ·{" "}
                    {formatCount(
                      claims.filter((claim) => claim.recordingId === recording.id).length,
                      "claim",
                    )}
                  </span>
                </Link>
              ))}
              {sourceRecordings.length === 0 ? (
                <p className="small muted">Source recordings are no longer in the archive.</p>
              ) : null}
            </div>
          </section>

          <section className="panel panel--muted">
            <div className="panel__body stack stack--sm">
              <h3>How to read this</h3>
              <ul className="integrity-list">
                <li>
                  <ShieldCheck size={14} aria-hidden="true" /> Shared accounts can both be mistaken in the
                  same way.
                </li>
                <li>
                  <ShieldCheck size={14} aria-hidden="true" /> Conflicting accounts can both preserve
                  partial truths.
                </li>
                <li>
                  <ShieldCheck size={14} aria-hidden="true" /> A unique account is not a false account.
                </li>
                <li>
                  <ShieldCheck size={14} aria-hidden="true" /> Comparison confidence describes the
                  grouping, not the history.
                </li>
              </ul>
            </div>
          </section>

          <section className="panel">
            <div className="panel__body stack stack--sm">
              <h3>Keep the provenance</h3>
              <p className="small muted">
                Export this comparison as JSON or Markdown to retain claim IDs, quotations, warnings and
                the model name. Audio remains in this browser and is not included in exports.
              </p>
              <div className="settings-actions">
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => exportComparisonJson(comparison, recordings, claims)}
                >
                  <Download size={13} aria-hidden="true" /> Export JSON
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => exportComparisonMarkdown(comparison, recordings, claims)}
                >
                  <Download size={13} aria-hidden="true" /> Export Markdown
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this comparison?"
        description="The saved comparison and its provisional groups will be removed. The source recordings, transcripts and claims are not affected."
        confirmLabel="Delete comparison"
        destructive
        busy={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
