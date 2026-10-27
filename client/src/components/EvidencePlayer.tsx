import { useState } from "react";
import { Clock3, Play, Volume2 } from "lucide-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { cn, formatSeconds } from "@/lib/utils";
import type { Claim, Recording } from "@/types";

export function EvidencePlayer({
  claim,
  recording,
  compact = false,
}: {
  claim: Claim;
  recording: Recording | undefined;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const start = claim.evidence.startSeconds;
  const end = claim.evidence.endSeconds;
  const hasAudio = Boolean(recording?.audio);

  if (start === null) {
    return (
      <span className="evidence-timestamp evidence-timestamp--missing" title="This segment has no verified timestamp. EchoLedger will not invent one.">
        <Clock3 size={13} aria-hidden="true" /> No verified timestamp
      </span>
    );
  }

  if (!hasAudio) {
    return (
      <span className="evidence-timestamp evidence-timestamp--missing" title="The timestamp is known, but the audio file is not stored in this archive.">
        <Volume2 size={13} aria-hidden="true" /> {formatSeconds(start)} · audio not in archive
      </span>
    );
  }

  return (
    <div className={cn("evidence-player", compact && "evidence-player--compact")}>
      <button
        type="button"
        className={cn("button button--small", open ? "button--ghost" : "button--soft")}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Play size={13} fill="currentColor" aria-hidden="true" />
        {open ? "Hide source audio" : `Play from ${formatSeconds(start)}`}
      </button>
      {open ? (
        <div className="evidence-player__audio">
          <AudioPlayer
            recordingId={recording!.id}
            startSeconds={start}
            endSeconds={end}
            autoPlay
            compact
            label="Evidence clip"
          />
        </div>
      ) : null}
    </div>
  );
}
