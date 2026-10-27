import { randomUUID } from "node:crypto";
import {
  AudioTranscriptionConfigMode,
  GoogleGenAI,
  Type,
  type GenerateContentResponse,
  type Schema,
} from "@google/genai";
import { config, isConfigured } from "./config.js";
import { AppError, mapGeminiError } from "./errors.js";
import { buildClaimExtractionPrompt, buildComparisonPrompt } from "./prompts.js";
import {
  aiClaimsResponseSchema,
  aiComparisonResponseSchema,
  type ClaimInput,
  type RecordingInput,
  type SegmentInput,
} from "./schemas.js";
import { locateQuote, parseOffset, splitPlainTranscript } from "./transcript.js";
import type { ServerClaim, ServerComparison, TranscriptionResult } from "./types.js";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!isConfigured()) {
    throw new AppError(
      503,
      "AI_NOT_CONFIGURED",
      "Gemini is not configured on the server. Add GEMINI_API_KEY to the .env file and restart. You can still use transcript-only records and demo data.",
    );
  }
  client ??= new GoogleGenAI({ apiKey: config.geminiApiKey });
  return client;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AppError(504, "AI_TIMEOUT", message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isTransientGeminiError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  const status =
    typeof candidate.status === "number"
      ? candidate.status
      : typeof candidate.code === "number"
        ? candidate.code
        : undefined;
  const message = typeof candidate.message === "string" ? candidate.message : "";
  return (
    status === 429 ||
    status === 503 ||
    /UNAVAILABLE|high demand|overloaded|rate limit|quota|resource exhausted|deadline exceeded/i.test(
      message,
    )
  );
}

/** Retry transient provider failures before surfacing an error to the researcher. */
async function withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientGeminiError(error) || attempt === attempts - 1) throw error;
      const waitMs = 2_000 * 2 ** attempt + Math.floor(Math.random() * 500);
      console.warn(`[gemini] transient error; retrying in ${waitMs}ms (attempt ${attempt + 1}/${attempts})`);
      await delay(waitMs);
    }
  }
  throw lastError;
}

function responseText(response: GenerateContentResponse): string {
  try {
    if (response.text && response.text.trim()) return response.text.trim();
  } catch {
    // The getter can throw when the response has no text parts.
  }
  const parts = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
  return parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function parseStructuredJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("[gemini] malformed JSON output:", cleaned.slice(0, 300));
    throw new AppError(
      502,
      "INVALID_MODEL_OUTPUT",
      "Gemini returned a response that was not valid JSON. Please retry.",
    );
  }
}

const claimExtractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    claims: {
      type: Type.ARRAY,
      description: "Grounded historical claims. Return an empty array if no reliable claim exists.",
      items: {
        type: Type.OBJECT,
        properties: {
          claimText: {
            type: Type.STRING,
            description: "Neutral English normalisation of the narrator's assertion, without added facts.",
          },
          claimType: {
            type: Type.STRING,
            format: "enum",
            enum: ["event", "tradition", "place", "person", "origin", "practice", "period", "other"],
          },
          entities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                type: {
                  type: Type.STRING,
                  format: "enum",
                  enum: ["person", "place", "event", "tradition", "organization", "object", "date", "other"],
                },
              },
              required: ["name", "type"],
            },
          },
          timePeriod: {
            type: Type.OBJECT,
            properties: {
              start: {
                type: Type.STRING,
                nullable: true,
                description: "Explicit year only, or null. Never estimate a date.",
              },
              end: {
                type: Type.STRING,
                nullable: true,
                description: "Explicit year only, or null. Never estimate a date.",
              },
              originalExpression: {
                type: Type.STRING,
                nullable: true,
                description: "The narrator's exact words about time, or null.",
              },
            },
            required: ["start", "end", "originalExpression"],
          },
          quote: {
            type: Type.STRING,
            description: "Exact contiguous excerpt from the transcript, in the original language.",
          },
          basis: {
            type: Type.STRING,
            format: "enum",
            enum: ["explicit", "inferred"],
          },
          uncertainty: {
            type: Type.STRING,
            format: "enum",
            enum: ["low", "medium", "high"],
          },
          interpretationNote: {
            type: Type.STRING,
            nullable: true,
            description: "Required for inferred claims: why the interpretation is reasonable.",
          },
        },
        required: [
          "claimText",
          "claimType",
          "entities",
          "timePeriod",
          "quote",
          "basis",
          "uncertainty",
          "interpretationNote",
        ],
      },
    },
  },
  required: ["claims"],
};

const comparisonSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Neutral, descriptive title for this provisional comparison.",
    },
    summary: {
      type: Type.STRING,
      description: "Short neutral summary of what the accounts share and where they differ.",
    },
    groups: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          relationship: {
            type: Type.STRING,
            format: "enum",
            enum: ["corroborating", "conflicting", "related", "unique", "uncertain"],
          },
          rationale: {
            type: Type.STRING,
            description: "Evidence-based explanation that does not decide which narrator is correct.",
          },
          claimIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          confidence: {
            type: Type.STRING,
            format: "enum",
            enum: ["low", "medium", "high"],
          },
        },
        required: ["topic", "relationship", "rationale", "claimIds", "confidence"],
      },
    },
  },
  required: ["title", "summary", "groups"],
};

type CollectedWord = {
  word: string;
  startSeconds: number | null;
  endSeconds: number | null;
  speakerLabel: string | null;
};

function joinWords(words: CollectedWord[]): string {
  return words
    .map((word) => word.word.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+([,.;:!?।॥%)\]])/g, "$1")
    .replace(/([(\[])\s+/g, "$1")
    .replace(/\s+([’'])/g, "$1")
    .trim();
}

function segmentsFromWords(words: CollectedWord[]): TranscriptionResult["segments"] {
  const segments: TranscriptionResult["segments"] = [];
  let bucket: CollectedWord[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const text = joinWords(bucket);
    if (!text) {
      bucket = [];
      return;
    }
    const start = bucket[0]?.startSeconds ?? null;
    const end = bucket[bucket.length - 1]?.endSeconds ?? null;
    const allTimed = bucket.every((word) => word.startSeconds !== null && word.endSeconds !== null);
    const speakers = new Set(bucket.map((word) => word.speakerLabel).filter(Boolean));
    segments.push({
      id: `seg-${randomUUID()}`,
      text,
      startSeconds: allTimed ? start : null,
      endSeconds: allTimed ? end : null,
      speakerLabel: speakers.size === 1 ? (bucket[0]?.speakerLabel ?? null) : null,
      translation: null,
    });
    bucket = [];
  };

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (!word) continue;
    const previous = bucket[bucket.length - 1];
    if (previous) {
      const gap =
        word.startSeconds !== null && previous.endSeconds !== null
          ? word.startSeconds - previous.endSeconds
          : 0;
      const speakerChanged = Boolean(word.speakerLabel && previous.speakerLabel && word.speakerLabel !== previous.speakerLabel);
      const tooLong = joinWords([...bucket, word]).length > 300;
      if (speakerChanged || gap > 1.6 || tooLong) flush();
    }
    bucket.push(word);
    if (/[.!?।॥]$/.test(word.word.trim())) flush();
  }
  flush();
  return segments;
}

export async function transcribeAudio(params: {
  filePath: string;
  mimeType: string;
  languageCode: string | null;
}): Promise<TranscriptionResult> {
  const ai = getClient();
  let remoteFile: { name?: string; uri?: string; state?: string } | null = null;

  try {
    const uploaded = await withTimeout(
      ai.files.upload({
        file: params.filePath,
        config: { mimeType: params.mimeType },
      }),
      120_000,
      "Uploading the recording to Gemini timed out.",
    );
    remoteFile = uploaded;

    let current = uploaded;
    let state = uploaded.state;
    const deadline = Date.now() + 120_000;
    while (state === "PROCESSING" && current.name && Date.now() < deadline) {
      await delay(1_500);
      current = await ai.files.get({ name: current.name });
      state = current.state;
    }
    if (state === "FAILED") {
      throw new AppError(
        502,
        "TRANSCRIPTION_FAILED",
        "Gemini could not process this recording. Check the file format and try again.",
      );
    }
    if (!current.uri) {
      throw new AppError(502, "TRANSCRIPTION_FAILED", "Gemini did not return a usable file reference.");
    }

    const response = await withTimeout(
      withRetry(() =>
        ai.models.generateContent({
          model: config.transcribeModel,
          contents: [
            {
              role: "user",
              parts: [{ fileData: { fileUri: current.uri, mimeType: params.mimeType } }],
            },
          ],
          config: {
            audioTranscriptionConfig: {
              languageCodes: params.languageCode ? [params.languageCode] : [],
              wordTimestamp: true,
              mode: AudioTranscriptionConfigMode.VERBATIM,
            },
          },
        }),
      ),
      300_000,
      "Gemini transcription took too long. Try a shorter recording.",
    );

    const words: CollectedWord[] = [];
    let detectedLanguage: string | null = null;
    let lastOffset: number | null = null;

    for (const candidate of response.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        const transcription = part.audioTranscription;
        if (!transcription) continue;
        if (transcription.languageCode) detectedLanguage = transcription.languageCode;
        const speakerLabel = transcription.speakerLabel ?? null;
        for (const wordInfo of transcription.words ?? []) {
          const word = wordInfo.word?.trim();
          if (!word) continue;
          const startSeconds = parseOffset(wordInfo.startOffset);
          const endSeconds = parseOffset(wordInfo.endOffset);
          words.push({ word, startSeconds, endSeconds, speakerLabel });
          if (endSeconds !== null) lastOffset = Math.max(lastOffset ?? 0, endSeconds);
        }
        const partEnd = parseOffset(transcription.endOffset);
        if (partEnd !== null) lastOffset = Math.max(lastOffset ?? 0, partEnd);
      }
    }

    const warnings: string[] = [];
    let segments = words.length > 0 ? segmentsFromWords(words) : [];
    let timestampSource: "gemini-word" | "none" = words.length > 0 ? "gemini-word" : "none";

    if (segments.length === 0) {
      const rawText = responseText(response);
      if (!rawText) {
        throw new AppError(
          502,
          "TRANSCRIPTION_FAILED",
          "Gemini returned an empty transcript. Check that the recording contains audible speech.",
        );
      }
      segments = splitPlainTranscript(rawText).map((segment) => ({
        ...segment,
        speakerLabel: segment.speakerLabel ?? null,
        translation: null,
      }));
      timestampSource = "none";
      warnings.push(
        "Gemini did not return word-level timing for this recording. The transcript has no verified timestamps; do not infer playback positions.",
      );
    }

    const transcript = segments.map((segment) => segment.text).join("\n");
    if (!transcript.trim()) {
      throw new AppError(
        502,
        "TRANSCRIPTION_FAILED",
        "Gemini returned an empty transcript. Check that the recording contains audible speech.",
      );
    }

    return {
      transcript,
      segments,
      languageCode: detectedLanguage ?? params.languageCode,
      durationSeconds: lastOffset,
      timestampSource,
      model: config.transcribeModel,
      warnings,
    };
  } catch (error) {
    throw mapGeminiError(error);
  } finally {
    if (remoteFile?.name) {
      await ai.files.delete({ name: remoteFile.name }).catch((error: unknown) => {
        console.error("[gemini] could not delete remote file:", error instanceof Error ? error.message : error);
      });
    }
  }
}

function hasYear(value: string): string[] {
  return value.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/g) ?? [];
}

function containsNormalized(haystack: string, needle: string): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  return normalize(haystack).includes(normalize(needle));
}

