import { z } from "zod";

export const CLAIM_TYPES = [
  "event",
  "tradition",
  "place",
  "person",
  "origin",
  "practice",
  "period",
  "other",
] as const;

export const ENTITY_TYPES = [
  "person",
  "place",
  "event",
  "tradition",
  "organization",
  "object",
  "date",
  "other",
] as const;

export const RELATIONSHIP_TYPES = [
  "corroborating",
  "conflicting",
  "related",
  "unique",
  "uncertain",
] as const;

export const UNCERTAINTY_LEVELS = ["low", "medium", "high"] as const;
export const CLAIM_BASES = ["explicit", "inferred"] as const;

export const segmentSchema = z.object({
  id: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(20_000),
  startSeconds: z.number().finite().nonnegative().nullable(),
  endSeconds: z.number().finite().nonnegative().nullable(),
  speakerLabel: z.string().trim().max(100).nullable().optional(),
  translation: z.string().trim().max(20_000).nullable().optional(),
});

export const recordingInputSchema = z.object({
  id: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  speaker: z.string().trim().min(1).max(200),
  language: z.string().trim().min(1).max(120),
  languageCode: z.string().trim().max(30).nullable().optional(),
  place: z.string().trim().max(200).default(""),
  period: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(4000).default(""),
});

export const timePeriodSchema = z.object({
  start: z.string().trim().max(100).nullable(),
  end: z.string().trim().max(100).nullable(),
  originalExpression: z.string().trim().max(300).nullable(),
});

export const extractClaimsRequestSchema = z.object({
  recording: recordingInputSchema,
  segments: z.array(segmentSchema).min(1).max(2000),
  consent: z.literal(true),
});

export const claimInputSchema = z.object({
  id: z.string().trim().min(1).max(200),
  recordingId: z.string().trim().min(1).max(200),
  claimText: z.string().trim().min(1).max(2000),
  claimType: z.enum(CLAIM_TYPES),
  entities: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        type: z.enum(ENTITY_TYPES),
      }),
    )
    .max(30)
    .default([]),
  timePeriod: timePeriodSchema,
  quote: z.string().trim().min(1).max(5000),
  basis: z.enum(CLAIM_BASES),
  uncertainty: z.enum(UNCERTAINTY_LEVELS),
  interpretationNote: z.string().trim().max(2000).nullable().optional(),
});

export const compareRequestSchema = z.object({
  recordings: z
    .array(
      recordingInputSchema.extend({
        segments: z.array(segmentSchema).min(1).max(2000),
      }),
    )
    .min(2)
    .max(8),
  claims: z.array(claimInputSchema).min(2).max(400),
  consent: z.literal(true),
});

export const aiClaimSchema = z.object({
  claimText: z.string().trim().min(1).max(2000),
  claimType: z.enum(CLAIM_TYPES),
  entities: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        type: z.enum(ENTITY_TYPES),
      }),
    )
    .max(30)
    .default([]),
  timePeriod: z.object({
    start: z.string().trim().max(100).nullable(),
    end: z.string().trim().max(100).nullable(),
    originalExpression: z.string().trim().max(300).nullable(),
  }),
  quote: z.string().trim().min(1).max(5000),
  basis: z.enum(CLAIM_BASES),
  uncertainty: z.enum(UNCERTAINTY_LEVELS),
  interpretationNote: z.string().trim().max(2000).nullable().optional(),
});

export const aiClaimsResponseSchema = z.object({
  claims: z.array(aiClaimSchema).max(100),
});

export const aiComparisonResponseSchema = z.object({
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().max(4000),
  groups: z
    .array(
      z.object({
        topic: z.string().trim().min(1).max(240),
        relationship: z.enum(RELATIONSHIP_TYPES),
        rationale: z.string().trim().min(1).max(3000),
        claimIds: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
        confidence: z.enum(UNCERTAINTY_LEVELS),
      }),
    )
    .max(100),
});

export type SegmentInput = z.infer<typeof segmentSchema>;
export type RecordingInput = z.infer<typeof recordingInputSchema>;
export type ClaimInput = z.infer<typeof claimInputSchema>;
export type AiClaim = z.infer<typeof aiClaimSchema>;
export type AiComparison = z.infer<typeof aiComparisonResponseSchema>;
