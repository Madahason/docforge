import { formatDistanceToNow } from "date-fns";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";

export interface ProjectRow {
  id: string;
  title: string;
  status: string | null;
  content_type: string | null;
  completion_percent: number | null;
  thumbnail_url: string | null;
  updated_at: string;
  style_profile?: { editing_style: string | null } | null;
}

const statusVariants: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "var(--text-muted)" },
  in_production: { label: "In Production", color: "var(--warning)" },
  complete: { label: "Complete", color: "var(--success)" },
};

export function ProjectCard({ project }: { project: ProjectRow }) {
  const status = statusVariants[project.status ?? "draft"] ?? statusVariants.draft;
  const pct = Math.max(0, Math.min(100, project.completion_percent ?? 0));

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-md border border-border bg-[var(--surface)] transition hover:border-[var(--accent-gold)]/60"
    >
      <div className="relative aspect-video bg-[var(--surface-elevated)]">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt={project.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No thumbnail
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="font-semibold text-foreground line-clamp-1">{project.title}</h3>
        <div className="flex flex-wrap gap-1.5">
          {project.content_type && (
            <Badge variant="outline" className="border-border text-muted-foreground">
              {project.content_type}
            </Badge>
          )}
          {project.style_profile?.editing_style && (
            <Badge variant="outline" className="border-border text-muted-foreground">
              {project.style_profile.editing_style}
            </Badge>
          )}
          <Badge variant="outline" className="border-border" style={{ color: status.color }}>
            {status.label}
          </Badge>
        </div>

        <div className="mt-auto space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{pct}% complete</span>
            <span>{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-elevated)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: "var(--accent-gold)" }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
