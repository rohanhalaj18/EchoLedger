import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  FlaskConical,
  LibraryBig,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import { RecordingCard } from "@/components/RecordingCard";
import { useArchive } from "@/context/ArchiveContext";
import { useToast } from "@/context/ToastContext";
import { exportArchiveJson } from "@/lib/export";
import { formatCount } from "@/lib/utils";

type SortMode = "newest" | "oldest" | "title" | "claims";
type DemoFilter = "all" | "research" | "demo";

export function LibraryPage() {
  const { loading, error, recordings, claims, comparisons, seedDemo } = useArchive();
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("all");
  const [place, setPlace] = useState("all");
  const [demoFilter, setDemoFilter] = useState<DemoFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [seeding, setSeeding] = useState(false);

  const languages = useMemo(
    () => [...new Set(recordings.map((recording) => recording.language))].sort(),
    [recordings],
  );
  const places = useMemo(
    () =>
      [...new Set(recordings.map((recording) => recording.place).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [recordings],
  );

  const claimCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const claim of claims) {
      map.set(claim.recordingId, (map.get(claim.recordingId) ?? 0) + 1);
    }
    return map;
  }, [claims]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const result = recordings.filter((recording) => {
      if (language !== "all" && recording.language !== language) return false;
      if (place !== "all" && recording.place !== place) return false;
      if (demoFilter === "demo" && !recording.isDemo) return false;
      if (demoFilter === "research" && recording.isDemo) return false;
      if (!query) return true;
      const haystack = [
        recording.title,
        recording.speaker,
        recording.language,
        recording.place,
        recording.period,
        recording.notes,
        recording.topics.join(" "),
        recording.transcriptSegments.map((segment) => segment.text).join(" "),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(query);
    });

    return [...result].sort((a, b) => {
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "claims") {
        return (claimCounts.get(b.id) ?? 0) - (claimCounts.get(a.id) ?? 0);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [recordings, language, place, demoFilter, search, sort, claimCounts]);

  const hasFilters =
    search.trim() !== "" || language !== "all" || place !== "all" || demoFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setLanguage("all");
    setPlace("all");
    setDemoFilter("all");
    setSort("newest");
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await seedDemo();
      notify(
        result.seeded
          ? "Fictional demonstration archive loaded. Every demo record is labelled."
          : "The demo archive is already present.",
        result.seeded ? "success" : "info",
      );
    } catch (seedError) {
      notify(
        seedError instanceof Error ? seedError.message : "The demo archive could not be loaded.",
        "error",
      );
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="notice notice--danger" role="alert">
        <LibraryBig size={18} aria-hidden="true" />
        <div className="notice__body">
          <strong className="notice__title">The archive could not be read</strong>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Local archive"
        title="Recordings & transcripts"
        description="Search every source in this browser. Demo records are fictional; research records are your own material. Audio never leaves the device unless you explicitly send it to Gemini."
        actions={
          <>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                exportArchiveJson(recordings, claims, comparisons);
                notify("Archive JSON exported with provenance and disclaimers.", "success");
              }}
              disabled={recordings.length === 0}
            >
              <Download size={15} aria-hidden="true" /> Export archive
            </button>
            <Link to="/recordings/new" className="button button--primary">
              <Plus size={16} aria-hidden="true" /> Add a recording
            </Link>
          </>
        }
        meta={
          <>
            <span>{formatCount(recordings.length, "recording")}</span>
            <span>{formatCount(claims.length, "claim")}</span>
            <span>{formatCount(comparisons.length, "comparison")}</span>
            <span>{formatCount(languages.length, "language")}</span>
          </>
        }
      />

      {recordings.length === 0 ? (
        <EmptyState
          icon={<LibraryBig size={23} />}
          title="The archive is empty"
          description="Add an audio interview or a transcript to begin. You can also load the fictional Nilavari Lake demonstration archive to explore the workflow without an API key."
          actions={
            <>
              <Link to="/recordings/new" className="button button--primary">
                <Plus size={16} aria-hidden="true" /> Add a recording
              </Link>
              <button
                type="button"
                className="button button--ghost"
                onClick={handleSeed}
                disabled={seeding}
              >
                <FlaskConical size={16} aria-hidden="true" />
                {seeding ? "Loading demo…" : "Load demo archive"}
              </button>
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
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search titles, narrators, places, topics or transcript text…"
                aria-label="Search archive"
              />
            </div>

            <div className="field">
              <label htmlFor="language-filter">Language</label>
              <select
                id="language-filter"
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
              <label htmlFor="place-filter">Place</label>
              <select
                id="place-filter"
                className="select"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
              >
                <option value="all">All places</option>
                {places.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="demo-filter">Record type</label>
              <select
                id="demo-filter"
                className="select"
                value={demoFilter}
                onChange={(event) => setDemoFilter(event.target.value as DemoFilter)}
              >
                <option value="all">All records</option>
                <option value="research">Research only</option>
                <option value="demo">Demo only</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="sort-filter">Sort</label>
              <select
                id="sort-filter"
                className="select"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title">Title A–Z</option>
                <option value="claims">Most claims</option>
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
              <SlidersHorizontal size={13} aria-hidden="true" style={{ display: "inline", marginRight: 5 }} />
              {filtered.length === recordings.length
                ? `${formatCount(recordings.length, "record")}`
                : `${filtered.length} of ${formatCount(recordings.length, "record")}`}
              {hasFilters ? " match these filters" : " in this archive"}
            </span>
            {demoFilter !== "demo" && recordings.some((recording) => recording.isDemo) ? (
              <span className="badge badge--amber">
                <FlaskConical size={12} aria-hidden="true" /> Demo records are fictional
              </span>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No records match"
              description="Try a broader search, choose another language or place, or clear the filters."
              actions={
                <button type="button" className="button button--ghost" onClick={clearFilters}>
                  <X size={15} aria-hidden="true" /> Clear filters
                </button>
              }
            />
          ) : (
            <div className="recording-grid">
              {filtered.map((recording) => (
                <RecordingCard
                  key={recording.id}
                  recording={recording}
                  claimCount={claimCounts.get(recording.id) ?? 0}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