export async function extractClaims(params: {
  recording: RecordingInput;
  segments: SegmentInput[];
}): Promise<{ claims: ServerClaim[]; rejectedCount: number; warnings: string[]; model: string }> {
  const ai = getClient();
  const prompt = buildClaimExtractionPrompt(params.recording, params.segments);

  try {
    const response = await withTimeout(
      withRetry(() =>
        ai.models.generateContent({
          model: config.textModel,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            temperature: 0.2,
            maxOutputTokens: 16_384,
            responseMimeType: "application/json",
            responseSchema: claimExtractionSchema,
          },
        }),
      ),
      240_000,
      "Gemini claim extraction took too long. Try a shorter transcript.",
    );

    const raw = responseText(response);
    if (!raw) {
      throw new AppError(502, "INVALID_MODEL_OUTPUT", "Gemini returned an empty claim response.");
    }
    const parsed = aiClaimsResponseSchema.safeParse(parseStructuredJson(raw));
    if (!parsed.success) {
      console.error("[gemini] claim schema validation failed:", parsed.error.issues.slice(0, 5));
      throw new AppError(
        502,
        "INVALID_MODEL_OUTPUT",
        "Gemini returned claims in an unexpected shape. No claims were saved. Please retry.",
      );
    }

    const warnings: string[] = [];
    const claims: ServerClaim[] = [];
    let rejectedCount = 0;
    const now = new Date().toISOString();

    for (const aiClaim of parsed.data.claims) {
      const located = locateQuote(params.segments, aiClaim.quote);
      if (!located) {
        rejectedCount += 1;
        warnings.push("A generated claim was rejected because its quotation could not be found verbatim in the transcript.");
        continue;
      }

      let start = aiClaim.timePeriod.start;
      let end = aiClaim.timePeriod.end;
      let originalExpression = aiClaim.timePeriod.originalExpression;

      if (start) {
        const years = hasYear(start);
        if (years.length === 0 || !years.every((year) => located.quote.includes(year))) {
          start = null;
          warnings.push(`Removed an unsupported date (${aiClaim.timePeriod.start}) from a claim.`);
        }
      }
      if (end) {
        const years = hasYear(end);
        if (years.length === 0 || !years.every((year) => located.quote.includes(year))) {
          end = null;
          warnings.push(`Removed an unsupported date (${aiClaim.timePeriod.end}) from a claim.`);
        }
      }
      if (originalExpression && !containsNormalized(located.quote, originalExpression)) {
        originalExpression = null;
        warnings.push("Removed a time expression that was not present verbatim in the supporting quotation.");
      }

      let uncertainty = aiClaim.uncertainty;
      if (aiClaim.basis === "inferred" && uncertainty === "low") {
        uncertainty = "medium";
        warnings.push("Raised the uncertainty of an inferred claim to medium.");
      }

      const interpretationNote =
        aiClaim.basis === "inferred"
          ? aiClaim.interpretationNote?.trim() || "AI interpretation; researcher review required."
          : aiClaim.interpretationNote?.trim() || null;

      claims.push({
        id: randomUUID(),
        recordingId: params.recording.id,
        claimText: aiClaim.claimText,
        claimType: aiClaim.claimType,
        entities: aiClaim.entities,
        timePeriod: { start, end, originalExpression },
        evidence: {
          quote: located.quote,
          startSeconds: located.startSeconds,
          endSeconds: located.endSeconds,
          timestampSource: located.timestampSource,
          segmentId: located.segmentId,
          segmentIds: located.segmentIds,
        },
        basis: aiClaim.basis,
        uncertainty,
        speakerWording: located.quote,
        interpretationNote,
        evidenceStatus: "valid",
        researcherNotes: "",
        createdAt: now,
        updatedAt: now,
        isDemo: false,
        model: config.textModel,
      });
    }

    return { claims, rejectedCount, warnings: [...new Set(warnings)], model: config.textModel };
  } catch (error) {
    throw mapGeminiError(error);
  }
}

