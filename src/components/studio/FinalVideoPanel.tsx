import { CheckCircle2, Download, Loader2, XCircle, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useFinalVideoRender } from "@/hooks/use-final-video-render";

const GOLD = "var(--accent-gold)";
const SURFACE = "#141414";
const BORDER = "#2a2a2a";

export function FinalVideoPanel({ projectId }: { projectId: string }) {
  const { renderJob, isTriggering, triggerRender } = useFinalVideoRender({ projectId });

  const status = renderJob?.status ?? "idle";

  // ── IDLE ────────────────────────────────────────────────────────────────────
  if (status === "idle") {
    return (
      <div
        className="rounded-lg border p-4"
        style={{ backgroundColor: SURFACE, borderColor: BORDER }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Film className="h-4 w-4" style={{ color: GOLD }} />
          <span className="text-sm font-semibold text-foreground">Export Final Video</span>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Render all scenes into a single MP4 ready for download.
        </p>
        <ul className="mb-4 space-y-1">
          {[
            "All scenes with motion graphics and visuals",
            "Voiceover audio per scene",
            "Background music",
            "Captions",
          ].map((item) => (
            <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <span style={{ color: GOLD, flexShrink: 0 }}>✓</span>
              {item}
            </li>
          ))}
        </ul>
        <Button
          className="w-full text-xs font-semibold"
          style={{ backgroundColor: GOLD, color: "#000" }}
          disabled={isTriggering}
          onClick={triggerRender}
        >
          {isTriggering ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Preparing render...
            </>
          ) : (
            "Render Final Video"
          )}
        </Button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Rendering typically takes 2–5 minutes
        </p>
      </div>
    );
  }

  // ── QUEUED / RENDERING ───────────────────────────────────────────────────────
  if (status === "queued" || status === "rendering") {
    const pct = renderJob?.progress_percent ?? 0;
    return (
      <div
        className="rounded-lg border p-4"
        style={{ backgroundColor: SURFACE, borderColor: BORDER }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} />
          <span className="text-sm font-semibold text-foreground">Rendering your video...</span>
        </div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{pct}% complete</span>
          <Badge
            variant="outline"
            className="text-[10px]"
            style={{ borderColor: GOLD, color: GOLD }}
          >
            {status}
          </Badge>
        </div>
        <Progress value={pct} className="h-2" />
        <p className="mt-3 text-[10px] text-muted-foreground">
          This usually takes 2–5 minutes. You can safely leave this page and come back.
        </p>
      </div>
    );
  }

  // ── COMPLETE ─────────────────────────────────────────────────────────────────
  if (status === "complete" && renderJob?.output_url) {
    return (
      <div
        className="rounded-lg border p-4"
        style={{ backgroundColor: SURFACE, borderColor: "#2a5c2a" }}
      >
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" style={{ color: "#4caf50" }} />
          <span className="text-sm font-semibold text-foreground">Your video is ready!</span>
        </div>
        <a href={renderJob.output_url} download target="_blank" rel="noreferrer" className="block w-full">
          <Button
            className="w-full text-xs font-semibold"
            style={{ backgroundColor: GOLD, color: "#000" }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download MP4
          </Button>
        </a>
        <Button
          variant="outline"
          className="mt-2 w-full text-xs"
          style={{ borderColor: BORDER, color: "var(--muted-foreground)" }}
          onClick={triggerRender}
          disabled={isTriggering}
        >
          {isTriggering ? "Preparing..." : "Render Again"}
        </Button>
        <p className="mt-2 truncate text-[10px] text-muted-foreground" title={renderJob.output_url}>
          {renderJob.output_url}
        </p>
      </div>
    );
  }

  // ── FAILED ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-lg border p-4"
      style={{ backgroundColor: SURFACE, borderColor: "#5c2a2a" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <XCircle className="h-4 w-4" style={{ color: "#f44336" }} />
        <span className="text-sm font-semibold text-foreground">Render failed</span>
      </div>
      {renderJob?.error_message && (
        <div
          className="mb-3 rounded p-2 text-xs"
          style={{ backgroundColor: "rgba(244,67,54,0.1)", color: "#ef9a9a" }}
        >
          {renderJob.error_message}
        </div>
      )}
      <Button
        className="w-full text-xs font-semibold"
        style={{ backgroundColor: GOLD, color: "#000" }}
        onClick={triggerRender}
        disabled={isTriggering}
      >
        {isTriggering ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Preparing render...
          </>
        ) : (
          "Try Again"
        )}
      </Button>
    </div>
  );
}
