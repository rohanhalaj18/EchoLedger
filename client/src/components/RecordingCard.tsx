import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  AudioLines,
  CalendarDays,
  FileText,
  Languages,
  MapPin,
  MessageSquareQuote,
  UserRound,
} from "lucide-react";
import { DemoBadge } from "@/components/Badges";
import { formatDate, formatDuration, getInitials, truncate } from "@/lib/utils";
import type { Recording } from "@/types";

export function RecordingCard({ recording, claimCount }: { recording: Recording; claimCount: number }) {
  return (
    <Link to={`/recordings/${recording.id}`} className="recording-card">
      <div className="recording-card__top">
        <div className="recording-card__source-icon" aria-hidden="true">
          {recording.source === "audio" ? <AudioLines size={18} /> : <FileText size={18} />}
        </div>
        <div className="recording-card__badges">
          {recording.isDemo ? <DemoBadge compact /> : null}
          <span className="badge badge--neutral">
            {recording.source === "audio" ? (recording.audio ? "Audio" : "Audio metadata") : "Transcript only"}
          </span>
        </div>
      </div>

      <div className="recording-card__title-row">
        <h2>{recording.title}</h2>
        <ArrowUpRight size={17} className="recording-card__arrow" aria-hidden="true" />
      </div>

      <p className="recording-card__speaker">
        <span className="avatar avatar--tiny" aria-hidden="true">
          {getInitials(recording.speaker) || <UserRound size={12} />}
        </span>
        {recording.speaker}
      </p>

      <div className="recording-card__meta">
        <span>
          <Languages size={13} aria-hidden="true" /> {recording.language}
        </span>
        {recording.place ? (
          <span>
            <MapPin size={13} aria-hidden="true" /> {truncate(recording.place, 34)}
          </span>
        ) : null}
        {recording.period ? (
          <span>
            <CalendarDays size={13} aria-hidden="true" /> {truncate(recording.period, 34)}
          </span>
        ) : null}
      </div>

      {recording.topics.length > 0 ? (
        <div className="tag-row">
          {recording.topics.slice(0, 4).map((topic) => (
            <span key={topic} className="tag">
              {topic}
            </span>
          ))}
        </div>
      ) : null}

      <div className="recording-card__footer">
        <span className="recording-card__stat">
          <MessageSquareQuote size={14} aria-hidden="true" />
          {claimCount} {claimCount === 1 ? "claim" : "claims"}
        </span>
        <span className="recording-card__stat">
          {recording.audio ? formatDuration(recording.audio.durationSeconds) : "No audio"}
        </span>
        <span className="recording-card__date">{formatDate(recording.createdAt)}</span>
      </div>
    </Link>
  );
}