export async function compareClaims(params: {
  recordings: Array<RecordingInput & { segments: SegmentInput[] }>;
  claims: ClaimInput[];
}): Promise<ServerComparison> {
  const ai = getClient();
  const recordingMap = new Map(params.recordings.map((recording) => [recording.id, recording]));
  const validatedClaims: ClaimInput[] = [];

  for (const claim of params.claims) {
    const recording = recordingMap.get(claim.recordingId);
    if (!recording) {
      throw new AppError(
        400,
        "INVALID_RECORDING_REFERENCE",
        "A claim refers to a recording that was not selected for comparison.",
      );
    }
    const located = locateQuote(recording.segments, claim.quote);
    if (!located) {
      throw new AppError(
        422,
        "INVALID_EVIDENCE",
        "One or more claims no longer match their source transcript. Re-validate or re-extract those claims before comparing.",
      );
    }
    validatedClaims.push({ ...claim, quote: located.quote });
  }

  const prompt = buildComparisonPrompt(params.recordings, validatedClaims);

  try {
    const response = await withTimeout(
      withRetry(() =>
        ai.models.generateContent({
          model: config.textModel,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            temperature: 0.2,
            maxOutputTokens: 12_288,
            responseMimeType: "application/json",
            responseSchema: comparisonSchema,
          },
        }),
      ),
      240_000,
      "Gemini comparison took too long. Try fewer recordings or claims.",
    );

    const raw = responseText(response);
    if (!raw) {
      throw new AppError(502, "INVALID_MODEL_OUTPUT", "Gemini returned an empty comparison response.");
    }
    const parsed = aiComparisonResponseSchema.safeParse(parseStructuredJson(raw));
    if (!parsed.success) {
      console.error("[gemini] comparison schema validation failed:", parsed.error.issues.slice(0, 5));
      throw new AppError(
        502,
        "INVALID_MODEL_OUTPUT",
        "Gemini returned a comparison in an unexpected shape. No comparison was saved. Please retry.",
      );
    }

    const validIds = new Set(validatedClaims.map((claim) => claim.id));
    const seen = new Set<string>();
    const warnings: string[] = [];
    const groups = [];

    for (const group of parsed.data.groups) {
      const claimIds = [...new Set(group.claimIds.filter((id) => validIds.has(id)))].filter((id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      if (claimIds.length === 0) {
        warnings.push("A comparison group referenced no valid claims and was removed.");
        continue;
      }

      let relationship = group.relationship;
      if (claimIds.length === 1 && relationship !== "unique" && relationship !== "uncertain") {
        relationship = "unique";
        warnings.push("A single-claim group was relabelled as unique.");
      }
      if (claimIds.length > 1 && relationship === "unique") {
        relationship = "related";
        warnings.push("A multi-claim group labelled unique was relabelled as related.");
      }

      groups.push({
        id: `group-${randomUUID()}`,
        topic: group.topic,
        relationship,
        rationale: group.rationale,
        claimIds,
        confidence: group.confidence,
      });
    }

    const ungroupedClaimIds = validatedClaims.map((claim) => claim.id).filter((id) => !seen.has(id));
    if (ungroupedClaimIds.length > 0) {
      warnings.push(`${ungroupedClaimIds.length} claim(s) were not placed in a comparison group. They remain available for manual review.`);
    }

    return {
      title: parsed.data.title,
      summary: parsed.data.summary,
      groups,
      ungroupedClaimIds,
      model: config.textModel,
      warnings: [...new Set(warnings)],
      disclaimer:
        "AI-assisted comparison — provisional findings for human review. Agreement is not proof of historical truth, a discrepancy is not necessarily a contradiction, and missing evidence is not evidence of absence. Always inspect the source quotations.",
    };
  } catch (error) {
    throw mapGeminiError(error);
  }
}
