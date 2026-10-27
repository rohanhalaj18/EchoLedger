import { randomUUID } from "node:crypto";
import type { SegmentInput } from "./schemas.js";

export type LocatedQuote = {
  quote: string;
  segmentId: string;
  segmentIds: string[];
  startSeconds: number | null;
  endSeconds: number | null;
  timestampSource: "segment" | "none";
};

type SegmentRange = {
  segment: SegmentInput;
  start: number;
  end: number;
};

function normalizeWithMap(input: string): { normalized: string; map: number[] } {
  let normalized = "";
  const map: number[] = [];
  let lastWasSpace = true;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? "";
    if (/\s/.test(char)) {
      if (!lastWasSpace) {
        normalized += " ";
        map.push(index);
        lastWasSpace = true;
      }
      continue;
    }
    normalized += char.toLocaleLowerCase();
    map.push(index);
    lastWasSpace = false;
  }

  return { normalized: normalized.trimEnd(), map };
}

/**
 * Locate a model-supplied quote inside the canonical transcript.
 *
 * Matching ignores case and whitespace differences only. The returned quote is
 * always sliced from the transcript itself, so paraphrases and invented
 * quotations are rejected rather than stored.
 */
export function locateQuote(segments: SegmentInput[], candidate: string): LocatedQuote | null {
  const full = segments.map((segment) => segment.text).join("\n");
  const ranges: SegmentRange[] = [];
  let cursor = 0;
  for (const segment of segments) {
    ranges.push({ segment, start: cursor, end: cursor + segment.text.length });
    cursor += segment.text.length + 1;
  }

  let start = -1;
  let end = -1;

  const exactIndex = full.indexOf(candidate);
  if (exactIndex >= 0) {
    start = exactIndex;
    end = exactIndex + candidate.length;
  } else {
    const normalizedFull = normalizeWithMap(full);
    const normalizedCandidate = normalizeWithMap(candidate).normalized;
    if (!normalizedCandidate) return null;
    const normalizedIndex = normalizedFull.normalized.indexOf(normalizedCandidate);
    if (normalizedIndex < 0) return null;
    const originalStart = normalizedFull.map[normalizedIndex];
    const originalEndMapIndex = normalizedIndex + normalizedCandidate.length - 1;
    const originalEnd = (normalizedFull.map[originalEndMapIndex] ?? originalStart) + 1;
    if (originalStart === undefined) return null;
    start = originalStart;
    end = originalEnd;
  }

  const quote = full.slice(start, end).trim();
  if (!quote) return null;

  const overlapping = ranges.filter((range) => range.start < start + quote.length && range.end > start);
  if (overlapping.length === 0) return null;

  const first = overlapping[0];
  const last = overlapping[overlapping.length - 1];
  const hasTimestamps =
    overlapping.every(
      (range) =>
        range.segment.startSeconds !== null &&
        range.segment.endSeconds !== null &&
        range.segment.endSeconds >= range.segment.startSeconds,
    ) && first !== undefined && last !== undefined;

  return {
    quote,
    segmentId: first?.segment.id ?? segments[0]?.id ?? "unknown",
    segmentIds: overlapping.map((range) => range.segment.id),
    startSeconds: hasTimestamps ? (first?.segment.startSeconds ?? null) : null,
    endSeconds: hasTimestamps ? (last?.segment.endSeconds ?? null) : null,
    timestampSource: hasTimestamps ? "segment" : "none",
  };
}

export function buildTranscriptText(segments: SegmentInput[]): string {
  return segments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Split a pasted transcript into readable segments. No timestamps are invented.
 */
export function splitPlainTranscript(text: string): SegmentInput[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n{2,}/);
  const segments: SegmentInput[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    const sentences = trimmed
      .split(/(?<=[.!?।॥])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    if (sentences.length === 0) continue;

    // Keep very short fragments with the previous sentence where possible.
    let buffer = "";
    for (const sentence of sentences) {
      const next = buffer ? `${buffer} ${sentence}` : sentence;
      if (next.length > 320 && buffer) {
        segments.push({
          id: `seg-${randomUUID()}`,
          text: buffer,
          startSeconds: null,
          endSeconds: null,
          speakerLabel: null,
          translation: null,
        });
        buffer = sentence;
      } else {
        buffer = next;
      }
    }
    if (buffer) {
      segments.push({
        id: `seg-${randomUUID()}`,
        text: buffer,
        startSeconds: null,
        endSeconds: null,
        speakerLabel: null,
        translation: null,
      });
    }
  }

  return segments;
}

/** Parse a Gemini offset such as "1.250s" or "00:01.250" into seconds. */
export function parseOffset(offset: string | undefined | null): number | null {
  if (!offset) return null;
  const trimmed = offset.trim();
  const secondsMatch = trimmed.match(/^([\d.]+)s$/i);
  if (secondsMatch?.[1]) {
    const value = Number.parseFloat(secondsMatch[1]);
    return Number.isFinite(value) ? value : null;
  }
  const clockMatch = trimmed.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (clockMatch) {
    const minutes = clockMatch[1] ? Number.parseInt(clockMatch[1], 10) : 0;
    const seconds = Number.parseFloat(clockMatch[2] ?? "0");
    return minutes * 60 + seconds;
  }
  const plain = Number.parseFloat(trimmed);
  return Number.isFinite(plain) ? plain : null;
}

export function formatTimestamp(seconds: number | null): string {
  if (seconds === null) return "No verified timestamp";
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
