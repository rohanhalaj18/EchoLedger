import { Link } from "react-router-dom";
import { ArrowUpRight, MessageSquareQuote, UserRound } from "lucide-react";
import {
  BasisBadge,
  ClaimTypeBadge,
  DemoBadge,
  RelationshipBadge,
  UncertaintyBadge,
} from "@/components/Badges";
import { EvidencePlayer } from "@/components/EvidencePlayer";
import { cn, getInitials, truncate } from "@/lib/utils";
import type { Claim, Recording, RelationshipType } from "@/types";

export type ClaimRelationship = {
  relationship: RelationshipType;
  topic: string;
  comparisonId: string;
  comparisonTitle: string;
};

type ClaimCardProps = {
  claim: Claim;
  recording: Recording | undefined;
  relationships?: ClaimRelationship[];
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  showQuote?: boolean;
  compact?: boolean;
  showPlayback?: boolean;
  className?: string;
};

export function ClaimCard({
  claim,
  recording,
  relationships = [],
  selectable = false,
  selected = false,
  onToggle,
  showQuote = true,
  compact = false,
  showPlayback = true,
  className,
}: ClaimCardProps) {
  const segment = recording?.transcriptSegments.find(
    (item) => item.id === claim.evidence.segmentId || claim.evidence.segmentIds.includes(item.id),
  );
  const translation = segment?.translation;

  return (
    <article className={cn("claim-card", compact && "claim-card--compact", selected && "claim-card--selected", className)}>
      <div className="claim-card__top">
        <div className="claim-card__badges">
          {selectable ? (
            <label className="claim-select" title="Select this claim">
              <input type="checkbox" checked={selected} onChange={onToggle} />
              <span aria-hidden="true" />
              <span className="sr-only">Select claim</span>
            </label>
          ) : null}
          <ClaimTypeBadge claimType={claim.claimType} />
          <UncertaintyBadge uncertainty={claim.uncertainty} />
          <BasisBadge basis={claim.basis} />
          {claim.isDemo ? <DemoBadge compact /> : null}
          {claim.evidenceStatus === "quote-mismatch" ? (
            <span className="badge badge--danger" title="The transcript changed after this claim was saved.">
              Evidence mismatch
            </span>
          ) : null}
        </div>
        <Link to={`/claims/${claim.id}`} className="claim-card__open" aria-label="Open claim evidence">
          Open <ArrowUpRight size={14} />
        </Link>
      </div>

      <Link to={`/claims/${claim.id}`} className="claim-card__claim">
        {claim.claimText}
      </Link>

      {relationships.length > 0 ? (
        <div className="claim-card__relationships">
          {relationships.map((relationship) => (
            <span key={`${relationship.comparisonId}-${relationship.topic}`} className="claim-relationship">
              <RelationshipBadge relationship={relationship.relationship} />
              <span>{truncate(relationship.topic, 46)}</span>
            </span>
          ))}
        </div>
      ) : null}

      {showQuote ? (
        <div className="claim-card__evidence">
          <div className="claim-card__evidence-label">
            <MessageSquareQuote size={13} aria-hidden="true" /> Original wording
          </div>
          <blockquote>{claim.evidence.quote}</blockquote>
          {translation ? (
            <p className="claim-card__translation">
              <span>English translation</span> {translation}
            </p>
          ) : null}
          {claim.interpretationNote ? (
            <p className="claim-card__interpretation">
              <strong>AI interpretation note:</strong> {claim.interpretationNote}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="claim-card__footer">
        <div className="claim-card__source">
          <span className="avatar avatar--tiny" aria-hidden="true">
            {recording ? getInitials(recording.speaker) : <UserRound size={12} />}
          </span>
          <span>
            <strong>{recording?.speaker ?? "Unknown narrator"}</strong>
            {recording ? (
              <>
                {" · "}
                <Link to={`/recordings/${recording.id}`}>{truncate(recording.title, 48)}</Link>
              </>
            ) : null}
          </span>
        </div>
        {showPlayback ? <EvidencePlayer claim={claim} recording={recording} compact={compact} /> : null}
      </div>
    </article>
  );
}
