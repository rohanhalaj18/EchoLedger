# EchoLedger

**Every account, held to its source.**

EchoLedger is an evidence-first, local-first research workspace for multilingual oral history. It helps researchers record what narrators said, trace every extracted claim back to a verbatim quotation and audio position, and compare accounts without turning disagreement into a verdict.

The archive lives in the browser. Google Gemini is used only for explicit, consented steps: audio transcription, claim extraction, and cross-account comparison.

> **Demonstration data is fictional.** The built-in Nilavari Lake Festival archive is an invented teaching dataset with synthetic TTS audio. It is labelled DEMO throughout the interface and exports, and must not be cited as history.

---

## Why EchoLedger

Oral-history tools often flatten testimony into a single summary. That hides uncertainty, erases language, and makes it hard to tell what a narrator actually said versus what a researcher or model inferred.

EchoLedger is built around four rules:

1. **The quotation is the unit of evidence.** A claim without an exact supporting excerpt is rejected, not silently rewritten.
2. **Uncertainty is information.** The interface distinguishes what was said from what was inferred, and describes evidence quality rather than declaring historical truth.
3. **Comparison is not adjudication.** Relationship labels such as _shared account_ or _conflicting accounts_ describe the accounts, not which narrator is right.
4. **Local first, consent first.** Audio, transcripts, claims, and notes stay in IndexedDB. Nothing is sent to Gemini until the researcher confirms a specific operation.

---

## What is implemented

### Research workspace

- **Dashboard** — archive counts, language coverage, recent recordings, open research threads, Gemini status, and a clearly labelled demo-archive entry point.
- **Recording intake** — upload WAV, MP3, M4A, WebM, OGG, FLAC, or AAC; or add a transcript-only record by pasting plain text, SRT, or WebVTT. Audio can be saved without transcription and transcribed later.
- **Archive library** — search across titles, narrators, places, topics, and transcript text; filter by language, place, source type; sort by date, title, or narrator; export the archive.
- **Recording detail** — audio playback, transcript segments, inline transcript editing with quote re-validation, claim extraction, source metadata, and deletion.
- **Claim explorer** — search and filter the full claim ledger by type, uncertainty, relationship, recording, language, and evidence status; export CSV.
- **Claim detail** — verbatim quotation in the original language, English translation where available, surrounding transcript context, audio excerpt playback, timestamp provenance, researcher review status, and notes.
- **Cross-account comparison** — select two to eight recordings, choose claims, and ask Gemini to propose provisional relationship groups. The server validates every claim and quotation against the selected transcripts before sending anything to the model.
- **Comparison detail** — relationship groups, per-claim quotations, warnings, JSON and Markdown export, and deletion.
- **Research map** — timeline of explicitly dated claims, thematic index of named entities, and cross-recording relationship groups. Relative expressions such as "the year after the flood" are preserved and never converted into dates.
- **Settings & AI** — Gemini connection status, model and upload limits, local-storage estimate, archive exports, demo loading/removal, and full local-data deletion.
- **Responsive shell** — desktop sidebar, mobile navigation, keyboard-accessible dialogs, and visible focus states.

### Evidence integrity

- Every Gemini-extracted quote is located in the canonical transcript. Matching tolerates case and whitespace only; the stored quote is sliced from the transcript itself.
- Claims whose quotations cannot be found are rejected and counted. The UI reports the rejection instead of saving invented evidence.
- Dates are accepted only when the narrator explicitly spoke a four-digit year inside the supporting quotation.
- Relative time expressions are retained only when they appear verbatim in the quotation.
- Inferred claims are raised to at least medium uncertainty and require an interpretation note.
- Segment timestamps are used only when present and internally consistent. Transcript-only records never receive invented playback positions.
- Comparison claim IDs are checked against the submitted claims, and quotations are re-validated against source transcripts before the model call.
- Deleting a recording cascades to its claims, audio blob, and affected comparison groups.

### Exports

- **Archive JSON** — stable `echoledger.research.v1` schema with recordings, transcripts, claims, evidence provenance, comparison groups, model metadata, and a disclaimer.
- **Claims CSV** — one row per claim, including quotation, timestamp provenance, entities, relationships, evidence status, and researcher notes.
- **Markdown report** — human-readable archive or single-comparison report with quotations and demo warnings.
- Audio is **not** included in exports; it remains in the browser archive.

