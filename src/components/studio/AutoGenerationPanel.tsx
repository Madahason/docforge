import { useEffect, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  Circle,
  Minus,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { AutoGenerationState, AutoStatus } from "@/hooks/use-auto-generation";

function StatusIcon({ status }: { status: AutoStatus }) {
  if (status === "waiting")
    return <Circle className="h-3.5 w-3.5 text-muted-foreground" fill="currentColor" />;
  if (status === "generating")
    return <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--accent-gold)" }} />;
  if (status === "complete")
    return <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--success)" }} />;
  if (status === "needs_manual")
    return (
      <Circle className="h-3.5 w-3.5" style={{ color: "var(--accent-gold)" }} fill="currentColor" />
    );
  if (status === "skipped") return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  if (status === "failed") return <X className="h-3.5 w-3.5" style={{ color: "var(--error)" }} />;
  return null;
}

export function AutoGenerationPanel({
  state,
  onSkipAll,
  onRetryFailed,
}: {
  state: AutoGenerationState;
  onSkipAll: () => void;
  onRetryFailed: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [autoCollapsed, setAutoCollapsed] = useState(false);

  // Auto-collapse 3s after finishing successfully (no failures)
  useEffect(() => {
    if (!state.finished) return;
    if (state.summary && state.summary.failed > 0) return;
    const t = setTimeout(() => setAutoCollapsed(true), 3000);
    return () => clearTimeout(t);
  }, [state.finished, state.summary]);

  const isCollapsed = collapsed || autoCollapsed;
  const completedCount = state.items.filter(
    (i) =>
      i.status === "complete" ||
      i.status === "skipped" ||
      i.status === "needs_manual" ||
      i.status === "failed",
  ).length;
  const total = state.items.length;
  const progress = total === 0 ? 0 : (completedCount / total) * 100;
  const allDone = state.finished;
  const hasFailed = (state.summary?.failed ?? 0) > 0;

  if (isCollapsed) {
    return (
      <button
        onClick={() => {
          setCollapsed(false);
          setAutoCollapsed(false);
        }}
        className="mb-6 flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left text-xs transition-colors hover:bg-[#1a1a1a]"
        style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
      >
        <span className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" style={{ color: "var(--success)" }} />
          <span className="font-semibold">Show Generation Summary</span>
          {state.summary && (
            <span className="text-muted-foreground">
              {state.summary.complete} complete • {state.summary.skipped} skipped
              {state.summary.failed > 0 ? ` • ${state.summary.failed} failed` : ""}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  const successState = allDone && !hasFailed;
  const borderColor = successState ? "var(--success)" : "var(--accent-gold)";

  return (
    <div
      className="mb-6 rounded-lg border"
      style={{ backgroundColor: "#141414", borderColor, padding: 20 }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {successState ? (
            <CheckCircle2 className="h-5 w-5" style={{ color: "var(--success)" }} />
          ) : (
            <Sparkles className="h-5 w-5" style={{ color: "var(--accent-gold)" }} />
          )}
          <h3 className="text-sm font-bold">
            {successState ? "All visuals generated" : "Auto-Generating Visuals"}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {state.isRunning && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={onSkipAll}
            >
              Skip All
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={() => setCollapsed(true)}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!successState && (
        <div className="mt-4">
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "#2a2a2a" }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                backgroundColor: "var(--accent-gold)",
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {state.isRunning
                ? `Generating scene ${Math.min(state.currentIndex + 1, total)} of ${total}...`
                : `Paused at ${completedCount} of ${total}`}
            </span>
          </div>
        </div>
      )}

      <div
        className="mt-4 max-h-[280px] overflow-y-auto rounded-md border"
        style={{ borderColor: "#222" }}
      >
        {state.items.map((item) => (
          <div
            key={item.sceneId}
            className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
            style={{ borderColor: "#1c1c1c" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-6 shrink-0 text-[10px] font-semibold text-muted-foreground">
                {item.sceneIndex}
              </span>
              <span className="truncate text-[12px]">{item.preview}…</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "text-[11px]",
                  item.status === "failed" && "text-[color:var(--error)] cursor-pointer underline",
                )}
                style={{
                  color:
                    item.status === "complete"
                      ? "var(--success)"
                      : item.status === "needs_manual"
                        ? "var(--accent-gold)"
                        : item.status === "failed"
                          ? "var(--error)"
                          : undefined,
                }}
              >
                {item.label}
              </span>
              <StatusIcon status={item.status} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">
          {completedCount} of {total} complete
        </div>
        {allDone && state.summary && (
          <div className="text-[11px] text-muted-foreground">
            {state.summary.complete} complete • {state.summary.skipped} skipped
            {state.summary.needsManual > 0 ? ` • ${state.summary.needsManual} needs manual` : ""}
            {state.summary.failed > 0 ? ` • ${state.summary.failed} failed` : ""}
          </div>
        )}
      </div>

      {allDone && hasFailed && (
        <div className="mt-3">
          <Button
            size="sm"
            onClick={onRetryFailed}
            className="bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold-hover)]"
          >
            Retry Failed Scenes
          </Button>
        </div>
      )}
    </div>
  );
}
