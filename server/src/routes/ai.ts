import { randomUUID } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { parseFile } from "music-metadata";
import { aiStatus, config } from "../config.js";
import { AppError } from "../errors.js";
import { compareClaims, extractClaims, transcribeAudio } from "../gemini.js";
import { compareRequestSchema, extractClaimsRequestSchema } from "../schemas.js";

const uploadDir = path.join(tmpdir(), "echoledger-uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".webm", ".ogg", ".flac", ".aac"]);

function mimeForUpload(originalName: string, fallback: string): string {
  const extension = path.extname(originalName).toLowerCase();
  switch (extension) {
    case ".wav":
      return "audio/wav";
    case ".mp3":
      return "audio/mp3";
    case ".m4a":
      return "audio/m4a";
    case ".webm":
      return "audio/webm";
    case ".ogg":
      return "audio/ogg";
    case ".flac":
      return "audio/flac";
    case ".aac":
      return "audio/aac";
    default:
      return fallback;
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, uploadDir),
    filename: (_request, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase() || ".audio";
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: {
    fileSize: config.maxAudioMb * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(extension)) {
      callback(
        new AppError(
          415,
          "UNSUPPORTED_FORMAT",
          "Unsupported audio format. Use WAV, MP3, M4A, WebM, OGG, FLAC or AAC.",
        ),
      );
      return;
    }
    callback(null, true);
  },
});

function asyncRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response, next).catch(next);
  };
}

function parseBody<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: unknown } } },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(400, "INVALID_REQUEST", "The request was missing or contained invalid fields.", result.error.issues);
  }
  return result.data;
}

export const aiRouter = Router();

aiRouter.get("/status", (_request, response) => {
  response.json(aiStatus());
});

aiRouter.post(
  "/transcribe",
  upload.single("audio"),
  asyncRoute(async (request, response) => {
    const file = request.file;
    if (!file) {
      throw new AppError(400, "MISSING_AUDIO", "Choose an audio file to transcribe.");
    }

    try {
      if (request.body.consent !== "true") {
        throw new AppError(
          400,
          "CONSENT_REQUIRED",
          "Explicit consent is required before sending audio to Gemini.",
        );
      }

      const rawLanguageCode =
        typeof request.body.languageCode === "string" ? request.body.languageCode.trim() : "";
      const languageCode = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(rawLanguageCode)
        ? rawLanguageCode
        : null;
      const mimeType = mimeForUpload(file.originalname, file.mimetype);

      let durationSeconds: number | null = null;
      try {
        const metadata = await parseFile(file.path);
        durationSeconds = metadata.format.duration ?? null;
      } catch {
        // Some browser WebM recordings do not expose duration metadata. Gemini can still try.
      }

      if (durationSeconds !== null && durationSeconds > config.maxAudioMinutes * 60) {
        throw new AppError(
          413,
          "AUDIO_TOO_LONG",
          `This recording is longer than ${config.maxAudioMinutes} minutes. Trim it or add a transcript manually. Word-level Gemini transcription is limited to ${config.maxAudioMinutes} minutes per request.`,
        );
      }

      const result = await transcribeAudio({
        filePath: file.path,
        mimeType,
        languageCode,
      });
      response.json({
        ...result,
        durationSeconds: result.durationSeconds ?? durationSeconds,
        consent: true,
      });
    } finally {
      // The local server never retains uploaded audio, including on validation errors.
      await fsp.unlink(file.path).catch(() => undefined);
    }
  }),
);

aiRouter.post(
  "/extract-claims",
  asyncRoute(async (request, response) => {
    const payload = parseBody(extractClaimsRequestSchema, request.body);
    const result = await extractClaims({
      recording: payload.recording,
      segments: payload.segments,
    });
    response.json({
      ...result,
      disclaimer:
        "AI-assisted extraction — provisional findings for human review. Claims describe what a narrator said, not verified historical facts.",
    });
  }),
);

aiRouter.post(
  "/compare",
  asyncRoute(async (request, response) => {
    const payload = parseBody(compareRequestSchema, request.body);
    const result = await compareClaims({
      recordings: payload.recordings,
      claims: payload.claims,
    });
    response.json(result);
  }),
);

export function cleanupUploadDir(): void {
  try {
    for (const entry of fs.readdirSync(uploadDir)) {
      fs.rmSync(path.join(uploadDir, entry), { force: true });
    }
  } catch {
    // Best effort cleanup at shutdown.
  }
}
