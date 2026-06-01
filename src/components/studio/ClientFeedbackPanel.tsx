import { useMemo, useState } from "react";
import { X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientReview, type ClientCommentRecord } from "@/lib/client-review-context";
import { useStudio } from "@/lib/studio-context";
import { cn } from "@/lib/utils";

const GOLD = "#e8c547";
const BORDER = "#2a2a2a";
const MUTED = "#888888";

function badgeFor(status: string) {
  switch (status) {
    case "approved":
      return { label: "Approved", color: "#4caf50", bg: "rgba(76,175,80,0.12)", dot: "#4caf50" };
    case "changes_requested":
      return { label: "Changes Requested", color: GOLD, bg: "rgba(232,197,71,0.12)", dot: GOLD };
    case "viewed":
      return { label: "Viewed", color: "#5aa6ff", bg: "rgba(90,166,255,0.12)", dot: "#5aa6ff" };
    default:
      return { label: "Pending", color: MUTED, bg: "rgba(255,255,255,0.05)", dot: MUTED };
  }
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function ClientFeedbackSection({ onOpen }: { onOpen: () => void }) {
  const { review, comments } = useClientReview();
  if (!review) return null;
  const badge = badgeFor(review.status);

  return (
    <div className="mt-3 space-y-2">
      <div
        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold"
        style={{ color: badge.color, backgroundColor: badge.bg }}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: badge.dot }}
        />
        {badge.label}
      </div>
      {comments.length > 0 && (
        <div className="text-xs" style={{ color: MUTED }}>
          {comments.length} comment{comments.length === 1 ? "" : "s"}
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={onOpen}
        className="w-full justify-start border-border bg-transparent text-xs"
      >
        <MessageSquare className="mr-2 h-3.5 w-3.5" />
        View All Comments
      </Button>
    </div>
  );
}

export function ClientFeedbackStatusDot() {
  const { review } = useClientReview();
  if (!review) return null;
  const b = badgeFor(review.status);
  return (
    <span
      className="ml-1.5 inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: b.dot }}
      title={b.label}
    />
  );
}

export function CommentsPanel({ onClose }: { onClose: () => void }) {
  const { review, comments, resolveComment, unresolveComment } = useClientReview();
  const { scenes } = useStudio();
  const [tab, setTab] = useState<"all" | "scene" | "unresolved">("all");

  const sceneIndexById = useMemo(() => {
    const m = new Map<string, number>();
    scenes.forEach((s) => m.set(s.id, s.scene_index));
    return m;
  }, [scenes]);

  const filtered = useMemo<ClientCommentRecord[]>(() => {
    if (tab === "scene") return comments.filter((c) => c.scene_id);
    if (tab === "unresolved") return comments.filter((c) => c.status !== "resolved");
    return comments;
  }, [comments, tab]);

  if (!review) return null;
  const badge = badgeFor(review.status);

  const scrollToScene = (sceneId: string) => {
    const el = document.querySelector(`[data-scene-id="${sceneId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.45)" }} />
      <aside
        className="absolute right-0 top-0 flex h-full w-[360px] flex-col border-l"
        style={{ backgroundColor: "#141414", borderColor: BORDER }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: BORDER }}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold">Client Feedback</h3>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ color: badge.color, backgroundColor: badge.bg }}
            >
              {badge.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b px-4 py-2" style={{ borderColor: BORDER }}>
          {(["all", "scene", "unresolved"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              style={{
                backgroundColor: tab === t ? "rgba(232,197,71,0.12)" : "transparent",
                color: tab === t ? GOLD : undefined,
              }}
            >
              {t === "all" ? "All" : t === "scene" ? "By Scene" : "Unresolved"}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {review.overall_comment && (
            <div
              className="rounded-md border p-3 text-xs"
              style={{ borderColor: BORDER, backgroundColor: "#0f0f0f" }}
            >
              <div
                className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: GOLD }}
              >
                Overall Feedback
              </div>
              <div className="leading-relaxed">{review.overall_comment}</div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-xs" style={{ color: MUTED }}>
              No comments yet.
            </div>
          )}

          {filtered.map((c) => {
            const resolved = c.status === "resolved";
            const sceneIdx = c.scene_id ? sceneIndexById.get(c.scene_id) : undefined;
            return (
              <div
                key={c.id}
                className={cn("rounded-md p-3 text-xs", resolved && "opacity-50")}
                style={{ backgroundColor: "#1a1a1a" }}
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  {c.scene_id && sceneIdx != null && (
                    <button
                      onClick={() => scrollToScene(c.scene_id!)}
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: `${GOLD}22`, color: GOLD }}
                    >
                      Scene {sceneIdx + 1}
                    </button>
                  )}
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", color: MUTED }}
                  >
                    {c.comment_type}
                  </span>
                  <span className="ml-auto text-[10px]" style={{ color: MUTED }}>
                    {relativeTime(c.created_at)}
                  </span>
                </div>
                <div className={cn("leading-relaxed", resolved && "line-through")}>
                  {c.comment_text}
                </div>
                <button
                  onClick={() => (resolved ? unresolveComment(c.id) : resolveComment(c.id))}
                  className="mt-2 text-[10px] hover:underline"
                  style={{ color: MUTED }}
                >
                  {resolved ? "Reopen" : "Resolve"}
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
