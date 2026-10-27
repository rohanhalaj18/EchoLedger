import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AudioLines,
  CalendarDays,
  Edit3,
  FileText,
  FlaskConical,
  GitCompareArrows,
  Languages,
  LoaderCircle,
  MapPin,
  MessageSquareQuote,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ClaimCard } from "@/components/ClaimCard";
import { ConsentDialog } from "@/components/ConsentDialog";
import { DemoBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { Modal, ConfirmDialog } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { useArchive } from "@/context/ArchiveContext";
import { useToast } from "@/context/ToastContext";
import { ApiError, extractClaims, transcribeAudio } from "@/lib/api";
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatFileSize,
  formatSeconds,
  parseTimestampedTranscript,
  splitPlainTranscript,
} from "@/lib/utils";
import type { Recording, TranscriptSegment } from "@/types";

type ConsentMode = "transcribe" | "extract" | null;

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function srtTimestamp(seconds: number | null): string {
  const totalMs = Math.max(0, Math.round((seconds ?? 0) * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function transcriptDraft(segments: TranscriptSegment[]): string {
  const allTimed =
    segments.length > 0 &&
    segments.every((segment) => segment.startSeconds !== null && segment.endSeconds !== null);
  if (allTimed) {
    return segments
      .map(
        (segment, index) =>
          `${index + 1}\n${srtTimestamp(segment.startSeconds)} --> ${srtTimestamp(segment.endSeconds)}\n${segment.text}`,
      )
      .join("\n\n");
  }
  return segments.map((segment) => segment.text).join("\n\n");
}

function mergeTranscriptDraft(
  previous: TranscriptSegment[],
  text: string,
): { segments: TranscriptSegment[]; source: Recording["transcriptSource"] } {
  const parsed = parseTimestampedTranscript(text);
  const source: Recording["transcriptSource"] = text.includes("-->")
    ? /^WEBVTT/i.test(text.trim())
      ? "vtt"
      : "srt"
    : "manual";

  const merged = parsed.map((segment) => {
    const match = previous.find(
      (item) =>
        item.text.trim() === segment.text.trim() &&
        item.startSeconds === segment.startSeconds &&
        item.endSeconds === segment.endSeconds,
    );
    return match
      ? { ...segment, id: match.id, translation: match.translation, speakerLabel: match.speakerLabel }
      : segment;
  });

  if (merged.length === 0) {
    return { segments: splitPlainTranscript(text), source: "manual" };
  }
  return { segments: merged, source };
}

export function RecordingDetailPage() {
  const { recordingId } = useParams<{ recordingId: string }>();
  const navigate = useNavigate();
  const {
    loading,
    recordings,
    claims,
    comparisons,
    aiStatus,
    updateRecording,
    deleteRecording,
    replaceClaims,
    getAudio,
  } = useArchive();
  const { notify } = useToast();

  const recording = recordings.find((item) => item.id === recordingId);
  const recordingClaims = useMemo(
    () => claims.filter((claim) => claim.recordingId === recordingId),
    [claims, recordingId],
  );
  const relatedComparisons = useMemo(
    () => comparisons.filter((comparison) => comparison.recordingIds.includes(recordingId ?? "")),
    [comparisons, recordingId],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSpeaker, setEditSpeaker] = useState("");
  const [editPlace, setEditPlace] = useState("");
  const [editPeriod, setEditPeriod] = useState("");
  const [editTopics, setEditTopics] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [consent, setConsent] = useState<ConsentMode>(null);
  const [busy, setBusy] = useState<"edit" | "transcript" | "delete" | "extract" | "transcribe" | null>(
    null,
  );
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{
    claimCount: number;
    rejectedCount: number;
    warnings: string[];
    model: string;
  } | null>(null);

  if (loading) return <LoadingState />;

  if (!recording) {
    return (
      <EmptyState
        icon={<FileText size={22} />}
        title="Recording not found"
        description="This record is not in the current local archive. It may have been deleted in another browser tab."
        actions={
          <Link to="/library" className="button button--primary">
            <ArrowLeft size={15} aria-hidden="true" /> Back to archive
          </Link>
        }
      />
    );
  }

  const aiConfigured = Boolean(aiStatus?.configured);
  const segments = recording.transcriptSegments;
  const activeSegment = segments.find((segment) => segment.id === activeSegmentId) ?? null;
  const hasVerifiedAudio = Boolean(recording.audio);

  const openEdit = () => {
    setEditTitle(recording.title);
    setEditSpeaker(recording.speaker);
    setEditPlace(recording.place);
    setEditPeriod(recording.period);
    setEditTopics(recording.topics.join(", "));
    setEditNotes(recording.notes);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editTitle.trim() || !editSpeaker.trim()) {
      notify("A title and narrator name are required.", "error");
      return;
    }
    setBusy("edit");
    try {
      const updated: Recording = {
        ...recording,
        title: editTitle.trim(),
        speaker: editSpeaker.trim(),
        place: editPlace.trim(),
        period: editPeriod.trim(),
        topics: editTopics
          .split(/[,;]/)
          .map((topic) => topic.trim())
          .filter(Boolean),
        notes: editNotes.trim(),
        updatedAt: new Date().toISOString(),
      };
      const result = await updateRecording(updated);
      notify(
        result.invalidatedClaims > 0
          ? `Details saved. ${result.invalidatedClaims} claim${result.invalidatedClaims === 1 ? "" : "s"} now need evidence review.`
          : "Recording details saved.",
        result.invalidatedClaims > 0 ? "info" : "success",
      );
      setEditOpen(false);
    } catch (saveError) {
      notify(errorMessage(saveError), "error");
    } finally {
      setBusy(null);
    }
  };

  const openTranscript = () => {
    setTranscriptText(transcriptDraft(recording.transcriptSegments));
    setTranscriptOpen(true);
  };

  const saveTranscript = async () => {
    if (!transcriptText.trim()) {
      notify("The transcript cannot be empty.", "error");
      return;
    }
    setBusy("transcript");
    try {
      const { segments: nextSegments, source } = mergeTranscriptDraft(
        recording.transcriptSegments,
        transcriptText,
      );
      const updated: Recording = {
        ...recording,
        transcriptSegments: nextSegments,
        transcriptSource: source,
        transcriptEditedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = await updateRecording(updated);
      notify(
        result.invalidatedClaims > 0
          ? `Transcript saved. ${result.invalidatedClaims} claim${result.invalidatedClaims === 1 ? "" : "s"} no longer match their quotation and are flagged for review.`
          : "Transcript saved and existing claims re-checked.",
        result.invalidatedClaims > 0 ? "info" : "success",
      );
      setTranscriptOpen(false);
    } catch (saveError) {
      notify(errorMessage(saveError), "error");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy("delete");
    try {
      await deleteRecording(recording.id);
      notify("Recording, its claims and affected comparisons were removed from this browser.", "success");
      navigate("/library");
    } catch (deleteError) {
      notify(errorMessage(deleteError), "error");
    } finally {
      setBusy(null);
      setDeleteOpen(false);
    }
  };

  const openExtract = () => {
    if (!aiConfigured) {
      notify("Gemini is not configured. Add a server API key to extract claims.", "error");
      return;
    }
    if (segments.length === 0) {
      notify("Add a transcript before extracting claims.", "error");
      return;
    }
    setConsent("extract");
  };

  const confirmExtract = async () => {
    if (segments.length === 0) return;
    setBusy("extract");
    try {
      const result = await extractClaims(recording, segments);
      await replaceClaims(recording.id, result.claims);
      setAiResult({
        claimCount: result.claims.length,
        rejectedCount: result.rejectedCount,
        warnings: result.warnings,
        model: result.model,
      });
      notify(
        result.claims.length > 0
          ? `${result.claims.length} evidence-linked claim${result.claims.length === 1 ? "" : "s"} extracted. Review each quotation before relying on it.`
          : "No supported claims were found. Existing claims were replaced with an empty set.",
        result.claims.length > 0 ? "success" : "info",
      );
    } catch (extractError) {
      notify(errorMessage(extractError), "error");
    } finally {
      setBusy(null);
      setConsent(null);
    }
  };

  const openTranscribe = () => {
    if (!aiConfigured) {
      notify("Gemini is not configured. Add a server API key to transcribe audio.", "error");
      return;
    }
    if (!hasVerifiedAudio) {
      notify("There is no stored audio file for this recording.", "error");
      return;
    }
    setConsent("transcribe");
  };

  const confirmTranscribe = async () => {
    setBusy("transcribe");
    try {
      const blob = await getAudio(recording.id);
      if (!blob) throw new Error("The local audio file could not be read.");
      const audioMeta = recording.audio;
      const file = new File([blob], audioMeta?.fileName ?? "recording.mp3", {
        type: audioMeta?.mimeType || blob.type || "audio/mpeg",
      });
      const result = await transcribeAudio(file, recording.languageCode);
      const updated: Recording = {
        ...recording,
        transcriptSegments: result.segments,
        transcriptSource: "gemini",
        consentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        audio: audioMeta
          ? {
              ...audioMeta,
              durationSeconds: audioMeta.durationSeconds ?? result.durationSeconds,
            }
          : audioMeta,
      };
      const updateResult = await updateRecording(updated);
      if (updateResult.invalidatedClaims > 0) {
        notify(
          `Transcribed. ${updateResult.invalidatedClaims} existing claim${updateResult.invalidatedClaims === 1 ? "" : "s"} no longer match and are flagged.`,
          "info",
        );
      } else if (result.timestampSource === "none") {
        notify(
          "Transcribed and saved. Gemini did not return word-level timing, so no playback timestamps were created.",
          "info",
        );
      } else {
        notify("Transcribed and saved with word-level timestamps.", "success");
      }
    } catch (transcribeError) {
      notify(errorMessage(transcribeError), "error");
    } finally {
      setBusy(null);
      setConsent(null);
    }
  };

  const consentConfig =
    consent === "transcribe"
      ? {
          title: "Send this audio to Gemini?",
          operation: "Gemini 3.5 Transcribe will transcribe the stored audio and may return word-level timestamps.",
          dataSummary: [
            `Audio file: ${recording.audio?.fileName ?? "recording audio"}${
              recording.audio ? ` (${formatFileSize(recording.audio.size)})` : ""
            }`,
            `Language hint: ${recording.language}${recording.languageCode ? ` (${recording.languageCode})` : ""}`,
            "Recording metadata: title, narrator, place, period and context notes",
          ],
          confirmLabel: "I consent — transcribe audio",
        }
      : {
          title: "Send this transcript to Gemini?",
          operation: "Gemini will propose claims from the transcript. Every proposed quotation is checked before saving.",
          dataSummary: [
            `${segments.length} transcript segment${segments.length === 1 ? "" : "s"}`,
            "Recording metadata: title, narrator, language, place, period and context notes",
            recordingClaims.length > 0
              ? `This replaces the ${recordingClaims.length} existing claim${recordingClaims.length === 1 ? "" : "s"} for this recording.`
              : "No audio is sent.",
          ],
          confirmLabel: "I consent — extract claims",
        };

  return (
    <>
      <PageHeader
        eyebrow={`${recording.source === "audio" ? "Audio record" : "Transcript record"} · ${recording.language}`}
        title={recording.title}
        description={
          recording.notes ||
          "A source record in your local archive. Claims extracted from it remain tied to the narrator's exact words."
        }
        actions={
          <>
            <Link to="/library" className="button button--ghost">
              <ArrowLeft size={15} aria-hidden="true" /> Archive
            </Link>
            <Link to={`/compare?recordings=${recording.id}`} className="button button--ghost">
              <GitCompareArrows size={15} aria-hidden="true" /> Compare
            </Link>
            <button type="button" className="button button--ghost" onClick={openEdit}>
              <Edit3 size={15} aria-hidden="true" /> Edit
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete recording"
            >
              <Trash2 size={15} aria-hidden="true" /> Delete
            </button>
          </>
        }
        meta={
          <>
            <span>
              <UserRound size={13} aria-hidden="true" /> {recording.speaker}
            </span>
            <span>
              <Languages size={13} aria-hidden="true" /> {recording.language}
            </span>
            {recording.place ? (
              <span>
                <MapPin size={13} aria-hidden="true" /> {recording.place}
              </span>
            ) : null}
            {recording.period ? (
              <span>
                <CalendarDays size={13} aria-hidden="true" /> {recording.period}
              </span>
            ) : null}
            {recording.isDemo ? <DemoBadge /> : null}
          </>
        }
      />

      {recording.isDemo ? (
        <div className="notice notice--warning" style={{ marginBottom: 18 }}>
          <FlaskConical size={17} aria-hidden="true" />
          <div className="notice__body">
            <strong className="notice__title">Fictional demonstration record</strong>
            <p>
              This narrator and account are invented, and the audio is synthetic TTS. Do not cite this
              material as history. It exists to demonstrate the evidence workflow.
            </p>
          </div>
        </div>
      ) : null}

      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel">
            <div className="panel__header">
              <div>
                <h2>Source audio</h2>
                <p>
                  {recording.audio
                    ? `${recording.audio.fileName} · ${formatFileSize(recording.audio.size)}${
                        recording.audio.durationSeconds
                          ? ` · ${formatDuration(recording.audio.durationSeconds)}`
                          : ""
                      }`
                    : "No audio is stored for this record."}
                </p>
              </div>
              {recording.audio ? (
                <span className="badge badge--sage">
                  <ShieldCheck size={12} aria-hidden="true" /> Local only
                </span>
              ) : null}
            </div>
            <div className="panel__body">
              {recording.audio ? (
                <AudioPlayer recordingId={recording.id} label="Recording audio" />
              ) : (
                <div className="notice notice--plain">
                  <AudioLines size={17} aria-hidden="true" />
                  <div className="notice__body">
                    <strong className="notice__title">Transcript-only record</strong>
                    <p>
                      Playback is unavailable because no audio file is stored. Timestamps, if present,
                      come from the imported transcript and cannot be independently checked here.
                    </p>
                  </div>
                </div>
              )}
              {recording.source === "audio" && !recording.audio ? (
                <p className="help mt-1">
                  Audio metadata was recorded without a stored file. This can happen if the file was
                  removed by the browser to reclaim storage.
                </p>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <h2>Claims from this recording</h2>
                <p>
                  {recordingClaims.length === 0
                    ? "No claims have been extracted yet."
                    : `${recordingClaims.length} claim${recordingClaims.length === 1 ? "" : "s"} tied to verbatim evidence.`}
                </p>
              </div>
              <div className="section__actions">
                <button
                  type="button"
                  className="button button--soft button--small"
                  onClick={openExtract}
                  disabled={!aiConfigured || segments.length === 0 || busy !== null}
                  title={
                    !aiConfigured
                      ? "Add GEMINI_API_KEY to the server .env"
                      : segments.length === 0
                        ? "Add a transcript first"
                        : undefined
                  }
                >
                  {busy === "extract" ? <LoaderCircle size={13} className="spin" /> : <Sparkles size={13} />}
                  {recordingClaims.length > 0 ? "Re-extract claims" : "Extract claims"}
                </button>
              </div>
            </div>

            <div className="panel__body stack">
              {!aiConfigured ? (
                <div className="notice notice--warning">
                  <Sparkles size={16} aria-hidden="true" />
                  <div className="notice__body">
                    <strong className="notice__title">Claim extraction needs Gemini</strong>
                    <p>
                      Add <code>GEMINI_API_KEY</code> to the root <code>.env</code> and restart the
                      server, or use the demonstration claims without a key.{" "}
                      <Link to="/settings">AI settings</Link>.
                    </p>
                  </div>
                </div>
              ) : null}

              {aiResult ? (
                <div className={`notice ${aiResult.claimCount > 0 ? "notice--success" : "notice--info"}`}>
                  <Sparkles size={16} aria-hidden="true" />
                  <div className="notice__body">
                    <strong className="notice__title">Last extraction · {aiResult.model}</strong>
                    <p>
                      {aiResult.claimCount} claim{aiResult.claimCount === 1 ? "" : "s"} saved
                      {aiResult.rejectedCount > 0
                        ? ` · ${aiResult.rejectedCount} rejected for unsupported quotation`
                        : ""}
                      . AI output is provisional and needs human review.
                    </p>
                    {aiResult.warnings.length > 0 ? (
                      <ul className="consent__list" style={{ marginTop: 6 }}>
                        {aiResult.warnings.slice(0, 4).map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {segments.length === 0 ? (
                <EmptyState
                  compact
                  icon={<FileText size={20} />}
                  title="A transcript is needed first"
                  description="Add a transcript manually or transcribe the stored audio with Gemini. Claims cannot be extracted from audio alone."
                  actions={
                    <>
                      <button type="button" className="button button--primary button--small" onClick={openTranscript}>
                        Add transcript
                      </button>
                      {hasVerifiedAudio ? (
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          onClick={openTranscribe}
                          disabled={!aiConfigured || busy !== null}
                        >
                          <Sparkles size={13} aria-hidden="true" /> Transcribe with Gemini
                        </button>
                      ) : null}
                    </>
                  }
                />
              ) : recordingClaims.length === 0 ? (
                <EmptyState
                  compact
                  icon={<MessageSquareQuote size={20} />}
                  title="No claims yet"
                  description="Extraction proposes claims only where Gemini can quote the transcript exactly. Unsupported claims are rejected rather than repaired."
                  actions={
                    <button
                      type="button"
                      className="button button--soft button--small"
                      onClick={openExtract}
                      disabled={!aiConfigured || busy !== null}
                    >
                      <Sparkles size={13} aria-hidden="true" /> Extract claims
                    </button>
                  }
                />
              ) : (
                <div className="claim-grid">
                  {recordingClaims.map((claim) => (
                    <ClaimCard key={claim.id} claim={claim} recording={recording} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <h2>Transcript</h2>
                <p>
                  {segments.length} segment{segments.length === 1 ? "" : "s"} ·{" "}
                  {recording.transcriptSource === "gemini"
                    ? "Gemini transcription"
                    : recording.transcriptSource === "demo"
                      ? "Demo transcript"
                      : recording.transcriptSource === "srt"
                        ? "SRT import"
                        : recording.transcriptSource === "vtt"
                          ? "WebVTT import"
                          : "Manual transcript"}
                </p>
              </div>
              <div className="section__actions">
                {hasVerifiedAudio && segments.length === 0 ? (
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={openTranscribe}
                    disabled={!aiConfigured || busy !== null}
                  >
                    <Sparkles size={13} aria-hidden="true" /> Transcribe
                  </button>
                ) : null}
                <button type="button" className="button button--ghost button--small" onClick={openTranscript}>
                  <Edit3 size={13} aria-hidden="true" /> {segments.length > 0 ? "Edit transcript" : "Add transcript"}
                </button>
              </div>
            </div>

            <div className="panel__body">
              {activeSegment && activeSegment.startSeconds !== null && recording.audio ? (
                <div className="segment-player">
                  <div className="segment-player__label">
                    <span>
                      Playing from {formatSeconds(activeSegment.startSeconds)}
                      {activeSegment.endSeconds !== null
                        ? ` to ${formatSeconds(activeSegment.endSeconds)}`
                        : ""}
                    </span>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() => setActiveSegmentId(null)}
                    >
                      Close
                    </button>
                  </div>
                  <AudioPlayer
                    key={activeSegment.id}
                    recordingId={recording.id}
                    startSeconds={activeSegment.startSeconds}
                    endSeconds={activeSegment.endSeconds}
                    autoPlay
                    compact
                    label="Transcript segment"
                  />
                </div>
              ) : null}

              {segments.length === 0 ? (
                <EmptyState
                  compact
                  icon={<FileText size={20} />}
                  title="No transcript"
                  description="Add a transcript to make this recording searchable and to enable evidence-linked claims."
                  actions={
                    <button type="button" className="button button--soft button--small" onClick={openTranscript}>
                      Add transcript
                    </button>
                  }
                />
              ) : (
                <ol className="transcript-list">
                  {segments.map((segment) => {
                    const canPlay = Boolean(recording.audio) && segment.startSeconds !== null;
                    return (
                      <li
                        key={segment.id}
                        className={`transcript-segment ${
                          segment.id === activeSegmentId ? "transcript-segment--active" : ""
                        }`}
                      >
                        <span className="transcript-segment__time">
                          {segment.startSeconds !== null ? formatSeconds(segment.startSeconds) : "—"}
                        </span>
                        <div>
                          {segment.speakerLabel ? (
                            <p className="tiny muted strong">{segment.speakerLabel}</p>
                          ) : null}
                          <p className="transcript-segment__text">{segment.text}</p>
                          {segment.translation ? (
                            <p className="transcript-segment__translation">
                              <span>English</span> {segment.translation}
                            </p>
                          ) : null}
                        </div>
                        <div className="transcript-segment__action">
                          {canPlay ? (
                            <button
                              type="button"
                              className="button button--ghost button--small"
                              onClick={() => setActiveSegmentId(segment.id)}
                            >
                              <Play size={12} fill="currentColor" aria-hidden="true" /> Play
                            </button>
                          ) : segment.startSeconds === null ? (
                            <span className="evidence-timestamp evidence-timestamp--missing">No timestamp</span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>
        </div>

        <aside className="detail-aside">
          <section className="panel">
            <div className="panel__header">
              <div>
                <h3>Record details</h3>
              </div>
            </div>
            <div className="panel__body">
              <dl className="meta-list">
                <div>
                  <dt>Narrator</dt>
                  <dd>{recording.speaker}</dd>
                </div>
                <div>
                  <dt>Language</dt>
                  <dd>
                    {recording.language}
                    {recording.languageCode ? ` (${recording.languageCode})` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Place</dt>
                  <dd>{recording.place || "Not supplied"}</dd>
                </div>
                <div>
                  <dt>Period</dt>
                  <dd>{recording.period || "Not supplied"}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{recording.source === "audio" ? "Audio recording" : "Transcript only"}</dd>
                </div>
                <div>
                  <dt>Transcript</dt>
                  <dd>{recording.transcriptSource}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(recording.createdAt)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDateTime(recording.updatedAt)}</dd>
                </div>
                <div>
                  <dt>AI consent</dt>
                  <dd>
                    {recording.consentAt
                      ? `Given ${formatDateTime(recording.consentAt)}`
                      : "No Gemini processing recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Record ID</dt>
                  <dd>
                    <code className="tiny">{recording.id}</code>
                  </dd>
                </div>
              </dl>
              {recording.topics.length > 0 ? (
                <div className="tag-row mt-2">
                  {recording.topics.map((topic) => (
                    <span key={topic} className="tag">
                      {topic}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          {relatedComparisons.length > 0 ? (
            <section className="panel">
              <div className="panel__header">
                <div>
                  <h3>In comparisons</h3>
                  <p>Provisional relationships, not verdicts.</p>
                </div>
              </div>
              <div className="panel__body stack stack--sm">
                {relatedComparisons.map((comparison) => (
                  <Link key={comparison.id} to={`/comparisons/${comparison.id}`} className="mini-claim">
                    <strong>{comparison.title}</strong>
                    <span>
                      {comparison.groups.length} group{comparison.groups.length === 1 ? "" : "s"} ·{" "}
                      {formatDate(comparison.createdAt)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel panel--muted">
            <div className="panel__body stack stack--sm">
              <h3>Evidence discipline</h3>
              <p className="small muted">
                Editing the transcript does not silently rewrite claims. EchoLedger re-locates every
                quotation; if the words no longer exist, the claim is flagged as an evidence mismatch
                rather than repaired with a guess.
              </p>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => {
                  setTranscriptText(transcriptDraft(recording.transcriptSegments));
                  setTranscriptOpen(true);
                }}
              >
                <RefreshCw size={13} aria-hidden="true" /> Review transcript
              </button>
            </div>
          </section>

          <div className="notice notice--info">
            <ShieldCheck size={16} aria-hidden="true" />
            <div className="notice__body">
              <strong className="notice__title">Your archive is local</strong>
              <p>
                This recording lives in IndexedDB. Export it before clearing browser data or moving to
                another device. Audio is not included in JSON/Markdown exports.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <Modal
        open={editOpen}
        onClose={busy === "edit" ? () => undefined : () => setEditOpen(false)}
        title="Edit recording details"
        description="Changes to metadata do not alter the transcript. Claims are re-checked automatically."
        size="md"
        footer={
          <>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setEditOpen(false)}
              disabled={busy === "edit"}
            >
              Cancel
            </button>
            <button type="button" className="button button--primary" onClick={() => void saveEdit()} disabled={busy === "edit"}>
              {busy === "edit" ? <LoaderCircle size={15} className="spin" /> : null}
              {busy === "edit" ? "Saving…" : "Save details"}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="field">
            <label htmlFor="edit-title">Title</label>
            <input id="edit-title" className="input" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="edit-speaker">Narrator</label>
            <input
              id="edit-speaker"
              className="input"
              value={editSpeaker}
              onChange={(event) => setEditSpeaker(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-place">Place / locality</label>
            <input id="edit-place" className="input" value={editPlace} onChange={(event) => setEditPlace(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="edit-period">Approximate period</label>
            <input
              id="edit-period"
              className="input"
              value={editPeriod}
              onChange={(event) => setEditPeriod(event.target.value)}
            />
          </div>
          <div className="field field--full">
            <label htmlFor="edit-topics">Topics</label>
            <input id="edit-topics" className="input" value={editTopics} onChange={(event) => setEditTopics(event.target.value)} />
          </div>
          <div className="field field--full">
            <label htmlFor="edit-notes">Context notes</label>
            <textarea
              id="edit-notes"
              className="textarea"
              value={editNotes}
              onChange={(event) => setEditNotes(event.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={transcriptOpen}
        onClose={busy === "transcript" ? () => undefined : () => setTranscriptOpen(false)}
        title={recording.transcriptSegments.length > 0 ? "Edit transcript" : "Add a transcript"}
        description="SRT/WebVTT cues and plain text are accepted. Changing the words can invalidate existing claims."
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setTranscriptOpen(false)}
              disabled={busy === "transcript"}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => void saveTranscript()}
              disabled={busy === "transcript"}
            >
              {busy === "transcript" ? <LoaderCircle size={15} className="spin" /> : null}
              {busy === "transcript" ? "Saving…" : "Save transcript"}
            </button>
          </>
        }
      >
        <div className="stack">
          <div className="notice notice--warning">
            <TriangleAlert size={16} aria-hidden="true" />
            <div className="notice__body">
              <p>
                Editing a timed transcript preserves cue timestamps only when the SRT/WebVTT structure is
                kept. Existing claims are re-checked against the new text; quotations that no longer exist
                are flagged, never silently rewritten.
              </p>
            </div>
          </div>
          <textarea
            className="textarea textarea--transcript"
            value={transcriptText}
            onChange={(event) => setTranscriptText(event.target.value)}
            placeholder="Paste or edit the transcript here…"
            aria-label="Transcript text"
          />
          <p className="help">
            {transcriptText.includes("-->")
              ? "Timestamped cues detected. Segment IDs are preserved where the text and timing are unchanged."
              : "Plain text: segments will have no verified timestamps."}
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this recording?"
        description={`"${recording.title}" and its ${recordingClaims.length} claim${recordingClaims.length === 1 ? "" : "s"} will be removed from this browser. Comparisons that depend on them may also be deleted. This cannot be undone without a backup export.`}
        confirmLabel="Delete recording"
        destructive
        busy={busy === "delete"}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
      />

      <ConsentDialog
        open={consent !== null}
        title={consentConfig.title}
        operation={consentConfig.operation}
        dataSummary={consentConfig.dataSummary}
        onCancel={() => {
          if (busy === null) setConsent(null);
        }}
        onConfirm={() => {
          if (consent === "extract") void confirmExtract();
          if (consent === "transcribe") void confirmTranscribe();
        }}
        busy={busy === "extract" || busy === "transcribe"}
        confirmLabel={consentConfig.confirmLabel}
      />
    </>
  );
}
