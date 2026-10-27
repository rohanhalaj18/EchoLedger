import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getAiStatus } from "@/lib/api";
import {
  clearAllData,
  deleteClaimCascade,
  deleteComparison as deleteComparisonDb,
  deleteDemoData,
  deleteRecordingCascade,
  getAudioAsset,
  getDB,
  loadArchive,
  putClaim,
  putComparison,
  putRecording,
  putRecordingMeta,
  replaceClaimsForRecording,
} from "@/lib/db";
import { seedDemoData } from "@/lib/seedDemo";
import { revalidateClaim, unique } from "@/lib/utils";
import type { AiStatus, Claim, Comparison, Recording } from "@/types";

type ArchiveContextValue = {
  loading: boolean;
  error: string | null;
  recordings: Recording[];
  claims: Claim[];
  comparisons: Comparison[];
  aiStatus: AiStatus | null;
  aiStatusError: string | null;
  reload: () => Promise<void>;
  refreshAiStatus: () => Promise<void>;
  addRecording: (
    recording: Recording,
    audio?: { blob: Blob; mimeType: string; fileName: string } | null,
  ) => Promise<void>;
  updateRecording: (recording: Recording) => Promise<{ invalidatedClaims: number }>;
  deleteRecording: (id: string) => Promise<void>;
  replaceClaims: (recordingId: string, claims: Claim[]) => Promise<void>;
  updateClaim: (claim: Claim) => Promise<void>;
  deleteClaim: (claimId: string) => Promise<void>;
  mergeClaims: (claimIds: string[], primaryId: string, mergedText: string) => Promise<Claim>;
  addComparison: (comparison: Comparison) => Promise<void>;
  deleteComparison: (id: string) => Promise<void>;
  seedDemo: () => Promise<{ seeded: boolean; audioAvailable: boolean }>;
  removeDemo: () => Promise<void>;
  clearArchive: () => Promise<void>;
  getAudio: (recordingId: string) => Promise<Blob | null>;
};

const ArchiveContext = createContext<ArchiveContextValue | null>(null);

