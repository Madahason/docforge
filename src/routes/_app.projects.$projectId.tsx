import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Sparkles,
  FileText,
  Download,
  Mic,
  Image as ImageIcon,
  Tag,
  Film,
  Wand2,
  Loader2,
  ChevronDown,
  RefreshCw,
  Play,
  Pause,
  ArrowRight,
  Search,
  ExternalLink,
  Check,
  Copy,
  Youtube,
  Camera,
  ImagePlus,
  Layers,
  PlayCircle,
  BarChart3,
  Star,
  Video,
} from "lucide-react";
import { ScenePreviewModal } from "@/components/preview/ScenePreviewModal";
import { FullVideoPreview } from "@/components/preview/FullVideoPreview";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { showError, showWarning, showSuccess } from "@/lib/notifications";
import { debugError } from "@/utils/debug";
import { MobileNotice } from "@/components/MobileNotice";
import { ErrorCard } from "@/components/ui/error-card";
import {
  StudioProvider,
  useStudio,
  TEMPERATURE_COLORS,
  VISUAL_JOB_COLORS,
  type Scene,
  type Voiceover,
  type Clip,
  type KenBurnsConfig,
  type RecommendedAssetType,
} from "@/lib/studio-context";
import { useWalkthroughGate } from "@/lib/walkthrough-context";

import { CONTENT_TYPES, EDITING_STYLES } from "@/lib/project-options";
import { analyzeScript, retryScriptAnalysisPart } from "@/lib/script-analysis.functions";
import { WORDS_PER_CHUNK, countScriptWords, splitScriptIntoChunks } from "@/lib/script-chunking";
import { listVoices, generateVoiceover, saveProjectVoice } from "@/lib/voiceover.functions";
import {
  searchYouTube,
  searchPexelsVideos,
  searchPexelsPhotos,
  checkClipIndex,
  confirmClip,
  generateImagePrompt,
  CHANNEL_OPTIONS,
  type YouTubeCandidate,
  type PexelsVideoCandidate,
  type PexelsPhotoCandidate,
} from "@/lib/clip-sourcing.functions";
import {
  generateImagesReplicate,
  loadImageAssetCache,
  animateImageReplicate,
} from "@/lib/replicate.functions";
import { generateSoundStyleProfile } from "@/lib/sound.functions";
import { generateSoundNarrative } from "@/lib/sound-narrative.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MotionGraphicTab } from "@/components/studio/MotionGraphicTab";
import { GraphicsTab, computeGraphicsStats } from "@/components/studio/GraphicsTab";
import {
  CaptionsTab,
  buildCombinedSrt,
  generateCaptionsForScene,
  downloadCombinedSrt,
} from "@/components/studio/CaptionsTab";
import { SoundTab } from "@/components/studio/SoundTab";
import { HeraFlow, HeraBudgetPanel } from "@/components/studio/HeraFlow";
import { ClientReviewProvider, useClientReview } from "@/lib/client-review-context";
import { ShareModal } from "@/components/studio/ShareModal";
import {
  ClientFeedbackSection,
  ClientFeedbackStatusDot,
  CommentsPanel,
} from "@/components/studio/ClientFeedbackPanel";
import { AutoGenerationPanel } from "@/components/studio/AutoGenerationPanel";
import { DiagnosticsPanel } from "@/components/studio/DiagnosticsPanel";
import { ManifestViewer, ManifestBuildingOverlay } from "@/components/studio/ManifestViewer";
import { ExportPackageModal } from "@/components/studio/ExportPackageModal";
import { FinalVideoPanel } from "@/components/studio/FinalVideoPanel";
import {
  fetchManifests,
  restoreManifestVersion,
  saveManifest,
  type ManifestData,
  type ManifestRow,
} from "@/lib/manifest";

import { useAutoGeneration, type AutoGenerationState } from "@/hooks/use-auto-generation";
import { Switch } from "@/components/ui/switch";
import {
  previewAutoGeneration,
  setAutoGenerateVisuals,
  finalizeAutoGeneration,
} from "@/lib/auto-generate.functions";
import { CLIP_SERVICE_URL, RENDERER_URL } from "@/lib/services";

export const Route = createFileRoute("/_app/projects/$projectId")({
  component: ProjectStudioRoute,
});