### Demo mode

- Three fictional narrators: Meera Kulkarni (Marathi), Rukmini Rao (Kannada), and Arjun Deshpande (Hindi).
- 13 claims, 6 relationship groups, and one saved comparison.
- Real generated audio files with verified durations and segment timestamps.
- Every demo recording, claim, comparison, banner, and export is labelled as fictional demonstration data.

---

## Google technology

EchoLedger uses the current official [`@google/genai`](https://www.npmjs.com/package/@google/genai) JavaScript SDK.

| Purpose | Default model | Google capability |
| --- | --- | --- |
| Transcription | `gemini-3.5-transcribe` | Files API upload, `audioTranscriptionConfig`, `VERBATIM` mode, word-level timestamps, optional BCP-47 language hint |
| Claim extraction | `gemini-3.8-flash` | Structured JSON output with a response schema, Zod validation, server-side quote/date checks |
| Comparison | `gemini-3.8-flash` | Structured JSON output, validated claim references, provisional relationship labels |

Model IDs are configuration, not hard-coded assumptions: set `GEMINI_TEXT_MODEL` and `GEMINI_TRANSCRIBE_MODEL` in `.env`.

The API key is read only by the Node server. It is never bundled into the client, returned by the status endpoint, or stored in IndexedDB.

---

## Privacy and trust boundaries

```text
Browser (IndexedDB)                 Node/Express (no archive DB)              Google Gemini
──────────────────                 ───────────────────────────              ─────────────
recordings, audio blobs  ────────►  temporary upload / JSON validation  ───►  consented request
transcripts, claims                 deletes temp audio after request          returns transcript,
comparisons, notes        ◄────────  forwards validated result only    ◄────  claims, relationships
```

- **Local by default.** The server has no database and does not persist archive data. Uploaded audio is written to a temporary directory only for the duration of a transcription request and deleted in a `finally` block; stale uploads are cleared at startup and shutdown.
- **Explicit consent.** A modal lists exactly what will leave the device before transcription, extraction, or comparison. The consent checkbox must be checked for each operation.
- **Provider processing.** When consent is given, the selected audio, transcript, metadata, or claims are processed by Google Gemini under Google's terms and data-handling policies. Do not upload material you are not authorised to share.
- **No truth verdicts.** Prompts forbid external historical knowledge and explicitly instruct the model not to decide which narrator is correct. Relationship labels are descriptive and provisional.
- **AI can be wrong.** Every AI output requires human review against the original quotation and audio.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Client | React 19, Vite 8, TypeScript, React Router 7, Lucide, `idb` |
| Styling | Hand-written CSS design system, Fraunces and Inter variable fonts |
| Server | Node.js 20.19+, Express 5, TypeScript, Zod 4, Multer, `music-metadata` |
| AI | `@google/genai`, Gemini 3.5 Transcribe, Gemini 3.8 Flash |
| Storage | Browser IndexedDB (`echoledger`) |
| Security | Helmet, CORS allow-list, rate limiting, upload type/size/duration limits |

No client-side API key, no server-side archive database, and no analytics or tracking scripts.

---

## Quick start

### Prerequisites

- Node.js **20.19 or newer**
- npm 10 or newer
- A modern browser with IndexedDB
- Optional: a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Install

```bash
git clone https://github.com/rohanhalaj18/EchoLedger.git
cd EchoLedger
npm install
```

### 2. Configure the server

```bash
cp .env.example .env
```

Add your key to `.env`:

```dotenv
GEMINI_API_KEY=your_key_here
```

The app is fully usable without a key for demo data, transcript-only records, transcript editing, search, exports, and manual review. Live transcription, claim extraction, and comparison require the key.

### 3. Develop

```bash
npm run dev
```

- Client: <http://localhost:5173>
- API: <http://localhost:8787>
- Health check: <http://localhost:8787/api/health>

Vite proxies `/api` to the Express server.

### 4. Production build

```bash
npm run build
npm run start
```

The Express server serves the built SPA and API from <http://localhost:8787>. `npm run build` must be run before `npm run start`.

### 5. Explore the demo

Open the app, choose **Explore the demo archive** on the dashboard, then visit **Claim explorer**, **Research map**, or **Compare accounts**. Synthetic demo audio is served from `client/public/demo-audio/`.

---

## Environment variables

All variables are optional except `GEMINI_API_KEY` for live AI features. Values are read from `.env` at the repository root.

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | empty | Server-only Gemini API key. Live AI is disabled when empty. |
| `GEMINI_TEXT_MODEL` | `gemini-3.8-flash` | Structured claim extraction and comparison model. |
| `GEMINI_TRANSCRIBE_MODEL` | `gemini-3.5-transcribe` | Audio transcription model with word timestamps. |
| `PORT` | `8787` | Express server port. |
| `CLIENT_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed browser origins in development. Same-origin production requests are always allowed. |
| `MAX_AUDIO_MB` | `100` | Maximum upload size. |
| `MAX_AUDIO_MINUTES` | `30` | Maximum accepted audio duration. Gemini word-level transcription is limited to 30 minutes per request. |
| `NODE_ENV` | `development` | Set to `production` when serving the built app. |

`.env` is git-ignored. Never commit a real key. `.env.example` contains placeholders only.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the Express API and Vite dev server together. |
| `npm run build` | Builds the server and client. |
| `npm run start` | Starts the compiled Express server and serves the built client. |
| `npm run typecheck` | Type-checks both workspaces. |
| `npm run clean` | Removes `client/dist` and `server/dist`. |

This MVP intentionally does not include an automated test suite. Verification is performed with type-checking, production builds, and a browser walkthrough of the demo and transcript-only flows. See [docs/architecture.md](docs/architecture.md#verification) for details.

---

## API surface

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service and AI configuration status. |
| `GET` | `/api/ai/status` | Model IDs, upload limits, and configured state (never the key). |
| `POST` | `/api/ai/transcribe` | Consented audio upload and transcription. |
| `POST` | `/api/ai/extract-claims` | Consented claim extraction with server-side evidence validation. |
| `POST` | `/api/ai/compare` | Consented cross-account comparison with claim/quote validation. |

All AI routes are rate-limited to 40 requests per 15 minutes per client. Request bodies are capped at 12 MB; audio uploads are capped separately by `MAX_AUDIO_MB`.

---

## Repository layout

```text
EchoLedger/
├── client/
│   ├── public/demo-audio/    # Synthetic demo audio + metadata
│   └── src/
│       ├── components/       # Shell, audio, evidence, consent, cards
│       ├── context/          # Archive state and toasts
│       ├── data/             # Fictional demo dataset
│       ├── lib/              # IndexedDB, API client, exports, parsing
│       ├── pages/            # Dashboard through Settings
│       └── styles/           # Design system and responsive layout
├── server/
│   └── src/
│       ├── routes/           # Validated AI endpoints
│       ├── config.ts         # Environment configuration
│       ├── gemini.ts         # Transcription, extraction, comparison
│       ├── prompts.ts        # Evidence-first prompts
│       ├── schemas.ts        # Zod request and model schemas
│       └── transcript.ts     # Quote location and transcript parsing
├── docs/architecture.md
├── .env.example
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

---

## Verification and limitations

Verified in this checkout:

- `npm run typecheck` passes for the server and client.
- `npm run build` completes and the production Express server serves the SPA, API, and demo audio.
- Browser walkthrough covers demo seeding, dashboard, library search, recording detail and audio metadata, claim explorer and detail, research map timeline/themes/relationships, comparison detail, settings, transcript-only record creation, and deletion.
- Demo and transcript-only flows work without a Gemini key. Live Gemini requests return a clear `AI_NOT_CONFIGURED` response when no key is present.

Limitations:

- **Live Gemini calls were not exercised in this checkout because no API key was available.** The integration follows the current official SDK and documented request shapes, but a keyed smoke test is still required before production use.
- The archive is local to one browser profile. It does not sync across devices and is lost if site data is cleared. Use exports for backup.
- Audio is not embedded in exports.
- Speaker diarization is not enabled; speaker labels are optional manual metadata.
- The demo dataset is fictional and synthetic. It is not evidence of any real event, place, or person.
- AI output is provisional. Researchers must review quotations, translations, dates, and relationship labels against the source.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, evidence-integrity rules, and the pull-request checklist.

## License

MIT. See [LICENSE](LICENSE).
