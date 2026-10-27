import type {
  CLAIM_BASES,
  CLAIM_TYPES,
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  UNCERTAINTY_LEVELS,
} from "./schemas.js";

export type ClaimType = (typeof CLAIM_TYPES)[number];
export type EntityType = (typeof ENTITY_TYPES)[number];
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];
export type Uncertainty = (typeof UNCERTAINTY_LEVELS)[number];
export type ClaimBasis = (typeof CLAIM_BASES)[number];

export type ServerClaim = {
  id: string;
  recordingId: string;
  claimText: string;
  claimType: ClaimType;
  entities: Array<{ name: string; type: EntityType }>;
  timePeriod: {
    start: string | null;
    end: string | null;
    originalExpression: string | null;
  };
  evidence: {
    quote: string;
    startSeconds: number | null;
    endSeconds: number | null;
    timestampSource: "segment" | "none";
    segmentId: string;
    segmentIds: string[];
  };
  basis: ClaimBasis;
  uncertainty: Uncertainty;
  speakerWording: string;
  interpretationNote: string | null;
  evidenceStatus: "valid";
  researcherNotes: string;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
  model: string;
};

export type ServerComparisonGroup = {
  id: string;
  topic: string;
  relationship: RelationshipType;
  rationale: string;
  claimIds: string[];
  confidence: Uncertainty;
};

export type ServerComparison = {
  title: string;
  summary: string;
  groups: ServerComparisonGroup[];
  ungroupedClaimIds: string[];
  model: string;
  warnings: string[];
  disclaimer: string;
};

export type TranscriptionResult = {
  transcript: string;
  segments: Array<{
    id: string;
    text: string;
    startSeconds: number | null;
    endSeconds: number | null;
    speakerLabel: string | null;
    translation: null;
  }>;
  languageCode: string | null;
  durationSeconds: number | null;
  timestampSource: "gemini-word" | "none";
  model: string;
  warnings: string[];
};
