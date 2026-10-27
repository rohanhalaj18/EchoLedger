import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AudioAsset, Claim, Comparison, Recording } from "@/types";

interface EchoDB extends DBSchema {
  recordings: {
    key: string;
    value: Recording;
    indexes: {
      "by-createdAt": string;
      "by-language": string;
      "by-place": string;
      "by-speaker": string;
    };
  };
  audio: {
    key: string;
    value: AudioAsset;
  };
  claims: {
    key: string;
    value: Claim;
    indexes: {
      "by-recording": string;
      "by-createdAt": string;
    };
  };
  comparisons: {
    key: string;
    value: Comparison;
    indexes: {
      "by-createdAt": string;
    };
  };
}

const DB_NAME = "echoledger";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<EchoDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<EchoDB>> {
  dbPromise ??= openDB<EchoDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const recordings = db.createObjectStore("recordings", { keyPath: "id" });
      recordings.createIndex("by-createdAt", "createdAt");
      recordings.createIndex("by-language", "language");
      recordings.createIndex("by-place", "place");
      recordings.createIndex("by-speaker", "speaker");

      db.createObjectStore("audio", { keyPath: "recordingId" });

      const claims = db.createObjectStore("claims", { keyPath: "id" });
      claims.createIndex("by-recording", "recordingId");
      claims.createIndex("by-createdAt", "createdAt");

      const comparisons = db.createObjectStore("comparisons", { keyPath: "id" });
      comparisons.createIndex("by-createdAt", "createdAt");
    },
  });
  return dbPromise;
}

export type ArchiveSnapshot = {
  recordings: Recording[];
  claims: Claim[];
  comparisons: Comparison[];
};

export async function loadArchive(): Promise<ArchiveSnapshot> {
  const db = await getDB();
  const tx = db.transaction(["recordings", "claims", "comparisons"], "readonly");
  const [recordings, claims, comparisons] = await Promise.all([
    tx.objectStore("recordings").getAll(),
    tx.objectStore("claims").getAll(),
    tx.objectStore("comparisons").getAll(),
  ]);
  await tx.done;
  return { recordings, claims, comparisons };
}

export async function putRecording(
  recording: Recording,
  audio?: { blob: Blob; mimeType: string; fileName: string } | null,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["recordings", "audio"], "readwrite");
  await tx.objectStore("recordings").put(recording);
  if (audio) {
    await tx.objectStore("audio").put({
      recordingId: recording.id,
      blob: audio.blob,
      mimeType: audio.mimeType,
      fileName: audio.fileName,
    });
  }
  await tx.done;
}

export async function putRecordingMeta(recording: Recording): Promise<void> {
  const db = await getDB();
  await db.put("recordings", recording);
}

export async function getAudioAsset(recordingId: string): Promise<AudioAsset | undefined> {
  const db = await getDB();
  return db.get("audio", recordingId);
}

export async function deleteRecordingCascade(recordingId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["recordings", "audio", "claims", "comparisons"], "readwrite");
  const claimStore = tx.objectStore("claims");
  const comparisonStore = tx.objectStore("comparisons");
  const claimKeys = await claimStore.index("by-recording").getAllKeys(recordingId);
  const claimIdSet = new Set(claimKeys.map(String));
  const comparisons = await comparisonStore.getAll();

  for (const key of claimKeys) {
    await claimStore.delete(key);
  }
  await tx.objectStore("recordings").delete(recordingId);
  await tx.objectStore("audio").delete(recordingId);

  for (const comparison of comparisons) {
    if (!comparison.recordingIds.includes(recordingId) && !comparison.groups.some((group) => group.claimIds.some((id) => claimIdSet.has(id)))) {
      continue;
    }
    const groups = comparison.groups
      .map((group) => ({ ...group, claimIds: group.claimIds.filter((id) => !claimIdSet.has(id)) }))
      .filter((group) => group.claimIds.length > 0);
    const recordingIds = comparison.recordingIds.filter((id) => id !== recordingId);
    const ungroupedClaimIds = comparison.ungroupedClaimIds.filter((id) => !claimIdSet.has(id));
    if (recordingIds.length < 2 || groups.length === 0) {
      await comparisonStore.delete(comparison.id);
    } else {
      await comparisonStore.put({ ...comparison, recordingIds, groups, ungroupedClaimIds });
    }
  }

  await tx.done;
}

