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
export type ClaimType = (typeof CLAIM_TYPES)[number];

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
export type EntityType = (typeof ENTITY_TYPES)[number];

export const RELATIONSHIP_TYPES = [
  "corroborating",
  "conflicting",
  "related",
  "unique",
  "uncertain",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const UNCERTAINTY_LEVELS = ["low", "medium", "high"] as const;
export type Uncertainty = (typeof UNCERTAINTY_LEVELS)[number];

export const CLAIM_BASES = ["explicit", "inferred"] as const;
export type ClaimBasis = (typeof CLAIM_BASES)[number];

export type TranscriptSegment = {
  id: string;
  text: string;
  startSeconds: number | null;
  endSeconds: number | null;
  speakerLabel: string | null;
  translation: string | null;
};

export type AudioMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  durationSeconds: number | null;
};

export type Recording = {
  id: string;
  title: string;
  speaker: string;
  language: string;
  languageCode: string | null;
  place: string;
  period: string;
  topics: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  source: "audio" | "transcript";
  transcriptSource: "gemini" | "manual" | "srt" | "vtt" | "demo";
  transcriptSegments: TranscriptSegment[];
  audio: AudioMeta | null;
  isDemo: boolean;
  consentAt: string | null;
  transcriptEditedAt: string | null;
};

export type AudioAsset = {
  recordingId: string;
  blob: Blob;
  mimeType: string;
  fileName: string;
};

export type Claim = {
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
    timestampSource: "gemini-word" | "segment" | "none";
    segmentId: string | null;
    segmentIds: string[];
  };
  basis: ClaimBasis;
  uncertainty: Uncertainty;
  speakerWording: string;
  interpretationNote: string | null;
  evidenceStatus: "valid" | "quote-mismatch";
  researcherNotes: string;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
  model: string;
};

export type ComparisonGroup = {
  id: string;
  topic: string;
  relationship: RelationshipType;
  rationale: string;
  claimIds: string[];
  confidence: Uncertainty;
};

export type Comparison = {
  id: string;
  title: string;
  summary: string;
  recordingIds: string[];
  groups: ComparisonGroup[];
  ungroupedClaimIds: string[];
  createdAt: string;
  model: string;
  isDemo: boolean;
  disclaimer: string;
  warnings: string[];
};

export type AiStatus = {
  configured: boolean;
  textModel: string;
  transcribeModel: string;
  maxAudioMb: number;
  maxAudioMinutes: number;
  timestampSupport: string;
  externalProcessing: boolean;
  note: string;
};

export type AiClaimResponse = {
  claims: Claim[];
  rejectedCount: number;
  warnings: string[];
  model: string;
  disclaimer: string;
};

export type TranscriptionResponse = {
  transcript: string;
  segments: TranscriptSegment[];
  languageCode: string | null;
  durationSeconds: number | null;
  timestampSource: "gemini-word" | "none";
  model: string;
  warnings: string[];
  consent: boolean;
};

export type ComparisonResponse = {
  title: string;
  summary: string;
  groups: Array<Omit<ComparisonGroup, "id"> & { id?: string }>;
  ungroupedClaimIds: string[];
  model: string;
  warnings: string[];
  disclaimer: string;
};

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  corroborating: "Shared account",
  conflicting: "Conflicting accounts",
  related: "Related accounts",
  unique: "Single account",
  uncertain: "Uncertain relationship",
};

export const RELATIONSHIP_DESCRIPTIONS: Record<RelationshipType, string> = {
  corroborating: "Accounts broadly agree. Agreement is not proof of historical truth.",
  conflicting: "Accounts cannot both be true as stated. A conflict is not proof that either is false.",
  related: "Accounts concern the same subject but are not identical.",
  unique: "Only one account in this comparison makes this claim.",
  uncertain: "The evidence is insufficient or ambiguous. Missing evidence is not evidence of absence.",
};

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  event: "Event",
  tradition: "Tradition",
  place: "Place",
  person: "Person",
  origin: "Origin",
  practice: "Practice",
  period: "Period",
  other: "Other",
};

export const LANGUAGE_OPTIONS = [
  { label: "Hindi", code: "hi-IN" },
  { label: "Kannada", code: "kn-IN" },
  { label: "Marathi", code: "mr-IN" },
  { label: "Tamil", code: "ta-IN" },
  { label: "Telugu", code: "te-IN" },
  { label: "Bengali", code: "bn-IN" },
  { label: "Gujarati", code: "gu-IN" },
  { label: "Malayalam", code: "ml-IN" },
  { label: "Odia", code: "or-IN" },
  { label: "Punjabi", code: "pa-IN" },
  { label: "Assamese", code: "as-IN" },
  { label: "Urdu", code: "ur-IN" },
  { label: "Sanskrit", code: "sa-IN" },
  { label: "Indian English", code: "en-IN" },
  { label: "English", code: "en-US" },
  { label: "Other / mixed language", code: "" },
];
