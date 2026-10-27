import { useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  AudioLines,
  FileText,
  FileUp,
  Info,
  LoaderCircle,
  Mic,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { ConsentDialog } from "@/components/ConsentDialog";
import { PageHeader } from "@/components/PageHeader";
import { useArchive } from "@/context/ArchiveContext";
import { useToast } from "@/context/ToastContext";
import { ApiError, extractClaims, transcribeAudio } from "@/lib/api";
import {
  cn,
  formatDuration,
  formatFileSize,
  parseTimestampedTranscript,
  uid,
} from "@/lib/utils";
import { LANGUAGE_OPTIONS, type Recording } from "@/types";

type SourceMode = "audio" | "transcript";
type BusyState = "save" | "transcribe" | "extract" | null;

function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      audio.removeAttribute("src");
      URL.revokeObjectURL(url);
      resolve(value);
    };

    const timer = window.setTimeout(() => finish(null), 8000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      finish(Number.isFinite(audio.duration) ? audio.duration : null);
    };
    audio.onerror = () => finish(null);
    audio.src = url;
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function AddRecordingPage() {
  const navigate = useNavigate();
  const { addRecording, replaceClaims, aiStatus, aiStatusError } = useArchive();
  const { notify } = useToast();

  const [mode, setMode] = useState<SourceMode>("audio");
  const [title, setTitle] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [languageChoice, setLanguageChoice] = useState("hi-IN");
  const [customLanguage, setCustomLanguage] = useState("");
  const [place, setPlace] = useState("");
  const [period, setPeriod] = useState("");
  const [topics, setTopics] = useState("");
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<BusyState>(null);
  const [consent, setConsent] = useState<null | "transcribe" | "extract">(null);

  const selectedLanguage = useMemo(
    () => LANGUAGE_OPTIONS.find((option) => option.code === languageChoice),
    [languageChoice],
  );
  const language =
    languageChoice === "__other" ? customLanguage.trim() : (selectedLanguage?.label ?? "");
  const languageCode = languageChoice === "__other" ? null : languageChoice || null;
  const transcriptSegments = useMemo(() => parseTimestampedTranscript(transcript), [transcript]);
  const maxAudioMb = aiStatus?.maxAudioMb ?? 100;
  const aiConfigured = Boolean(aiStatus?.configured);

  const updateError = (key: string, value: string) => {
    setErrors((previous) => {
      const next = { ...previous };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Give this recording a short, descriptive title.";
    if (!speaker.trim()) next.speaker = "Record the narrator's name or a research pseudonym.";
    if (!language) next.language = "Choose the language of the recording.";
    if (mode === "audio" && !file) next.file = "Choose an audio file, or switch to transcript-only.";
    if (mode === "transcript" && !transcript.trim()) {
      next.transcript = "Paste or import a transcript before saving.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const acceptAudio = async (nextFile: File) => {
    updateError("file", "");
    if (!nextFile.type.startsWith("audio/") && !/\.(wav|mp3|m4a|webm|ogg|flac|aac)$/i.test(nextFile.name)) {
      updateError("file", "Choose an audio file: WAV, MP3, M4A, WebM, OGG, FLAC or AAC.");
      return;
    }
    if (nextFile.size > maxAudioMb * 1024 * 1024) {
      updateError("file", `This file is larger than the ${maxAudioMb} MB upload limit.`);
      return;
    }
    setFile(nextFile);
    setDuration(await readAudioDuration(nextFile));
  };

  const handleAudioInput = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) void acceptAudio(nextFile);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) void acceptAudio(nextFile);
  };

  const handleTranscriptFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    event.target.value = "";
    if (!nextFile) return;
    try {
      const text = await nextFile.text();
      setTranscript(text);
      updateError("transcript", "");
      notify(`Loaded ${nextFile.name}. Check the text before saving.`, "info");
    } catch {
      notify("That transcript file could not be read.", "error");
    }
  };

  const buildRecording = (options: {
    segments: Recording["transcriptSegments"];
    transcriptSource: Recording["transcriptSource"];
    audio: Recording["audio"];
    consentAt: string | null;
  }): Recording => {
    const now = new Date().toISOString();
    return {
      id: uid("rec"),
      title: title.trim(),
      speaker: speaker.trim(),
      language,
      languageCode,
      place: place.trim(),
      period: period.trim(),
      topics: topics
        .split(/[,;]/)
        .map((topic) => topic.trim())
        .filter(Boolean),
      notes: notes.trim(),
      createdAt: now,
      updatedAt: now,
      source: mode,
      transcriptSource: options.transcriptSource,
      transcriptSegments: options.segments,
      audio: options.audio,
      isDemo: false,
      consentAt: options.consentAt,
      transcriptEditedAt: null,
    };
  };

  const audioMetadata = (durationSeconds: number | null): Recording["audio"] =>
    file
      ? {
          fileName: file.name,
          mimeType: file.type || "audio/mpeg",
          size: file.size,
          durationSeconds,
        }
      : null;

  const handleSave = async () => {
    if (!validate()) return;
    setBusy("save");
    try {
      const recording =
        mode === "audio"
          ? buildRecording({
              segments: [],
              transcriptSource: "manual",
              audio: audioMetadata(duration),
              consentAt: null,
            })
          : buildRecording({
              segments: transcriptSegments,
              transcriptSource: transcript.includes("-->")
                ? /^WEBVTT/i.test(transcript.trim())
                  ? "vtt"
                  : "srt"
                : "manual",
              audio: null,
              consentAt: null,
            });

      await addRecording(
        recording,
        mode === "audio" && file
          ? { blob: file, mimeType: file.type || "audio/mpeg", fileName: file.name }
          : null,
      );
      notify(
        mode === "audio"
          ? "Recording saved to this browser. You can transcribe it from the record page."
          : "Transcript saved to this browser.",
        "success",
      );
      navigate(`/recordings/${recording.id}`);
    } catch (saveError) {
      notify(errorMessage(saveError), "error");
    } finally {
      setBusy(null);
    }
  };

  const handleTranscribe = () => {
    if (!validate()) return;
    if (!aiConfigured) {
      notify("Gemini is not configured. Save the audio now and add a transcript later.", "error");
      return;
    }
    setConsent("transcribe");
  };

  const handleExtractAndSave = () => {
    if (!validate()) return;
    if (!aiConfigured) {
      notify("Gemini is not configured. Save the transcript now and extract claims later.", "error");
      return;
    }
    setConsent("extract");
  };

  const confirmTranscribe = async () => {
    if (!file) return;
    setBusy("transcribe");
    try {
      const result = await transcribeAudio(file, languageCode);
      const now = new Date().toISOString();
      const recording = buildRecording({
        segments: result.segments,
        transcriptSource: "gemini",
        audio: audioMetadata(result.durationSeconds ?? duration),
        consentAt: now,
      });
      await addRecording(recording, {
        blob: file,
        mimeType: file.type || "audio/mpeg",
        fileName: file.name,
      });
      if (result.timestampSource === "none") {
        notify(
          "Transcribed and saved. Gemini did not return word-level timing, so this transcript has no verified timestamps.",
          "info",
        );
      } else {
        notify("Transcribed and saved with word-level timestamps.", "success");
      }
      if (result.warnings.length > 0) notify(result.warnings[0]!, "info");
      navigate(`/recordings/${recording.id}`);
    } catch (transcriptionError) {
      notify(errorMessage(transcriptionError), "error");
    } finally {
      setBusy(null);
      setConsent(null);
    }
  };

  const confirmExtract = async () => {
    setBusy("extract");
    let saved: Recording | null = null;
    try {
      const now = new Date().toISOString();
      saved = buildRecording({
        segments: transcriptSegments,
        transcriptSource: transcript.includes("-->")
          ? /^WEBVTT/i.test(transcript.trim())
            ? "vtt"
            : "srt"
          : "manual",
        audio: null,
        consentAt: now,
      });
      await addRecording(saved);
      const result = await extractClaims(saved, saved.transcriptSegments);
      await replaceClaims(saved.id, result.claims);
      if (result.claims.length === 0) {
        notify(
          "Recording saved, but Gemini found no claims that could be tied to a verbatim quote.",
          "info",
        );
      } else {
        notify(
          `Saved with ${result.claims.length} evidence-linked claim${result.claims.length === 1 ? "" : "s"}.`,
          "success",
        );
      }
      if (result.rejectedCount > 0) {
        notify(
          `${result.rejectedCount} generated claim${result.rejectedCount === 1 ? " was" : "s were"} rejected because the quotation was not found in the transcript.`,
          "info",
        );
      }
      navigate(`/recordings/${saved.id}`);
    } catch (extractError) {
      if (saved) {
        notify(
          `Recording saved, but claim extraction failed: ${errorMessage(extractError)}`,
          "error",
        );
        navigate(`/recordings/${saved.id}`);
      } else {
        notify(errorMessage(extractError), "error");
      }
    } finally {
      setBusy(null);
      setConsent(null);
    }
  };

  const consentConfig =
    consent === "transcribe"
      ? {
          title: "Send this audio to Gemini?",
          operation: "Gemini 3.5 Transcribe will transcribe the recording and may return word-level timestamps.",
          dataSummary: [
            `Audio file: ${file?.name ?? "selected file"} (${file ? formatFileSize(file.size) : "unknown size"})`,
            `Language hint: ${language || "not selected"}`,
            "Recording metadata: title, narrator, place, period and context notes",
            "No other archive records are sent.",
          ],
          confirmLabel: "I consent — transcribe audio",
        }
      : {
          title: "Send this transcript to Gemini?",
          operation: "Gemini will propose evidence-linked claims from the transcript.",
          dataSummary: [
            `${transcriptSegments.length} transcript segment${transcriptSegments.length === 1 ? "" : "s"}`,
            "Recording metadata: title, narrator, language, place, period and context notes",
            "No audio is sent.",
          ],
          confirmLabel: "I consent — extract claims",
        };

  return (
    <>
      <PageHeader
        eyebrow="New record"
        title="Add a recording"
        description="Capture a narrator's own words, then keep every later claim attached to a verbatim source. AI steps are optional and always require explicit consent."
        actions={
          <Link to="/library" className="button button--ghost">
            <ArrowLeft size={15} aria-hidden="true" /> Back to archive
          </Link>
        }
      />

      <div className="detail-layout">
        <div className="detail-main">
          <form
            className="panel"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <div className="panel__body form">
              {Object.keys(errors).length > 0 ? (
                <div className="notice notice--danger" role="alert">
                  <TriangleAlert size={18} aria-hidden="true" />
                  <div className="notice__body">
                    <strong className="notice__title">A few details need attention</strong>
                    <p>Check the highlighted fields before saving this record.</p>
                  </div>
                </div>
              ) : null}

              <section className="form-section">
                <div className="form-section__header">
                  <div>
                    <h2>Source material</h2>
                    <p>Audio is stored in this browser&apos;s IndexedDB. Nothing is uploaded unless you choose a Gemini step.</p>
                  </div>
                </div>

                <div className="radio-cards" role="radiogroup" aria-label="Source type">
                  <label className={cn("radio-card", mode === "audio" && "radio-card--active")}>
                    <input
                      type="radio"
                      name="source-mode"
                      value="audio"
                      checked={mode === "audio"}
                      onChange={() => setMode("audio")}
                    />
                    <span className="radio-card__icon">
                      <Mic size={17} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>Audio recording</strong>
                      <small>Upload an interview file. Transcribe it later or with Gemini.</small>
                    </span>
                  </label>
                  <label className={cn("radio-card", mode === "transcript" && "radio-card--active")}>
                    <input
                      type="radio"
                      name="source-mode"
                      value="transcript"
                      checked={mode === "transcript"}
                      onChange={() => setMode("transcript")}
                    />
                    <span className="radio-card__icon">
                      <FileText size={17} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>Transcript only</strong>
                      <small>Paste plain text, SRT or WebVTT. No audio is required.</small>
                    </span>
                  </label>
                </div>

                {mode === "audio" ? (
                  <div className="field field--full">
                    {file ? (
                      <div className="file-selected">
                        <span className="file-selected__icon">
                          <AudioLines size={17} aria-hidden="true" />
                        </span>
                        <div className="file-selected__body">
                          <strong>{file.name}</strong>
                          <span>
                            {formatFileSize(file.size)}
                            {duration ? ` · ${formatDuration(duration)}` : " · duration unavailable"}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          onClick={() => {
                            setFile(null);
                            setDuration(null);
                          }}
                        >
                          Replace
                        </button>
                      </div>
                    ) : (
                      <label
                        className={cn("file-drop", dragging && "file-drop--active")}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                      >
                        <input type="file" accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg,.flac,.aac" onChange={handleAudioInput} />
                        <span className="file-drop__icon">
                          <Upload size={18} aria-hidden="true" />
                        </span>
                        <strong>Drop an audio file here, or choose one</strong>
                        <span>WAV, MP3, M4A, WebM, OGG, FLAC or AAC · up to {maxAudioMb} MB</span>
                      </label>
                    )}
                    {errors.file ? <p className="field-error">{errors.file}</p> : null}
                    <p className="help">
                      For long interviews, check the configured upload and duration limits in Settings. A
                      transcript can be added later even if transcription fails.
                    </p>
                  </div>
                ) : (
                  <div className="field field--full">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <label htmlFor="transcript">Transcript</label>
                      <label className="button button--ghost button--small" style={{ cursor: "pointer" }}>
                        <FileUp size={13} aria-hidden="true" /> Import .txt / .srt / .vtt
                        <input
                          type="file"
                          accept=".txt,.srt,.vtt,text/plain"
                          className="sr-only"
                          onChange={handleTranscriptFile}
                        />
                      </label>
                    </div>
                    <textarea
                      id="transcript"
                      className="textarea textarea--transcript"
                      value={transcript}
                      onChange={(event) => {
                        setTranscript(event.target.value);
                        updateError("transcript", "");
                      }}
                      placeholder={
                        "Paste the narrator's words here.\n\nSRT and WebVTT timestamps are parsed into verified segments. Plain text is grouped into short passages without timestamps — EchoLedger will not invent playback positions."
                      }
                    />
                    {errors.transcript ? <p className="field-error">{errors.transcript}</p> : null}
                    <p className="help">
                      {transcript.trim()
                        ? `${transcriptSegments.length} segment${transcriptSegments.length === 1 ? "" : "s"} detected${
                            transcript.includes("-->") ? " with cue timestamps" : " without timestamps"
                          }.`
                        : "Keep the original language. Add an English translation later in the transcript editor if needed."}
                    </p>
                  </div>
                )}
              </section>

              <section className="form-section">
                <div className="form-section__header">
                  <div>
                    <h2>Narrator & context</h2>
                    <p>Context helps a researcher interpret the account. It never overrides the source.</p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="title">
                      Recording title <span className="required">*</span>
                    </label>
                    <input
                      id="title"
                      className="input"
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value);
                        updateError("title", "");
                      }}
                      placeholder="e.g. Memories of the first festival"
                      autoFocus
                    />
                    {errors.title ? <p className="field-error">{errors.title}</p> : null}
                  </div>

                  <div className="field">
                    <label htmlFor="speaker">
                      Narrator <span className="required">*</span>
                    </label>
                    <input
                      id="speaker"
                      className="input"
                      value={speaker}
                      onChange={(event) => {
                        setSpeaker(event.target.value);
                        updateError("speaker", "");
                      }}
                      placeholder="Name or research pseudonym"
                    />
                    {errors.speaker ? <p className="field-error">{errors.speaker}</p> : null}
                  </div>

                  <div className="field">
                    <label htmlFor="language">
                      Language <span className="required">*</span>
                    </label>
                    <select
                      id="language"
                      className="select"
                      value={languageChoice}
                      onChange={(event) => {
                        setLanguageChoice(event.target.value);
                        updateError("language", "");
                      }}
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.code || "other"} value={option.code || "__other"}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {errors.language ? <p className="field-error">{errors.language}</p> : null}
                  </div>

                  {languageChoice === "__other" ? (
                    <div className="field">
                      <label htmlFor="custom-language">Language name</label>
                      <input
                        id="custom-language"
                        className="input"
                        value={customLanguage}
                        onChange={(event) => {
                          setCustomLanguage(event.target.value);
                          updateError("language", "");
                        }}
                        placeholder="e.g. Konkani, Bhojpuri, mixed Marathi–Hindi"
                      />
                    </div>
                  ) : (
                    <div className="field">
                      <label htmlFor="place">Place / locality</label>
                      <input
                        id="place"
                        className="input"
                        value={place}
                        onChange={(event) => setPlace(event.target.value)}
                        placeholder="Village, town or region"
                      />
                    </div>
                  )}

                  {languageChoice === "__other" ? (
                    <div className="field">
                      <label htmlFor="place-other">Place / locality</label>
                      <input
                        id="place-other"
                        className="input"
                        value={place}
                        onChange={(event) => setPlace(event.target.value)}
                        placeholder="Village, town or region"
                      />
                    </div>
                  ) : null}

                  <div className="field">
                    <label htmlFor="period">Approximate period</label>
                    <input
                      id="period"
                      className="input"
                      value={period}
                      onChange={(event) => setPeriod(event.target.value)}
                      placeholder="e.g. Recorded 2024 · memories of the 1960s"
                    />
                  </div>

                  <div className="field field--full">
                    <label htmlFor="topics">Topics</label>
                    <input
                      id="topics"
                      className="input"
                      value={topics}
                      onChange={(event) => setTopics(event.target.value)}
                      placeholder="festival origin, flood, boat ritual (comma-separated)"
                    />
                  </div>

                  <div className="field field--full">
                    <label htmlFor="notes">Context notes</label>
                    <textarea
                      id="notes"
                      className="textarea"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Interview circumstances, consent notes, relationship to the narrator, known gaps. Do not add facts the narrator did not say."
                    />
                    <p className="help">
                      These notes travel with exports so other researchers can judge the context. They
                      are not treated as evidence.
                    </p>
                  </div>
                </div>
              </section>

              <div className="form-actions">
                <button type="submit" className="button button--primary" disabled={busy !== null}>
                  {busy === "save" ? <LoaderCircle size={15} className="spin" /> : <ShieldCheck size={15} />}
                  {busy === "save"
                    ? "Saving locally…"
                    : mode === "audio"
                      ? "Save recording"
                      : "Save transcript"}
                </button>

                {mode === "audio" ? (
                  <button
                    type="button"
                    className="button button--soft"
                    onClick={handleTranscribe}
                    disabled={busy !== null || !aiConfigured}
                    title={!aiConfigured ? "Add GEMINI_API_KEY to the server .env to enable transcription." : undefined}
                  >
                    {busy === "transcribe" ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
                    {busy === "transcribe" ? "Transcribing…" : "Transcribe with Gemini & save"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button button--soft"
                    onClick={handleExtractAndSave}
                    disabled={busy !== null || !aiConfigured}
                    title={!aiConfigured ? "Add GEMINI_API_KEY to the server .env to enable claim extraction." : undefined}
                  >
                    {busy === "extract" ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
                    {busy === "extract" ? "Extracting claims…" : "Save & extract claims"}
                  </button>
                )}

                <div className="form-actions__spacer" />
                <Link to="/library" className="button button--ghost">
                  Cancel
                </Link>
              </div>

              {!aiConfigured ? (
                <div className="notice notice--warning">
                  <Info size={16} aria-hidden="true" />
                  <div className="notice__body">
                    <strong className="notice__title">
                      {aiStatusError ? "The local API server is not reachable" : "Gemini is not configured"}
                    </strong>
                    <p>
                      You can still save audio and transcripts locally. To enable AI transcription and claim
                      extraction, add <code>GEMINI_API_KEY</code> to the root <code>.env</code> and restart the
                      server. <Link to="/settings">Open AI settings</Link>.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </form>
        </div>

        <aside className="detail-aside">
          <section className="panel">
            <div className="panel__header">
              <div>
                <h3>What happens on save</h3>
                <p>No hidden uploads.</p>
              </div>
            </div>
            <div className="panel__body">
              <ul className="integrity-list">
                <li>
                  <ShieldCheck size={14} aria-hidden="true" /> Audio, transcripts and metadata are written
                  to IndexedDB in this browser.
                </li>
                <li>
                  <ShieldCheck size={14} aria-hidden="true" /> The local server does not keep a copy of your
                  archive.
                </li>
                <li>
                  <ShieldCheck size={14} aria-hidden="true" /> Gemini is contacted only after you confirm a
                  consent dialog.
                </li>
                <li>
                  <ShieldCheck size={14} aria-hidden="true" /> Temporary audio uploads are deleted by the
                  server after processing.
                </li>
              </ul>
            </div>
          </section>

          <section className="panel panel--muted">
            <div className="panel__body stack stack--sm">
              <h3>Timestamp policy</h3>
              <p className="small muted">
                EchoLedger only shows playback timestamps that come from SRT/VTT cues or Gemini word
                offsets. Plain-text transcripts get no timestamps. It will never estimate a position from
                a quotation.
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel__body stack stack--sm">
              <h3>Suggested intake practice</h3>
              <p className="small muted">
                Record the consent conversation, note the narrator&apos;s preferred name and language, and
                capture the place and approximate period. Keep your own interpretation in the context
                notes, clearly separated from the narrator&apos;s words.
              </p>
            </div>
          </section>

          <div className="notice notice--info">
            <Info size={16} aria-hidden="true" />
            <div className="notice__body">
              <strong className="notice__title">AI is optional</strong>
              <p>
                You can add a transcript manually and write claims only after reviewing the source. The
                demo archive is also available without any API key.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <ConsentDialog
        open={consent !== null}
        title={consentConfig.title}
        operation={consentConfig.operation}
        dataSummary={consentConfig.dataSummary}
        onCancel={() => {
          if (busy === null) setConsent(null);
        }}
        onConfirm={() => {
          if (consent === "transcribe") void confirmTranscribe();
          if (consent === "extract") void confirmExtract();
        }}
        busy={busy === "transcribe" || busy === "extract"}
        confirmLabel={consentConfig.confirmLabel}
      />
    </>
  );
}