export async function replaceClaimsForRecording(recordingId: string, claims: Claim[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["claims", "comparisons"], "readwrite");
  const store = tx.objectStore("claims");
  const comparisonStore = tx.objectStore("comparisons");
  const existing = await store.index("by-recording").getAllKeys(recordingId);
  const nextIds = new Set(claims.map((claim) => claim.id));
  const removedIds = new Set(existing.map(String).filter((id) => !nextIds.has(id)));

  for (const key of existing) {
    await store.delete(key);
  }
  for (const claim of claims) {
    await store.put(claim);
  }

  if (removedIds.size > 0) {
    const comparisons = await comparisonStore.getAll();
    for (const comparison of comparisons) {
      let changed = false;
      const groups = comparison.groups
        .map((group) => {
          if (!group.claimIds.some((id) => removedIds.has(id))) return group;
          changed = true;
          return { ...group, claimIds: group.claimIds.filter((id) => !removedIds.has(id)) };
        })
        .filter((group) => group.claimIds.length > 0);
      const ungroupedClaimIds = comparison.ungroupedClaimIds.filter((id) => !removedIds.has(id));
      if (ungroupedClaimIds.length !== comparison.ungroupedClaimIds.length) changed = true;
      if (!changed) continue;
      if (groups.length === 0 || comparison.recordingIds.length < 2) {
        await comparisonStore.delete(comparison.id);
      } else {
        await comparisonStore.put({ ...comparison, groups, ungroupedClaimIds });
      }
    }
  }

  await tx.done;
}

export async function putClaims(claims: Claim[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("claims", "readwrite");
  for (const claim of claims) {
    await tx.store.put(claim);
  }
  await tx.done;
}

export async function putClaim(claim: Claim): Promise<void> {
  const db = await getDB();
  await db.put("claims", claim);
}

export async function deleteClaimCascade(claimId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["claims", "comparisons"], "readwrite");
  const claimStore = tx.objectStore("claims");
  const comparisonStore = tx.objectStore("comparisons");
  await claimStore.delete(claimId);
  const comparisons = await comparisonStore.getAll();
  for (const comparison of comparisons) {
    let changed = false;
    const groups = comparison.groups
      .map((group) => {
        if (!group.claimIds.includes(claimId)) return group;
        changed = true;
        return { ...group, claimIds: group.claimIds.filter((id) => id !== claimId) };
      })
      .filter((group) => group.claimIds.length > 0);
    const ungroupedClaimIds = comparison.ungroupedClaimIds.filter((id) => id !== claimId);
    if (ungroupedClaimIds.length !== comparison.ungroupedClaimIds.length) changed = true;
    if (!changed) continue;
    if (groups.length === 0) {
      await comparisonStore.delete(comparison.id);
    } else {
      await comparisonStore.put({ ...comparison, groups, ungroupedClaimIds });
    }
  }
  await tx.done;
}

export async function putComparison(comparison: Comparison): Promise<void> {
  const db = await getDB();
  await db.put("comparisons", comparison);
}

export async function deleteComparison(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("comparisons", id);
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["recordings", "audio", "claims", "comparisons"], "readwrite");
  await Promise.all([
    tx.objectStore("recordings").clear(),
    tx.objectStore("audio").clear(),
    tx.objectStore("claims").clear(),
    tx.objectStore("comparisons").clear(),
  ]);
  await tx.done;
}

export async function deleteDemoData(): Promise<void> {
  const db = await getDB();
  const recordings = await db.getAll("recordings");
  const demoIds = recordings.filter((recording) => recording.isDemo).map((recording) => recording.id);
  for (const id of demoIds) {
    await deleteRecordingCascade(id);
  }
  const comparisons = await db.getAll("comparisons");
  for (const comparison of comparisons) {
    if (comparison.isDemo) await db.delete("comparisons", comparison.id);
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}
