import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  Download,
  RefreshCw,
  FileJson,
  FileText,
  History,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  type ManifestData,
  type ManifestRow,
  type ManifestScene,
  manifestToMarkdown,
  downloadBlob,
} from "@/lib/manifest";
import { TEMPERATURE_COLORS } from "@/lib/studio-context";
import { cn } from "@/lib/utils";

type Props = {
  current: ManifestRow;
  versions: ManifestRow[];
  onClose: () => void;
  onRegenerate: () => Promise<void> | void;
  onRestoreVersion: (row: ManifestRow) => Promise<void> | void;
  regenerating?: boolean;
};

export function ManifestViewer({
  current,
  versions,
  onClose,
  onRegenerate,
  onRestoreVersion,
  regenerating,
}: Props) {
  const [activeId, setActiveId] = useState(current.id);
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const active = useMemo(
    () => versions.find((v) => v.id === activeId) ?? current,
    [versions, activeId, current],
  );
  const manifest = active.manifest_data as ManifestData;

  const exportJson = () => {
    const safe = manifest.project.title.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
    downloadBlob(
      `${safe}_manifest_v${active.version}.json`,
      JSON.stringify(manifest, null, 2),
      "application/json",
    );
    setExportOpen(false);
  };
  const exportMd = () => {
    const safe = manifest.project.title.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
    downloadBlob(
      `${safe}_manifest_v${active.version}.md`,
      manifestToMarkdown(manifest),
      "text/markdown",
    );
    setExportOpen(false);
  };
  const exportPdf = () => {
    // Print-to-PDF fallback via window.print of a hidden HTML view
    const safe = manifest.project.title.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
    const html = `<!doctype html><html><head><title>${safe}_manifest_v${active.version}</title>
<style>body{font-family:ui-sans-serif,system-ui;padding:24px;color:#111}h1,h2,h3{margin-top:1.2em}pre{background:#f4f4f5;padding:12px;border-radius:6px;white-space:pre-wrap}</style>
</head><body><pre>${manifestToMarkdown(manifest).replace(/</g, "&lt;")}</pre>
<script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
    setExportOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a] text-foreground">
      {/* Top bar */}
      <div
        className="flex items-center gap-3 border-b px-5 py-3"
        style={{ borderColor: "#2a2a2a", backgroundColor: "#0d0d0d" }}
      >
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-semibold">Assembly Manifest</h1>
          <Badge variant="secondary" className="bg-[#e8c547]/15 text-[#e8c547]">
            v{active.version}
            {active.is_current && activeId === current.id ? " · current" : ""}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(active.created_at).toLocaleString()}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen((v) => !v)}
              className="gap-1.5"
            >
              <History className="h-4 w-4" />
              Version History
            </Button>
            {historyOpen && (
              <div
                className="absolute right-0 top-9 z-10 w-72 rounded-md border p-1 shadow-lg"
                style={{ borderColor: "#2a2a2a", backgroundColor: "#141414" }}
              >
                {versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setActiveId(v.id);
                      setHistoryOpen(false);
                    }}
                    className={cn(
                      "flex w-full flex-col items-start rounded px-2 py-1.5 text-left text-xs hover:bg-white/5",
                      v.id === activeId && "bg-white/5",
                    )}
                  >
                    <span className="font-medium">
                      v{v.version}
                      {v.is_current ? " — Current" : ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()} · {v.total_scenes ?? 0} scenes
                    </span>
                  </button>
                ))}
                {activeId !== current.id && (
                  <div className="mt-1 border-t pt-1" style={{ borderColor: "#2a2a2a" }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full justify-start text-xs"
                      onClick={() => {
                        onRestoreVersion(active);
                        setHistoryOpen(false);
                      }}
                    >
                      Restore this version
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onRegenerate()}
            disabled={regenerating}
            className="gap-1.5"
          >
            {regenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Regenerate
          </Button>

          <div className="relative">
            <Button
              size="sm"
              onClick={() => setExportOpen((v) => !v)}
              className="gap-1.5 bg-[#e8c547] text-black hover:bg-[#e8c547]/90"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            {exportOpen && (
              <div
                className="absolute right-0 top-9 z-10 w-44 rounded-md border p-1 shadow-lg"
                style={{ borderColor: "#2a2a2a", backgroundColor: "#141414" }}
              >
                <ExportItem icon={FileJson} label="Export as JSON" onClick={exportJson} />
                <ExportItem icon={FileText} label="Export as Markdown" onClick={exportMd} />
                <ExportItem icon={FileText} label="Export as PDF" onClick={exportPdf} />
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside
          className="w-[220px] shrink-0 overflow-y-auto border-r p-3"
          style={{ borderColor: "#2a2a2a", backgroundColor: "#0d0d0d" }}
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Scenes
          </div>
          <div className="space-y-1">
            {manifest.scenes.map((s) => (
              <a
                key={s.scene_id}
                href={`#scene-${s.scene_id}`}
                className="block rounded border px-2 py-1.5 text-xs hover:bg-white/5"
                style={{
                  borderColor: "#1f1f1f",
                  borderLeftColor:
                    TEMPERATURE_COLORS[
                      s.emotional_temperature as keyof typeof TEMPERATURE_COLORS
                    ] ?? "#444",
                  borderLeftWidth: 3,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">#{s.scene_number}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {s.timeline_start_formatted}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {s.visual.asset_type.replace(/_/g, " ")}
                </div>
              </a>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-5xl space-y-4 p-6">
            <ProjectHeaderCard manifest={manifest} />
            <EditorBriefCard manifest={manifest} />
            {manifest.scenes.map((s) => (
              <SceneCard
                key={s.scene_id}
                scene={s}
                totalDuration={manifest.project.total_duration_seconds}
              />
            ))}
            {manifest.assembly_summary.warnings.length > 0 && (
              <WarningsCard warnings={manifest.assembly_summary.warnings} />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ExportItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-white/5"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ProjectHeaderCard({ manifest }: { manifest: ManifestData }) {
  const b = manifest.assembly_summary.asset_breakdown;
  const pills: { label: string; n: number; color: string }[] = [
    { label: "Motion Graphics", n: b.motion_graphic_scenes, color: "#ab47bc" },
    { label: "AI Images", n: b.ai_image_scenes, color: "#4fc3f7" },
    { label: "Stock Images", n: b.stock_image_scenes, color: "#66bb6a" },
    { label: "Stock Video", n: b.stock_video_scenes, color: "#26a69a" },
    { label: "YouTube", n: b.youtube_scenes, color: "#ef5350" },
    { label: "Hera Standalone", n: b.hera_standalone_scenes, color: "#e8c547" },
    { label: "Hera Overlay", n: b.hera_overlay_scenes, color: "#ff7043" },
  ].filter((p) => p.n > 0);
  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "#2a2a2a", backgroundColor: "#141414" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{manifest.project.title}</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            {manifest.project.platform_targets.join(", ") || "—"} · target{" "}
            {manifest.project.target_duration ?? "—"}
          </div>
        </div>
        <Badge className="bg-[#e8c547] text-black">
          {manifest.project.total_duration_formatted}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {pills.map((p) => (
          <span
            key={p.label}
            className="rounded-full border px-2 py-0.5 text-[11px]"
            style={{ borderColor: p.color, color: p.color }}
          >
            {p.n} {p.label}
          </span>
        ))}
        <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
          Real footage {manifest.assembly_summary.real_footage_percentage}%
        </span>
      </div>
    </div>
  );
}

function EditorBriefCard({ manifest }: { manifest: ManifestData }) {
  const brief = manifest.editor_brief;
  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "#2a2a2a", backgroundColor: "#141414" }}
    >
      <h3 className="mb-2 text-sm font-semibold">Editor Brief</h3>
      <p className="text-xs text-foreground/85">{brief.overview}</p>
      <dl className="mt-3 space-y-1.5 text-xs">
        <BriefRow label="Color grade" value={brief.color_grade} />
        <BriefRow label="Pacing" value={brief.pacing_notes} />
        <BriefRow label="Music" value={brief.music_notes} />
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {Object.entries(brief.export_specs).map(([k, spec]) => (
          <div
            key={k}
            className="rounded border p-2 text-[11px]"
            style={{ borderColor: "#2a2a2a", backgroundColor: "#0d0d0d" }}
          >
            <div className="font-semibold capitalize">{k.replace(/_/g, " ")}</div>
            {Object.entries(spec).map(([k2, v]) => (
              <div key={k2} className="flex justify-between text-muted-foreground">
                <span>{k2}</span>
                <span>{String(v)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex-1">{value}</dd>
    </div>
  );
}

function SceneCard({ scene, totalDuration }: { scene: ManifestScene; totalDuration: number }) {
  const tempColor =
    TEMPERATURE_COLORS[scene.emotional_temperature as keyof typeof TEMPERATURE_COLORS] ?? "#444";
  return (
    <div
      id={`scene-${scene.scene_id}`}
      className="rounded-lg border p-5"
      style={{
        borderColor: "#2a2a2a",
        borderLeftColor: tempColor,
        borderLeftWidth: 4,
        backgroundColor: "#141414",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-[#e8c547] text-black">#{scene.scene_number}</Badge>
        <span className="text-xs text-muted-foreground">
          {scene.timeline_start_formatted} — {scene.timeline_end_formatted}
        </span>
        <Badge variant="outline">{scene.duration_seconds}s</Badge>
        {scene.emotional_temperature && (
          <Badge variant="outline" style={{ borderColor: tempColor, color: tempColor }}>
            {scene.emotional_temperature}
          </Badge>
        )}
        {scene.visual_job && <Badge variant="outline">{scene.visual_job}</Badge>}
        <Badge variant="secondary">{scene.visual.asset_type.replace(/_/g, " ")}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-12 gap-4">
        {/* Left: script & VO */}
        <div className="col-span-12 lg:col-span-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Script
          </div>
          <p className="mt-1 text-xs leading-relaxed text-foreground/85">{scene.script.text}</p>
          <div
            className="mt-3 rounded border p-2 text-[11px]"
            style={{ borderColor: "#2a2a2a", backgroundColor: "#0d0d0d" }}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">Voiceover</span>
              <span className="text-muted-foreground">
                {scene.voiceover.duration_seconds ?? 0}s · {scene.voiceover.wpm ?? "?"} WPM
              </span>
            </div>
            {scene.voiceover.audio_url ? (
              <audio src={scene.voiceover.audio_url} controls className="mt-1 w-full" />
            ) : (
              <div className="mt-1 text-[10px] text-[#ef5350]">[MISSING]</div>
            )}
          </div>
        </div>

        {/* Center: visual & graphics */}
        <div className="col-span-12 lg:col-span-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Visual
          </div>
          {scene.visual.image_url && (
            <img
              src={scene.visual.image_url}
              alt=""
              className="mt-1 h-32 w-full rounded object-cover"
            />
          )}
          <pre
            className="mt-2 whitespace-pre-wrap rounded border p-2 text-[10px] leading-snug text-foreground/85"
            style={{ borderColor: "#2a2a2a", backgroundColor: "#0d0d0d" }}
          >
            {scene.visual.editor_instruction}
          </pre>

          {scene.graphics.has_text_overlay && scene.graphics.text_overlay && (
            <div className="mt-2">
              <span className="inline-block rounded-full bg-[#e8c547]/15 px-2 py-0.5 text-[10px] font-medium text-[#e8c547]">
                Text Overlay
              </span>
              <p className="mt-1 text-[11px] text-foreground/85">
                {scene.graphics.text_overlay.editor_instruction}
              </p>
            </div>
          )}
          {scene.graphics.has_data_graphic && scene.graphics.data_graphic && (
            <div className="mt-2">
              <span className="inline-block rounded-full bg-[#ab47bc]/15 px-2 py-0.5 text-[10px] font-medium text-[#ab47bc]">
                Data Graphic
              </span>
              <p className="mt-1 text-[11px] text-foreground/85">
                {scene.graphics.data_graphic.editor_instruction}
              </p>
            </div>
          )}
        </div>

        {/* Right: technical */}
        <div className="col-span-12 lg:col-span-3 space-y-2 text-[11px]">
          <Tech label="Cut in" value={scene.cut_instructions.cut_in.replace(/_/g, " ")} />
          <Tech label="Cut out" value={scene.cut_instructions.cut_out.replace(/_/g, " ")} />
          <Tech label="Music" value={scene.music_instruction.action} />
          <Tech label="Captions" value={`${scene.captions.line_count} lines`} />
          {scene.voiceover.status !== "complete" && scene.voiceover.status !== "ready" && (
            <div className="rounded border border-[#e8c547]/40 bg-[#e8c547]/10 p-2 text-[10px] text-[#e8c547]">
              Voiceover {scene.voiceover.status}
            </div>
          )}
        </div>
      </div>

      {/* Timeline bar */}
      <div className="mt-4">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#1f1f1f]">
          <div
            className="absolute h-full rounded-full bg-[#e8c547]"
            style={{
              left: `${totalDuration > 0 ? (scene.timeline_start / totalDuration) * 100 : 0}%`,
              width: `${totalDuration > 0 ? (scene.duration_seconds / totalDuration) * 100 : 0}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Tech({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function WarningsCard({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-lg border border-[#ef5350]/40 bg-[#ef5350]/10 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#ef5350]">
        <AlertTriangle className="h-4 w-4" />
        {warnings.length} warning{warnings.length === 1 ? "" : "s"} found
      </div>
      <ul className="space-y-1 text-xs text-foreground/85">
        {warnings.map((w, i) => (
          <li key={i}>• {w}</li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Loading overlay                                                           */
/* -------------------------------------------------------------------------- */

export function ManifestBuildingOverlay({ step }: { step: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80">
      <Loader2 className="h-8 w-8 animate-spin text-[#e8c547]" />
      <div className="mt-4 text-sm font-medium">Building manifest…</div>
      <div className="mt-1 text-xs text-muted-foreground">{step}</div>
    </div>
  );
}
