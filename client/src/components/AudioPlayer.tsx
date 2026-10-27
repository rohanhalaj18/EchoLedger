import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, LoaderCircle, Pause, Play, RotateCcw } from "lucide-react";
import { useArchive } from "@/context/ArchiveContext";
import { cn, formatDuration, formatSeconds } from "@/lib/utils";

type AudioPlayerProps = {
  recordingId: string;
  startSeconds?: number | null;
  endSeconds?: number | null;
  autoPlay?: boolean;
  compact?: boolean;
  onTimeUpdate?: (time: number) => void;
  label?: string;
};

export function AudioPlayer({
  recordingId,
  startSeconds = null,
  endSeconds = null,
  autoPlay = false,
  compact = false,
  onTimeUpdate,
  label = "Recording audio",
}: AudioPlayerProps) {
  const { getAudio } = useArchive();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(startSeconds ?? 0);
  const [duration, setDuration] = useState<number | null>(null);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setUrl(null);
    setPlaying(false);
    setCurrent(startSeconds ?? 0);

    getAudio(recordingId)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setError("No audio file is stored for this recording.");
          setLoading(false);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("The local audio file could not be read.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [getAudio, recordingId, startSeconds]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    audio.playbackRate = rate;

    const applyStart = () => {
      const target = Math.max(0, startSeconds ?? 0);
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      if (target > 0 && target < (audio.duration || Number.POSITIVE_INFINITY)) {
        audio.currentTime = target;
        setCurrent(target);
      }
      if (autoPlay) {
        void audio.play().catch(() => {
          // Browsers may block autoplay. The play button remains available.
        });
      }
    };

    if (audio.readyState >= 1) applyStart();
    else audio.addEventListener("loadedmetadata", applyStart, { once: true });
    return () => audio.removeEventListener("loadedmetadata", applyStart);
  }, [url, startSeconds, autoPlay]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = audio.currentTime;
    setCurrent(time);
    onTimeUpdate?.(time);
    if (endSeconds !== null && Number.isFinite(endSeconds) && time >= endSeconds) {
      audio.pause();
      audio.currentTime = endSeconds;
      setCurrent(endSeconds);
    }
  }, [endSeconds, onTimeUpdate]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (playing) {
      audio.pause();
      return;
    }
    if (endSeconds !== null && audio.currentTime >= endSeconds - 0.05) {
      audio.currentTime = Math.max(0, startSeconds ?? 0);
    }
    void audio.play().catch(() => setError("Playback was blocked by the browser. Press play again."));
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  };

  const cycleRate = () => {
    const next = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : 1;
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  if (loading) {
    return (
      <div className={cn("audio-player audio-player--loading", compact && "audio-player--compact")}>
        <LoaderCircle size={17} className="spin" aria-hidden="true" />
        <span>Loading local audio…</span>
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className={cn("audio-player audio-player--unavailable", compact && "audio-player--compact")}>
        <AudioLines size={17} aria-hidden="true" />
        <span>{error ?? "Audio is not available for this recording."}</span>
      </div>
    );
  }

  return (
    <div className={cn("audio-player", compact && "audio-player--compact")}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration);
        }}
      />
      <button
        type="button"
        className="audio-player__play"
        onClick={toggle}
        aria-label={playing ? "Pause audio" : "Play audio"}
      >
        {playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
      </button>
      <div className="audio-player__body">
        {!compact ? (
          <div className="audio-player__meta">
            <span>
              <AudioLines size={14} aria-hidden="true" /> {label}
            </span>
            <span>{formatDuration(duration)}</span>
          </div>
        ) : null}
        <input
          type="range"
          min={0}
          max={duration && Number.isFinite(duration) ? duration : 0}
          step={0.05}
          value={Math.min(current, duration ?? current)}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Seek audio"
          className="audio-player__range"
        />
        <div className="audio-player__times">
          <span>{formatSeconds(current)}</span>
          <span>{duration ? formatDuration(duration) : "—"}</span>
        </div>
      </div>
      <button
        type="button"
        className="audio-player__rate"
        onClick={cycleRate}
        aria-label={`Playback speed ${rate}x. Click to change.`}
      >
        {rate === 1 ? <RotateCcw size={12} aria-hidden="true" /> : null}
        {rate}×
      </button>
    </div>
  );
}
