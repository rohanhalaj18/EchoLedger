import type { ClaimInput, RecordingInput, SegmentInput } from "./schemas.js";

const claimRules = `You are an oral-history research assistant. Your job is to extract historical claims from a transcript, not to write history.

A "claim" is a statement a narrator makes about the past: an event, a person's role, a place, a tradition, an origin story, a period, or a practice. It must be grounded in the transcript.

NON-NEGOTIABLE RULES
1. The "quote" field must be an exact, contiguous excerpt copied from the transcript, in the narrator's original language and spelling. Do not paraphrase, translate, correct, summarise, join distant passages, or use ellipses. If you cannot copy a supporting excerpt exactly, omit the claim.
2. "claimText" is a neutral English-language normalisation of what the narrator asserts. Do not add outside facts or resolve ambiguities.
3. "basis" is "explicit" when the narrator states the claim directly. Use "inferred" only when the claim is a careful interpretation of what was said; inferred claims need an "interpretationNote" and at least "medium" uncertainty.
4. "timePeriod.start" and "timePeriod.end" may contain a year only when that year is explicitly spoken in the quote. Otherwise use null. "originalExpression" must be the narrator's exact words about time (for example, "the year after the great flood" or "about seventy years ago"), or null. Never estimate, convert relative dates, or infer a precise date.
5. "uncertainty": "low" for a clear, detailed assertion; "medium" for vague, partial or contested memory; "high" for fragmentary, ambiguous or heavily qualified statements. Uncertainty describes the evidence, not whether the claim is true.
6. Entities must be named in the transcript. Do not identify real people or places from outside knowledge.
7. A narrator may be mistaken. Do not mark a claim as true or false; record what they said.
8. If there are no reliable claims, return {"claims": []}. An empty result is better than invented history.`;

function formatSeconds(value: number | null): string {
  if (value === null) return "no verified timestamp";
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}

export function buildClaimExtractionPrompt(recording: RecordingInput, segments: SegmentInput[]): string {
  const transcript = segments
    .map(
      (segment) =>
        `[${segment.id}] (${formatSeconds(segment.startSeconds)}–${formatSeconds(segment.endSeconds)})${
          segment.speakerLabel ? ` speaker=${segment.speakerLabel}` : ""
        }\n${segment.text}`,
    )
    .join("\n\n");

  return `${claimRules}

RECORDING METADATA
- Recording ID: ${recording.id}
- Title: ${recording.title}
- Narrator: ${recording.speaker}
- Language: ${recording.language}${recording.languageCode ? ` (${recording.languageCode})` : ""}
- Place / locality: ${recording.place || "not supplied"}
- Approximate period: ${recording.period || "not supplied"}
- Context notes: ${recording.notes || "none"}

TRANSCRIPT
<transcript>
${transcript}
</transcript>

Extract every distinct historical claim that is genuinely supported by this transcript. Keep related details together where that preserves meaning, but do not merge separate claims. Return only the structured JSON requested by the response schema.`;
}

export function buildComparisonPrompt(
  recordings: Array<RecordingInput & { segments: SegmentInput[] }>,
  claims: ClaimInput[],
): string {
  const recordingById = new Map(recordings.map((recording) => [recording.id, recording]));

  const claimBlocks = claims.map((claim) => {
    const recording = recordingById.get(claim.recordingId);
    const segmentIndex = recording?.segments.findIndex((segment) =>
      segment.text.includes(claim.quote.slice(0, Math.min(40, claim.quote.length))),
    );
    const context =
      segmentIndex !== undefined && segmentIndex >= 0 && recording
        ? [recording.segments[Math.max(0, segmentIndex - 1)], recording.segments[segmentIndex], recording.segments[segmentIndex + 1]]
            .filter((segment): segment is SegmentInput => Boolean(segment))
            .map((segment) => segment.text)
            .join(" ")
        : "";
    return {
      id: claim.id,
      recordingId: claim.recordingId,
      narrator: recording?.speaker ?? "unknown",
      language: recording?.language ?? "unknown",
      place: recording?.place ?? "",
      claimText: claim.claimText,
      claimType: claim.claimType,
      quote: claim.quote,
      timePeriod: claim.timePeriod,
      basis: claim.basis,
      uncertainty: claim.uncertainty,
      context: context || undefined,
    };
  });

  return `You are comparing historical claims extracted from oral-history recordings. You are not a judge of historical truth.

Your task is to group claims that discuss a comparable subject and label the relationship between the accounts. Use only the supplied claims and context. Do not add external historical knowledge, dates, names, places or source references.

RELATIONSHIP LABELS
- "corroborating": two or more accounts broadly agree on the same assertion. Agreement is not proof that the assertion is historically true.
- "conflicting": the accounts cannot both be true as stated (for example, incompatible dates, origins or attributions). A conflict is not proof that any account is false; memories can differ for many reasons.
- "related": the accounts concern the same subject but are not identical and are not clearly incompatible.
- "unique": the claim appears in only one recording, with no comparable account in the supplied set.
- "uncertain": the evidence is too thin, ambiguous or incomplete to assign a stronger relationship. Missing evidence is not evidence of absence.

RULES
1. Every claim ID you use must appear exactly as supplied. Never invent a claim ID or source.
2. Put each claim in at most one group. Include every claim somewhere, even if it is unique or uncertain.
3. Keep conflicting accounts separate inside the group. Do not merge them into one definitive narrative.
4. "rationale" must explain what is similar or different using only the supplied evidence. Do not declare which narrator is correct.
5. "title" and "summary" must be neutral and descriptive. Do not present findings as established history.
6. "confidence" describes confidence in the comparison, not confidence in the historical claim.
7. If there is not enough material for a meaningful comparison, return groups with "uncertain" or "unique" relationships rather than inventing connections.

RECORDINGS
${JSON.stringify(
  recordings.map((recording) => ({
    id: recording.id,
    title: recording.title,
    narrator: recording.speaker,
    language: recording.language,
    place: recording.place,
    period: recording.period,
  })),
  null,
  2,
)}

CLAIMS
${JSON.stringify(claimBlocks, null, 2)}

Return only the structured JSON requested by the response schema.`;
}
