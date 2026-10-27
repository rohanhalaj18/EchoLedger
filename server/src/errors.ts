export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

const GENERIC_MESSAGE = "Something went wrong while contacting the AI service. Please try again.";

function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  for (const value of [candidate.status, candidate.statusCode, candidate.code]) {
    if (typeof value === "number") return value;
    if (typeof value === "string" && /^\d{3}$/.test(value)) return Number(value);
  }
  return undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Convert SDK/provider failures into stable, non-sensitive API errors.
 * Raw provider messages are logged server-side only.
 */
export function mapGeminiError(error: unknown): AppError {
  if (isAppError(error)) return error;

  const status = statusOf(error);
  const message = messageOf(error);
  console.error("[gemini]", message);

  if (/API key|api_key|unauthenticated|invalid key|permission denied|forbidden/i.test(message)) {
    return new AppError(
      503,
      "AI_AUTH_FAILED",
      "Gemini rejected the server API key. Check GEMINI_API_KEY in the server environment.",
    );
  }
  if (status === 429 || /rate limit|quota|resource exhausted/i.test(message)) {
    return new AppError(
      429,
      "RATE_LIMITED",
      "The Gemini API is rate-limited right now. Wait a moment and try again.",
    );
  }
  if (status === 413 || /too large|payload size/i.test(message)) {
    return new AppError(413, "FILE_TOO_LARGE", "The recording is too large for Gemini to process.");
  }
  if (status === 415 || /unsupported|mime/i.test(message)) {
    return new AppError(
      415,
      "UNSUPPORTED_FORMAT",
      "Gemini could not read this audio format. Try WAV, MP3, M4A, WebM, OGG or FLAC.",
    );
  }
  if (status === 404 || /model.*not found|not found.*model/i.test(message)) {
    return new AppError(
      502,
      "MODEL_UNAVAILABLE",
      "The configured Gemini model is unavailable. Update GEMINI_TEXT_MODEL or GEMINI_TRANSCRIBE_MODEL.",
    );
  }
  if (status === 400) {
    return new AppError(
      502,
      "AI_BAD_REQUEST",
      "Gemini could not process this request. Check the file, transcript length and configured models.",
    );
  }
  if (status === 401 || status === 403) {
    return new AppError(
      503,
      "AI_AUTH_FAILED",
      "Gemini authentication failed. Check GEMINI_API_KEY in the server environment.",
    );
  }
  if (/timeout|timed out|aborted/i.test(message)) {
    return new AppError(
      504,
      "AI_TIMEOUT",
      "Gemini took too long to respond. The recording may be long; try a shorter excerpt.",
    );
  }
  return new AppError(502, "AI_ERROR", GENERIC_MESSAGE);
}
