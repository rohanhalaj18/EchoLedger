import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// Works for both server/src (tsx) and server/dist (compiled): two levels up is the repo root.
dotenv.config({ path: path.resolve(here, "../../.env") });
dotenv.config();

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: positiveInt(process.env.PORT, 8787),
  geminiApiKey: (process.env.GEMINI_API_KEY ?? "").trim(),
  textModel: (process.env.GEMINI_TEXT_MODEL ?? "gemini-3.8-flash").trim(),
  transcribeModel: (process.env.GEMINI_TRANSCRIBE_MODEL ?? "gemini-3.5-transcribe").trim(),
  maxAudioMb: positiveInt(process.env.MAX_AUDIO_MB, 100),
  maxAudioMinutes: positiveInt(process.env.MAX_AUDIO_MINUTES, 30),
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export const isConfigured = () => Boolean(config.geminiApiKey);

export const aiStatus = () => ({
  configured: isConfigured(),
  textModel: config.textModel,
  transcribeModel: config.transcribeModel,
  maxAudioMb: config.maxAudioMb,
  maxAudioMinutes: config.maxAudioMinutes,
  timestampSupport: "word-level timestamps via Gemini 3.5 Transcribe",
  externalProcessing: true,
  note: "Audio, transcripts and claim text are sent to Google Gemini only after explicit consent in the browser. The local server deletes temporary uploads immediately and does not store archive data.",
});
