import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpenText,
  CalendarDays,
  FlaskConical,
  GitCompareArrows,
  Layers,
  Network,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { DemoBadge, RelationshipBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import { useArchive } from "@/context/ArchiveContext";
import { formatCount, parseYear, truncate } from "@/lib/utils";
import type { Claim } from "@/types";

type MapTab = "timeline" | "themes" | "relationships";

function MiniClaim({ claim, recordingLabel }: { claim: Claim; recordingLabel: string }) {
  return (
    <Link to={`/claims/${claim.id}`} className="mini-claim">
      <strong>{claim.claimText}</strong>
      <span>
        {recordingLabel} · {claim.claimType}
        {claim.timePeriod.originalExpression
          ? ` · “${truncate(claim.timePeriod.originalExpression, 42)}”`
          : ""}
      </span>
    </Link>
  );
}

export function ResearchMapPage() {
  const { loading, recordings, claims, comparisons } = useArchive();
  const [tab, setTab] = useState<MapTab>("timeline");
  const [showAllThemes, setShowAllThemes] = useState(false);

  const datedClaims = useMemo(
    () =>
      claims
        .map((claim) => ({ claim, year: parseYear(claim) }))
        .filter((item): item is { claim: Claim; year: { year: number; label: string } } =>
          Boolean(item.year),
        ),
    [claims],
  );

  const timeline = useMemo(() => {
    const groups = new Map<number, Claim[]>();
    for (const item of datedClaims) {
      const list = groups.get(item.year.year) ?? [];
      list.push(item.claim);
      groups.set(item.year.year, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [datedClaims]);

  const undatedClaims = useMemo(() => {
    const datedIds = new Set(datedClaims.map((item) => item.claim.id));
    return claims.filter((claim) => !datedIds.has(claim.id));
  }, [claims, datedClaims]);

  const themes = useMemo(() => {
    const map = new Map<string, { label: string; claims: Claim[] }>();
    for (const claim of claims) {
      const seen = new Set<string>();
      for (const entity of claim.entities) {
        const key = entity.name.trim().toLocaleLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const group = map.get(key) ?? { label: entity.name.trim(), claims: [] };
        group.claims.push(claim);
        map.set(key, group);
      }
    }
    return [...map.values()].sort(
      (a, b) => b.claims.length - a.claims.length || a.label.localeCompare(b.label),
    );
  }, [claims]);

  const recordingLabel = (claim: Claim) => {
    const recording = recordings.find((item) => item.id === claim.recordingId);
    return recording ? `${recording.speaker}` : "Unknown narrator";
  };

  const resolvedComparisons = useMemo(
    () =>
      comparisons.map((comparison) => ({
        comparison,
        groups: comparison.groups
          .map((group) => ({
            ...group,
            claims: group.claimIds
              .map((claimId) => claims.find((claim) => claim.id === claimId))
              .filter((claim): claim is Claim => Boolean(claim)),
          }))
          .filter((group) => group.claims.length > 0),
      })),
    [comparisons, claims],
  );

  if (loading) return <LoadingState />;

  return (
    <>
      <PageHeader
        eyebrow="Spatial & temporal view"
        title="Research map"
        description="A timeline of explicitly dated claims, a thematic index of named entities, and the provisional relationships between accounts. Relative time expressions are preserved, never converted into dates."
        actions={
          <>
            <Link to="/claims" className="button button--ghost">
              <BookOpenText size={15} aria-hidden="true" /> Claim explorer
            </Link>
            <Link to="/compare" className="button button--primary">
              <GitCompareArrows size={16} aria-hidden="true" /> New comparison
            </Link>
          </>
        }
        meta={
          <>
            <span>{formatCount(datedClaims.length, "dated claim")}</span>
            <span>{formatCount(undatedClaims.length, "relative or undated claim")}</span>
            <span>{formatCount(themes.length, "theme")}</span>
            <span>{formatCount(comparisons.length, "comparison")}</span>
          </>
        }
      />

      <div className="notice notice--info" style={{ marginBottom: 16 }}>
        <CalendarDays size={17} aria-hidden="true" />
        <div className="notice__body">
          <strong className="notice__title">Dates are only what the narrator explicitly said</strong>
          <p>
            A year appears on this timeline only when it is present in the claim&apos;s evidence. Expressions
            like “about seventy years ago” or “the year after the flood” remain relative and appear below
            the timeline. EchoLedger does not estimate calendar years.
          </p>
        </div>
      </div>

      {claims.length === 0 ? (
        <EmptyState
          icon={<Network size={23} />}
          title="The map has no claims to plot"
          description="Add a transcript and extract evidence-linked claims, or load the demo archive. The map is built from claims, not from invented summaries."
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
          <div className="toolbar" style={{ marginBottom: 16 }}>
            <div className="segmented" role="tablist" aria-label="Research map views">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "timeline"}
                className={tab === "timeline" ? "segmented--active" : undefined}
                onClick={() => setTab("timeline")}
              >
                <CalendarDays size={14} aria-hidden="true" /> Timeline
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "themes"}
                className={tab === "themes" ? "segmented--active" : undefined}
                onClick={() => setTab("themes")}
              >
                <Tag size={14} aria-hidden="true" /> Themes
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "relationships"}
                className={tab === "relationships" ? "segmented--active" : undefined}
                onClick={() => setTab("relationships")}
              >
                <Layers size={14} aria-hidden="true" /> Relationships
              </button>
            </div>
            <div className="toolbar__spacer" />
            <div className="map-summary">
              <span>
                <CalendarDays size={13} aria-hidden="true" /> {formatCount(timeline.length, "year")}
              </span>
              <span>
                <Tag size={13} aria-hidden="true" /> {formatCount(themes.length, "entity theme")}
              </span>
              <span>
                <Layers size={13} aria-hidden="true" /> {formatCount(comparisons.length, "comparison")}
              </span>
            </div>
          </div>

          {tab === "timeline" ? (
            <div className="stack stack--lg">
              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h2>Explicit years</h2>
                    <p>Claims whose evidence contains a stated four-digit year.</p>
                  </div>
                </div>
                <div className="panel__body">
                  {timeline.length === 0 ? (
                    <p className="small muted">
                      No claim currently has an explicit year. Relative expressions remain below.
                    </p>
                  ) : (
                    <ol className="timeline">
                      {timeline.map(([year, yearClaims]) => (
                        <li key={year} className="timeline__group">
                          <div className="timeline__year">
                            {year}
                            <span className="timeline__year-label">stated year</span>
                          </div>
                          <div className="timeline__items">
                            {yearClaims.map((claim) => (
                              <MiniClaim
                                key={claim.id}
                                claim={claim}
                                recordingLabel={recordingLabel(claim)}
                              />
                            ))}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>

              {undatedClaims.length > 0 ? (
                <section className="panel">
                  <div className="panel__header">
                    <div>
                      <h2>Relative or unstated time</h2>
                      <p>
                        These claims were not placed on the calendar. The narrator&apos;s expression is kept
                        verbatim where available.
                      </p>
                    </div>
                  </div>
                  <div className="panel__body">
                    <div className="grid grid--2">
                      {undatedClaims.map((claim) => (
                        <MiniClaim
                          key={claim.id}
                          claim={claim}
                          recordingLabel={recordingLabel(claim)}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {tab === "themes" ? (
            <section className="panel">
              <div className="panel__header">
                <div>
                  <h2>Named entities</h2>
                  <p>
                    Themes are built only from entities named in the evidence. They are an index, not an
                    interpretation.
                  </p>
                </div>
              </div>
              <div className="panel__body">
                {themes.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Tag size={20} />}
                    title="No entities indexed"
                    description="Claims currently contain no named entities. Re-extract claims or add entities in a future claim review."
                  />
                ) : (
                  <>
                    <div className="theme-grid">
                      {themes
                        .slice(0, showAllThemes ? themes.length : 12)
                        .map((theme, index) => (
                          <details key={theme.label} className="theme-card" open={index < 3}>
                            <summary>
                              {theme.label}
                              <span>{formatCount(theme.claims.length, "claim")}</span>
                            </summary>
                            <div className="theme-card__body">
                              {theme.claims.map((claim) => (
                                <MiniClaim
                                  key={claim.id}
                                  claim={claim}
                                  recordingLabel={recordingLabel(claim)}
                                />
                              ))}
                            </div>
                          </details>
                        ))}
                    </div>
                    {themes.length > 12 ? (
                      <div className="form-actions mt-2">
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          onClick={() => setShowAllThemes((value) => !value)}
                        >
                          {showAllThemes
                            ? "Show fewer themes"
                            : `Show all ${themes.length} themes`}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </section>
          ) : null}

          {tab === "relationships" ? (
            <div className="stack stack--lg">
              {comparisons.length === 0 ? (
                <EmptyState
                  icon={<GitCompareArrows size={22} />}
                  title="No relationships saved"
                  description="Generate a comparison to map how accounts agree, differ or remain unique. Relationships are provisional research aids, not truth verdicts."
                  actions={
                    <Link to="/compare" className="button button--primary">
                      Compare accounts
                    </Link>
                  }
                />
              ) : (
                resolvedComparisons.map(({ comparison, groups }) => (
                  <section key={comparison.id} className="section" style={{ marginTop: 0 }}>
                    <div className="section__header">
                      <div>
                        <h2>{comparison.title}</h2>
                        <p>
                          {formatCount(groups.length, "group")} ·{" "}
                          {formatCount(comparison.recordingIds.length, "recording")} ·{" "}
                          {comparison.isDemo ? "fictional demo" : comparison.model}
                        </p>
                      </div>
                      <div className="section__actions">
                        {comparison.isDemo ? <DemoBadge compact /> : null}
                        <Link
                          to={`/comparisons/${comparison.id}`}
                          className="button button--ghost button--small"
                        >
                          Open comparison
                        </Link>
                      </div>
                    </div>
                    {groups.length === 0 ? (
                      <p className="small muted">
                        This comparison&apos;s claims are no longer in the archive.
                      </p>
                    ) : (
                      <div className="group-list">
                        {groups.map((group) => (
                          <article key={group.id} className="group-card">
                            <div className="group-card__header">
                              <div>
                                <RelationshipBadge relationship={group.relationship} />
                                <h3>{group.topic}</h3>
                              </div>
                              <span className="badge badge--neutral">
                                Comparison confidence: {group.confidence}
                              </span>
                            </div>
                            <p className="group-card__rationale">{group.rationale}</p>
                            <div className="group-card__claims">
                              {group.claims.map((claim) => (
                                <MiniClaim
                                  key={claim.id}
                                  claim={claim}
                                  recordingLabel={recordingLabel(claim)}
                                />
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                ))
              )}

              {comparisons.some((comparison) => comparison.isDemo) ? (
                <div className="notice notice--warning">
                  <FlaskConical size={17} aria-hidden="true" />
                  <div className="notice__body">
                    <strong className="notice__title">Demo relationships are fictional</strong>
                    <p>
                      The Nilavari Lake comparison was invented to demonstrate conflicting origins and
                      shared ritual. It is not historical evidence.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <div className="notice notice--plain mt-3">
        <ShieldCheck size={16} aria-hidden="true" />
        <div className="notice__body">
          <strong className="notice__title">A map is an argument, not the territory</strong>
          <p>
            Grouping and timelines reflect the claims in this archive, not a complete historical record.
            Absence from the map means the archive lacks evidence, not that something did not happen.
          </p>
        </div>
      </div>
    </>
  );
}
