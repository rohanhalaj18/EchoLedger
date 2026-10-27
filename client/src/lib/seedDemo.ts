import { demoClaims, demoComparison, demoRecordings } from "@/data/demo";
import { getDB, putClaims, putComparison, putRecording } from "@/lib/db";
import type { Recording } from "@/types";

export async function seedDemoData(): Promise<{ seeded: boolean; audioAvailable: boolean }> {
  const db = await getDB();
  const existing = await db.get("recordings", demoRecordings[0]!.id);
  if (existing) return { seeded: false, audioAvailable: Boolean(existing.audio) };

  let audioAvailable = false;

  for (const baseRecording of demoRecordings) {
    let recording: Recording = baseRecording;
    let audio: { blob: Blob; mimeType: string; fileName: string } | null = null;

    if (baseRecording.audio) {
      try {
        const response = await fetch(`/demo-audio/${baseRecording.audio.fileName}`);
        const contentType = response.headers.get("content-type") ?? "";
        if (response.ok && contentType.startsWith("audio/")) {
          const blob = await response.blob();
          audio = {
            blob,
            mimeType: blob.type || baseRecording.audio.mimeType,
            fileName: baseRecording.audio.fileName,
          };
          recording = {
            ...baseRecording,
            audio: { ...baseRecording.audio, size: blob.size },
          };
          audioAvailable = true;
        }
      } catch {
        // The transcript and claims remain useful if demo audio cannot be loaded.
      }
    }

    await putRecording(recording, audio);
  }

  await putClaims(demoClaims);
  await putComparison(demoComparison);
  return { seeded: true, audioAvailable };
}
