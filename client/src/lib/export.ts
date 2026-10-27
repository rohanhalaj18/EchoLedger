import type { Claim, Comparison, Recording } from "@/types";
import { csvEscape, downloadText, formatSeconds, slugify } from "@/lib/utils";

const SCHEMA_VERSION = "echoledger.research.v1";
const DISCLAIMER =
  "EchoLedger is a research aid. Claims describe what a narrator said, not verified historical facts. AI-assisted extraction and comparison are provisional and require human review. Agreement is not proof of truth; a discrepancy is not necessarily a contradiction; missing evidence is not evidence of absence.";

function claimForExport(claim: Claim, comparisons: Comparison[]) {
  const relationships = comparisons.flatMap((comparison) =>
    comparison.groups
      .filter((group) => group.claimIds.includes(claim.id))
      .map((group) => ({
        comparisonId: comparison.id,
        comparisonTitle: comparison.title,
        topic: group.topic,
        relationship: group.relationship,
        rationale: group.rationale,
        confidence: group.confidence,
      })),
  );
  return {
    claimId: claim.id,
    recordingId: claim.recordingId,
    claimText: claim.claimText,
    claimType: claim.claimType,
    entities: claim.entities,
    timePeriod: claim.timePeriod,
    basis: claim.basis,
    uncertainty: claim.uncertainty,
    evidence: {
      quote: claim.evidence.quote,
      startSeconds: claim.evidence.startSeconds,
      endSeconds: claim.evidence.endSeconds,
      timestampSource: claim.evidence.timestampSource,
      segmentId: claim.evidence.segmentId,
      segmentIds: claim.evidence.segmentIds,
      evidenceStatus: claim.evidenceStatus,
    },
    speakerWording: claim.speakerWording,
    interpretationNote: claim.interpretationNote,
    researcherNotes: claim.researcherNotes,
    relationships,
    isDemo: claim.isDemo,
    model: claim.model,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
  };
}

export function buildArchivePayload(
  recordings: Recording[],
  claims: Claim[],
  comparisons: Comparison[],
) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generator: "EchoLedger",
    exportedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    containsDemonstrationData: recordings.some((recording) => recording.isDemo),
    recordings: recordings.map((recording) => ({
      id: recording.id,
      title: recording.title,
      narrator: recording.speaker,
      language: recording.language,
      languageCode: recording.languageCode,
      place: recording.place,
      period: recording.period,
      topics: recording.topics,
      notes: recording.notes,
      source: recording.source,
      transcriptSource: recording.transcriptSource,
      createdAt: recording.createdAt,
      updatedAt: recording.updatedAt,
      isDemo: recording.isDemo,
      audio: recording.audio
        ? {
            fileName: recording.audio.fileName,
            mimeType: recording.audio.mimeType,
            sizeBytes: recording.audio.size,
            durationSeconds: recording.audio.durationSeconds,
            note: "Audio remains in the local browser archive and is not included in this export.",
          }
        : null,
      transcript: recording.transcriptSegments.map((segment) => ({
        segmentId: segment.id,
        text: segment.text,
        translation: segment.translation,
        speakerLabel: segment.speakerLabel,
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
      })),
      claims: claims
        .filter((claim) => claim.recordingId === recording.id)
        .map((claim) => claimForExport(claim, comparisons)),
    })),
    comparisons: comparisons.map((comparison) => ({
      id: comparison.id,
      title: comparison.title,
      summary: comparison.summary,
      recordingIds: comparison.recordingIds,
      createdAt: comparison.createdAt,
      model: comparison.model,
      isDemo: comparison.isDemo,
      disclaimer: comparison.disclaimer,
      warnings: comparison.warnings,
      groups: comparison.groups.map((group) => ({
        id: group.id,
        topic: group.topic,
        relationship: group.relationship,
        rationale: group.rationale,
        confidence: group.confidence,
        claimIds: group.claimIds,
        claims: group.claimIds
          .map((claimId) => {
            const claim = claims.find((item) => item.id === claimId);
            if (!claim) return null;
            const recording = recordings.find((item) => item.id === claim.recordingId);
            return {
              claimId: claim.id,
              recordingId: claim.recordingId,
              recordingTitle: recording?.title ?? "Unknown recording",
              narrator: recording?.speaker ?? "Unknown narrator",
              claimText: claim.claimText,
              quote: claim.evidence.quote,
              startSeconds: claim.evidence.startSeconds,
              endSeconds: claim.evidence.endSeconds,
              uncertainty: claim.uncertainty,
              basis: claim.basis,
            };
          })
          .filter(Boolean),
      })),
      ungroupedClaimIds: comparison.ungroupedClaimIds,
    })),
  };
}

