import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  FlaskConical,
  HardDrive,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { DemoBadge } from "@/components/Badges";
import { ConfirmDialog } from "@/components/Modal";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import { useArchive } from "@/context/ArchiveContext";
import { useToast } from "@/context/ToastContext";
import { storageEstimate } from "@/lib/db";
import {
  exportArchiveJson,
  exportArchiveMarkdown,
  exportClaimsCsv,
} from "@/lib/export";
import { formatCount, formatFileSize } from "@/lib/utils";

type ConfirmAction = "clear" | "remove-demo" | null;

export function SettingsPage() {
  const {
    loading,
    recordings,
    claims,
    comparisons,
    aiStatus,
    aiStatusError,
    refreshAiStatus,
    seedDemo,
    removeDemo,
    clearArchive,
  } = useArchive();
  const { notify } = useToast();
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setEstimateLoading(true);
    storageEstimate()
      .then((value) => {
        if (active) setEstimate(value);
      })
      .catch(() => {
        if (active) setEstimate(null);
      })
      .finally(() => {
        if (active) setEstimateLoading(false);
      });
    return () => {
      active = false;
    };
  }, [recordings.length, claims.length, comparisons.length]);

  if (loading) return <LoadingState />;

  const demoCount = recordings.filter((recording) => recording.isDemo).length;
  const configured = Boolean(aiStatus?.configured);
  const usagePercent =
    estimate && estimate.quota > 0 ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAiStatus();
      notify("AI configuration refreshed from the local server.", "info");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSeed = async () => {
    setDemoBusy(true);
    try {
      const result = await seedDemo();
      notify(
        result.seeded
          ? "Fictional demonstration archive loaded. All records are labelled DEMO."
          : "The demo archive is already present.",
        result.seeded ? "success" : "info",
      );
    } catch (seedError) {
      notify(
        seedError instanceof Error ? seedError.message : "The demo archive could not be loaded.",
        "error",
      );
    } finally {
      setDemoBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      if (confirmAction === "clear") {
        await clearArchive();
        notify("All local archive data was cleared. Export a backup before relying on this archive.", "success");
      } else {
        await removeDemo();
        notify("Demo records and demo comparisons were removed. Research records are untouched.", "success");
      }
      setConfirmAction(null);
    } catch (actionError) {
      notify(
        actionError instanceof Error ? actionError.message : "The action could not be completed.",
        "error",
      );
    } finally {
      setConfirmBusy(false);
    }
  };

  const models = {
    text: aiStatus?.textModel ?? "gemini-3.8-flash",
    transcribe: aiStatus?.transcribeModel ?? "gemini-3.5-transcribe",
  };

  return (
    <>
      <PageHeader
        eyebrow="Configuration & data"
        title="Settings & AI"
        description="EchoLedger runs locally. The API key stays on your server, archive data stays in this browser, and Gemini is used only for the steps you explicitly approve."
        actions={
          <button type="button" className="button button--ghost" onClick={() => void handleRefresh()} disabled={refreshing}>
            {refreshing ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />}
            {refreshing ? "Refreshing…" : "Refresh status"}
          </button>
        }
      />

      <div className="settings-grid">
        <section className="panel panel--wide">
          <div className="panel__header">
            <div>
              <h2>Gemini connection</h2>
              <p>Optional AI transcription, claim extraction and comparison.</p>
            </div>
            {configured ? (
              <span className="badge badge--sage">
                <CheckCircle2 size={12} aria-hidden="true" /> Configured
              </span>
            ) : (
              <span className="badge badge--amber">
                <TriangleAlert size={12} aria-hidden="true" /> Not configured
              </span>
            )}
          </div>
          <div className="panel__body stack">
            <div
              className={`status-panel ${
                configured ? "status-panel--online" : aiStatusError ? "status-panel--offline" : "status-panel--standby"
              }`}
            >
              <span className="status-panel__dot" aria-hidden="true" />
              <div>
                <strong>
                  {configured
                    ? "The local server is connected to Google Gemini"
                    : aiStatusError
                      ? "The local API server is not reachable"
                      : "No Gemini API key is configured"}
                </strong>
                <p>
                  {configured
                    ? "Live requests will be sent to Google only after the browser consent dialog is confirmed."
                    : aiStatusError
                      ? aiStatusError
                      : "Transcript-only records and the demonstration archive remain fully usable without a key."}
                </p>
              </div>
            </div>

            <div className="env-table" aria-label="AI configuration">
              <div className="env-row">
                <code>GEMINI_API_KEY</code>
                <span>{configured ? "Set on the server (never sent to the browser)" : "Not set — add it to the root .env"}</span>
              </div>
              <div className="env-row">
                <code>GEMINI_TEXT_MODEL</code>
                <span>{models.text} — claim extraction and comparison</span>
              </div>
              <div className="env-row">
                <code>GEMINI_TRANSCRIBE_MODEL</code>
                <span>{models.transcribe} — audio transcription with word timing</span>
              </div>
              <div className="env-row">
                <code>MAX_AUDIO_MB / MINUTES</code>
                <span>
                  {aiStatus?.maxAudioMb ?? 100} MB / {aiStatus?.maxAudioMinutes ?? 30} minutes per upload
                </span>
              </div>
              <div className="env-row">
                <code>External processing</code>
                <span>{aiStatus?.externalProcessing ? "Enabled only with explicit browser consent" : "Disabled"}</span>
              </div>
            </div>

            {!configured ? (
              <div className="notice notice--warning">
                <KeyRound size={17} aria-hidden="true" />
                <div className="notice__body">
                  <strong className="notice__title">Enable Gemini in three steps</strong>
                  <p>Create a key in Google AI Studio, put it in the root .env, then restart the server.</p>
                  <pre className="code-block mt-1">{`cp .env.example .env
# edit .env and set:
GEMINI_API_KEY=your-key-here

npm run dev`}</pre>
                  <p className="tiny" style={{ marginTop: 6 }}>
                    Never commit <code>.env</code>. The repository ignores it. The browser calls only the
                    local EchoLedger server, not Gemini directly.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="settings-actions">
              <a
                className="button button--ghost button--small"
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={13} aria-hidden="true" /> Get a Gemini API key
              </a>
              <a
                className="button button--ghost button--small"
                href="https://ai.google.dev/gemini-api/docs"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={13} aria-hidden="true" /> Gemini API documentation
              </a>
            </div>

            {aiStatus?.note ? <p className="help">{aiStatus.note}</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Local archive</h2>
              <p>Stored in this browser&apos;s IndexedDB.</p>
            </div>
            <Database size={18} aria-hidden="true" className="muted" />
          </div>
          <div className="panel__body stack">
            <div className="compare-summary__counts">
              <div className="compare-summary__count">
                <strong>{recordings.length}</strong>
                <span>recordings</span>
              </div>
              <div className="compare-summary__count">
                <strong>{claims.length}</strong>
                <span>claims</span>
              </div>
              <div className="compare-summary__count">
                <strong>{comparisons.length}</strong>
                <span>comparisons</span>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                <span className="small muted">
                  {estimateLoading
                    ? "Estimating storage…"
                    : estimate
                      ? `${formatFileSize(estimate.usage)} used of ${formatFileSize(estimate.quota)} available`
                      : "Storage estimate unavailable in this browser"}
                </span>
                {estimate ? <span className="tiny muted">{usagePercent.toFixed(1)}%</span> : null}
              </div>
              <div className="storage-bar" aria-hidden="true">
                {estimate ? (
                  <div className="storage-bar__fill" style={{ width: `${Math.max(1, usagePercent)}%` }} />
                ) : null}
              </div>
            </div>

            <div className="settings-actions">
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => {
                  exportArchiveJson(recordings, claims, comparisons);
                  notify("Full archive JSON exported.", "success");
                }}
                disabled={recordings.length === 0}
              >
                <FileJson size={13} aria-hidden="true" /> JSON
              </button>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => {
                  exportClaimsCsv(recordings, claims, comparisons);
                  notify("Claims CSV exported.", "success");
                }}
                disabled={claims.length === 0}
              >
                <Download size={13} aria-hidden="true" /> Claims CSV
              </button>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => {
                  exportArchiveMarkdown(recordings, claims, comparisons);
                  notify("Human-readable Markdown report exported.", "success");
                }}
                disabled={recordings.length === 0}
              >
                <FileText size={13} aria-hidden="true" /> Report
              </button>
            </div>
            <p className="help">
              Exports preserve claim IDs, verbatim quotations, timestamp provenance, uncertainty and
              comparison warnings. Audio files are not included; back them up separately if needed.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Demonstration archive</h2>
              <p>Fictional Nilavari Lake records with synthetic audio.</p>
            </div>
            {demoCount > 0 ? <DemoBadge /> : <FlaskConical size={18} aria-hidden="true" className="muted" />}
          </div>
          <div className="panel__body stack">
            <p className="small muted">
              {demoCount > 0
                ? `${formatCount(demoCount, "demo recording")} and a demonstration comparison are present. They are fictional and must not be cited as history.`
                : "Load three fictional narrators, 13 claims and a comparison to explore the workflow without an API key. The audio is synthetic TTS."}
            </p>
            <div className="settings-actions">
              {demoCount > 0 ? (
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => setConfirmAction("remove-demo")}
                >
                  <Trash2 size={13} aria-hidden="true" /> Remove demo data
                </button>
              ) : (
                <button
                  type="button"
                  className="button button--soft button--small"
                  onClick={() => void handleSeed()}
                  disabled={demoBusy}
                >
                  {demoBusy ? <LoaderCircle size={13} className="spin" /> : <FlaskConical size={13} />}
                  {demoBusy ? "Loading…" : "Load demo archive"}
                </button>
              )}
            </div>
            <p className="help">
              Removing demo data never touches research records. Demo claims and comparisons are marked
              throughout the interface and in every export.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Privacy & consent</h2>
              <p>What leaves this device, and when.</p>
            </div>
            <ShieldCheck size={18} aria-hidden="true" className="muted" />
          </div>
          <div className="panel__body">
            <ul className="integrity-list">
              <li>
                <ShieldCheck size={14} aria-hidden="true" /> Recordings, transcripts, claims and
                comparisons stay in this browser by default.
              </li>
              <li>
                <ShieldCheck size={14} aria-hidden="true" /> The local Express server does not persist
                archive data and deletes temporary uploads after processing.
              </li>
              <li>
                <ShieldCheck size={14} aria-hidden="true" /> Audio, transcripts and claim text are sent to
                Gemini only after a consent checkbox is confirmed for that specific step.
              </li>
              <li>
                <ShieldCheck size={14} aria-hidden="true" /> Gemini remote files are deleted after
                transcription; Google&apos;s own data-handling terms still apply.
              </li>
              <li>
                <ShieldCheck size={14} aria-hidden="true" /> EchoLedger does not include analytics,
                telemetry or third-party tracking.
              </li>
            </ul>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>AI workflow limits</h2>
              <p>Provisional by design.</p>
            </div>
            <Sparkles size={18} aria-hidden="true" className="muted" />
          </div>
          <div className="panel__body stack stack--sm">
            <p className="small muted">
              Gemini can mishear speech, miss claims, infer too much or produce biased groupings. Every
              claim is validated against a verbatim transcript quotation, but validation is not historical
              verification. Review the source audio and context before using a claim.
            </p>
            <p className="small muted">
              Comparison relationships are descriptive and provisional. The model never decides which
              narrator is correct, and EchoLedger never labels a narrator as lying.
            </p>
          </div>
        </section>

        <section className="panel danger-zone panel--wide">
          <div className="panel__header">
            <div>
              <h2>Danger zone</h2>
              <p>These actions affect only this browser&apos;s local archive.</p>
            </div>
            <HardDrive size={18} aria-hidden="true" className="muted" />
          </div>
          <div className="panel__body stack">
            <div className="notice notice--danger">
              <TriangleAlert size={17} aria-hidden="true" />
              <div className="notice__body">
                <strong className="notice__title">Export before clearing</strong>
                <p>
                  Clearing the archive removes all recordings, audio blobs, transcripts, claims and
                  comparisons from this browser. There is no server backup and no undo.
                </p>
              </div>
            </div>
            <div className="settings-actions">
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => {
                  exportArchiveJson(recordings, claims, comparisons);
                  notify("Backup JSON exported before clearing.", "success");
                }}
                disabled={recordings.length === 0}
              >
                <Download size={13} aria-hidden="true" /> Export backup first
              </button>
              <button
                type="button"
                className="button button--danger button--small"
                onClick={() => setConfirmAction("clear")}
                disabled={recordings.length === 0 && claims.length === 0 && comparisons.length === 0}
              >
                <Trash2 size={13} aria-hidden="true" /> Clear entire archive
              </button>
            </div>
          </div>
        </section>

        <section className="panel panel--wide">
          <div className="panel__body" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h3>EchoLedger 0.1.0</h3>
              <p className="small muted" style={{ marginTop: 3 }}>
                Evidence-first, local-first oral history. MIT licensed. Built with React, Express and
                Google Gemini.
              </p>
            </div>
            <div className="settings-actions">
              <a
                className="button button--ghost button--small"
                href="https://github.com/rohanhalaj18/EchoLedger"
                target="_blank"
                rel="noreferrer"
              >
                <Server size={13} aria-hidden="true" /> GitHub repository
              </a>
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === "clear" ? "Clear the entire archive?" : "Remove demonstration data?"}
        description={
          confirmAction === "clear"
            ? "Every recording, audio file, transcript, claim, comparison and researcher note in this browser will be permanently removed. Export a JSON backup first if you need one."
            : "The three fictional demo recordings, their synthetic audio, claims and the demo comparison will be removed. Your own research records are not affected."
        }
        confirmLabel={confirmAction === "clear" ? "Clear everything" : "Remove demo data"}
        destructive
        busy={confirmBusy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
