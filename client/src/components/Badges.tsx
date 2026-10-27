import type { ReactNode } from "react";
import { FlaskConical, Sparkles } from "lucide-react";
import {
  CLAIM_TYPE_LABELS,
  RELATIONSHIP_LABELS,
  type ClaimBasis,
  type ClaimType,
  type RelationshipType,
  type Uncertainty,
} from "@/types";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "sage" | "amber" | "danger" | "ink";
  className?: string;
  title?: string;
}) {
  return (
    <span className={cn("badge", `badge--${tone}`, className)} title={title}>
      {children}
    </span>
  );
}

export function DemoBadge({ compact = false }: { compact?: boolean }) {
  return (
    <Badge tone="amber" className="badge--demo" title="Fictional demonstration data, not historical evidence">
      <FlaskConical size={12} aria-hidden="true" />
      {compact ? "DEMO" : "Demonstration data"}
    </Badge>
  );
}

export function AiBadge({ children = "AI-assisted" }: { children?: ReactNode }) {
  return (
    <Badge tone="accent">
      <Sparkles size={12} aria-hidden="true" />
      {children}
    </Badge>
  );
}

export function RelationshipBadge({ relationship }: { relationship: RelationshipType }) {
  return (
    <span className={cn("relationship-badge", `relationship-badge--${relationship}`)}>
      <span className="relationship-badge__dot" aria-hidden="true" />
      {RELATIONSHIP_LABELS[relationship]}
    </span>
  );
}

export function UncertaintyBadge({ uncertainty }: { uncertainty: Uncertainty }) {
  const label = uncertainty === "low" ? "Low uncertainty" : uncertainty === "medium" ? "Medium uncertainty" : "High uncertainty";
  return (
    <Badge
      tone={uncertainty === "low" ? "sage" : uncertainty === "medium" ? "amber" : "danger"}
      title="This describes the strength of the evidence, not whether the claim is true."
    >
      {label}
    </Badge>
  );
}

export function BasisBadge({ basis }: { basis: ClaimBasis }) {
  return (
    <Badge tone={basis === "explicit" ? "neutral" : "accent"} title={basis === "explicit" ? "The narrator states this directly." : "An AI interpretation of what the narrator said. Review the source."}>
      {basis === "explicit" ? "Explicit statement" : "AI inference"}
    </Badge>
  );
}

export function ClaimTypeBadge({ claimType }: { claimType: ClaimType }) {
  return <Badge tone="ink">{CLAIM_TYPE_LABELS[claimType]}</Badge>;
}
