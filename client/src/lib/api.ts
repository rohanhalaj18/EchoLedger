import type {
  AiClaimResponse,
  AiStatus,
  Claim,
  ComparisonResponse,
  Recording,
  TranscriptSegment,
  TranscriptionResponse,
} from "@/types";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code = "UNKNOWN", status = 0, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = 360_000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const errorBody =
        typeof body === "object" && body !== null && "error" in body
          ? (body as { error: { code?: string; message?: string; details?: unknown } }).error
          : null;
      throw new ApiError(
        errorBody?.message || `Request failed with status ${response.status}.`,
        errorBody?.code || "REQUEST_FAILED",
        response.status,
        errorBody?.details,
      );
    }

    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("The request timed out. Please try again.", "TIMEOUT", 0);
    }
    throw new ApiError(
      "Could not reach the EchoLedger server. Make sure `npm run dev` is running and try again.",
      "NETWORK_ERROR",
      0,
    );
  } finally {
    window.clearTimeout(timer);
  }
}

export function getAiStatus(): Promise<AiStatus> {
  return requestJson<AiStatus>("/api/ai/status", undefined, 15_000);
}

function recordingInput(recording: Recording) {
  return {
    id: recording.id,
    title: recording.title,
    speaker: recording.speaker,
    language: recording.language,
    languageCode: recording.languageCode,
    place: recording.place,
    period: recording.period,
    notes: recording.notes,
  };
}

export function transcribeAudio(
  file: File,
  languageCode: string | null,
): Promise<TranscriptionResponse> {
  const form = new FormData();
  form.append("audio", file, file.name);
  form.append("consent", "true");
  if (languageCode) form.append("languageCode", languageCode);
  return requestJson<TranscriptionResponse>("/api/ai/transcribe", {
    method: "POST",
    body: form,
  });
}

export function extractClaims(
  recording: Recording,
  segments: TranscriptSegment[],
): Promise<AiClaimResponse> {
  return requestJson<AiClaimResponse>("/api/ai/extract-claims", {
    method: "POST",
    body: JSON.stringify({
      recording: recordingInput(recording),
      segments: segments.map((segment) => ({
        id: segment.id,
        text: segment.text,
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
        speakerLabel: segment.speakerLabel,
        translation: segment.translation,
      })),
      consent: true,
    }),
  });
}

export function compareRecordings(
  recordings: Recording[],
  claims: Claim[],
): Promise<ComparisonResponse> {
  return requestJson<ComparisonResponse>("/api/ai/compare", {
    method: "POST",
    body: JSON.stringify({
      recordings: recordings.map((recording) => ({
        ...recordingInput(recording),
        segments: recording.transcriptSegments.map((segment) => ({
          id: segment.id,
          text: segment.text,
          startSeconds: segment.startSeconds,
          endSeconds: segment.endSeconds,
          speakerLabel: segment.speakerLabel,
          translation: segment.translation,
        })),
      })),
      claims: claims.map((claim) => ({
        id: claim.id,
        recordingId: claim.recordingId,
        claimText: claim.claimText,
        claimType: claim.claimType,
        entities: claim.entities,
        timePeriod: claim.timePeriod,
        quote: claim.evidence.quote,
        basis: claim.basis,
        uncertainty: claim.uncertainty,
        interpretationNote: claim.interpretationNote,
      })),
      consent: true,
    }),
  });
}