function ProjectStudioRoute() {
  const { projectId } = Route.useParams();
  return (
    <>
      <MobileNotice />
      <StudioProvider projectId={projectId} fallback={<StudioSkeleton />}>
        <ClientReviewProvider projectId={projectId}>
          <ProductionStudio />
        </ClientReviewProvider>
      </StudioProvider>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Top-level layout                                                          */
/* -------------------------------------------------------------------------- */

function ProductionStudio() {
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [previewSceneId, setPreviewSceneId] = useState<string | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const sceneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { scenes, voiceovers, clips, project, motionGraphics, sceneSounds } = useStudio();
  const autoGen = useAutoGeneration();

  // Auto-select first scene
  useEffect(() => {
    if (!selectedSceneId && scenes.length > 0) {
      setSelectedSceneId(scenes[0].id);
    }
  }, [scenes, selectedSceneId]);

  // Keep-alive ping for clip service
  useEffect(() => {
    if (!CLIP_SERVICE_URL) return;
    const ping = () => { fetch(`${CLIP_SERVICE_URL}/health`).catch(() => {}); };
    ping();
    const interval = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Keep-alive ping for renderer service
  useEffect(() => {
    if (!RENDERER_URL) return;
    const ping = () => { fetch(`${RENDERER_URL}/health`).catch(() => {}); };
    ping();
    const interval = setInterval(ping, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectScene = (id: string) => {
    setSelectedSceneId(id);
    const el = sceneRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const voiceoverReadyCount = voiceovers.filter(
    (v) => !!v.audio_url && (v.status === "ready" || v.status === "complete"),
  ).length;
  const fullPreviewEnabled = voiceoverReadyCount >= 3;

  return (
    <AutoGenCtx.Provider value={autoGen}>
      <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
        <StudioTopBar
          onPreviewVideo={() => setShowFullPreview(true)}
          previewEnabled={fullPreviewEnabled}
        />
        <div className="flex flex-1 overflow-hidden">
          <ScenesSidebar selectedSceneId={selectedSceneId} onSelect={handleSelectScene} />
          <ScenesCenter
            selectedSceneId={selectedSceneId}
            sceneRefs={sceneRefs}
            onPreviewScene={setPreviewSceneId}
          />
          <RightSidebar />
        </div>
        {previewSceneId && (
          <ScenePreviewModal
            scenes={scenes}
            voiceovers={voiceovers}
            clips={clips}
            motionGraphics={motionGraphics}
            initialSceneId={previewSceneId}
            onClose={() => setPreviewSceneId(null)}
          />
        )}
        {showFullPreview && (
          <FullVideoPreview
            projectTitle={project.title}
            scenes={scenes}
            voiceovers={voiceovers}
            clips={clips}
            motionGraphics={motionGraphics}
            sceneSounds={sceneSounds}
            onClose={() => setShowFullPreview(false)}
          />
        )}
      </div>
    </AutoGenCtx.Provider>
  );
}

type AutoGenCtxValue = ReturnType<typeof useAutoGeneration>;
const AutoGenCtx = createContext<AutoGenCtxValue | null>(null);
function useAutoGen() {
  const v = useContext(AutoGenCtx);
  if (!v) throw new Error("AutoGenCtx missing");
  return v;
}

/* -------------------------------------------------------------------------- */
/*  Top bar                                                                   */
/* -------------------------------------------------------------------------- */

function StudioTopBar({
  onPreviewVideo,
  previewEnabled,
}: {
  onPreviewVideo: () => void;
  previewEnabled: boolean;
}) {
  const navigate = useNavigate();
  const { project, styleProfile, manifestReady, setProject } = useStudio();
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    setTitle(project.title);
  }, [project.title]);

  const saveTitle = async () => {
    setEditingTitle(false);
    const trimmed = title.trim();
    if (!trimmed || trimmed === project.title) {
      setTitle(project.title);
      return;
    }
    setProject({ title: trimmed }); // optimistic
    const { error } = await supabase
      .from("projects")
      .update({ title: trimmed })
      .eq("id", project.id);
    if (error) {
      toast.error(error.message);
      setProject({ title: project.title });
      setTitle(project.title);
    }
  };

  const editingStyleLabel =
    EDITING_STYLES.find((s) => s.id === (styleProfile?.editing_style ?? ""))?.label ??
    styleProfile?.editing_style ??
    "No style";
  const contentTypeLabel =
    CONTENT_TYPES.find((c) => c.id === (project.content_type ?? ""))?.title ??
    project.content_type ??
    "General";

  return (
    <div
      className="flex items-center gap-4 border-b px-4"
      style={{
        height: 52,
        borderColor: "#2a2a2a",
        backgroundColor: "#0d0d0d",
      }}
    >
      <button
        onClick={() => navigate({ to: "/projects" })}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground"
        aria-label="Back to projects"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        {editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setTitle(project.title);
                setEditingTitle(false);
              }
            }}
            className="w-full max-w-[400px] rounded-md border border-[var(--accent-gold)] bg-[var(--surface)] px-2 py-1 text-sm font-semibold outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="max-w-[400px] truncate rounded-md px-2 py-1 text-sm font-semibold hover:bg-[var(--surface-elevated)]"
            title="Click to rename"
          >
            {project.title}
          </button>
        )}
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <Badge>{editingStyleLabel}</Badge>
        <Badge>{contentTypeLabel}</Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShareOpen(true)}
          className="border-border bg-transparent"
        >
          Share
          <ClientFeedbackStatusDot />
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!previewEnabled}
                  onClick={onPreviewVideo}
                  className="border-border bg-transparent"
                >
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  Preview Video
                </Button>
              </span>
            </TooltipTrigger>
            {!previewEnabled && (
              <TooltipContent>Generate voiceovers for at least 3 scenes to preview</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <Button
          variant="outline"
          size="sm"
          disabled={!manifestReady}
          onClick={() => setExportOpen(true)}
          data-walkthrough="export-package"
          className="border-border bg-transparent"
        >
          Export Package
        </Button>

        <Button
          size="sm"
          disabled={!manifestReady}
          className="bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
        >
          Render Draft
        </Button>
      </div>
      {exportOpen && <ExportPackageModal onClose={() => setExportOpen(false)} />}
      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
      {commentsOpen && <CommentsPanel onClose={() => setCommentsOpen(false)} />}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function AssetTypeIndicator({ type }: { type: RecommendedAssetType }) {
  const meta = ASSET_TYPE_META[type];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="flex h-5 w-5 cursor-help items-center justify-center rounded-full"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              border: `1px solid ${meta.color}55`,
            }}
            aria-label={`Recommended: ${meta.label}`}
          >
            <Icon className="h-3 w-3" style={{ color: meta.color }} />
          </span>
        </TooltipTrigger>
        <TooltipContent>Recommended: {meta.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function VideoBudgetPanel() {
  const { scenes, clips } = useStudio();
  const realScenes = scenes.filter((s) => s.is_real_footage_scene);
  const realSeconds = realScenes.reduce((sum, s) => sum + (s.estimated_seconds ?? 0), 0);
  const totalSeconds = scenes.reduce((sum, s) => sum + (s.estimated_seconds ?? 0), 0);
  const pct = totalSeconds > 0 ? (realSeconds / totalSeconds) * 100 : 0;
  const pctLabel = pct.toFixed(1);

  const fillColor = pct < 20 ? "#4caf50" : pct <= 25 ? "#e8c547" : "#f44336";
  const statusMsg =
    pct < 10
      ? {
          text: "Consider adding authority clips for credibility",
          color: "var(--muted-foreground)",
        }
      : pct <= 25
        ? { text: "On target", color: "#4caf50" }
        : { text: "Too much real footage — consider replacing some clips", color: "#f44336" };

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted-foreground">Target: 10–25% real footage</p>
      <div className="flex items-end justify-between text-xs">
        <span className="text-foreground/85">{Math.round(realSeconds)}s real footage</span>
        <span className="text-muted-foreground">{Math.round(totalSeconds)}s total</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "#1f1f1f" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: fillColor }}
        />
      </div>
      <div className="text-right text-[11px] font-semibold" style={{ color: fillColor }}>
        {pctLabel}% real footage
      </div>
      <p className="text-[11px]" style={{ color: statusMsg.color }}>
        {statusMsg.text}
      </p>

      <div className="mt-3">
        <p className="text-[12px] text-muted-foreground">Real footage scenes:</p>
        {realScenes.length === 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">No real footage assigned yet</p>
        ) : (
          <ul className="mt-1 space-y-1 text-[11px]">
            {realScenes.map((s) => {
              const clip = clips.find((c) => c.scene_id === s.id);
              const title = clip?.source_title ?? "Not sourced yet";
              const isYoutube = clip?.asset_type === "youtube";
              const isStock = clip?.asset_type === "stock_footage";
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-1.5 text-foreground/80">
                  <span>
                    • Scene {s.scene_index} — {title} ({Math.round(s.estimated_seconds ?? 0)}s)
                  </span>
                  {isYoutube && (
                    <span
                      className="rounded-sm px-1 py-0.5 text-[9px] font-semibold"
                      style={{ backgroundColor: "rgba(239,83,80,0.15)", color: "#ef5350" }}
                    >
                      YOUTUBE
                    </span>
                  )}
                  {isStock && (
                    <span
                      className="rounded-sm px-1 py-0.5 text-[9px] font-semibold"
                      style={{ backgroundColor: "rgba(76,175,80,0.15)", color: "#4caf50" }}
                    >
                      STOCK
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Left sidebar — scenes                                                     */
/* -------------------------------------------------------------------------- */

function ScenesSidebar({
  selectedSceneId,
  onSelect,
}: {
  selectedSceneId: string | null;
  onSelect: (id: string) => void;
}) {
  const { scenes, analyzing, project, setProject } = useStudio();
  const runAnalyze = useAnalyzeScript();
  const previewFn = useServerFn(previewAutoGeneration);
  const setToggleFn = useServerFn(setAutoGenerateVisuals);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCounts, setConfirmCounts] = useState<{ sourced: number; pending: number } | null>(
    null,
  );
  const totalSeconds = scenes.reduce((sum, s) => sum + (s.estimated_seconds ?? 0), 0);
  const minutes = Math.round(totalSeconds / 60);
  const hasScenes = scenes.length > 0;
  const autoEnabled = project.auto_generate_visuals !== false;

  const handleClick = async () => {
    if (!hasScenes) {
      runAnalyze();
      return;
    }
    try {
      const counts = await previewFn({ data: { projectId: project.id } });
      setConfirmCounts({ sourced: counts.sourced, pending: counts.pending });
    } catch {
      setConfirmCounts({ sourced: 0, pending: scenes.length });
    }
    setConfirmOpen(true);
  };

  const toggleAuto = async (enabled: boolean) => {
    setProject({ auto_generate_visuals: enabled });
    try {
      await setToggleFn({ data: { projectId: project.id, enabled } });
    } catch {
      setProject({ auto_generate_visuals: !enabled });
      toast.error("Could not update setting");
    }
  };

  return (
    <aside
      data-walkthrough="scene-list"
      className="flex w-[220px] shrink-0 flex-col overflow-hidden border-r"
      style={{ backgroundColor: "#0d0d0d", borderColor: "#2a2a2a" }}
    >
      <div className="border-b px-4 py-3" style={{ borderColor: "#2a2a2a" }}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Scenes
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {scenes.length} {scenes.length === 1 ? "scene" : "scenes"}
          {minutes > 0 ? ` • ${minutes} min` : ""}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {scenes.map((scene) => (
          <SceneListItem
            key={scene.id}
            scene={scene}
            selected={scene.id === selectedSceneId}
            onSelect={() => onSelect(scene.id)}
          />
        ))}
      </div>

      <div className="border-t p-3 space-y-3" style={{ borderColor: "#2a2a2a" }}>
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="auto-gen-toggle"
            className="text-[11px] text-muted-foreground cursor-pointer"
          >
            Auto-generate visuals
          </label>
          <Switch id="auto-gen-toggle" checked={autoEnabled} onCheckedChange={toggleAuto} />
        </div>
        <Button
          onClick={handleClick}
          disabled={analyzing}
          variant="outline"
          data-walkthrough="analyze-script"
          className="w-full border-[var(--accent-gold)] bg-transparent text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/10 hover:text-[var(--accent-gold)]"
          size="sm"
        >
          {hasScenes ? (
            <RefreshCw className={cn("mr-2 h-4 w-4", analyzing && "animate-spin")} />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {analyzing ? "Analyzing…" : hasScenes ? "Re-analyze Script" : "Analyze Script"}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-analyze script?</AlertDialogTitle>
            <AlertDialogDescription>
              Re-analyzing will regenerate visuals for scenes that haven't been confirmed.{" "}
              {confirmCounts
                ? `${confirmCounts.sourced} confirmed ${confirmCounts.sourced === 1 ? "scene" : "scenes"} will be skipped.`
                : ""}{" "}
              Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                runAnalyze();
              }}
            >
              Yes, re-analyze
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function SceneListItem({
  scene,
  selected,
  onSelect,
}: {
  scene: Scene;
  selected: boolean;
  onSelect: () => void;
}) {
  const { voiceovers, clips } = useStudio();
  const vo = voiceovers.find((v) => v.scene_id === scene.id);
  const clip = clips.find((c) => c.scene_id === scene.id);

  const tempColor = scene.emotional_temperature
    ? TEMPERATURE_COLORS[scene.emotional_temperature]
    : "transparent";

  const preview = scene.script_text.split(/\s+/).slice(0, 10).join(" ");

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-2 border-b px-3 py-2.5 text-left transition-colors",
        selected ? "bg-[#1a1a1a]" : "hover:bg-[#141414]",
      )}
      style={{
        borderColor: "#1c1c1c",
        borderLeft: `2px solid ${selected ? "var(--accent-gold)" : tempColor}`,
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-muted-foreground">{scene.scene_index}</span>
          <StatusDots
            voStatus={vo?.status ?? "pending"}
            clipStatus={clip?.status ?? "pending"}
            captionsStatus={scene.captions_status}
          />
        </div>
        <div className="mt-1 line-clamp-2 text-[12px] leading-snug text-foreground/90">
          {preview}
          {scene.script_text.split(/\s+/).length > 10 ? "…" : ""}
        </div>
      </div>
    </button>
  );
}

function StatusDots({
  voStatus,
  clipStatus,
  captionsStatus,
}: {
  voStatus: string;
  clipStatus: string;
  captionsStatus: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Dot status={voStatus} title="Voiceover" />
      <Dot status={clipStatus} title="Clip" />
      <Dot status={captionsStatus} title="Captions" />
    </div>
  );
}

function Dot({ status, title }: { status: string; title: string }) {
  const color =
    status === "complete" || status === "ready"
      ? "#4caf50"
      : status === "sourced" || status === "in_progress"
        ? "var(--accent-gold)"
        : "#3a3a3a";
  return (
    <span
      title={`${title}: ${status}`}
      className="block h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Center column — scene cards                                               */
/* -------------------------------------------------------------------------- */

function ScenesCenter({
  selectedSceneId,
  sceneRefs,
  onPreviewScene,
}: {
  selectedSceneId: string | null;
  sceneRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  onPreviewScene: (id: string) => void;
}) {
  const { scenes, analyzing } = useStudio();

  if (analyzing && scenes.length === 0) {
    return (
      <div
        className="flex flex-1 items-center justify-center overflow-y-auto p-6"
        style={{ backgroundColor: "#0f0f0f" }}
      >
        <AnalyzingState />
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div
        className="flex flex-1 items-center justify-center overflow-y-auto p-6"
        style={{ backgroundColor: "#0f0f0f" }}
      >
        <CenterEmptyState />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "#0f0f0f" }}>
      <AnalysisProgressMount />
      <AutoGenerationMount />
      {scenes.map((scene, idx) => {
        const prevEnd = scenes
          .slice(0, idx)
          .reduce((sum, s) => sum + (s.estimated_seconds ?? 0), 0);
        return (
          <div
            key={scene.id}
            ref={(el) => {
              sceneRefs.current[scene.id] = el;
            }}
          >
            <SceneCard
              scene={scene}
              startSec={prevEnd}
              highlighted={scene.id === selectedSceneId}
              onPreview={onPreviewScene}
            />
          </div>
        );
      })}
    </div>
  );
}

function AnalysisProgressMount() {
  const { analyzing, analysisProgress } = useStudio();
  if (analyzing)
    return (
      <div className="mb-4">
        <AnalyzingState />
      </div>
    );
  if (analysisProgress?.failedParts.length) return <AnalysisWarning />;
  return null;
}

function AnalysisWarning() {
  const { project, setScenes, analysisProgress, setAnalysisProgress } = useStudio();
  const retryFn = useServerFn(retryScriptAnalysisPart);
  const [retrying, setRetrying] = useState(false);
  const part = analysisProgress?.failedParts[0];
  if (!part || !analysisProgress) return null;

  const retry = async () => {
    setRetrying(true);
    try {
      await retryFn({ data: { projectId: project.id, partNumber: part } });
      const { data, error } = await supabase
        .from("scenes")
        .select("*")
        .eq("project_id", project.id)
        .order("scene_index", { ascending: true });
      if (error) throw new Error(error.message);
      setScenes((data ?? []) as unknown as Scene[]);
      const failedParts = analysisProgress.failedParts.filter((p) => p !== part);
      setAnalysisProgress({ ...analysisProgress, failedParts });
      showSuccess({ title: `Part ${part} analyzed` });
    } catch (e) {
      showError({
        title: "Retry failed",
        description: (e as Error).message || "Couldn't re-analyze that part. Please try again.",
        retryable: true,
        retryFn: () => void retry(),
      });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <ErrorCard
      tone="warning"
      className="mb-4"
      title={`Analysis incomplete — part ${part} of ${analysisProgress.totalParts} failed`}
      description="Scenes from that section are missing. You can retry just that part without re-running the whole script."
      actions={[
        {
          label: retrying ? "Retrying…" : "Retry Failed Part",
          onClick: () => void retry(),
        },
      ]}
    />
  );
}

function AutoGenerationMount() {
  const { state, skipAll, retryFailed } = useAutoGen();
  if (state.items.length === 0) return null;
  return <AutoGenerationPanel state={state} onSkipAll={skipAll} onRetryFailed={retryFailed} />;
}

function AnalyzingState() {
  const { analysisProgress } = useStudio();
  const current = analysisProgress?.currentPart ?? 1;
  const total = analysisProgress?.totalParts ?? 1;
  const completed = Math.max(0, Math.min(total, current - 1));
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(0, total - completed) * 8;

  return (
    <div
      className="w-full max-w-md rounded-lg border p-5"
      style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
    >
      <div className="flex items-center gap-2 text-base font-semibold">
        <Sparkles className="h-4 w-4" style={{ color: "var(--accent-gold)" }} />
        Analyzing Script
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "#242424" }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: "var(--accent-gold)" }}
        />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span>
          Analyzing part {current} of {total}...
        </span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>Processing ~{WORDS_PER_CHUNK} words per part</span>
        <span>~{remaining} seconds remaining</span>
      </div>
    </div>
  );
}

function CenterEmptyState() {
  const { project, setProject, analyzing } = useStudio();
  const runAnalyze = useAnalyzeScript();
  const [draft, setDraft] = useState(project.script_raw ?? "");
  const [saving, setSaving] = useState(false);

  const hasScript = !!project.script_raw && project.script_raw.trim().length > 0;
  const words = countScriptWords(draft);
  const chunkEstimate = Math.ceil(words / WORDS_PER_CHUNK);

  const saveScript = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error("Paste a script to continue");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({ script_raw: trimmed })
      .eq("id", project.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save script");
      return;
    }
    setProject({ script_raw: trimmed });
    toast.success("Script saved");
  };

  if (hasScript) {
    return (
      <div className="flex max-w-md flex-col items-center text-center">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--surface-elevated)" }}
        >
          <FileText className="h-6 w-6" style={{ color: "var(--accent-gold)" }} />
        </div>
        <h3 className="text-base font-semibold">Script ready for analysis</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Click Analyze Script to break your script into scenes
        </p>
        <Button
          onClick={runAnalyze}
          disabled={analyzing}
          className="mt-6 bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
        >
          <Wand2 className="mr-2 h-4 w-4" />
          {analyzing ? "Analyzing…" : "Analyze Script"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-2xl flex-col">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-5 w-5" style={{ color: "var(--accent-gold)" }} />
        <h3 className="text-base font-semibold">Paste your script</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Paste your documentary script below. We'll break it into scenes once you analyze it.
      </p>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={"Paste your documentary script here..."}
        className="min-h-[320px] resize-y bg-[var(--surface)] font-mono text-sm"
        style={{ lineHeight: 1.7 }}
      />
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{words} words</span>
      </div>
      {words > WORDS_PER_CHUNK && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          Long script — will be analyzed in ~{chunkEstimate} parts
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          onClick={saveScript}
          disabled={saving || !draft.trim()}
          className="bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
        >
          {saving ? "Saving…" : "Save Script"}
        </Button>
      </div>
    </div>
  );
}

function useAnalyzeScript() {
  const { project, setScenes, setProject, setAnalyzing, analyzing, setAnalysisProgress } =
    useStudio();
  const analyzeFn = useServerFn(analyzeScript);
  const finalizeFn = useServerFn(finalizeAutoGeneration);
  const autoGen = useAutoGen();

  return async function runAnalysis() {
    if (analyzing) return;
    if (!project.script_raw || !project.script_raw.trim()) {
      showError({
        title: "No script to analyze",
        description: "Paste your script into the editor before running analysis.",
      });
      return;
    }
    setAnalyzing(true);
    const totalParts = splitScriptIntoChunks(project.script_raw).length || 1;
    setAnalysisProgress({ currentPart: 1, totalParts, failedParts: [] });
    let poll: ReturnType<typeof setInterval> | null = null;
    try {
      await supabase.from("scenes").delete().eq("project_id", project.id);
      await supabase.from("clips").delete().eq("project_id", project.id);
      setScenes([]);

      // Reset auto-generation flag so it can run for this fresh analysis
      try {
        await finalizeFn({ data: { projectId: project.id, complete: false } });
      } catch {
        /* non-fatal */
      }

      poll = setInterval(async () => {
        const { data } = await supabase
          .from("scenes")
          .select("*")
          .eq("project_id", project.id)
          .order("scene_index", { ascending: true });
        const progressiveScenes = (data ?? []) as unknown as Scene[];
        if (progressiveScenes.length > 0) {
          setScenes(progressiveScenes);
          const maxIndex = Math.max(...progressiveScenes.map((s) => s.scene_index));
          const completedParts = Math.min(totalParts, Math.ceil(maxIndex / 100));
          setAnalysisProgress({
            currentPart: Math.min(totalParts, completedParts + 1),
            totalParts,
            failedParts: [],
          });
        }
      }, 2500);

      const result = await analyzeFn({ data: { projectId: project.id } });
      if (poll) clearInterval(poll);
      poll = null;

      const { data, error } = await supabase
        .from("scenes")
        .select("*")
        .eq("project_id", project.id)
        .order("scene_index", { ascending: true });
      if (error) throw new Error(error.message);
      const newScenes = (data ?? []) as unknown as Scene[];
      setScenes(newScenes);
      setProject({ script_parsed: true, completion_percent: 10, auto_generation_complete: false });
      const failedParts = result.failedParts ?? [];
      setAnalysisProgress({ currentPart: totalParts, totalParts, failedParts });
      showSuccess({ title: `${newScenes.length} scenes ready` });
      if (failedParts.length > 0) {
        showWarning({
          title: "Analysis incomplete",
          description: `Part ${failedParts[0]} of ${totalParts} failed. Retry it from the scene list.`,
        });
      }

      // Trigger auto-generation if enabled (default true)
      if (project.auto_generate_visuals !== false) {
        // Defer one tick so scenes propagate into context before queue is built
        setTimeout(() => {
          autoGen.start();
        }, 50);
      }
    } catch (e) {
      const err = e as Error & { status?: number };
      const msg = err.message ?? "";
      const lower = msg.toLowerCase();
      debugError("[analyzeScript] failed:", e);
      const retry = () => void runAnalysis();

      if (
        lower.includes("truncated") ||
        lower.includes("too long") ||
        lower.includes("output limit")
      ) {
        showError({
          title: "Script too long for one pass",
          description:
            "The AI response was truncated. Try shortening your script or splitting it into shorter sections, then re-run analysis.",
        });
      } else if (lower.includes("json") || lower.includes("schema") || lower.includes("empty")) {
        showError({
          title: "AI returned an invalid response",
          description:
            "The model returned malformed output. This is usually transient — retrying often works. If it keeps failing, simplify unusual formatting in your script.",
          retryable: true,
          retryFn: retry,
        });
      } else if (err.status === 401 || lower.includes("unauthorized")) {
        showError({
          title: "Session expired",
          description: "Please sign in again to continue.",
          action: {
            label: "Sign in",
            fn: () => {
              if (typeof window !== "undefined") window.location.href = "/login";
            },
          },
        });
      } else if (err.status === 429 || lower.includes("rate limit")) {
        showError({
          title: "Too many requests",
          description: "You've hit the API limit. Wait 60 seconds and try again.",
          retryable: true,
          retryFn: retry,
        });
      } else if (lower.includes("timeout")) {
        showError({
          title: "Analysis timed out",
          description:
            "This is taking longer than expected. Try again, or split a very long script into shorter parts.",
          retryable: true,
          retryFn: retry,
        });
      } else if (msg === "Failed to fetch" || lower.includes("network")) {
        showError({
          title: "Connection lost",
          description: "Check your internet connection and try again.",
          retryable: true,
          retryFn: retry,
        });
      } else {
        showError({
          title: "Analysis failed",
          description: msg || "Something went wrong. Please try again.",
          retryable: true,
          retryFn: retry,
        });
      }
    } finally {
      if (poll) clearInterval(poll);
      setAnalyzing(false);
    }
  };
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SceneCard({
  scene,
  startSec,
  highlighted,
  onPreview,
}: {
  scene: Scene;
  startSec: number;
  highlighted: boolean;
  onPreview: (id: string) => void;
}) {
  const { voiceovers, clips } = useStudio();
  const vo = voiceovers.find((v) => v.scene_id === scene.id);
  const clip = clips.find((c) => c.scene_id === scene.id);
  const endSec = startSec + (scene.estimated_seconds ?? 0);
  const [tab, setTab] = useState<"voiceover" | "clips" | "graphics" | "captions" | "sound">(
    "voiceover",
  );

  const hasVoiceover = !!vo?.audio_url;
  const hasClip = !!clip;
  const previewDisabled = !hasVoiceover && !hasClip;
  const audioOnly = hasVoiceover && !hasClip;

  return (
    <div
      className="mb-4 rounded-lg border p-5 transition-colors"
      style={{
        backgroundColor: "#141414",
        borderColor: highlighted ? "var(--accent-gold)" : "#2a2a2a",
      }}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-sm font-bold">Scene {scene.scene_index}</span>
        <span className="text-xs text-muted-foreground">
          ≈ {formatTime(startSec)} — {formatTime(endSec)}
        </span>
        {scene.emotional_temperature && (
          <ColoredBadge color={TEMPERATURE_COLORS[scene.emotional_temperature]}>
            {scene.emotional_temperature}
          </ColoredBadge>
        )}
        {scene.visual_job && (
          <ColoredBadge color={VISUAL_JOB_COLORS[scene.visual_job]}>
            {scene.visual_job}
          </ColoredBadge>
        )}
        <AssetTypeIndicator type={scene.recommended_asset_type ?? "ai_image_ken_burns"} />
        {scene.pacing_instruction && (
          <span className="rounded-full bg-[#1a1a1a] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {scene.pacing_instruction.replace("_", " ")}
          </span>
        )}
        <SceneRetryButton sceneId={scene.id} clipStatus={scene.clip_status ?? "pending"} />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-auto">
                <button
                  type="button"
                  disabled={previewDisabled}
                  onClick={() => onPreview(scene.id)}
                  className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: "var(--accent-gold)",
                    color: "var(--accent-gold)",
                    backgroundColor: "transparent",
                  }}
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  Preview Scene
                </button>
              </span>
            </TooltipTrigger>
            {audioOnly && (
              <TooltipContent>No clip sourced yet — previewing audio only</TooltipContent>
            )}
            {previewDisabled && (
              <TooltipContent>Generate a voiceover or source a clip to preview</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      <div
        className="mt-4 pb-4 text-[14px]"
        style={{ color: "#cccccc", lineHeight: 1.8, borderBottom: "1px solid #222" }}
      >
        {scene.script_text}
      </div>

      {(scene.text_overlay_flag || scene.data_graphic_flag) && (
        <TooltipProvider>
          <div className="mt-3 flex flex-wrap gap-2">
            {scene.text_overlay_flag && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="cursor-help rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: "rgba(232,197,71,0.15)",
                      color: "var(--accent-gold)",
                      border: "1px solid rgba(232,197,71,0.4)",
                    }}
                  >
                    Text Overlay
                  </span>
                </TooltipTrigger>
                {scene.text_overlay_suggestion && (
                  <TooltipContent>{scene.text_overlay_suggestion}</TooltipContent>
                )}
              </Tooltip>
            )}
            {scene.data_graphic_flag && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="cursor-help rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: "rgba(171,71,188,0.15)",
                      color: "#ab47bc",
                      border: "1px solid rgba(171,71,188,0.4)",
                    }}
                  >
                    Data Graphic
                  </span>
                </TooltipTrigger>
                {scene.data_graphic_detail && (
                  <TooltipContent>{scene.data_graphic_detail}</TooltipContent>
                )}
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      )}

      {scene.clip_brief && (
        <ClipBriefPanel brief={scene.clip_brief} channels={scene.youtube_source_priority} />
      )}

      <div className="mt-4 flex gap-4 border-b" style={{ borderColor: "#222" }}>
        {(["voiceover", "clips", "graphics", "captions", "sound"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-1 pb-2 text-xs font-medium capitalize transition-colors",
              tab === t
                ? "border-[var(--accent-gold)] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="py-4">
        {tab === "voiceover" ? (
          <VoiceoverPanel scene={scene} />
        ) : tab === "clips" ? (
          <ClipsPanel scene={scene} />
        ) : tab === "graphics" ? (
          <GraphicsTab scene={scene} />
        ) : tab === "captions" ? (
          <CaptionsTab scene={scene} />
        ) : (
          <SoundTab scene={scene} />
        )}
      </div>

      <div
        className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-xs"
        style={{ borderColor: "#222" }}
      >
        <FooterStatus
          status={vo?.status ?? "pending"}
          label="Voiceover"
          pendingText="Not generated"
        />
        <FooterStatus status={clip?.status ?? "pending"} label="Clip" pendingText="Not sourced" />
        <FooterStatus status={scene.captions_status} label="Captions" pendingText="Not generated" />
      </div>
    </div>
  );
}

function ColoredBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
      style={{
        backgroundColor: `${color}22`,
        color,
        border: `1px solid ${color}55`,
      }}
    >
      {children}
    </span>
  );
}

function ClipBriefPanel({
  brief,
  channels,
}: {
  brief: NonNullable<Scene["clip_brief"]>;
  channels: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-md border" style={{ borderColor: "#222" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-foreground/85 hover:bg-[#181818]"
      >
        <span>Clip Brief</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3 pt-1 text-xs text-foreground/85">
          <BriefRow label="Subject" value={brief.subject} />
          <BriefTags label="Mood" items={brief.mood} />
          <BriefTags label="Avoid" items={brief.avoid} />
          {brief.preferred_era && <BriefRow label="Preferred Era" value={brief.preferred_era} />}
          <BriefRow label="Color Temperature" value={brief.color_temperature} />
          <div>
            <div className="mb-1 text-muted-foreground">Search Terms</div>
            <ol className="space-y-0.5 pl-4 text-foreground/90" style={{ listStyle: "decimal" }}>
              {brief.suggested_search_terms.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          </div>
          {channels.length > 0 && (
            <BriefTags
              label="Priority Channels"
              items={channels.map((c) => c.replace(/_/g, " "))}
            />
          )}
        </div>
      )}
    </div>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right capitalize">{value}</span>
    </div>
  );
}

function BriefTags({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((tag) => (
          <span
            key={tag}
            className="rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[10px] capitalize text-foreground/90"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function FooterStatus({
  status,
  label,
  pendingText,
}: {
  status: string;
  label: string;
  pendingText: string;
}) {
  const isReady = status === "complete" || status === "ready";
  const isSourced = status === "sourced";
  const color = isReady
    ? "#4caf50"
    : isSourced || status === "in_progress"
      ? "var(--accent-gold)"
      : "#3a3a3a";
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-foreground/80">{label}:</span>
      {isReady ? "Ready" : isSourced ? "Sourced" : pendingText}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Right sidebar — status + actions + info                                   */
/* -------------------------------------------------------------------------- */

function RightSidebar() {
  const {
    project,
    styleProfile,
    scenes,
    voiceovers,
    clips,
    sceneGraphics,
    captions,
    upsertCaption,
    manifestReady,
    thumbnailReady,
    metadataReady,
  } = useStudio();

  const total = scenes.length;
  const voReady = voiceovers.filter((v) => v.status === "complete" || v.status === "ready").length;
  const voFailed = voiceovers.filter((v) => v.status === "failed").length;
  const clipReady = clips.filter(
    (c) => c.status === "sourced" || c.status === "complete" || c.status === "ready",
  ).length;
  const captionsReady = scenes.filter(
    (s) => s.captions_status === "complete" || s.captions_status === "ready",
  ).length;
  const graphicsStats = computeGraphicsStats(scenes, sceneGraphics);

  const [sidebarTab, setSidebarTab] = useState<"overview" | "export">("overview");
  const { generateAll, generating, progress, confirmDialog } = useGenerateAllVoiceovers();

  // Walkthrough gates for studio steps
  useWalkthroughGate("analyze-script", total > 0);
  useWalkthroughGate("generate-all-visuals", total > 0 && clipReady / total >= 0.5);

  const modules = [
    { label: "Script Analysis", state: total > 0 ? "complete" : "pending", detail: undefined },
    {
      label: "Voiceover",
      state: total > 0 && voReady === total ? "complete" : voReady > 0 ? "progress" : "pending",
      detail:
        total > 0 ? `${voReady}/${total}${voFailed > 0 ? ` (${voFailed} failed)` : ""}` : undefined,
    },
    {
      label: "Clips",
      state: total > 0 && clipReady === total ? "complete" : clipReady > 0 ? "progress" : "pending",
      detail: total > 0 ? `${clipReady}/${total}` : undefined,
    },
    {
      label: "Graphics",
      state:
        graphicsStats.flagged === 0
          ? "pending"
          : graphicsStats.complete === graphicsStats.flagged
            ? "complete"
            : graphicsStats.complete > 0
              ? "progress"
              : "pending",
      detail:
        graphicsStats.flagged > 0
          ? `${graphicsStats.complete}/${graphicsStats.flagged} flagged`
          : undefined,
    },
    {
      label: "Captions",
      state:
        total > 0 && captionsReady === total
          ? "complete"
          : captionsReady > 0
            ? "progress"
            : "pending",
      detail: total > 0 ? `${captionsReady}/${total}` : undefined,
    },
    {
      label: "Manifest",
      state: manifestReady ? "complete" : "pending",
      detail: manifestReady ? "Ready" : "Not Ready",
    },
    { label: "Thumbnail", state: thumbnailReady ? "complete" : "pending", detail: undefined },
    { label: "Metadata", state: metadataReady ? "complete" : "pending", detail: undefined },
  ];

  // Weighted completion: analysis 10%, voiceover 25%, clips 25%, captions 15%, manifest 5%, thumbnail 10%, metadata 10%
  const completePct = useMemo(() => {
    if (total === 0) return 0;
    let pct = 10; // analysis already done if total > 0
    pct += Math.round((voReady / total) * 25);
    pct += Math.round((clipReady / total) * 25);
    pct += Math.round((captionsReady / total) * 15);
    if (manifestReady) pct += 5;
    if (thumbnailReady) pct += 10;
    if (metadataReady) pct += 10;
    return Math.min(100, pct);
  }, [total, voReady, clipReady, captionsReady, manifestReady, thumbnailReady, metadataReady]);

  const [genCaptionsBusy, setGenCaptionsBusy] = useState(false);
  const [genCaptionsProgress, setGenCaptionsProgress] = useState({ done: 0, total: 0 });
  const allCaptionsComplete = total > 0 && captionsReady === total;
  const canGenerateAllCaptions = scenes.some((s) => {
    const v = voiceovers.find((x) => x.scene_id === s.id);
    return (
      (v?.status === "complete" || v?.status === "ready") &&
      (v?.word_timestamps?.length ?? 0) > 0 &&
      s.captions_status !== "complete" &&
      s.captions_status !== "ready"
    );
  });

  const handleGenerateAllCaptions = async () => {
    const targets = scenes.filter((s) => {
      const v = voiceovers.find((x) => x.scene_id === s.id);
      return (
        (v?.status === "complete" || v?.status === "ready") &&
        (v?.word_timestamps?.length ?? 0) > 0 &&
        s.captions_status !== "complete" &&
        s.captions_status !== "ready"
      );
    });
    if (!targets.length) {
      toast.error("No scenes ready for caption generation");
      return;
    }
    setGenCaptionsBusy(true);
    setGenCaptionsProgress({ done: 0, total: targets.length });
    let done = 0;
    for (const scene of targets) {
      const v = voiceovers.find((x) => x.scene_id === scene.id);
      if (!v) continue;
      try {
        await generateCaptionsForScene({ scene, vo: v, preset: "documentary", upsertCaption });
      } catch (e) {
        debugError("Caption generation failed for scene", scene.scene_index, e);
      }
      done += 1;
      setGenCaptionsProgress({ done, total: targets.length });
    }
    setGenCaptionsBusy(false);
    toast.success(`Generated captions for ${done} scene${done === 1 ? "" : "s"}`);
  };

  const handleDownloadFullSrt = () => {
    const combined = buildCombinedSrt(scenes, captions, voiceovers);
    const safeTitle = (project.title || "project").replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
    downloadCombinedSrt(`docforge_${safeTitle}_captions.srt`, combined);
  };

  const editingStyleLabel =
    EDITING_STYLES.find((s) => s.id === (styleProfile?.editing_style ?? ""))?.label ?? "—";
  const contentTypeLabel =
    CONTENT_TYPES.find((c) => c.id === (project.content_type ?? ""))?.title ?? "—";
  const words = project.script_raw
    ? project.script_raw.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const estMin = Math.round(words / 150);
  const platforms = Array.isArray(project.platform_targets)
    ? project.platform_targets.join(", ")
    : "—";

  return (
    <aside
      className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l"
      style={{ backgroundColor: "#0d0d0d", borderColor: "#2a2a2a" }}
    >
      {/* Sidebar tab header */}
      <div className="flex gap-4 border-b px-4 pt-3" style={{ borderColor: "#2a2a2a" }}>
        {(["overview", "export"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSidebarTab(t)}
            className={cn(
              "-mb-px border-b-2 pb-2 text-xs font-medium capitalize transition-colors flex items-center gap-1",
              sidebarTab === t
                ? "border-[var(--accent-gold)] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "export" && <Download className="h-3 w-3" />}
            {t === "overview" ? "Overview" : "Export Video"}
          </button>
        ))}
      </div>

      {sidebarTab === "export" ? (
        <div className="p-4">
          <FinalVideoPanel projectId={project.id} />
        </div>
      ) : (
        <div className="flex flex-col p-4">
      <SectionLabel>Project Status</SectionLabel>
      <div className="mt-3 flex flex-col items-center">
        <CircularProgress value={completePct} />
        <div className="mt-1 text-[11px] text-muted-foreground">Complete</div>
      </div>

      <div className="mt-4 space-y-1.5">
        {modules.map((m) => (
          <div key={m.label} className="flex items-center justify-between text-xs">
            <span className="text-foreground/85">{m.label}</span>
            <ModuleBadge state={m.state} detail={m.detail} />
          </div>
        ))}
      </div>

      <SectionLabel className="mt-6">Voice Settings</SectionLabel>
      <div className="mt-3">
        <VoiceSelector />
      </div>

      <SectionLabel className="mt-6">Video Budget</SectionLabel>
      <div className="mt-3 space-y-3">
        <VideoBudgetPanel />
        <HeraBudgetPanel />
      </div>

      <SectionLabel className="mt-6">Actions</SectionLabel>
      <div className="mt-3 space-y-2">
        <div data-walkthrough="generate-all-visuals">
          <GenerateAllVisualsButton />
        </div>
        <DiagnosticsButtonWrapper />
        <div data-walkthrough="generate-all-voiceovers">
          <ActionButton
            icon={Mic}
            label={
              generating
                ? `Generating ${progress.done}/${progress.total}…`
                : "Generate All Voiceovers"
            }
            disabled={total === 0 || !project.elevenlabs_voice_id}
            loading={generating}
            onClick={generateAll}
          />
        </div>
        {generating && (
          <Progress
            value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
            className="h-1.5"
          />
        )}

        <ActionButton
          icon={FileText}
          label={
            genCaptionsBusy
              ? `Generating captions... ${genCaptionsProgress.done} of ${genCaptionsProgress.total}`
              : "Generate All Captions"
          }
          disabled={!canGenerateAllCaptions || genCaptionsBusy}
          loading={genCaptionsBusy}
          onClick={handleGenerateAllCaptions}
        />
        {genCaptionsBusy && (
          <Progress
            value={
              genCaptionsProgress.total > 0
                ? (genCaptionsProgress.done / genCaptionsProgress.total) * 100
                : 0
            }
            className="h-1.5"
          />
        )}
        <ActionButton
          icon={Download}
          label="Download Full Video SRT"
          disabled={!allCaptionsComplete}
          onClick={handleDownloadFullSrt}
        />
        <ManifestSection
          canGenerate={total > 0 && voReady === total && clipReady === total}
          totalScenes={total}
          voMissing={total - voReady}
          clipMissing={total - clipReady}
        />

        <RenderAllGraphicsButton />

        <SoundNarrativeSection
          canGenerate={total > 0 && scenes.every((s) => (s as any).sound_status !== "pending")}
        />

        <ClientFeedbackSectionWrapper />

        <ActionButton
          icon={ImageIcon}
          label="Generate Thumbnail Concepts"
          disabled={!manifestReady}
        />
        <ActionButton icon={Tag} label="Generate Metadata" disabled={!manifestReady} />
      </div>

      <SectionLabel className="mt-6">Project Info</SectionLabel>
      <dl className="mt-3 space-y-2 text-xs">
        <InfoRow label="Content Type" value={contentTypeLabel} />
        <InfoRow label="Editing Style" value={editingStyleLabel} />
        <InfoRow label="Target Duration" value={project.target_duration ?? "—"} />
        <InfoRow label="Platforms" value={platforms || "—"} />
        <InfoRow label="Word Count" value={`${words} words`} />
        <InfoRow label="Est. Duration" value={`${estMin} min at 150 WPM`} />
        <InfoRow label="Created" value={new Date(project.created_at).toLocaleDateString()} />
        <InfoRow label="Last Updated" value={new Date(project.updated_at).toLocaleDateString()} />
      </dl>
      {confirmDialog}
        </div>
      )}
    </aside>
  );
}

function DiagnosticsButtonWrapper() {
  const { project } = useStudio();
  const { reloadFromDb, start } = useAutoGen();
  return (
    <DiagnosticsPanel
      projectId={project.id}
      onAfterFix={async () => {
        await reloadFromDb();
        await start();
      }}
    />
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CircularProgress({ value }: { value: number }) {
  const size = 86;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#2a2a2a"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--accent-gold)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
        {value}%
      </div>
    </div>
  );
}

function ModuleBadge({
  state,
  detail,
}: {
  state: "complete" | "progress" | "pending" | string;
  detail?: string;
}) {
  const text =
    detail ??
    (state === "complete" ? "Complete" : state === "progress" ? "In Progress" : "Pending");
  const styles =
    state === "complete"
      ? { color: "#4caf50", backgroundColor: "rgba(76, 175, 80, 0.12)" }
      : state === "progress"
        ? { color: "var(--accent-gold)", backgroundColor: "rgba(232, 197, 71, 0.12)" }
        : { color: "var(--text-muted)", backgroundColor: "#1a1a1a" };

  return (
    <span className="rounded px-2 py-0.5 text-[10px] font-medium" style={styles}>
      {text}
    </span>
  );
}

function ManifestSection({
  canGenerate,
  totalScenes,
  voMissing,
  clipMissing,
}: {
  canGenerate: boolean;
  totalScenes: number;
  voMissing: number;
  clipMissing: number;
}) {
  const studio = useStudio();
  const [showViewer, setShowViewer] = useState(false);
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);

  const current = studio.manifests.find((m) => m.is_current) ?? studio.manifests[0] ?? null;
  const currentData = current?.manifest_data as ManifestData | undefined;
  const warnings = currentData?.assembly_summary?.warnings?.length ?? 0;

  const generate = async () => {
    const steps = [
      "Reading scene data...",
      "Compiling assets...",
      "Calculating timecodes...",
      "Saving manifest...",
    ];
    try {
      for (const s of steps.slice(0, 3)) {
        setBusyStep(s);
        await new Promise((r) => setTimeout(r, 500));
      }
      setBusyStep(steps[3]);
      const saved = await saveManifest({
        project: studio.project,
        styleProfile: studio.styleProfile,
        scenes: studio.scenes,
        voiceovers: studio.voiceovers,
        clips: studio.clips,
        motionGraphics: studio.motionGraphics,
        sceneGraphics: studio.sceneGraphics,
        captions: studio.captions,
      });
      const fresh = await fetchManifests(studio.project.id);
      studio.setManifests(
        fresh.map((r) => ({
          id: r.id,
          project_id: r.project_id,
          version: r.version,
          status: r.status,
          manifest_data: r.manifest_data,
          total_scenes: r.total_scenes,
          total_duration_seconds: r.total_duration_seconds,
          is_current: r.is_current,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
      );
      toast.success(`Manifest v${saved.version} generated`);
      setShowViewer(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Manifest generation failed");
    } finally {
      setBusyStep(null);
      setShowOverride(false);
    }
  };

  const restore = async (row: ManifestRow) => {
    try {
      await restoreManifestVersion(studio.project.id, row);
      const fresh = await fetchManifests(studio.project.id);
      studio.setManifests(
        fresh.map((r) => ({
          id: r.id,
          project_id: r.project_id,
          version: r.version,
          status: r.status,
          manifest_data: r.manifest_data,
          total_scenes: r.total_scenes,
          total_duration_seconds: r.total_duration_seconds,
          is_current: r.is_current,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
      );
      toast.success("Restored as new version");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    }
  };

  const tooltipMsg =
    !canGenerate && totalScenes > 0
      ? `${voMissing} scenes missing voiceover. ${clipMissing} scenes missing clips. Fix these before generating manifest.`
      : null;

  return (
    <>
      {current ? (
        <ActionButton icon={Film} label="View Manifest" onClick={() => setShowViewer(true)} />
      ) : (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block">
                <ActionButton
                  icon={Film}
                  label={busyStep ? "Building manifest…" : "Generate Manifest"}
                  disabled={(!canGenerate && !showOverride) || !!busyStep || totalScenes === 0}
                  loading={!!busyStep}
                  onClick={generate}
                />
              </span>
            </TooltipTrigger>
            {tooltipMsg && (
              <TooltipContent side="left" className="max-w-[220px] text-[11px] leading-snug">
                {tooltipMsg}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )}
      {!current && !canGenerate && totalScenes > 0 && !showOverride && (
        <button
          onClick={() => setShowOverride(true)}
          className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
        >
          Generate Anyway
        </button>
      )}

      {current && currentData && (
        <div
          className="mt-1 rounded border p-2 text-[11px]"
          style={{ borderColor: "#2a2a2a", backgroundColor: "#0d0d0d" }}
        >
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span>v{current.version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Scenes</span>
            <span>{current.total_scenes ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span>{currentData.project?.total_duration_formatted ?? "0:00"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Warnings</span>
            <span className={warnings > 0 ? "text-[#e8c547]" : ""}>{warnings}</span>
          </div>
          <button
            onClick={() => setShowViewer(true)}
            className="mt-1 text-[#e8c547] hover:underline"
          >
            View Manifest →
          </button>
        </div>
      )}

      {busyStep && <ManifestBuildingOverlay step={busyStep} />}

      {showViewer && current && (
        <ManifestViewer
          current={current as unknown as ManifestRow}
          versions={studio.manifests as unknown as ManifestRow[]}
          onClose={() => setShowViewer(false)}
          onRegenerate={generate}
          onRestoreVersion={restore}
          regenerating={!!busyStep}
        />
      )}
    </>
  );
}

function ActionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
  loading,
}: {
  icon: typeof Mic;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || loading}
      onClick={onClick}
      className="w-full justify-start border-border bg-transparent text-xs font-medium"
    >
      {loading ? (
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="mr-2 h-3.5 w-3.5" />
      )}
      {label}
    </Button>
  );
}

function SceneRetryButton({ sceneId, clipStatus }: { sceneId: string; clipStatus: string }) {
  const { retryScene, retryingScenes } = useAutoGen();
  if (clipStatus !== "failed") return null;
  const loading = !!retryingScenes[sceneId];
  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void retryScene(sceneId)}
      className="flex items-center gap-1 rounded-md border border-red-500/60 px-2 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
      Retry
    </button>
  );
}

function GenerateAllVisualsButton() {
  const { scenes, clips } = useStudio();
  const { state, start, regenerateAll } = useAutoGen();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);

  const total = scenes.length;
  const sourcedCount = scenes.filter((s) => (s.clip_status ?? "pending") === "sourced").length;
  const pendingCount = total - sourcedCount;
  const allSourced = total > 0 && pendingCount === 0;
  const isRunning = state.isRunning;

  const disabled = total === 0 || isRunning || (pendingCount === 0 && !allSourced);

  const handlePrimary = () => {
    if (isRunning) return;
    if (allSourced) {
      setRegenConfirmOpen(true);
      return;
    }
    if (sourcedCount > 0) {
      setConfirmOpen(true);
      return;
    }
    void start();
  };

  const label = isRunning
    ? "Generating..."
    : allSourced
      ? "Regenerate All Visuals"
      : "Generate All Visuals";

  return (
    <>
      <Button
        size="sm"
        disabled={disabled}
        onClick={handlePrimary}
        variant={allSourced ? "outline" : "default"}
        className={cn(
          "w-full justify-start text-xs font-semibold",
          !allSourced && "bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold)]/90",
          allSourced &&
            "border-[var(--accent-gold)] text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/10",
        )}
      >
        {isRunning ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-3.5 w-3.5" />
        )}
        {label}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate visuals for pending scenes?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1.5 text-sm">
                <div>
                  <span className="text-emerald-400">✓</span> {sourcedCount} scenes already
                  confirmed — will be skipped
                </div>
                <div>
                  <span className="text-muted-foreground">◌</span> {pendingCount} scenes pending —
                  will be generated
                </div>
                <div className="pt-2">Continue?</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold)]/90"
              onClick={() => {
                setConfirmOpen(false);
                void start();
              }}
            >
              Generate {pendingCount} Scenes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={regenConfirmOpen} onOpenChange={setRegenConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate all visuals?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace visuals for all scenes that aren&apos;t manually confirmed.
              Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold)]/90"
              onClick={() => {
                setRegenConfirmOpen(false);
                void regenerateAll();
              }}
            >
              Yes, regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[160px] truncate text-right text-foreground/90" title={value}>
        {value}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Voice settings + voiceover panel                                          */
/* -------------------------------------------------------------------------- */

function VoiceSelector() {
  const { project, setProject, voices, voicesLoaded, setVoices } = useStudio();
  const loadVoices = useServerFn(listVoices);
  const saveVoice = useServerFn(saveProjectVoice);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !voicesLoaded && !loading) {
      setLoading(true);
      try {
        const res = await loadVoices();
        setVoices(res.voices);
      } catch (e) {
        toast.error((e as Error).message || "Failed to load voices");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSelect = async (voiceId: string) => {
    const voice = voices.find((v) => v.voice_id === voiceId);
    if (!voice) return;
    setProject({
      elevenlabs_voice_id: voice.voice_id,
      elevenlabs_voice_name: voice.name,
    });
    try {
      await saveVoice({
        data: { projectId: project.id, voiceId: voice.voice_id, voiceName: voice.name },
      });
    } catch (e) {
      toast.error((e as Error).message || "Could not save voice");
    }
  };

  const selectedVoice = voices.find((v) => v.voice_id === project.elevenlabs_voice_id);
  const previewUrl = selectedVoice?.preview_url;

  const togglePreview = () => {
    if (!previewUrl) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (!audioRef.current || audioRef.current.src !== previewUrl) {
      audioRef.current = new Audio(previewUrl);
      audioRef.current.onended = () => setPlaying(false);
    }
    audioRef.current
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  };

  return (
    <div className="space-y-2">
      <Select
        value={project.elevenlabs_voice_id ?? undefined}
        onValueChange={handleSelect}
        onOpenChange={handleOpenChange}
      >
        <SelectTrigger className="h-9 w-full border-border bg-[var(--surface)] text-xs">
          <SelectValue placeholder={project.elevenlabs_voice_name ?? "Select a voice"}>
            {project.elevenlabs_voice_name ?? "Select a voice"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && voices.length === 0 && voicesLoaded && (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              No voices found
            </div>
          )}
          {!loading &&
            voices.map((v) => (
              <SelectItem key={v.voice_id} value={v.voice_id}>
                <div className="flex items-center gap-2">
                  <span>{v.name}</span>
                  <span className="text-[10px] capitalize text-muted-foreground">{v.category}</span>
                </div>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {selectedVoice && previewUrl && (
        <Button
          size="sm"
          variant="outline"
          onClick={togglePreview}
          className="h-7 w-full border-border bg-transparent text-[11px]"
        >
          {playing ? <Pause className="mr-1.5 h-3 w-3" /> : <Play className="mr-1.5 h-3 w-3" />}
          Preview
        </Button>
      )}
    </div>
  );
}

function VoiceoverPanel({ scene }: { scene: Scene }) {
  const { voiceovers, project } = useStudio();
  const vo = voiceovers.find((v) => v.scene_id === scene.id);
  const generate = useGenerateSceneVoiceover();
  const [generating, setGenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasVoice = !!project.elevenlabs_voice_id;
  const isComplete = vo?.status === "complete" && !!vo.audio_url;
  const estSeconds = Math.round((scene.script_text.split(/\s+/).filter(Boolean).length / 150) * 60);

  const run = async (regenerate: boolean) => {
    if (!hasVoice) {
      toast.error("Select a voice in the right panel first");
      return;
    }
    setGenerating(true);
    try {
      await generate(scene.id, regenerate);
    } catch (e) {
      toast.error((e as Error).message || "Voiceover generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (generating || vo?.status === "generating") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent-gold)" }} />
        <div className="text-xs text-muted-foreground">Generating voiceover…</div>
      </div>
    );
  }

  if (isComplete && vo) {
    return (
      <div className="space-y-3">
        <AudioPlayer src={vo.audio_url!} duration={Number(vo.duration_seconds ?? 0)} />
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            <span className="text-foreground/80">Words:</span> {vo.word_count ?? 0}
          </span>
          <span>
            <span className="text-foreground/80">Duration:</span>{" "}
            {Number(vo.duration_seconds ?? 0).toFixed(1)}s
          </span>
          <span>
            <span className="text-foreground/80">WPM:</span>{" "}
            {Math.round(Number(vo.words_per_minute ?? 0))}
          </span>
          <span>
            <span className="text-foreground/80">Voice:</span>{" "}
            {vo.voice_name ?? project.elevenlabs_voice_name ?? "—"}
          </span>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            className="h-7 border-border bg-transparent text-[11px] text-muted-foreground"
          >
            <RefreshCw className="mr-1.5 h-3 w-3" />
            Regenerate
          </Button>
        </div>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Regenerate voiceover?</AlertDialogTitle>
              <AlertDialogDescription>
                This will replace the current voiceover. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmOpen(false);
                  void run(true);
                }}
              >
                Yes, regenerate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // State 1 — no voiceover yet
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="text-muted-foreground">
          {hasVoice ? (
            <>
              <span className="text-foreground/80">Voice:</span> {project.elevenlabs_voice_name}
            </>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              Select a voice in the panel
              <ArrowRight className="h-3 w-3" />
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">≈ {estSeconds} seconds at 150 WPM</div>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={!hasVoice}
        onClick={() => run(false)}
        className="border-[var(--accent-gold)] bg-transparent text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/10 hover:text-[var(--accent-gold)]"
      >
        <Mic className="mr-1.5 h-3.5 w-3.5" />
        Generate Voiceover
      </Button>
    </div>
  );
}

function AudioPlayer({ src, duration }: { src: string; duration: number }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration || 0);

  useEffect(() => {
    const audio = new Audio(src);
    ref.current = audio;
    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => setTotal(audio.duration || duration || 0);
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [src, duration]);

  const toggle = () => {
    if (!ref.current) return;
    if (playing) {
      ref.current.pause();
      setPlaying(false);
    } else {
      ref.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  const seek = (pct: number) => {
    if (!ref.current) return;
    const t = (pct / 100) * (total || 0);
    ref.current.currentTime = t;
    setCurrent(t);
  };

  const pct = total > 0 ? (current / total) * 100 : 0;

  // 40 static bars styled as a waveform
  const bars = Array.from({ length: 40 }, (_, i) => {
    const h = 30 + Math.abs(Math.sin(i * 1.3)) * 70;
    return h;
  });

  return (
    <div
      className="rounded-md border p-3"
      style={{ backgroundColor: "#0a0a0a", borderColor: "#222" }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black transition-colors"
          style={{ backgroundColor: "var(--accent-gold)" }}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <div className="flex h-10 flex-1 items-center gap-[2px]">
          {bars.map((h, i) => {
            const active = (i / bars.length) * 100 <= pct;
            return (
              <span
                key={i}
                className="flex-1 rounded-sm transition-colors"
                style={{
                  height: `${h}%`,
                  backgroundColor: active ? "var(--accent-gold)" : "#2a2a2a",
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{formatTime(current)}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, var(--accent-gold) 0%, var(--accent-gold) ${pct}%, #2a2a2a ${pct}%, #2a2a2a 100%)`,
          }}
        />
        <span>{formatTime(total)}</span>
      </div>
    </div>
  );
}

function useGenerateSceneVoiceover() {
  const { upsertVoiceover } = useStudio();
  const generateFn = useServerFn(generateVoiceover);
  return async (sceneId: string, regenerate: boolean) => {
    const res = await generateFn({ data: { sceneId, regenerate } });
    if (res?.voiceover) {
      upsertVoiceover(res.voiceover as unknown as Voiceover);
    }
  };
}

function useGenerateAllVoiceovers() {
  const { scenes, voiceovers, project, upsertVoiceover } = useStudio();
  const generateFn = useServerFn(generateVoiceover);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [pendingConfirm, setPendingConfirm] = useState<{
    remaining: Scene[];
    existing: number;
  } | null>(null);

  const runBatch = async (targets: Scene[]) => {
    setGenerating(true);
    setProgress({ done: 0, total: targets.length, failed: 0 });
    let failed = 0;
    for (let i = 0; i < targets.length; i++) {
      const scene = targets[i];
      try {
        const res = await generateFn({ data: { sceneId: scene.id, regenerate: false } });
        if (res?.voiceover) {
          upsertVoiceover(res.voiceover as unknown as Voiceover);
        }
      } catch (e) {
        failed += 1;
        // Mark as failed locally (no row was created if upload failed before insert)
        upsertVoiceover({
          id: `failed-${scene.id}`,
          scene_id: scene.id,
          status: "failed",
          audio_url: null,
          voice_id: project.elevenlabs_voice_id,
          voice_name: project.elevenlabs_voice_name,
          duration_seconds: null,
          word_count: null,
          words_per_minute: null,
          word_timestamps: null,
        });
        debugError(`Voiceover failed for scene ${scene.scene_index}:`, e);
      }
      setProgress({ done: i + 1, total: targets.length, failed });
      // 500ms delay between calls
      if (i < targets.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    setGenerating(false);
    if (failed === 0) {
      toast.success("All voiceovers ready");
    } else {
      toast.warning(`${targets.length - failed} complete, ${failed} failed`);
    }
  };

  const generateAll = () => {
    if (!project.elevenlabs_voice_id) {
      toast.error("Select a voice first");
      return;
    }
    const completedSceneIds = new Set(
      voiceovers.filter((v) => v.status === "complete").map((v) => v.scene_id),
    );
    const remaining = scenes.filter((s) => !completedSceneIds.has(s.id));
    if (remaining.length === 0) {
      toast.info("All scenes already have voiceovers");
      return;
    }
    const existing = scenes.length - remaining.length;
    if (existing > 0) {
      setPendingConfirm({ remaining, existing });
    } else {
      void runBatch(remaining);
    }
  };

  const confirmDialog = pendingConfirm ? (
    <AlertDialog open={!!pendingConfirm} onOpenChange={(open) => !open && setPendingConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Generate remaining voiceovers?</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingConfirm.existing} scenes already have voiceovers. Generate only for the
            remaining {pendingConfirm.remaining.length} scenes?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const r = pendingConfirm.remaining;
              setPendingConfirm(null);
              void runBatch(r);
            }}
          >
            Generate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  // Inject the dialog into the document via portal-style render. Since hooks
  // can't return JSX into a parent easily, we attach it via a side-effect
  // through a hidden component the parent renders.
  return { generateAll, generating, progress, confirmDialog };
}

/* -------------------------------------------------------------------------- */
/*  Skeleton                                                                  */
/* -------------------------------------------------------------------------- */

function StudioSkeleton() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      <div
        className="flex items-center gap-4 border-b px-4"
        style={{ height: 52, borderColor: "#2a2a2a", backgroundColor: "#0d0d0d" }}
      >
        <div className="h-6 w-48 animate-pulse rounded bg-[var(--surface-elevated)]" />
        <div className="flex-1" />
        <div className="h-7 w-20 animate-pulse rounded bg-[var(--surface-elevated)]" />
        <div className="h-7 w-28 animate-pulse rounded bg-[var(--surface-elevated)]" />
        <div className="h-7 w-28 animate-pulse rounded bg-[var(--surface-elevated)]" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div
          className="w-[220px] shrink-0 space-y-2 border-r p-3"
          style={{ backgroundColor: "#0d0d0d", borderColor: "#2a2a2a" }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-[var(--surface-elevated)]" />
          ))}
        </div>
        <div className="flex-1 space-y-4 p-6" style={{ backgroundColor: "#0f0f0f" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-[var(--surface-elevated)]" />
          ))}
        </div>
        <div
          className="w-[280px] shrink-0 space-y-3 border-l p-4"
          style={{ backgroundColor: "#0d0d0d", borderColor: "#2a2a2a" }}
        >
          <div className="h-24 animate-pulse rounded bg-[var(--surface-elevated)]" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-[var(--surface-elevated)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Clips panel                                                               */
/* -------------------------------------------------------------------------- */

type AssetType = "motion_graphic" | "ai_image" | "stock_image" | "stock_video" | "youtube";

const ASSET_TAB_ITEMS: { id: AssetType; label: string; icon: typeof Youtube }[] = [
  { id: "motion_graphic", label: "Motion Graphic", icon: BarChart3 },
  { id: "ai_image", label: "AI Image", icon: ImagePlus },
  { id: "stock_image", label: "Stock Image", icon: ImageIcon },
  { id: "stock_video", label: "Stock Video", icon: Video },
  { id: "youtube", label: "YouTube", icon: Youtube },
];

// Map server-side recommended_asset_type -> client tab id
function recommendedToTab(r: RecommendedAssetType | null | undefined): AssetType {
  switch (r) {
    case "motion_graphic":
      return "motion_graphic";
    case "ai_image_ken_burns":
      return "ai_image";
    case "animated_image":
      return "ai_image";
    case "stock_image_ken_burns":
      return "stock_image";
    case "stock_video":
      return "stock_video";
    case "youtube_clip":
      return "youtube";
    default:
      return "ai_image";
  }
}

// Asset-type indicator config used in scene card header
export const ASSET_TYPE_META: Record<
  RecommendedAssetType,
  { label: string; icon: typeof Youtube; color: string }
> = {
  motion_graphic: { label: "Motion Graphic", icon: BarChart3, color: "var(--accent-gold)" },
  ai_image_ken_burns: { label: "AI Image (Ken Burns)", icon: ImageIcon, color: "#4fc3f7" },
  stock_image_ken_burns: { label: "Stock Image (Ken Burns)", icon: ImageIcon, color: "#9e9e9e" },
  animated_image: { label: "Animated Image", icon: Play, color: "#ab47bc" },
  stock_video: { label: "Stock Video", icon: Video, color: "#4caf50" },
  youtube_clip: { label: "YouTube Clip", icon: Youtube, color: "#ef5350" },
};

const RIGHTS_COLOR: Record<string, string> = {
  low: "#4caf50",
  medium: "var(--accent-gold)",
  high: "#ef5350",
};

function hmsToSeconds(s: string): number {
  if (!s) return 0;
  const parts = s.split(":").map((p) => Number(p) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}

function ClipsPanel({ scene }: { scene: Scene }) {
  const { project, clips } = useStudio();
  const existingClip = clips.find((c) => c.scene_id === scene.id) ?? null;

  const recommended = scene.recommended_asset_type ?? "ai_image_ken_burns";
  const recommendedTab = recommendedToTab(recommended);

  // Initial tab: prefer existing clip's asset_type when present, otherwise recommendation
  const initial: AssetType = (() => {
    if (existingClip) {
      const t = existingClip.asset_type;
      if (t === "youtube") return "youtube";
      if (t === "stock_footage") return "stock_video";
      if (t === "static_image") return "stock_image";
      if (t === "animated_image") return "ai_image";
      if (t === "motion_graphic") return "motion_graphic";
    }
    return recommendedTab;
  })();

  const [assetType, setAssetType] = useState<AssetType>(initial);

  // AI Image sub-mode: when scene was recommended as animated_image, default to animated
  const initialAiMode: "static" | "animated" =
    recommended === "animated_image" ? "animated" : "static";

  if (existingClip && existingClip.status === "sourced") {
    return <ConfirmedClipCard clip={existingClip} sceneId={scene.id} projectId={project.id} />;
  }

  return (
    <div className="space-y-4">
      <AssetTypeSelector value={assetType} onChange={setAssetType} recommended={recommendedTab} />

      {assetType === "motion_graphic" && <MotionGraphicMode scene={scene} />}
      {assetType === "ai_image" && <AiImageMode scene={scene} initialMode={initialAiMode} />}
      {assetType === "stock_image" && <StockImageOnlyMode scene={scene} />}
      {assetType === "stock_video" && <StockFootageMode scene={scene} />}
      {assetType === "youtube" && <YouTubeMode scene={scene} />}
    </div>
  );
}

function AssetTypeSelector({
  value,
  onChange,
  recommended,
}: {
  value: AssetType;
  onChange: (v: AssetType) => void;
  recommended: AssetType;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {ASSET_TAB_ITEMS.map((it) => {
        const Icon = it.icon;
        const active = value === it.id;
        const isRec = recommended === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] font-medium transition-colors",
              active
                ? "border-[var(--accent-gold)] bg-[rgba(232,197,71,0.08)] text-foreground"
                : "border-border bg-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="leading-tight">{it.label}</span>
            {isRec && (
              <span
                className="mt-0.5 flex items-center gap-0.5 text-[9px] font-semibold"
                style={{ color: "var(--accent-gold)" }}
              >
                <Star className="h-2.5 w-2.5 fill-current" />
                Recommended
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Wraps AI Image generation (static) with a toggle to switch to Animated mode
function AiImageMode({ scene, initialMode }: { scene: Scene; initialMode: "static" | "animated" }) {
  const [mode, setMode] = useState<"static" | "animated" | "hera">(initialMode);
  const { project } = useStudio();
  const confirmFn = useServerFn(confirmClip);
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(
          [
            { id: "static", label: "Static + Ken Burns" },
            { id: "animated", label: "Animated" },
            { id: "hera", label: "Hera (video clip)" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-medium",
              mode === t.id
                ? "border-[var(--accent-gold)] bg-[rgba(232,197,71,0.1)] text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {mode === "static" && <StaticImageAi scene={scene} />}
      {mode === "animated" && <AnimatedImageMode scene={scene} />}
      {mode === "hera" && (
        <HeraFlow
          scene={scene}
          projectId={project.id}
          onConfirm={async (payload) => {
            await confirmFn({
              data: {
                projectId: project.id,
                sceneId: scene.id,
                assetType: "hera_video",
                visualJob: scene.visual_job,
                moodTags: scene.clip_brief?.mood ?? [],
                rightsRisk: "low",
                sourceUrl: payload.output_url,
                thumbnailUrl: payload.thumbnail_url ?? undefined,
                durationSeconds: payload.duration_seconds,
              },
            });
          }}
        />
      )}
    </div>
  );
}

// Stock image-only mode (Pexels photo search) extracted from former StaticImageMode
function StockImageOnlyMode({ scene }: { scene: Scene }) {
  return <StaticImageSearch scene={scene} />;
}

// Motion Graphic mode — full configuration + preview + confirm flow
function MotionGraphicMode({ scene }: { scene: Scene }) {
  return <MotionGraphicTab scene={scene} />;
}

/* ---------------- YouTube mode ---------------- */

function YouTubeMode({ scene }: { scene: Scene }) {
  const brief = scene.clip_brief;
  const initialQuery = brief?.suggested_search_terms?.[0] ?? brief?.subject ?? "";
  const initialChannels =
    scene.youtube_source_priority && scene.youtube_source_priority.length > 0
      ? scene.youtube_source_priority
      : ["any"];

  const [query, setQuery] = useState(initialQuery);
  const [channels, setChannels] = useState<string[]>(initialChannels);
  const [rightsFilter, setRightsFilter] = useState<"low" | "medium" | "any">("low");
  const [results, setResults] = useState<YouTubeCandidate[] | null>(null);
  const [cached, setCached] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const runSearch = useServerFn(searchYouTube);

  const doSearch = async () => {
    if (!query.trim()) {
      toast.error("Enter a search term");
      return;
    }
    setSearching(true);
    setSelectedId(null);
    try {
      const res = await runSearch({
        data: { query: query.trim(), channels, rightsFilter },
      });
      setResults(res.results);
      setCached(res.cached);
    } catch (e) {
      toast.error((e as Error).message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <ClipIndexSection scene={scene} />

      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Search YouTube
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search query"
            className="h-9 bg-[var(--surface)] text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={searching}
            onClick={doSearch}
            className="h-9 border-[var(--accent-gold)] bg-transparent text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/10 hover:text-[var(--accent-gold)]"
          >
            {searching ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-3.5 w-3.5" />
            )}
            Search
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Rights
            </span>
            {(["low", "medium", "any"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRightsFilter(r)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[10px] font-medium capitalize transition-colors",
                  rightsFilter === r
                    ? "border-[var(--accent-gold)] bg-[rgba(232,197,71,0.1)] text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <ChannelMultiSelect value={channels} onChange={setChannels} />
      </div>

      {results !== null && (
        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{results.length} results</span>
            {cached && (
              <span className="rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Cached
              </span>
            )}
          </div>
          {results.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No matching videos. Try a different query.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {results.map((r) => (
                <YouTubeCandidateCard
                  key={r.video_id}
                  candidate={r}
                  scene={scene}
                  expanded={selectedId === r.video_id}
                  onToggle={() => setSelectedId((id) => (id === r.video_id ? null : r.video_id))}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChannelMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (slug: string) => {
    if (slug === "any") {
      onChange(["any"]);
      return;
    }
    const without = value.filter((v) => v !== "any");
    const next = without.includes(slug) ? without.filter((v) => v !== slug) : [...without, slug];
    onChange(next.length === 0 ? ["any"] : next);
  };
  const labels =
    value.includes("any") || value.length === 0
      ? "Any Channel"
      : value.map((s) => CHANNEL_OPTIONS.find((c) => c.slug === s)?.label ?? s).join(", ");
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-border bg-[var(--surface)] px-2.5 py-1.5 text-left text-[11px] text-foreground/85"
      >
        <span className="truncate">{labels}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-[#1a1a1a] p-1 shadow-lg">
          <ChannelOption
            slug="any"
            label="Any Channel"
            selected={value.includes("any")}
            onClick={() => toggle("any")}
          />
          <div className="my-1 border-t border-border" />
          {CHANNEL_OPTIONS.map((c) => (
            <ChannelOption
              key={c.slug}
              slug={c.slug}
              label={c.label}
              selected={value.includes(c.slug)}
              onClick={() => toggle(c.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChannelOption({
  label,
  selected,
  onClick,
}: {
  slug: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[11px] hover:bg-[var(--surface-elevated)]"
    >
      <span>{label}</span>
      {selected && <Check className="h-3 w-3 text-[var(--accent-gold)]" />}
    </button>
  );
}

type ClipIndexMatch = {
  id: string;
  thumbnail_url?: string | null;
  source_title?: string | null;
  source_channel?: string | null;
};

function ClipIndexSection({ scene }: { scene: Scene }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<ClipIndexMatch[] | null>(null);
  const run = useServerFn(checkClipIndex);
  const handle = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const res = await run({
        data: {
          visualJob: scene.visual_job ?? null,
          moodTags: scene.clip_brief?.mood ?? [],
        },
      });
      setMatches(res.matches as ClipIndexMatch[]);
    } catch (e) {
      toast.error((e as Error).message || "Index lookup failed");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="rounded-md border border-border bg-[#0a0a0a] p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Index
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Check your saved library for matching clips.
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handle}
          disabled={loading}
          className="h-7 border-border bg-transparent text-[11px]"
        >
          {loading ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <Search className="mr-1.5 h-3 w-3" />
          )}
          Check Clip Index
        </Button>
      </div>
      {open && !loading && matches !== null && (
        <div className="mt-3">
          {matches.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">
              No index matches — search YouTube below.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {matches.slice(0, 6).map((m) => (
                <div
                  key={m.id}
                  className="overflow-hidden rounded-md border border-border bg-[#141414]"
                >
                  {m.thumbnail_url && (
                    <img
                      src={m.thumbnail_url}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  )}
                  <div className="p-2">
                    <div className="line-clamp-2 text-[11px] font-medium">
                      {m.source_title ?? "Untitled"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {m.source_channel ?? ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function YouTubeCandidateCard({
  candidate,
  scene,
  expanded,
  onToggle,
}: {
  candidate: YouTubeCandidate;
  scene: Scene;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { project, upsertClip } = useStudio();
  const priority = scene.youtube_source_priority ?? [];
  const isPriority = priority.some(
    (slug) =>
      CHANNEL_OPTIONS.find((c) => c.slug === slug)?.label.toLowerCase() ===
      candidate.channel_title.toLowerCase(),
  );

  const confirm = useServerFn(confirmClip);
  const [startStr, setStartStr] = useState("00:00:00");
  const [endStr, setEndStr] = useState("00:00:06");
  const [confirming, setConfirming] = useState(false);

  const startSec = hmsToSeconds(startStr);
  const endSec = hmsToSeconds(endStr);
  const dur = Math.max(0, endSec - startSec);
  const durColor =
    dur >= 4 && dur <= 8 ? "#4caf50" : dur > 8 && dur <= 15 ? "var(--accent-gold)" : "#ef5350";

  const handleConfirm = async () => {
    if (dur <= 0) {
      toast.error("End time must be after start time");
      return;
    }
    setConfirming(true);
    try {
      const res = await confirm({
        data: {
          projectId: project.id,
          sceneId: scene.id,
          assetType: "youtube",
          sourceUrl: `https://youtube.com/watch?v=${candidate.video_id}`,
          sourceChannel: candidate.channel_title,
          sourceTitle: candidate.title,
          sourceVideoId: candidate.video_id,
          timestampStart: startStr,
          timestampEnd: endStr,
          durationSeconds: dur,
          visualJob: scene.visual_job,
          moodTags: scene.clip_brief?.mood ?? [],
          colorTemperature: scene.clip_brief?.color_temperature ?? null,
          rightsRisk: candidate.rights_risk,
          thumbnailUrl: candidate.thumbnail_url,
        },
      });
      if (res?.clip) upsertClip(res.clip as unknown as Clip);
      toast.success("Clip confirmed");
    } catch (e) {
      toast.error((e as Error).message || "Could not confirm clip");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-md border border-border bg-[#141414]">
      <div className="relative">
        <img src={candidate.thumbnail_url} alt="" className="aspect-video w-full object-cover" />
        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white">
          {candidate.duration_label}
        </span>
      </div>
      <div className="space-y-2 p-2.5">
        <div className="line-clamp-2 text-[11px] font-medium leading-snug">{candidate.title}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
            style={{
              backgroundColor: isPriority ? "rgba(232,197,71,0.15)" : "#1a1a1a",
              color: isPriority ? "var(--accent-gold)" : "var(--text-muted)",
              border: `1px solid ${isPriority ? "rgba(232,197,71,0.4)" : "transparent"}`,
            }}
          >
            {candidate.channel_title}
          </span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold capitalize"
            style={{
              backgroundColor: `${RIGHTS_COLOR[candidate.rights_risk]}22`,
              color: RIGHTS_COLOR[candidate.rights_risk],
            }}
          >
            {candidate.rights_risk} rights
          </span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(candidate.published_at).toLocaleDateString()}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onToggle}
          className="h-7 w-full border-border bg-transparent text-[11px]"
        >
          {expanded ? "Cancel" : "Select"}
        </Button>

        {expanded && (
          <div className="space-y-2 rounded-md border border-border bg-[#0a0a0a] p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Start Time
                </label>
                <Input
                  value={startStr}
                  onChange={(e) => setStartStr(e.target.value)}
                  placeholder="HH:MM:SS"
                  className="h-7 bg-[var(--surface)] text-[11px]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  End Time
                </label>
                <Input
                  value={endStr}
                  onChange={(e) => setEndStr(e.target.value)}
                  placeholder="HH:MM:SS"
                  className="h-7 bg-[var(--surface)] text-[11px]"
                />
              </div>
            </div>
            <div className="text-[11px]" style={{ color: durColor }}>
              {dur} seconds selected
            </div>
            <div className="text-[10px] text-muted-foreground">
              5-7 seconds recommended for b-roll and authority clips.
            </div>
            <a
              href={`https://youtube.com/watch?v=${candidate.video_id}&t=${startSec}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-gold)] hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Open in YouTube
            </a>
            <Button
              size="sm"
              disabled={confirming || dur <= 0}
              onClick={handleConfirm}
              className="w-full bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
            >
              {confirming ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Confirm Clip
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmedClipCard({
  clip,
  sceneId,
  projectId,
}: {
  clip: Clip;
  sceneId: string;
  projectId: string;
}) {
  const { upsertClip, setClips, clips } = useStudio();
  const [changing, setChanging] = useState(false);

  const fetchLabel =
    clip.fetch_status === "ready"
      ? { text: "Ready", color: "#4caf50" }
      : clip.fetch_status === "fetching"
        ? { text: "Fetching…", color: "var(--accent-gold)" }
        : { text: "Not Fetched", color: "var(--text-muted)" };

  const handleChange = async () => {
    setChanging(true);
    const { error } = await supabase.from("clips").delete().eq("id", clip.id);
    setChanging(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setClips(clips.filter((c) => c.id !== clip.id));
  };

  return (
    <div className="rounded-md border border-border bg-[#0a0a0a] p-3">
      <div className="flex gap-3">
        {clip.thumbnail_url && (
          <img
            src={clip.thumbnail_url}
            alt=""
            className="aspect-video w-32 shrink-0 rounded object-cover"
          />
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="line-clamp-2 text-[12px] font-medium">{clip.source_title}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {clip.source_channel && (
              <span className="rounded-full bg-[#1a1a1a] px-1.5 py-0.5 text-[10px] text-foreground/85">
                {clip.source_channel}
              </span>
            )}
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize"
              style={{
                backgroundColor: `${RIGHTS_COLOR[clip.rights_risk] ?? "#1a1a1a"}22`,
                color: RIGHTS_COLOR[clip.rights_risk] ?? "var(--text-muted)",
              }}
            >
              {clip.rights_risk} rights
            </span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: `${fetchLabel.color}22`, color: fetchLabel.color }}
            >
              {fetchLabel.text}
            </span>
          </div>
          {(clip.timestamp_start || clip.timestamp_end) && (
            <div className="text-[11px] text-muted-foreground">
              {clip.timestamp_start} — {clip.timestamp_end} ({clip.duration_seconds ?? 0} sec)
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {clip.source_url && (
              <a
                href={clip.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-gold)] hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Open in YouTube
              </a>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={changing}
              onClick={handleChange}
              className="h-7 border-border bg-transparent text-[11px]"
            >
              {changing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Change Clip
            </Button>
          </div>
        </div>
      </div>
      {/* keep refs to silence unused params */}
      <input type="hidden" value={sceneId} />
      <input type="hidden" value={projectId} />
    </div>
  );
}

/* ---------------- Stock footage mode ---------------- */

function StockFootageMode({ scene }: { scene: Scene }) {
  const { project, upsertClip } = useStudio();
  const [query, setQuery] = useState(scene.clip_brief?.subject ?? "");
  const [results, setResults] = useState<PexelsVideoCandidate[] | null>(null);
  const [cached, setCached] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const run = useServerFn(searchPexelsVideos);
  const confirm = useServerFn(confirmClip);

  const doSearch = async () => {
    if (!query.trim()) return toast.error("Enter a search term");
    setSearching(true);
    setSelectedId(null);
    try {
      const res = await run({ data: { query: query.trim() } });
      setResults(res.results);
      setCached(res.cached);
    } catch (e) {
      toast.error((e as Error).message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stock footage"
          className="h-9 bg-[var(--surface)] text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={searching}
          onClick={doSearch}
          className="h-9 border-[var(--accent-gold)] bg-transparent text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/10 hover:text-[var(--accent-gold)]"
        >
          {searching ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="mr-1.5 h-3.5 w-3.5" />
          )}
          Search
        </Button>
      </div>
      <div className="text-[10px] text-muted-foreground">Free sources only: Pexels</div>

      {results !== null && (
        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{results.length} results</span>
            {cached && (
              <span className="rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[10px]">Cached</span>
            )}
          </div>
          {results.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No videos found.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {results.map((r) => {
                const expanded = selectedId === r.id;
                return (
                  <PexelsVideoCard
                    key={r.id}
                    candidate={r}
                    expanded={expanded}
                    onToggle={() => setSelectedId((id) => (id === r.id ? null : r.id))}
                    onConfirm={async (startStr, endStr, dur) => {
                      try {
                        const res = await confirm({
                          data: {
                            projectId: project.id,
                            sceneId: scene.id,
                            assetType: "stock_footage",
                            sourceUrl: r.source_url,
                            sourceChannel: "pexels",
                            sourceTitle: r.title,
                            sourceVideoId: r.id,
                            timestampStart: startStr,
                            timestampEnd: endStr,
                            durationSeconds: dur,
                            resolution: r.resolution,
                            visualJob: scene.visual_job,
                            moodTags: scene.clip_brief?.mood ?? [],
                            colorTemperature: scene.clip_brief?.color_temperature ?? null,
                            rightsRisk: "low",
                            thumbnailUrl: r.thumbnail_url,
                          },
                        });
                        if (res?.clip) upsertClip(res.clip as unknown as Clip);
                        toast.success("Clip confirmed");
                      } catch (e) {
                        toast.error((e as Error).message || "Could not confirm clip");
                      }
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PexelsVideoCard({
  candidate,
  expanded,
  onToggle,
  onConfirm,
}: {
  candidate: PexelsVideoCandidate;
  expanded: boolean;
  onToggle: () => void;
  onConfirm: (start: string, end: string, dur: number) => Promise<void>;
}) {
  const [startStr, setStartStr] = useState("00:00:00");
  const [endStr, setEndStr] = useState("00:00:06");
  const [submitting, setSubmitting] = useState(false);
  const dur = Math.max(0, hmsToSeconds(endStr) - hmsToSeconds(startStr));
  const durColor =
    dur >= 4 && dur <= 8 ? "#4caf50" : dur > 8 && dur <= 15 ? "var(--accent-gold)" : "#ef5350";

  return (
    <div className="overflow-hidden rounded-md border border-border bg-[#141414]">
      <div className="relative">
        <img src={candidate.thumbnail_url} alt="" className="aspect-video w-full object-cover" />
        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white">
          {candidate.duration_label}
        </span>
      </div>
      <div className="space-y-2 p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[rgba(76,175,80,0.15)] px-1.5 py-0.5 text-[9px] font-semibold text-[#4caf50]">
            Pexels
          </span>
          <span className="rounded-full bg-[rgba(76,175,80,0.15)] px-1.5 py-0.5 text-[9px] font-semibold text-[#4caf50]">
            Royalty Free
          </span>
          {candidate.resolution && (
            <span className="text-[10px] text-muted-foreground">{candidate.resolution}</span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onToggle}
          className="h-7 w-full border-border bg-transparent text-[11px]"
        >
          {expanded ? "Cancel" : "Select"}
        </Button>
        {expanded && (
          <div className="space-y-2 rounded-md border border-border bg-[#0a0a0a] p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Start Time
                </label>
                <Input
                  value={startStr}
                  onChange={(e) => setStartStr(e.target.value)}
                  className="h-7 bg-[var(--surface)] text-[11px]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  End Time
                </label>
                <Input
                  value={endStr}
                  onChange={(e) => setEndStr(e.target.value)}
                  className="h-7 bg-[var(--surface)] text-[11px]"
                />
              </div>
            </div>
            <div className="text-[11px]" style={{ color: durColor }}>
              {dur} seconds selected
            </div>
            <Button
              size="sm"
              disabled={submitting || dur <= 0}
              onClick={async () => {
                setSubmitting(true);
                await onConfirm(startStr, endStr, dur);
                setSubmitting(false);
              }}
              className="w-full bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
            >
              {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Confirm Clip
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Static image mode ---------------- */

function StaticImageMode({ scene }: { scene: Scene }) {
  const [sub, setSub] = useState<"search" | "ai">("search");
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(
          [
            { id: "search", label: "Search Stock" },
            { id: "ai", label: "Generate with AI" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-medium",
              sub === t.id
                ? "border-[var(--accent-gold)] bg-[rgba(232,197,71,0.1)] text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sub === "search" ? <StaticImageSearch scene={scene} /> : <StaticImageAi scene={scene} />}
    </div>
  );
}

function StaticImageSearch({ scene }: { scene: Scene }) {
  const { project, upsertClip } = useStudio();
  const [query, setQuery] = useState(scene.clip_brief?.subject ?? "");
  const [results, setResults] = useState<PexelsPhotoCandidate[] | null>(null);
  const [selected, setSelected] = useState<PexelsPhotoCandidate | null>(null);
  const [searching, setSearching] = useState(false);
  const [cached, setCached] = useState(false);
  const run = useServerFn(searchPexelsPhotos);
  const confirm = useServerFn(confirmClip);

  const [kb, setKb] = useState<KenBurnsConfig>({
    enabled: true,
    zoom: "in",
    pan: "none",
    speed: "medium",
  });
  const [submitting, setSubmitting] = useState(false);

  const doSearch = async () => {
    if (!query.trim()) return toast.error("Enter a search term");
    setSearching(true);
    setSelected(null);
    try {
      const res = await run({ data: { query: query.trim() } });
      setResults(res.results);
      setCached(res.cached);
    } catch (e) {
      toast.error((e as Error).message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const doConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await confirm({
        data: {
          projectId: project.id,
          sceneId: scene.id,
          assetType: "static_image",
          sourceUrl: selected.full_url,
          sourceChannel: "pexels",
          sourceTitle: `Photo by ${selected.photographer}`,
          sourceVideoId: selected.id,
          thumbnailUrl: selected.thumbnail_url,
          visualJob: scene.visual_job,
          moodTags: scene.clip_brief?.mood ?? [],
          colorTemperature: scene.clip_brief?.color_temperature ?? null,
          rightsRisk: "low",
          kenBurnsConfig: kb,
        },
      });
      if (res?.clip) upsertClip(res.clip as unknown as Clip);
      toast.success("Image confirmed");
    } catch (e) {
      toast.error((e as Error).message || "Could not confirm image");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stock photos"
          className="h-9 bg-[var(--surface)] text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={searching}
          onClick={doSearch}
          className="h-9 border-[var(--accent-gold)] bg-transparent text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/10 hover:text-[var(--accent-gold)]"
        >
          {searching ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="mr-1.5 h-3.5 w-3.5" />
          )}
          Search
        </Button>
      </div>

      {results !== null && (
        <>
          {cached && <div className="text-[10px] text-muted-foreground">Cached</div>}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={cn(
                  "overflow-hidden rounded-md border",
                  selected?.id === p.id ? "border-[var(--accent-gold)]" : "border-border",
                )}
              >
                <img src={p.thumbnail_url} alt="" className="aspect-video w-full object-cover" />
                <div className="truncate px-1.5 py-1 text-left text-[9px] text-muted-foreground">
                  {p.photographer}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {selected && (
        <div className="space-y-3 rounded-md border border-border bg-[#0a0a0a] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ken Burns Effect
          </div>
          <PillToggle
            label=""
            options={[
              { id: "on", label: "On" },
              { id: "off", label: "Off" },
            ]}
            value={kb.enabled ? "on" : "off"}
            onChange={(v) => setKb({ ...kb, enabled: v === "on" })}
          />
          {kb.enabled && (
            <>
              <PillToggle
                label="Zoom"
                options={[
                  { id: "in", label: "In" },
                  { id: "out", label: "Out" },
                ]}
                value={kb.zoom ?? "in"}
                onChange={(v) => setKb({ ...kb, zoom: v as KenBurnsConfig["zoom"] })}
              />
              <PillToggle
                label="Pan"
                options={[
                  { id: "none", label: "None" },
                  { id: "left", label: "Left" },
                  { id: "right", label: "Right" },
                  { id: "up", label: "Up" },
                  { id: "down", label: "Down" },
                ]}
                value={kb.pan ?? "none"}
                onChange={(v) => setKb({ ...kb, pan: v as KenBurnsConfig["pan"] })}
              />
              <PillToggle
                label="Speed"
                options={[
                  { id: "slow", label: "Slow" },
                  { id: "medium", label: "Medium" },
                  { id: "fast", label: "Fast" },
                ]}
                value={kb.speed ?? "medium"}
                onChange={(v) => setKb({ ...kb, speed: v as KenBurnsConfig["speed"] })}
              />
            </>
          )}
          <Button
            size="sm"
            onClick={doConfirm}
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
          >
            {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Confirm Image
          </Button>
        </div>
      )}
    </div>
  );
}

function PillToggle({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && (
        <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      )}
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
            value === o.id
              ? "border-[var(--accent-gold)] bg-[rgba(232,197,71,0.1)] text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StaticImageAi({ scene }: { scene: Scene }) {
  const { project, upsertClip } = useStudio();
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptEditable, setPromptEditable] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [kb, setKb] = useState<KenBurnsConfig>({
    enabled: true,
    zoom: "in",
    pan: "none",
    speed: "medium",
  });

  const genPrompt = useServerFn(generateImagePrompt);
  const genImages = useServerFn(generateImagesReplicate);
  const loadCache = useServerFn(loadImageAssetCache);
  const confirm = useServerFn(confirmClip);

  // Load cached generation on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await loadCache({
          data: { sceneId: scene.id, sourceType: "ai_generated" },
        });
        if (!alive || !res.asset) return;
        const a = res.asset as {
          prompt_used: string | null;
          image_urls: string[];
          selected_url: string | null;
          ken_burns_config: KenBurnsConfig | null;
        };
        if (a.prompt_used) setPrompt(a.prompt_used);
        if (Array.isArray(a.image_urls) && a.image_urls.length > 0) {
          setImageUrls(a.image_urls);
          setFromCache(true);
        }
        if (a.selected_url) setSelectedUrl(a.selected_url);
        if (a.ken_burns_config) setKb(a.ken_burns_config);
      } catch {
        /* no cache, ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [scene.id, loadCache]);

  const writePrompt = async () => {
    setPromptLoading(true);
    try {
      const res = await genPrompt({ data: { sceneId: scene.id } });
      setPrompt(res.prompt);
      setPromptEditable(true);
    } catch (e) {
      toast.error((e as Error).message || "Could not generate prompt");
    } finally {
      setPromptLoading(false);
    }
  };

  const doGenerate = async () => {
    if (!prompt.trim()) return toast.error("Write or generate a prompt first");
    setGenerating(true);
    setSelectedUrl(null);
    setFromCache(false);
    try {
      const res = await genImages({
        data: {
          prompt: prompt.trim(),
          sceneId: scene.id,
          projectId: project.id,
        },
      });
      setImageUrls(res.urls);
    } catch (e) {
      toast.error((e as Error).message || "Image generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const doConfirm = async () => {
    if (!selectedUrl) return toast.error("Select an image first");
    setSubmitting(true);
    try {
      const res = await confirm({
        data: {
          projectId: project.id,
          sceneId: scene.id,
          assetType: "static_image",
          sourceUrl: selectedUrl,
          sourceChannel: "ai_generated",
          sourceTitle: "AI generated image",
          thumbnailUrl: selectedUrl,
          visualJob: scene.visual_job,
          moodTags: scene.clip_brief?.mood ?? [],
          colorTemperature: scene.clip_brief?.color_temperature ?? null,
          rightsRisk: "low",
          kenBurnsConfig: kb,
          promptUsed: prompt.trim(),
        },
      });
      if (res?.clip) upsertClip(res.clip as unknown as Clip);
      toast.success("Image confirmed");
    } catch (e) {
      toast.error((e as Error).message || "Could not confirm image");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-[#0a0a0a] p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Prompt
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={writePrompt}
          disabled={promptLoading || generating}
          className="h-7 border-border bg-transparent text-[11px]"
        >
          {promptLoading ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <Wand2 className="mr-1.5 h-3 w-3" />
          )}
          {prompt ? "Regenerate Prompt" : "Generate Prompt"}
        </Button>
      </div>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        readOnly={!promptEditable}
        placeholder="Your image generation prompt will appear here…"
        className="min-h-[90px] resize-y bg-[var(--surface)] text-xs"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPromptEditable((v) => !v)}
          className="h-7 border-border bg-transparent text-[11px]"
        >
          {promptEditable ? "Lock Prompt" : "Edit Prompt"}
        </Button>
        <Button
          size="sm"
          onClick={doGenerate}
          disabled={generating || !prompt.trim()}
          className="h-7 flex-1 bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
        >
          {generating ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Generating images…
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-3 w-3" />
              Generate Images
            </>
          )}
        </Button>
      </div>

      {generating && (
        <div className="rounded-md border border-border bg-[#141414] p-3 text-center text-[11px] text-muted-foreground">
          This takes 15-30 seconds
        </div>
      )}

      {!generating && imageUrls.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Results</span>
            {fromCache && (
              <span className="rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[10px] normal-case tracking-normal">
                Cached
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {imageUrls.map((url) => {
              const active = selectedUrl === url;
              return (
                <button
                  key={url}
                  onClick={() => setSelectedUrl(url)}
                  className={cn(
                    "group relative overflow-hidden rounded-md border",
                    active ? "border-[var(--accent-gold)]" : "border-border",
                  )}
                >
                  <img src={url} alt="" className="aspect-square w-full object-cover" />
                  <div
                    className={cn(
                      "absolute inset-x-0 bottom-0 px-1.5 py-1 text-center text-[10px] font-medium",
                      active
                        ? "bg-[var(--accent-gold)] text-black"
                        : "bg-black/70 text-white opacity-0 group-hover:opacity-100",
                    )}
                  >
                    {active ? "Selected" : "Select"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedUrl && (
        <div className="space-y-3 rounded-md border border-border bg-[#141414] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ken Burns Effect
          </div>
          <PillToggle
            label=""
            options={[
              { id: "on", label: "On" },
              { id: "off", label: "Off" },
            ]}
            value={kb.enabled ? "on" : "off"}
            onChange={(v) => setKb({ ...kb, enabled: v === "on" })}
          />
          {kb.enabled && (
            <>
              <PillToggle
                label="Zoom"
                options={[
                  { id: "in", label: "In" },
                  { id: "out", label: "Out" },
                ]}
                value={kb.zoom ?? "in"}
                onChange={(v) => setKb({ ...kb, zoom: v as KenBurnsConfig["zoom"] })}
              />
              <PillToggle
                label="Pan"
                options={[
                  { id: "none", label: "None" },
                  { id: "left", label: "Left" },
                  { id: "right", label: "Right" },
                  { id: "up", label: "Up" },
                  { id: "down", label: "Down" },
                ]}
                value={kb.pan ?? "none"}
                onChange={(v) => setKb({ ...kb, pan: v as KenBurnsConfig["pan"] })}
              />
              <PillToggle
                label="Speed"
                options={[
                  { id: "slow", label: "Slow" },
                  { id: "medium", label: "Medium" },
                  { id: "fast", label: "Fast" },
                ]}
                value={kb.speed ?? "medium"}
                onChange={(v) => setKb({ ...kb, speed: v as KenBurnsConfig["speed"] })}
              />
            </>
          )}
          <Button
            size="sm"
            onClick={doConfirm}
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
          >
            {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Confirm Image
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Animated image mode ---------------- */

type AnimationStyle = "ken_burns" | "subtle_motion" | "camera_move" | "loop_atmosphere";

const ANIMATION_STYLES: Array<{
  id: AnimationStyle;
  label: string;
  description: string;
  badge: string;
  costly: boolean;
  recommended?: boolean;
}> = [
  {
    id: "ken_burns",
    label: "Ken Burns",
    description: "Slow zoom or pan on a still image. Works in final render.",
    badge: "No extra cost",
    costly: false,
    recommended: true,
  },
  {
    id: "subtle_motion",
    label: "Subtle Motion",
    description: "Gentle atmospheric movement via Replicate.",
    badge: "Uses Replicate credits",
    costly: true,
  },
  {
    id: "camera_move",
    label: "Camera Move",
    description: "Programmatic zoom or push into the scene.",
    badge: "No extra cost",
    costly: false,
  },
  {
    id: "loop_atmosphere",
    label: "Loop Atmosphere",
    description: "Looping ambient motion effect.",
    badge: "Uses Replicate credits",
    costly: true,
  },
];

function AnimatedImageMode({ scene }: { scene: Scene }) {
  const { project, upsertClip } = useStudio();
  const [baseImage, setBaseImage] = useState<PexelsPhotoCandidate | null>(null);
  const [query, setQuery] = useState(scene.clip_brief?.subject ?? "");
  const [results, setResults] = useState<PexelsPhotoCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [cached, setCached] = useState(false);
  const [style, setStyle] = useState<AnimationStyle | null>(null);
  const [kb, setKb] = useState<KenBurnsConfig>({
    enabled: true,
    zoom: "in",
    pan: "none",
    speed: "medium",
  });
  const [animating, setAnimating] = useState(false);
  const [animatedUrl, setAnimatedUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const search = useServerFn(searchPexelsPhotos);
  const animate = useServerFn(animateImageReplicate);
  const confirm = useServerFn(confirmClip);

  const doSearch = async () => {
    if (!query.trim()) return toast.error("Enter a search term");
    setSearching(true);
    try {
      const res = await search({ data: { query: query.trim() } });
      setResults(res.results);
      setCached(res.cached);
    } catch (e) {
      toast.error((e as Error).message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const doAnimate = async () => {
    if (!baseImage || !style) return;
    if (style !== "subtle_motion" && style !== "loop_atmosphere") return;
    setAnimating(true);
    setAnimatedUrl(null);
    try {
      const res = await animate({
        data: {
          imageUrl: baseImage.full_url,
          sceneId: scene.id,
          projectId: project.id,
          style,
        },
      });
      setAnimatedUrl(res.videoUrl);
    } catch (e) {
      toast.error((e as Error).message || "Animation failed");
    } finally {
      setAnimating(false);
    }
  };

  const doConfirm = async () => {
    if (!baseImage || !style) return;
    setSubmitting(true);
    try {
      const isReplicate = style === "subtle_motion" || style === "loop_atmosphere";
      const res = await confirm({
        data: {
          projectId: project.id,
          sceneId: scene.id,
          assetType: isReplicate ? "animated_image" : "static_image",
          sourceUrl: baseImage.full_url,
          sourceChannel: isReplicate ? "replicate" : "pexels",
          sourceTitle: `Animated: ${ANIMATION_STYLES.find((s) => s.id === style)?.label}`,
          sourceVideoId: baseImage.id,
          thumbnailUrl: baseImage.thumbnail_url,
          visualJob: scene.visual_job,
          moodTags: scene.clip_brief?.mood ?? [],
          colorTemperature: scene.clip_brief?.color_temperature ?? null,
          rightsRisk: "low",
          kenBurnsConfig: !isReplicate ? kb : null,
          animationType: style,
          animationUrl: animatedUrl ?? null,
        },
      });
      if (res?.clip) upsertClip(res.clip as unknown as Clip);
      toast.success("Animation confirmed");
    } catch (e) {
      toast.error((e as Error).message || "Could not confirm");
    } finally {
      setSubmitting(false);
    }
  };

  const styleMeta = style ? ANIMATION_STYLES.find((s) => s.id === style) : null;
  const isReplicateStyle = style === "subtle_motion" || style === "loop_atmosphere";

  return (
    <div className="space-y-4">
      {/* Step 1: pick base image */}
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Step 1 — Choose a base image
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stock photos"
            className="h-9 bg-[var(--surface)] text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={searching}
            onClick={doSearch}
            className="h-9 border-[var(--accent-gold)] bg-transparent text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/10 hover:text-[var(--accent-gold)]"
          >
            {searching ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-3.5 w-3.5" />
            )}
            Search
          </Button>
        </div>
        {results !== null && (
          <>
            {cached && <div className="text-[10px] text-muted-foreground">Cached</div>}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setBaseImage(p);
                    setStyle(null);
                    setAnimatedUrl(null);
                  }}
                  className={cn(
                    "overflow-hidden rounded-md border",
                    baseImage?.id === p.id ? "border-[var(--accent-gold)]" : "border-border",
                  )}
                >
                  <img src={p.thumbnail_url} alt="" className="aspect-video w-full object-cover" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Step 2: animation style */}
      {baseImage && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Step 2 — Animation Style
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {ANIMATION_STYLES.map((s) => {
              const active = style === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setStyle(s.id);
                    setAnimatedUrl(null);
                  }}
                  className={cn(
                    "rounded-md border p-3 text-left transition-colors",
                    active
                      ? "border-[var(--accent-gold)] bg-[rgba(232,197,71,0.08)]"
                      : "border-border bg-[#0a0a0a] hover:bg-[#141414]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12px] font-semibold">
                      {s.label}
                      {s.recommended && (
                        <span className="ml-1.5 text-[9px] font-medium text-[var(--accent-gold)]">
                          (Recommended)
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                        s.costly
                          ? "bg-[rgba(232,197,71,0.15)] text-[var(--accent-gold)]"
                          : "bg-[rgba(76,175,80,0.15)] text-[#4caf50]",
                      )}
                    >
                      {s.badge}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{s.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3 — config / generate */}
      {baseImage && style && (
        <div className="space-y-3 rounded-md border border-border bg-[#0a0a0a] p-3">
          {!isReplicateStyle && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {styleMeta?.label} Settings
              </div>
              <PillToggle
                label="Zoom"
                options={[
                  { id: "in", label: "In" },
                  { id: "out", label: "Out" },
                ]}
                value={kb.zoom ?? "in"}
                onChange={(v) => setKb({ ...kb, zoom: v as KenBurnsConfig["zoom"] })}
              />
              <PillToggle
                label="Pan"
                options={[
                  { id: "none", label: "None" },
                  { id: "left", label: "Left" },
                  { id: "right", label: "Right" },
                  { id: "up", label: "Up" },
                  { id: "down", label: "Down" },
                ]}
                value={kb.pan ?? "none"}
                onChange={(v) => setKb({ ...kb, pan: v as KenBurnsConfig["pan"] })}
              />
              <PillToggle
                label="Speed"
                options={[
                  { id: "slow", label: "Slow" },
                  { id: "medium", label: "Medium" },
                  { id: "fast", label: "Fast" },
                ]}
                value={kb.speed ?? "medium"}
                onChange={(v) => setKb({ ...kb, speed: v as KenBurnsConfig["speed"] })}
              />
              <Button
                size="sm"
                onClick={doConfirm}
                disabled={submitting}
                className="w-full bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
              >
                {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Confirm
              </Button>
            </>
          )}

          {isReplicateStyle && (
            <>
              {!animatedUrl && !animating && (
                <Button
                  size="sm"
                  onClick={doAnimate}
                  className="w-full bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
                >
                  <Sparkles className="mr-1.5 h-3 w-3" />
                  Animate Image
                </Button>
              )}
              {animating && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-border bg-[#141414] p-4 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-gold)]" />
                  <div className="text-[11px] text-muted-foreground">
                    Animating image… 15-30 seconds
                  </div>
                </div>
              )}
              {animatedUrl && !animating && (
                <>
                  <video
                    src={animatedUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="aspect-video w-full rounded-md border border-border"
                  />
                  <Button
                    size="sm"
                    onClick={doConfirm}
                    disabled={submitting}
                    className="w-full bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
                  >
                    {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    Confirm
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ClientFeedbackSectionWrapper() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ClientFeedbackSection onOpen={() => setOpen(true)} />
      {open && <CommentsPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function SoundNarrativeSection({ canGenerate }: { canGenerate: boolean }) {
  const { soundStyleProfile, setSoundStyleProfile, project } = useStudio();
  const genProfile = useServerFn(generateSoundStyleProfile);
  const genNarrative = useServerFn(generateSoundNarrative);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasProfile = !!soundStyleProfile;
  const hasNarrative = !!soundStyleProfile?.narrative_arc;

  const run = async () => {
    setBusy(true);
    try {
      let profile = soundStyleProfile;
      if (!profile) {
        const res = await genProfile({ data: { projectId: project.id } });
        profile = res.profile as any;
        setSoundStyleProfile(profile as any);
      }
      if (!profile) throw new Error("Could not create sound profile");
      const res = await genNarrative({ data: { projectId: profile.project_id } });
      setSoundStyleProfile(res.profile as any);
      toast.success(
        res.cached
          ? "Narrative loaded from cache"
          : `Narrative ready (${(res as any).scenes_updated ?? 0} scenes updated)`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const arc = (soundStyleProfile?.narrative_arc as any) ?? null;
  const moments = (soundStyleProfile?.signature_moments as any[]) ?? [];

  return (
    <>
      <ActionButton
        icon={Layers}
        label={
          busy
            ? "Generating narrative..."
            : hasNarrative
              ? "Regenerate Sound Narrative"
              : "Generate Sound Narrative"
        }
        disabled={!canGenerate || busy}
        loading={busy}
        onClick={() => setConfirmOpen(true)}
      />
      {hasNarrative && arc && (
        <div className="rounded-md border border-border bg-[#0f0f0f] p-2 text-[11px] text-muted-foreground space-y-1">
          <div
            className="font-semibold uppercase tracking-wider text-[10px]"
            style={{ color: "var(--accent-gold)" }}
          >
            Narrative Arc
          </div>
          {Array.isArray(arc.acts) &&
            arc.acts.slice(0, 4).map((a: any, i: number) => (
              <div key={i}>
                <span className="text-foreground">{a.name}</span>
                {Array.isArray(a.scenes) && a.scenes.length > 0 && (
                  <span>
                    {" "}
                    (Scenes {a.scenes[0]}–{a.scenes[a.scenes.length - 1]})
                  </span>
                )}
                {a.sound_strategy && `: ${a.sound_strategy}`}
              </div>
            ))}
          {moments.slice(0, 3).map((m: any, i: number) => (
            <div key={`m${i}`} className="opacity-80">
              ◆ Scene {m.scene}: {m.moment}
            </div>
          ))}
        </div>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Design Sound Narrative?</AlertDialogTitle>
            <AlertDialogDescription>
              Analyze the full video and design a coherent sound narrative. This optimizes volume
              levels, tension, and silence across all scenes for maximum emotional impact.
              {!hasProfile && " A sound style profile will be created first."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={run}>Generate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RenderAllGraphicsButton() {
  const { motionGraphics, clips, upsertMotionGraphic } = useStudio();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });

  const pending = motionGraphics.filter((m) => {
    const c = clips.find((cl) => cl.scene_id === m.scene_id);
    return (
      m.confirmed &&
      m.render_method === "remotion" &&
      !m.remotion_output_url &&
      c?.asset_type === "motion_graphic"
    );
  });

  const handleClick = async () => {
    if (pending.length === 0) {
      toast.info("No graphics pending render.");
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: pending.length, label: "Starting..." });
    try {
      const { triggerRemotionRender } = await import("@/lib/remotion-render");
      for (let i = 0; i < pending.length; i++) {
        const mg = pending[i];
        setProgress({
          done: i,
          total: pending.length,
          label: `Rendering ${i + 1} of ${pending.length}`,
        });
        try {
          const job = await triggerRemotionRender({
            project_id: mg.project_id,
            scene_id: mg.scene_id,
            motion_graphic_id: mg.id,
            graphic_type: mg.graphic_type,
            graphic_data: mg.graphic_data as Record<string, unknown>,
            duration_seconds: 6,
          });
          await supabase
            .from("motion_graphics")
            .update({ remotion_render_job_id: job.id })
            .eq("id", mg.id);
          upsertMotionGraphic({ ...mg, remotion_render_job_id: job.id });
          // Wait for this job to complete before queuing the next
          await new Promise<void>((resolve) => {
            const channel = supabase
              .channel(`render_all_${job.id}`)
              .on(
                "postgres_changes",
                {
                  event: "UPDATE",
                  schema: "public",
                  table: "render_jobs",
                  filter: `id=eq.${job.id}`,
                },
                (payload) => {
                  const row = payload.new as {
                    status: string;
                    progress_percent: number;
                    output_url: string | null;
                  };
                  setProgress((p) => ({
                    ...p,
                    label: `Scene ${i + 1}: ${row.progress_percent}%`,
                  }));
                  if (row.status === "complete" || row.status === "failed") {
                    if (row.status === "complete" && row.output_url) {
                      const outputUrl = row.output_url;
                      void supabase
                        .from("motion_graphics")
                        .update({ remotion_output_url: outputUrl })
                        .eq("id", mg.id);
                      upsertMotionGraphic({
                        ...mg,
                        remotion_output_url: outputUrl,
                        remotion_render_job_id: job.id,
                      });
                    }
                    void supabase.removeChannel(channel);
                    resolve();
                  }
                },
              )
              .subscribe();
            // Safety timeout: 5 minutes per scene
            setTimeout(
              () => {
                void supabase.removeChannel(channel);
                resolve();
              },
              5 * 60 * 1000,
            );
          });
        } catch (e) {
          debugError("Render failed for scene", mg.scene_id, e);
        }
      }
      setProgress({ done: pending.length, total: pending.length, label: "Done" });
      toast.success(`Rendered ${pending.length} graphic(s).`);
    } finally {
      setBusy(false);
    }
  };

  const label = busy
    ? progress.label || `Rendering ${progress.done}/${progress.total}…`
    : pending.length > 0
      ? `Render All Graphics (${pending.length})`
      : "Render All Graphics";

  return (
    <>
      <ActionButton
        icon={Video}
        label={label}
        disabled={pending.length === 0 || busy}
        loading={busy}
        onClick={handleClick}
      />
      {busy && (
        <Progress
          value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
          className="h-1.5"
        />
      )}
    </>
  );
}
