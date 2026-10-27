import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpenText,
  FlaskConical,
  GitCompareArrows,
  Languages,
  LibraryBig,
  MessageSquareQuote,
  Plus,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { ClaimCard } from "@/components/ClaimCard";
import { DemoBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import { RecordingCard } from "@/components/RecordingCard";
import { useArchive } from "@/context/ArchiveContext";
import { useToast } from "@/context/ToastContext";
import { formatCount } from "@/lib/utils";

export function DashboardPage() {
  const {
    loading,
    error,
    recordings,
    claims,
    comparisons,
    aiStatus,
    aiStatusError,
    seedDemo,
  } = useArchive();
  const { notify } = useToast();
  const [seeding, setSeeding] = useState(false);

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="notice notice--danger" role="alert">
        <TriangleAlert size={18} aria-hidden="true" />
        <div className="notice__body">
          <strong className="notice__title">The local archive could not be opened</strong>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const demoCount = recordings.filter((recording) => recording.isDemo).length;
  const languages = new Set(recordings.map((recording) => recording.language)).size;
  const recentRecordings = recordings.slice(0, 3);
  const recentClaims = claims.slice(0, 3);
  const reviewClaims = claims
    .filter((claim) => claim.evidenceStatus === "quote-mismatch" || claim.uncertainty === "high")
    .slice(0, 3);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await seedDemo();
      if (result.seeded) {
        notify(
          result.audioAvailable
            ? "Demo archive loaded. All three fictional records include synthetic audio."
            : "Demo archive loaded. Audio was unavailable, but the transcripts and claims are ready.",
          "success",
        );
      } else {
        notify("The demo archive is already in this browser.", "info");
      }
    } catch (seedError) {
      notify(
        seedError instanceof Error ? seedError.message : "The demo archive could not be loaded.",
        "error",
      );
    } finally {
      setSeeding(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Research workspace"
        title="Every account, held to its source."
        description="EchoLedger keeps multilingual oral histories, verbatim evidence and provisional comparisons in one local-first research space. AI helps you find claims; it never decides what is true."
        actions={
          <>
            <Link to="/recordings/new" className="button button--primary">
              <Plus size={16} aria-hidden="true" /> Add a recording
            </Link>
            {recordings.length > 0 ? (
              <Link to="/library" className="button button--ghost">
                <LibraryBig size={16} aria-hidden="true" /> Open archive
              </Link>
            ) : null}
          </>
        }
      />

      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero__copy">
          <p className="eyebrow">Evidence first · Local first</p>
          <h2 id="hero-heading" className="hero__heading">
            Oral history is testimony. Treat it that way.
          </h2>
          <p className="hero__description">
            Record a conversation, transcribe it in its own language, and trace every claim back to
            the narrator&apos;s exact words. Compare accounts without flattening disagreement into a
            single story.
          </p>
          <div className="hero__actions">
            <Link to="/recordings/new" className="button button--primary">
              <Plus size={16} aria-hidden="true" /> Start a new record
            </Link>
            {demoCount === 0 ? (
              <button
                type="button"
                className="button button--ghost"
                onClick={handleSeed}
                disabled={seeding}
              >
                <FlaskConical size={16} aria-hidden="true" />
                {seeding ? "Loading demo…" : "Explore the demo archive"}
              </button>
            ) : (
              <Link to="/compare" className="button button--ghost">
                <GitCompareArrows size={16} aria-hidden="true" /> See a comparison
              </Link>
            )}
          </div>
          <div className="hero__meta">
            <span>
              <ShieldCheck size={13} aria-hidden="true" /> Data stays in this browser
            </span>
            <span>
              <Sparkles size={13} aria-hidden="true" /> Gemini only with your consent
            </span>
            <span>
              <Languages size={13} aria-hidden="true" /> {formatCount(languages, "language")} in this
              archive
            </span>
          </div>
        </div>

        <div className="hero__visual" aria-hidden="true">
          <p className="hero__visual-label">The evidence chain</p>
          <div className="hero__quote">
            “Every claim keeps the narrator&apos;s exact words.”
            <small>EchoLedger research principle</small>
          </div>
          <div className="hero__flow">
            <span>Transcript</span>
            <ArrowRight size={12} />
            <span>Verbatim quote</span>
            <ArrowRight size={12} />
            <span>Claim</span>
          </div>
          <div className="hero__claim">
            <strong>No claim without a source</strong>
            Quotations are validated against the transcript. Unsupported evidence is rejected, not
            repaired.
          </div>
        </div>
      </section>

      <div className="stat-grid">
        <Link to="/library" className="stat-card">
          <span className="stat-card__icon">
            <LibraryBig size={17} aria-hidden="true" />
          </span>
          <span>
            <span className="stat-card__value">{recordings.length}</span>
            <span className="stat-card__label">Recordings</span>
          </span>
        </Link>
        <Link to="/claims" className="stat-card">
          <span className="stat-card__icon">
            <MessageSquareQuote size={17} aria-hidden="true" />
          </span>
          <span>
            <span className="stat-card__value">{claims.length}</span>
            <span className="stat-card__label">Evidence-linked claims</span>
          </span>
        </Link>
        <Link to="/compare" className="stat-card">
          <span className="stat-card__icon">
            <GitCompareArrows size={17} aria-hidden="true" />
          </span>
          <span>
            <span className="stat-card__value">{comparisons.length}</span>
            <span className="stat-card__label">Saved comparisons</span>
          </span>
        </Link>
        <Link to="/map" className="stat-card">
          <span className="stat-card__icon">
            <BookOpenText size={17} aria-hidden="true" />
          </span>
          <span>
            <span className="stat-card__value">
              {claims.filter((claim) => claim.timePeriod.start || claim.timePeriod.end).length}
            </span>
            <span className="stat-card__label">Claims with an explicit date</span>
          </span>
        </Link>
      </div>

      {recordings.length === 0 ? (
        <div className="section">
          <EmptyState
            icon={<BookOpenText size={22} />}
            title="Begin with a recording or a transcript"
            description="You can add an audio interview, paste a transcript, or load a fictional demonstration archive. Audio and transcripts are stored in this browser, not on the server."
            actions={
              <>
                <Link to="/recordings/new" className="button button--primary">
                  <Plus size={16} aria-hidden="true" /> Add a recording
                </Link>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={handleSeed}
                  disabled={seeding}
                >
                  <FlaskConical size={16} aria-hidden="true" />
                  {seeding ? "Loading demo…" : "Load demo archive"}
                </button>
              </>
            }
          />
        </div>
      ) : (
        <div className="dashboard-grid">
          <div className="stack">
            <section className="section" style={{ marginTop: 0 }}>
              <div className="section__header">
                <div>
                  <h2>Recent recordings</h2>
                  <p>Source material in your local archive.</p>
                </div>
                <div className="section__actions">
                  <Link to="/library" className="button button--ghost button--small">
                    View all <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>
              </div>
              <div className="recording-grid">
                {recentRecordings.map((recording) => (
                  <RecordingCard
                    key={recording.id}
                    recording={recording}
                    claimCount={claims.filter((claim) => claim.recordingId === recording.id).length}
                  />
                ))}
              </div>
            </section>

            <section className="section">
              <div className="section__header">
                <div>
                  <h2>Latest evidence</h2>
                  <p>Claims remain attached to the narrator&apos;s original wording.</p>
                </div>
                <div className="section__actions">
                  <Link to="/claims" className="button button--ghost button--small">
                    Claim explorer <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>
              </div>
              {recentClaims.length > 0 ? (
                <div className="claim-grid">
                  {recentClaims.map((claim) => (
                    <ClaimCard
                      key={claim.id}
                      claim={claim}
                      recording={recordings.find((item) => item.id === claim.recordingId)}
                      compact
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  compact
                  icon={<MessageSquareQuote size={20} />}
                  title="No claims yet"
                  description="Open a recording to extract claims from its transcript. Extraction uses Gemini and requires explicit consent."
                  actions={
                    <Link to="/library" className="button button--soft button--small">
                      Choose a recording
                    </Link>
                  }
                />
              )}
            </section>
          </div>

          <aside className="stack" aria-label="Research guidance">
            <section className="panel">
              <div className="panel__header">
                <div>
                  <h3>Gemini readiness</h3>
                  <p>Optional AI assistance for transcription and extraction.</p>
                </div>
              </div>
              <div className="panel__body stack stack--sm">
                <div
                  className={`status-panel ${
                    aiStatus?.configured
                      ? "status-panel--online"
                      : aiStatusError
                        ? "status-panel--offline"
                        : "status-panel--standby"
                  }`}
                >
                  <span className="status-panel__dot" aria-hidden="true" />
                  <div>
                    <strong>
                      {aiStatus?.configured
                        ? "Connected to Gemini"
                        : aiStatusError
                          ? "Local API server unreachable"
                          : "Gemini is not configured"}
                    </strong>
                    <p>
                      {aiStatus?.configured
                        ? `Text: ${aiStatus.textModel} · Audio: ${aiStatus.transcribeModel}`
                        : aiStatusError
                          ? aiStatusError
                          : "Transcript-only and demo workflows still work. Add a server key to enable AI."}
                    </p>
                  </div>
                </div>
                <Link to="/settings" className="button button--soft button--small">
                  AI settings & privacy
                </Link>
              </div>
            </section>

            {reviewClaims.length > 0 ? (
              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h3>Worth a closer look</h3>
                    <p>High uncertainty or transcript drift.</p>
                  </div>
                </div>
                <div className="panel__body stack stack--sm">
                  {reviewClaims.map((claim) => {
                    const recording = recordings.find((item) => item.id === claim.recordingId);
                    return (
                      <Link key={claim.id} to={`/claims/${claim.id}`} className="mini-claim">
                        <strong>{claim.claimText}</strong>
                        <span>
                          {claim.evidenceStatus === "quote-mismatch"
                            ? "Evidence no longer matches the transcript"
                            : "High uncertainty"}{" "}
                          · {recording?.speaker ?? "Unknown narrator"}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="panel panel--muted">
              <div className="panel__header">
                <div>
                  <h3>How the workflow holds up</h3>
                </div>
              </div>
              <div className="panel__body">
                <div className="workflow-list">
                  <div className="workflow-step">
                    <span className="workflow-step__number">1</span>
                    <div>
                      <strong>Capture with consent</strong>
                      <p>Audio and transcript metadata are stored in this browser.</p>
                    </div>
                  </div>
                  <div className="workflow-step">
                    <span className="workflow-step__number">2</span>
                    <div>
                      <strong>Quote before claim</strong>
                      <p>Each claim is checked against a verbatim transcript excerpt.</p>
                    </div>
                  </div>
                  <div className="workflow-step">
                    <span className="workflow-step__number">3</span>
                    <div>
                      <strong>Compare, don&apos;t adjudicate</strong>
                      <p>Relationships describe agreement and difference, never truth.</p>
                    </div>
                  </div>
                  <div className="workflow-step">
                    <span className="workflow-step__number">4</span>
                    <div>
                      <strong>Export with provenance</strong>
                      <p>JSON, CSV and Markdown exports keep IDs, quotes and warnings.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel panel--dark">
              <div className="panel__body stack stack--sm">
                <h3>Research integrity</h3>
                <ul className="integrity-list">
                  <li>
                    <ShieldCheck size={14} aria-hidden="true" /> AI output is provisional and must be
                    reviewed.
                  </li>
                  <li>
                    <ShieldCheck size={14} aria-hidden="true" /> Agreement is not proof of truth.
                  </li>
                  <li>
                    <ShieldCheck size={14} aria-hidden="true" /> A conflict does not make either
                    account false.
                  </li>
                  <li>
                    <ShieldCheck size={14} aria-hidden="true" /> Missing evidence is not evidence of
                    absence.
                  </li>
                </ul>
              </div>
            </section>

            {demoCount > 0 ? (
              <div className="notice notice--warning">
                <FlaskConical size={17} aria-hidden="true" />
                <div className="notice__body">
                  <strong className="notice__title">Demonstration data present</strong>
                  <p>
                    {demoCount} fictional record{demoCount === 1 ? "" : "s"} with synthetic audio{" "}
                    <DemoBadge compact />. Not historical evidence.
                  </p>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </>
  );
}
