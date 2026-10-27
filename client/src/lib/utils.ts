import type { Claim, Recording, TranscriptSegment } from "@/types";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function uid(prefix: string): string {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "No verified timestamp";
  }
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function truncate(value: string, max = 160): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function splitPlainTranscript(text: string): TranscriptSegment[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const segments: TranscriptSegment[] = [];
  for (const paragraph of clean.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    const sentences = trimmed
      .split(/(?<=[.!?।॥])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    let buffer = "";
    for (const sentence of sentences) {
      const next = buffer ? `${buffer} ${sentence}` : sentence;
      if (next.length > 320 && buffer) {
        segments.push({
          id: uid("seg"),
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
        id: uid("seg"),
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

function parseClock(value: string): number | null {
  const match = value.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!match) return null;
  const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  const seconds = Number.parseInt(match[3] ?? "0", 10);
  const milliseconds = match[4] ? Number.parseInt(match[4].padEnd(3, "0"), 10) : 0;
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/** Parse SRT or WebVTT cues into segments with verified cue timestamps. */
export function parseTimestampedTranscript(content: string): TranscriptSegment[] {
  const clean = content.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "").trim();
  if (!clean) return [];
  const blocks = clean.split(/\n{2,}/);
  const segments: TranscriptSegment[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (/^WEBVTT/i.test(lines[0] ?? "")) continue;
    const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
    if (timeLineIndex < 0) continue;
    const timeLine = lines[timeLineIndex] ?? "";
    const [startRaw, endRaw] = timeLine.split("-->").map((part) => part.trim().split(/\s+/)[0] ?? "");
    const start = parseClock(startRaw);
    const end = parseClock(endRaw);
    if (start === null || end === null) continue;
    const text = lines
      .slice(timeLineIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    segments.push({
      id: uid("seg"),
      text,
      startSeconds: start,
      endSeconds: end,
      speakerLabel: null,
      translation: null,
    });
  }

  return segments.length > 0 ? segments : splitPlainTranscript(clean);
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export type LocatedEvidence = {
  quote: string;
  segmentId: string;
  segmentIds: string[];
  startSeconds: number | null;
  endSeconds: number | null;
};

/**
 * Locate an exact (or whitespace/case-insensitive) quote in the current
 * transcript. The returned quote always comes from the transcript itself.
 */
export function locateEvidence(
  segments: TranscriptSegment[],
  candidate: string,
): LocatedEvidence | null {
  const full = segments.map((segment) => segment.text).join("\n");
  const ranges: Array<{ segment: TranscriptSegment; start: number; end: number }> = [];
  let cursor = 0;
  for (const segment of segments) {
    ranges.push({ segment, start: cursor, end: cursor + segment.text.length });
    cursor += segment.text.length + 1;
  }

  let start = full.indexOf(candidate);
  let end = start >= 0 ? start + candidate.length : -1;

  if (start < 0) {
    const normalize = (value: string) => {
      let output = "";
      const map: number[] = [];
      let lastSpace = true;
      for (let index = 0; index < value.length; index += 1) {
        const char = value[index] ?? "";
        if (/\s/.test(char)) {
          if (!lastSpace) {
            output += " ";
            map.push(index);
            lastSpace = true;
          }
          continue;
        }
        output += char.toLocaleLowerCase();
        map.push(index);
        lastSpace = false;
      }
      return { output: output.trimEnd(), map };
    };
    const normalizedFull = normalize(full);
    const normalizedCandidate = normalize(candidate).output;
    if (!normalizedCandidate) return null;
    const found = normalizedFull.output.indexOf(normalizedCandidate);
    if (found < 0) return null;
    const originalStart = normalizedFull.map[found];
    const originalEnd = (normalizedFull.map[found + normalizedCandidate.length - 1] ?? originalStart) + 1;
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
  const allTimed = overlapping.every(
    (range) =>
      range.segment.startSeconds !== null &&
      range.segment.endSeconds !== null &&
      range.segment.endSeconds >= range.segment.startSeconds,
  );

  return {
    quote,
    segmentId: first?.segment.id ?? segments[0]?.id ?? "",
    segmentIds: overlapping.map((range) => range.segment.id),
    startSeconds: allTimed ? (first?.segment.startSeconds ?? null) : null,
    endSeconds: allTimed ? (last?.segment.endSeconds ?? null) : null,
  };
}

export function revalidateClaim(claim: Claim, recording: Recording): Claim {
  const located = locateEvidence(recording.transcriptSegments, claim.evidence.quote);
  if (!located) {
    return {
      ...claim,
      evidenceStatus: "quote-mismatch",
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    ...claim,
    evidenceStatus: "valid",
    evidence: {
      ...claim.evidence,
      quote: located.quote,
      segmentId: located.segmentId,
      segmentIds: located.segmentIds,
      startSeconds: located.startSeconds,
      endSeconds: located.endSeconds,
      timestampSource: located.startSeconds !== null ? "segment" : "none",
    },
    updatedAt: new Date().toISOString(),
  };
}

export function parseYear(claim: Claim): { year: number; label: string } | null {
  const candidates = [claim.timePeriod.start, claim.timePeriod.end].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const match = candidate.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
    if (match) {
      return { year: Number.parseInt(match[0], 10), label: claim.timePeriod.originalExpression || candidate };
    }
  }
  return null;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(content: string, filename: string, mimeType: string): void {
  downloadBlob(new Blob([content], { type: `${mimeType};charset=utf-8` }), filename);
}

export function slugify(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "echoledger";
}

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function groupBy<T, K extends string | number>(items: T[], getKey: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