function sortByCreatedAt<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiStatusError, setAiStatusError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const snapshot = await loadArchive();
      setRecordings(sortByCreatedAt(snapshot.recordings));
      setClaims(sortByCreatedAt(snapshot.claims));
      setComparisons(sortByCreatedAt(snapshot.comparisons));
      setError(null);
    } catch (loadError) {
      console.error("[archive] load failed", loadError);
      setError(
        "EchoLedger could not open its local archive. Check that this browser allows IndexedDB and that storage is not full.",
      );
    }
  }, []);

  const refreshAiStatus = useCallback(async () => {
    try {
      const status = await getAiStatus();
      setAiStatus(status);
      setAiStatusError(null);
    } catch (statusError) {
      setAiStatus(null);
      setAiStatusError(
        statusError instanceof Error
          ? statusError.message
          : "Could not read Gemini configuration from the local server.",
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await reload();
      if (active) setLoading(false);
      await refreshAiStatus();
    })();
    return () => {
      active = false;
    };
  }, [reload, refreshAiStatus]);

  const addRecording = useCallback<ArchiveContextValue["addRecording"]>(
    async (recording, audio = null) => {
      await putRecording(recording, audio);
      setRecordings((previous) => sortByCreatedAt([recording, ...previous]));
    },
    [],
  );

  const updateRecording = useCallback<ArchiveContextValue["updateRecording"]>(
    async (recording) => {
      await putRecordingMeta(recording);
      setRecordings((previous) =>
        sortByCreatedAt(previous.map((item) => (item.id === recording.id ? recording : item))),
      );

      const recordingClaims = claims.filter((claim) => claim.recordingId === recording.id);
      if (recordingClaims.length === 0) return { invalidatedClaims: 0 };

      const revalidated = recordingClaims.map((claim) => revalidateClaim(claim, recording));
      const invalidatedClaims = revalidated.filter((claim) => claim.evidenceStatus === "quote-mismatch").length;
      for (const claim of revalidated) {
        await putClaim(claim);
      }
      const byId = new Map(revalidated.map((claim) => [claim.id, claim]));
      setClaims((previous) => previous.map((claim) => byId.get(claim.id) ?? claim));
      return { invalidatedClaims };
    },
    [claims],
  );

  const deleteRecording = useCallback<ArchiveContextValue["deleteRecording"]>(async (id) => {
    await deleteRecordingCascade(id);
    setRecordings((previous) => previous.filter((recording) => recording.id !== id));
    setClaims((previous) => previous.filter((claim) => claim.recordingId !== id));
    setComparisons((previous) =>
      previous.filter((comparison) => comparison.recordingIds.includes(id) === false),
    );
    await reload();
  }, [reload]);

  const replaceClaims = useCallback<ArchiveContextValue["replaceClaims"]>(
    async (recordingId, nextClaims) => {
      await replaceClaimsForRecording(recordingId, nextClaims);
      setClaims((previous) => [
        ...previous.filter((claim) => claim.recordingId !== recordingId),
        ...nextClaims,
      ]);
      await reload();
    },
    [reload],
  );

  const updateClaim = useCallback<ArchiveContextValue["updateClaim"]>(async (claim) => {
    const updated = { ...claim, updatedAt: new Date().toISOString() };
    await putClaim(updated);
    setClaims((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  const deleteClaim = useCallback<ArchiveContextValue["deleteClaim"]>(
    async (claimId) => {
      await deleteClaimCascade(claimId);
      setClaims((previous) => previous.filter((claim) => claim.id !== claimId));
      await reload();
    },
    [reload],
  );

  const mergeClaims = useCallback<ArchiveContextValue["mergeClaims"]>(
    async (claimIds, primaryId, mergedText) => {
      const selected = claims.filter((claim) => claimIds.includes(claim.id));
      const primary = selected.find((claim) => claim.id === primaryId);
      if (!primary || selected.length < 2) {
        throw new Error("Select at least two claims from the same recording to merge.");
      }
      if (new Set(selected.map((claim) => claim.recordingId)).size > 1) {
        throw new Error("Claims from different recordings cannot be merged into one source.");
      }

      const uncertaintyRank = { low: 0, medium: 1, high: 2 } as const;
      const uncertainty = selected.reduce<Claim["uncertainty"]>(
        (highest, claim) =>
          uncertaintyRank[claim.uncertainty] > uncertaintyRank[highest] ? claim.uncertainty : highest,
        "low",
      );
      const merged: Claim = {
        ...primary,
        claimText: mergedText.trim() || primary.claimText,
        entities: unique(
          selected.flatMap((claim) => claim.entities.map((entity) => `${entity.name}\u0000${entity.type}`)),
        ).map((value) => {
          const [name = "", type = "other"] = value.split("\u0000");
          return { name, type: type as Claim["entities"][number]["type"] };
        }),
        uncertainty,
        researcherNotes: [primary.researcherNotes, `Merged by researcher from ${selected.length} claims: ${selected.map((claim) => claim.id).join(", ")}`]
          .filter(Boolean)
          .join("\n"),
        updatedAt: new Date().toISOString(),
      };

      const db = await getDB();
      const tx = db.transaction(["claims", "comparisons"], "readwrite");
      const claimStore = tx.objectStore("claims");
      const comparisonStore = tx.objectStore("comparisons");
      await claimStore.put(merged);
      for (const claim of selected) {
        if (claim.id !== primary.id) await claimStore.delete(claim.id);
      }

      const comparisons = await comparisonStore.getAll();
      for (const comparison of comparisons) {
        const mergedIds = new Set(selected.map((claim) => claim.id));
        let changed = false;
        const groups = comparison.groups
          .map((group) => {
            if (!group.claimIds.some((id) => mergedIds.has(id))) return group;
            changed = true;
            const nextIds = unique(group.claimIds.map((id) => (mergedIds.has(id) ? primary.id : id)));
            return { ...group, claimIds: nextIds };
          })
          .filter((group) => group.claimIds.length > 0);
        const ungroupedClaimIds = unique(
          comparison.ungroupedClaimIds.map((id) => (mergedIds.has(id) ? primary.id : id)),
        ).filter((id) => !groups.some((group) => group.claimIds.includes(id)));
        if (!changed) continue;
        if (groups.length === 0) {
          await comparisonStore.delete(comparison.id);
        } else {
          await comparisonStore.put({ ...comparison, groups, ungroupedClaimIds });
        }
      }
      await tx.done;

      await reload();
      return merged;
    },
    [claims, reload],
  );

  const addComparison = useCallback<ArchiveContextValue["addComparison"]>(async (comparison) => {
    await putComparison(comparison);
    setComparisons((previous) => sortByCreatedAt([comparison, ...previous]));
  }, []);

  const deleteComparison = useCallback<ArchiveContextValue["deleteComparison"]>(
    async (id) => {
      await deleteComparisonDb(id);
      setComparisons((previous) => previous.filter((comparison) => comparison.id !== id));
    },
    [],
  );

  const seedDemo = useCallback<ArchiveContextValue["seedDemo"]>(async () => {
    const result = await seedDemoData();
    await reload();
    return result;
  }, [reload]);

  const removeDemo = useCallback<ArchiveContextValue["removeDemo"]>(async () => {
    await deleteDemoData();
    await reload();
  }, [reload]);

  const clearArchive = useCallback<ArchiveContextValue["clearArchive"]>(async () => {
    await clearAllData();
    setRecordings([]);
    setClaims([]);
    setComparisons([]);
  }, []);

  const getAudio = useCallback<ArchiveContextValue["getAudio"]>(async (recordingId) => {
    const asset = await getAudioAsset(recordingId);
    return asset?.blob ?? null;
  }, []);

  const value = useMemo<ArchiveContextValue>(
    () => ({
      loading,
      error,
      recordings,
      claims,
      comparisons,
      aiStatus,
      aiStatusError,
      reload,
      refreshAiStatus,
      addRecording,
      updateRecording,
      deleteRecording,
      replaceClaims,
      updateClaim,
      deleteClaim,
      mergeClaims,
      addComparison,
      deleteComparison,
      seedDemo,
      removeDemo,
      clearArchive,
      getAudio,
    }),
    [
      loading,
      error,
      recordings,
      claims,
      comparisons,
      aiStatus,
      aiStatusError,
      reload,
      refreshAiStatus,
      addRecording,
      updateRecording,
      deleteRecording,
      replaceClaims,
      updateClaim,
      deleteClaim,
      mergeClaims,
      addComparison,
      deleteComparison,
      seedDemo,
      removeDemo,
      clearArchive,
      getAudio,
    ],
  );

  return <ArchiveContext.Provider value={value}>{children}</ArchiveContext.Provider>;
}

export function useArchive(): ArchiveContextValue {
  const context = useContext(ArchiveContext);
  if (!context) throw new Error("useArchive must be used inside ArchiveProvider.");
  return context;
}
