import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
};

export function EmptyState({ icon, title, description, actions, className, compact = false }: EmptyStateProps) {
  return (
    <div className={cn("empty-state", compact && "empty-state--compact", className)}>
      <div className="empty-state__icon" aria-hidden="true">
        {icon}
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {actions ? <div className="empty-state__actions">{actions}</div> : null}
    </div>
  );
}