export function exportArchiveJson(recordings: Recording[], claims: Claim[], comparisons: Comparison[]): void {
  const payload = buildArchivePayload(recordings, claims, comparisons);
  downloadText(
    JSON.stringify(payload, null, 2),
    `echoledger-archive-${new Date().toISOString().slice(0, 10)}.json`,
    "application/json",
  );
}

export function exportClaimsCsv(recordings: Recording[], claims: Claim[], comparisons: Comparison[]): void {
  const headers = [
    "claim_id",
    "recording_id",
    "recording_title",
    "narrator",
    "language",
    "place",
    "claim_text",
    "claim_type",
    "basis",
    "uncertainty",
    "quote",
    "start_seconds",
    "end_seconds",
    "timestamp_source",
    "time_start",
    "time_end",
    "time_original_expression",
    "entities",
    "relationships",
    "researcher_notes",
    "evidence_status",
    "is_demo",
    "model",
  ];
  const rows = claims.map((claim) => {
    const recording = recordings.find((item) => item.id === claim.recordingId);
    const relationships = comparisons.flatMap((comparison) =>
      comparison.groups
        .filter((group) => group.claimIds.includes(claim.id))
        .map((group) => `${group.relationship}: ${group.topic}`),
    );
    return [
      claim.id,
      claim.recordingId,
      recording?.title ?? "",
      recording?.speaker ?? "",
      recording?.language ?? "",
      recording?.place ?? "",
      claim.claimText,
      claim.claimType,
      claim.basis,
      claim.uncertainty,
      claim.evidence.quote,
      claim.evidence.startSeconds ?? "",
      claim.evidence.endSeconds ?? "",
      claim.evidence.timestampSource,
      claim.timePeriod.start ?? "",
      claim.timePeriod.end ?? "",
      claim.timePeriod.originalExpression ?? "",
      claim.entities.map((entity) => `${entity.name} (${entity.type})`).join("; "),
      relationships.join("; "),
      claim.researcherNotes,
      claim.evidenceStatus,
      claim.isDemo ? "true" : "false",
      claim.model,
    ].map(csvEscape);
  });
  const content = `\uFEFF${[headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n")}\r\n`;
  downloadText(content, `echoledger-claims-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
}

function markdownQuote(value: string): string {
  return value
    .split(/\n+/)
    .map((line) => `> ${line}`)
    .join("\n");
}

export function buildArchiveMarkdown(
  recordings: Recording[],
  claims: Claim[],
  comparisons: Comparison[],
): string {
  const lines: string[] = [];
  const demo = recordings.some((recording) => recording.isDemo);
  lines.push("# EchoLedger research export", "");
  lines.push(`Generated: ${new Date().toISOString()}`, "");
  lines.push(`> ${DISCLAIMER}`, "");
  if (demo) {
    lines.push(
      "> **Demonstration data included.** Records marked DEMO are fictional examples created to demonstrate the interface. They are not historical evidence.",
      "",
    );
  }
  lines.push("## Archive overview", "");
  lines.push(`- Recordings: ${recordings.length}`);
  lines.push(`- Claims: ${claims.length}`);
  lines.push(`- Comparisons: ${comparisons.length}`);
  lines.push(`- Schema: \`${SCHEMA_VERSION}\``, "");

  for (const recording of recordings) {
    lines.push(`## ${recording.title}`, "");
    lines.push(`- Recording ID: \`${recording.id}\``);
    lines.push(`- Narrator: ${recording.speaker}`);
    lines.push(`- Language: ${recording.language}`);
    lines.push(`- Place: ${recording.place || "Not supplied"}`);
    lines.push(`- Period: ${recording.period || "Not supplied"}`);
    lines.push(`- Source: ${recording.source === "audio" ? "Audio recording" : "Transcript only"}`);
    lines.push(`- Transcript source: ${recording.transcriptSource}`);
    if (recording.isDemo) lines.push("- **DEMONSTRATION RECORD — fictional data**");
    if (recording.notes) lines.push(`- Context: ${recording.notes}`);
    lines.push("", "### Transcript", "");
    for (const segment of recording.transcriptSegments) {
      const timing =
        segment.startSeconds !== null ? `[${formatSeconds(segment.startSeconds)}–${formatSeconds(segment.endSeconds)}] ` : "";
      lines.push(`- ${timing}${segment.text}`);
      if (segment.translation) lines.push(`  - English translation: ${segment.translation}`);
    }
    lines.push("", "### Claims", "");
    const recordingClaims = claims.filter((claim) => claim.recordingId === recording.id);
    if (recordingClaims.length === 0) {
      lines.push("_No claims extracted._", "");
    }
    for (const claim of recordingClaims) {
      lines.push(`#### ${claim.claimText}`, "");
      lines.push(`- Claim ID: \`${claim.id}\``);
      lines.push(`- Type: ${claim.claimType}`);
      lines.push(`- Basis: ${claim.basis}`);
      lines.push(`- Uncertainty: ${claim.uncertainty}`);
      lines.push(`- Evidence status: ${claim.evidenceStatus}`);
      lines.push(
        `- Time: ${claim.timePeriod.start ?? claim.timePeriod.end ?? "Unknown"}${
          claim.timePeriod.originalExpression ? ` — “${claim.timePeriod.originalExpression}”` : ""
        }`,
      );
      lines.push(
        `- Source: ${recording.speaker}, “${recording.title}”${
          claim.evidence.startSeconds !== null
            ? ` at ${formatSeconds(claim.evidence.startSeconds)}`
            : " (no verified timestamp)"
        }`,
      );
      if (claim.interpretationNote) lines.push(`- AI interpretation note: ${claim.interpretationNote}`);
      if (claim.researcherNotes) lines.push(`- Researcher notes: ${claim.researcherNotes}`);
      lines.push("", "Supporting quotation:", "", markdownQuote(claim.evidence.quote), "");
    }
  }

  lines.push("## Comparisons", "");
  if (comparisons.length === 0) {
    lines.push("_No comparisons generated._", "");
  }
  for (const comparison of comparisons) {
    lines.push(`### ${comparison.title}`, "");
    lines.push(`- Comparison ID: \`${comparison.id}\``);
    lines.push(`- Recordings: ${comparison.recordingIds.map((id) => `\`${id}\``).join(", ")}`);
    lines.push(`- Model: ${comparison.model}`);
    lines.push(`- Created: ${comparison.createdAt}`);
    if (comparison.isDemo) lines.push("- **DEMONSTRATION COMPARISON — fictional accounts**");
    lines.push("", comparison.summary, "", `> ${comparison.disclaimer}`, "");
    for (const group of comparison.groups) {
      lines.push(`#### ${group.topic}`, "");
      lines.push(`- Relationship: **${group.relationship}**`);
      lines.push(`- Comparison confidence: ${group.confidence}`);
      lines.push(`- Rationale: ${group.rationale}`, "");
      for (const claimId of group.claimIds) {
        const claim = claims.find((item) => item.id === claimId);
        if (!claim) continue;
        const recording = recordings.find((item) => item.id === claim.recordingId);
        lines.push(`- **${recording?.speaker ?? "Unknown narrator"}** — ${claim.claimText}`);
        lines.push(`  - ${claim.evidence.quote}`);
        lines.push(
          `  - Source: \`${claim.recordingId}\`${
            claim.evidence.startSeconds !== null
              ? ` at ${formatSeconds(claim.evidence.startSeconds)}`
              : " (no verified timestamp)"
          }`,
        );
      }
      lines.push("");
    }
    if (comparison.warnings.length > 0) {
      lines.push("Warnings:", ...comparison.warnings.map((warning) => `- ${warning}`), "");
    }
  }

  lines.push("## Reuse", "");
  lines.push(
    "This export uses the stable `echoledger.research.v1` schema. Every claim keeps its recording ID, verbatim quotation, evidence status and timestamp provenance. AI-generated relationships are marked with a relationship category and should be treated as provisional.",
    "",
  );
  return lines.join("\n");
}

export function exportArchiveMarkdown(recordings: Recording[], claims: Claim[], comparisons: Comparison[]): void {
  downloadText(
    buildArchiveMarkdown(recordings, claims, comparisons),
    `echoledger-report-${new Date().toISOString().slice(0, 10)}.md`,
    "text/markdown",
  );
}

export function exportComparisonJson(
  comparison: Comparison,
  recordings: Recording[],
  claims: Claim[],
): void {
  const payload = buildArchivePayload(recordings, claims, [comparison]);
  downloadText(
    JSON.stringify(payload, null, 2),
    `echoledger-comparison-${slugify(comparison.title)}.json`,
    "application/json",
  );
}

export function exportComparisonMarkdown(
  comparison: Comparison,
  recordings: Recording[],
  claims: Claim[],
): void {
  const markdown = buildArchiveMarkdown(recordings, claims, [comparison]);
  downloadText(markdown, `echoledger-comparison-${slugify(comparison.title)}.md`, "text/markdown");
}
