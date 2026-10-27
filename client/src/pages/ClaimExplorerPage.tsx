import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  FlaskConical,
  GitCompareArrows,
  MessageSquareQuote,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { ClaimCard, type ClaimRelationship } from "@/components/ClaimCard";
import { DemoBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import { useArchive } from "@/context/ArchiveContext";
import { useToast } from "@/context/ToastContext";
import { exportClaimsCsv } from "@/lib/export";
import { formatCount } from "@/lib/utils";
import {
  CLAIM_TYPES,
  CLAIM_TYPE_LABELS,
  RELATIONSHIP_LABELS,
  UNCERTAINTY_LEVELS,
  type ClaimType,
  type RelationshipType,
  type Uncertainty,
} from "@/types";

type EvidenceFilter = "all" | "valid" | "quote-mismatch";
type SortMode = "newest" | "oldest" | "uncertainty";

const uncertaintyRank: Record<Uncertainty, number> = { high: 0, medium: 1, low: 2 };

export function ClaimExplorerPage() {
  const { loading, recordings, claims, comparisons } = useArchive();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [claimType, setClaimType] = useState<"all" | ClaimType>("all");
  const [uncertainty, setUncertainty] = useState<"all" | Uncertainty>("all");
  const [relationship, setRelationship] = useState<"all" | RelationshipType>("all");
  const [recordingId, setRecordingId] = useState("all");
  const [language, setLanguage] = useState("all");
  const [evidence, setEvidence] = useState<EvidenceFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");

  const relationshipsByClaim = useMemo(() => {
    const map = new Map<string, ClaimRelationship[]>();
    for (const comparison of comparisons) {
      for (const group of comparison.groups) {
        for (const claimId of group.claimIds) {
          const list = map.get(claimId) ?? [];
          list.push({
            relationship: group.relationship,
            topic: group.topic,
            comparisonId: comparison.id,
            comparisonTitle: comparison.title,
          });
          map.set(claimId, list);
        }
      }
    }
    return map;
  }, [comparisons]);

  const languages = useMemo(
    () =>
      [
        ...new Set(
          claims
            .map((claim) => recordings.find((recording) => recording.id === claim.recordingId)?.language)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [claims, recordings],
  );

  const recordingOptions = useMemo(
    () =>
      recordings
        .filter((recording) => claims.some((claim) => claim.recordingId === recording.id))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [recordings, claims],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const result = claims.filter((claim) => {
      const recording = recordings.find((item) => item.id === claim.recordingId);
      if (claimType !== "all" && claim.claimType !== claimType) return false;
      if (uncertainty !== "all" && claim.uncertainty !== uncertainty) return false;
      if (recordingId !== "all" && claim.recordingId !== recordingId) return false;
      if (language !== "all" && recording?.language !== language) return false;
      if (evidence !== "all" && claim.evidenceStatus !== evidence) return false;
      if (relationship !== "all") {
        const claimRelationships = relationshipsByClaim.get(claim.id) ?? [];
        if (!claimRelationships.some((item) => item.relationship === relationship)) return false;
      }
      if (!needle) return true;
      const haystack = [
        claim.claimText,
        claim.evidence.quote,
        claim.speakerWording,
        claim.interpretationNote ?? "",
        claim.researcherNotes,
        claim.entities.map((entity) => `${entity.name} ${entity.type}`).join(" "),
        claim.timePeriod.originalExpression ?? "",
        recording?.title ?? "",
        recording?.speaker ?? "",
        recording?.place ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(needle);
    });

    return [...result].sort((a, b) => {
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sort === "uncertainty") {
        return uncertaintyRank[a.uncertainty] - uncertaintyRank[b.uncertainty];
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [
    claims,
    recordings,
    claimType,
    uncertainty,
    recordingId,
    language,
    evidence,
    relationship,
    relationshipsByClaim,
    query,
    sort,
  ]);

  const hasFilters =
    query.trim() !== "" ||
    claimType !== "all" ||
    uncertainty !== "all" ||
    relationship !== "all" ||
    recordingId !== "all" ||
    language !== "all" ||
    evidence !== "all";

  const clearFilters = () => {
    setQuery("");
    setClaimType("all");
    setUncertainty("all");
    setRelationship("all");
    setRecordingId("all");
    setLanguage("all");
    setEvidence("all");
    setSort("newest");
  };

  if (loading) return <LoadingState />;

  return (
    <>
      <PageHeader
        eyebrow="Evidence ledger"
        title="Claim explorer"
        description="Every claim describes what a narrator said, not a verified historical fact. Search the wording, filter by uncertainty, and open a claim to hear the source and inspect its context."
        actions={
          <>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                exportClaimsCsv(recordings, filtered, comparisons);
                notify(
                  `Exported ${filtered.length} claim${filtered.length === 1 ? "" : "s"} with quotations, provenance and relationships.`,
                  "success",
                );
              }}
              disabled={filtered.length === 0}
            >
              <Download size={15} aria-hidden="true" /> Export CSV
            </button>
            <Link to="/compare" className="button button--ghost">
              <GitCompareArrows size={15} aria-hidden="true" /> Compare
            </Link>
            <Link to="/recordings/new" className="button button--primary">
              <Sparkles size={15} aria-hidden="true" /> Add source
            </Link>
          </>
        }
        meta={
          <>
            <span>{formatCount(claims.length, "claim")}</span>
            <span>{formatCount(comparisons.length, "comparison")}</span>
            <span>{formatCount(languages.length, "language")}</span>
            {claims.some((claim) => claim.isDemo) ? <DemoBadge compact /> : null}
          </>
        }
      />

      <div className="notice notice--info" style={{ marginBottom: 16 }}>
        <ShieldCheck size={17} aria-hidden="true" />
        <div className="notice__body">
          <strong className="notice__title">Evidence status is not truth status</strong>
          <p>
            “Low uncertainty” means the evidence is clear and detailed, not that the claim is historically
            true. “Evidence mismatch” means the transcript changed after extraction; the claim is flagged
            for review, not deleted or silently rewritten.
          </p>
        </div>
      </div>

      {claims.length === 0 ? (
        <EmptyState
          icon={<MessageSquareQuote size={23} />}
          title="No claims in this archive"
          description="Claims are extracted from transcripts, one verbatim quotation at a time. Add a transcript and run Gemini extraction, or load the demo archive to see how evidence-linked claims work."
          actions={
            <>
              <Link to="/recordings/new" className="button button--primary">
                Add a recording
              </Link>
              <Link to="/library" className="button button--ghost">
                Open archive
              </Link>
            </>
          }
        />
      ) : (
        <>
          <div className="toolbar" role="search">
            <div className="search-field">
              <Search size={15} aria-hidden="true" />
              <input
                className="input"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search claims, quotations, entities or narrator names…"
                aria-label="Search claims"
              />
            </div>

            <div className="field">
              <label htmlFor="claim-type">Type</label>
              <select
                id="claim-type"
                className="select"
                value={claimType}
                onChange={(event) => setClaimType(event.target.value as "all" | ClaimType)}
              >
                <option value="all">All types</option>
                {CLAIM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CLAIM_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="claim-uncertainty">Uncertainty</label>
              <select
                id="claim-uncertainty"
                className="select"
                value={uncertainty}
                onChange={(event) => setUncertainty(event.target.value as "all" | Uncertainty)}
              >
                <option value="all">Any level</option>
                {UNCERTAINTY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level[0]!.toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="claim-relationship">Relationship</label>
              <select
                id="claim-relationship"
                className="select"
                value={relationship}
                onChange={(event) =>
                  setRelationship(event.target.value as "all" | RelationshipType)
                }
              >
                <option value="all">Any relationship</option>
                {(Object.keys(RELATIONSHIP_LABELS) as RelationshipType[]).map((value) => (
                  <option key={value} value={value}>
                    {RELATIONSHIP_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="claim-recording">Recording</label>
              <select
                id="claim-recording"
                className="select"
                value={recordingId}
                onChange={(event) => setRecordingId(event.target.value)}
              >
                <option value="all">All recordings</option>
                {recordingOptions.map((recording) => (
                  <option key={recording.id} value={recording.id}>
                    {recording.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="claim-language">Language</label>
              <select
                id="claim-language"
                className="select"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="all">All languages</option>
                {languages.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="claim-evidence">Evidence</label>
              <select
                id="claim-evidence"
                className="select"
                value={evidence}
                onChange={(event) => setEvidence(event.target.value as EvidenceFilter)}
              >
                <option value="all">Any status</option>
                <option value="valid">Valid quotation</option>
                <option value="quote-mismatch">Evidence mismatch</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="claim-sort">Sort</label>
              <select
                id="claim-sort"
                className="select"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="uncertainty">Most uncertain</option>
              </select>
            </div>

            {hasFilters ? (
              <button type="button" className="button button--ghost button--small" onClick={clearFilters}>
                <X size={13} aria-hidden="true" /> Clear
              </button>
            ) : null}
          </div>

          <div className="result-count">
            <span>
              {filtered.length === claims.length
                ? formatCount(claims.length, "claim")
                : `${filtered.length} of ${formatCount(claims.length, "claim")}`}
              {hasFilters ? " match these filters" : " in this archive"}
            </span>
            <div className="chip-row">
              {claims.some((claim) => claim.isDemo) && evidence !== "quote-mismatch" ? (
                <span className="badge badge--amber">
                  <FlaskConical size={12} aria-hidden="true" /> Demo claims are fictional
                </span>
              ) : null}
              {claims.some((claim) => claim.evidenceStatus === "quote-mismatch") ? (
                <span className="badge badge--danger">
                  {claims.filter((claim) => claim.evidenceStatus === "quote-mismatch").length} evidence
                  mismatch
                </span>
              ) : null}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No claims match"
              description="Try a broader search, remove a filter, or clear everything to return to the full evidence ledger."
              actions={
                <button type="button" className="button button--ghost" onClick={clearFilters}>
                  <X size={15} aria-hidden="true" /> Clear filters
                </button>
              }
            />
          ) : (
            <div className="claim-grid">
              {filtered.map((claim) => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  recording={recordings.find((recording) => recording.id === claim.recordingId)}
                  relationships={relationshipsByClaim.get(claim.id) ?? []}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
