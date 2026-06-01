import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Star, AlertTriangle, Check, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useStudio, type Scene } from "@/lib/studio-context";
import {
  heraLibrarySearch,
  heraGenerate,
  heraTrackUsage,
  heraPreviewPrompt,
} from "@/lib/hera.functions";

const GOLD = "#e8c547";

type HeraCacheItem = {
  id: string;
  output_url: string;
  thumbnail_url: string | null;
  prompt_text: string;
  duration_seconds: number;
  visual_job: string | null;
  emotional_temperature: string | null;
  mood_tags: string[];
  usage_count: number;
  user_rating: number | null;
  projects_used_in?: string[];
  confidence_score: number;
  match_type: string;
};

type SearchState =
  | { status: "loading" }
  | { status: "loaded"; match_type: string; results: HeraCacheItem[] }
  | { status: "error"; error: string };

export type HeraConfirmPayload = {
  cache_id: string;
  output_url: string;
  thumbnail_url: string | null;
  prompt_text: string;
  duration_seconds: number;
  from_cache: boolean;
};

// HERA_DEV_MODE lives in server-side secrets only (read by hera.functions.ts).
// The frontend never gates UI on dev mode — it always runs the real generate flow.

// Session cache keyed by scene id — avoids re-running library search when user
// flips between tabs in the same session.
const sessionSearchCache = new Map<string, { match_type: string; results: HeraCacheItem[] }>();

export function HeraFlow({
  scene,
  projectId,
  confirmedCacheId,
  onConfirm,
}: {
  scene: Scene;
  projectId: string;
  confirmedCacheId?: string | null;
  onConfirm: (payload: HeraConfirmPayload) => Promise<void> | void;
}) {
  const searchFn = useServerFn(heraLibrarySearch);
  const generateFn = useServerFn(heraGenerate);
  const trackFn = useServerFn(heraTrackUsage);
  const previewPromptFn = useServerFn(heraPreviewPrompt);

  const [search, setSearch] = useState<SearchState>(
    sessionSearchCache.has(scene.id)
      ? { status: "loaded", ...sessionSearchCache.get(scene.id)! }
      : { status: "loading" },
  );
  const [showGenerate, setShowGenerate] = useState(false);
  const [autoPrompt, setAutoPrompt] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [promptEditable, setPromptEditable] = useState(false);
  const [genState, setGenState] = useState<
    | { kind: "idle" }
    | { kind: "confirm" }
    | { kind: "generating" }
    | { kind: "complete"; result: HeraCacheItem; from_cache: boolean }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const [previewClip, setPreviewClip] = useState<HeraCacheItem | null>(null);
  const [justConfirmed, setJustConfirmed] = useState<HeraCacheItem | null>(null);
  const [rated, setRated] = useState(false);

  // Library search (once per scene per session)
  useEffect(() => {
    if (sessionSearchCache.has(scene.id)) return;
    let active = true;
    setSearch({ status: "loading" });
    searchFn({
      data: {
        visual_job: scene.visual_job ?? null,
        emotional_temperature: scene.emotional_temperature ?? null,
        mood_tags: (scene.clip_brief?.mood ?? []) as string[],
        content_tags: [],
        color_temperature: null,
        subject:
          (scene.clip_brief as any)?.subject ??
          scene.text_overlay_suggestion ??
          scene.script_text?.slice(0, 120) ??
          null,
      },
    })
      .then((res) => {
        if (!active) return;
        const payload = { match_type: res.match_type, results: (res.results as any) ?? [] };
        sessionSearchCache.set(scene.id, payload);
        setSearch({ status: "loaded", ...payload });
        if (payload.match_type === "none") setShowGenerate(true);
      })
      .catch((e) => {
        if (!active) return;
        setSearch({ status: "error", error: (e as Error).message });
        setShowGenerate(true);
      });
    return () => {
      active = false;
    };
  }, [scene.id]);

  // Build auto prompt when generation panel opens (so user can edit)
  useEffect(() => {
    if (!showGenerate || autoPrompt) return;
    previewPromptFn({
      data: {
        scene_id: scene.id,
        project_id: projectId,
        visual_job: scene.visual_job ?? null,
        emotional_temperature: scene.emotional_temperature ?? null,
        mood_tags: (scene.clip_brief?.mood ?? []) as string[],
        content_tags: [],
        subject:
          (scene.clip_brief as any)?.subject ??
          scene.text_overlay_suggestion ??
          scene.script_text?.slice(0, 120) ??
          null,
        color_temperature: null,
        camera_motion: null,
        style_profile: {},
        duration: 6,
        confirm_paid_call: false,
      },
    })
      .then((res) => {
        setAutoPrompt(res.prompt);
        setPrompt(res.prompt);
      })
      .catch(() => {});
  }, [showGenerate, autoPrompt, scene.id]);

  const handleUseLibraryClip = async (clip: HeraCacheItem) => {
    try {
      await trackFn({ data: { cache_id: clip.id, action: "used", project_id: projectId } });
      await onConfirm({
        cache_id: clip.id,
        output_url: clip.output_url,
        thumbnail_url: clip.thumbnail_url,
        prompt_text: clip.prompt_text,
        duration_seconds: clip.duration_seconds,
        from_cache: true,
      });
      setJustConfirmed(clip);
      setRated(false);
      setPreviewClip(null);
      toast.success("Library clip applied");
    } catch (e) {
      toast.error((e as Error).message || "Could not apply clip");
    }
  };

  const runGenerate = async (confirmPaid: boolean) => {
    setGenState({ kind: "generating" });
    try {
      const res = await generateFn({
        data: {
          scene_id: scene.id,
          project_id: projectId,
          visual_job: scene.visual_job ?? null,
          emotional_temperature: scene.emotional_temperature ?? null,
          mood_tags: (scene.clip_brief?.mood ?? []) as string[],
          content_tags: [],
          subject:
            (scene.clip_brief as any)?.subject ??
            scene.text_overlay_suggestion ??
            scene.script_text?.slice(0, 120) ??
            null,
          color_temperature: null,
          camera_motion: null,
          style_profile: {},
          duration: 6,
          confirm_paid_call: confirmPaid,
          prompt_override: prompt && prompt !== autoPrompt ? prompt : undefined,
        },
      });
      if ((res as any).requires_confirmation) {
        setGenState({ kind: "confirm" });
        return;
      }
      const cache = (res as any).data as HeraCacheItem | null;
      if (!cache?.output_url) throw new Error("Hera returned no clip");
      setGenState({ kind: "complete", result: cache, from_cache: !!res.from_cache });
    } catch (e) {
      setGenState({ kind: "error", message: (e as Error).message || "Generation failed" });
    }
  };

  const handleConfirmGenerated = async () => {
    if (genState.kind !== "complete") return;
    try {
      await onConfirm({
        cache_id: genState.result.id,
        output_url: genState.result.output_url,
        thumbnail_url: genState.result.thumbnail_url,
        prompt_text: genState.result.prompt_text,
        duration_seconds: genState.result.duration_seconds,
        from_cache: genState.from_cache,
      });
      setJustConfirmed(genState.result);
      setRated(false);
      toast.success("Hera clip confirmed");
    } catch (e) {
      toast.error((e as Error).message || "Could not confirm");
    }
  };

  const handleRegenerate = async () => {
    if (genState.kind === "complete") {
      // Mark the previous clip as rejected
      try {
        await trackFn({ data: { cache_id: genState.result.id, action: "rejected" } });
      } catch {
        // ignore rejection tracking failure
      }
    }
    setGenState({ kind: "confirm" });
  };

  const handleRate = async (rating: number) => {
    if (!justConfirmed) return;
    try {
      await trackFn({ data: { cache_id: justConfirmed.id, action: "rated", rating } });
      setRated(true);
      toast.success("Rating saved");
    } catch (e) {
      toast.error((e as Error).message || "Could not save rating");
    }
  };

  // If parent says we already have a confirmed clip from a previous session,
  // surface a compact confirmed state with rating prompt.
  const isPreviouslyConfirmed = !!confirmedCacheId && !justConfirmed;

  return (
    <div className="space-y-4">
      {isPreviouslyConfirmed && <ConfirmedPanel cacheId={confirmedCacheId!} />}

      {/* Library search */}
      {!isPreviouslyConfirmed && search.status === "loading" && (
        <div
          className="flex h-[60px] items-center justify-center gap-2 rounded-md border"
          style={{ borderColor: "#2a2a2a", backgroundColor: "#0a0a0a" }}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">Searching clip library…</span>
        </div>
      )}

      {!isPreviouslyConfirmed && search.status === "loaded" && search.results.length > 0 && (
        <LibraryResults
          matchType={search.match_type}
          results={search.results}
          onPreview={(c) => setPreviewClip(c)}
          onUse={handleUseLibraryClip}
          onGenerateNew={() => setShowGenerate(true)}
        />
      )}

      {/* Generation panel */}
      {!isPreviouslyConfirmed && showGenerate && (
        <GenerationPanel
          autoPrompt={autoPrompt}
          prompt={prompt}
          setPrompt={setPrompt}
          editable={promptEditable}
          setEditable={setPromptEditable}
          state={genState}
          onStart={() => runGenerate(true)}
          onConfirmPaid={() => runGenerate(true)}
          onCancelConfirm={() => setGenState({ kind: "idle" })}
          onRetry={() => setGenState({ kind: "idle" })}
          onRegenerate={handleRegenerate}
          onConfirmClip={handleConfirmGenerated}
          libraryCount={search.status === "loaded" ? search.results.length : 0}
        />
      )}

      {/* Rating prompt (after confirmation in this session) */}
      {justConfirmed && !rated && (
        <div
          className="rounded-md border p-3"
          style={{ backgroundColor: "#0a0a0a", borderColor: "#2a2a2a" }}
        >
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Rate this clip for this scene type
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => handleRate(n)}
                className="rounded p-1 hover:bg-[#1a1a1a]"
                aria-label={`${n} star`}
              >
                <Star className="h-4 w-4" style={{ color: GOLD }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview modal */}
      <Dialog open={!!previewClip} onOpenChange={(o) => !o && setPreviewClip(null)}>
        <DialogContent
          className="max-w-[600px]"
          style={{ backgroundColor: "#0a0a0a", borderColor: "#2a2a2a" }}
        >
          <DialogHeader>
            <DialogTitle className="text-sm">Library clip preview</DialogTitle>
          </DialogHeader>
          {previewClip && (
            <div className="space-y-3">
              <video
                key={previewClip.id}
                src={previewClip.output_url}
                autoPlay
                muted
                loop
                playsInline
                className="w-full rounded-md"
                style={{ aspectRatio: "16 / 9", backgroundColor: "#000" }}
              />
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <Badge>{previewClip.duration_seconds}s</Badge>
                {previewClip.visual_job && <Badge>{previewClip.visual_job}</Badge>}
                {previewClip.emotional_temperature && (
                  <Badge>{previewClip.emotional_temperature}</Badge>
                )}
                {(previewClip.mood_tags ?? []).slice(0, 4).map((m) => (
                  <Badge key={m}>{m}</Badge>
                ))}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Used {previewClip.usage_count} time{previewClip.usage_count === 1 ? "" : "s"} across{" "}
                {(previewClip.projects_used_in ?? []).length} project
                {(previewClip.projects_used_in ?? []).length === 1 ? "" : "s"}
                {previewClip.user_rating ? ` • ${"★".repeat(previewClip.user_rating)}` : ""}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setPreviewClip(null)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  style={{ backgroundColor: GOLD, color: "#000" }}
                  onClick={() => handleUseLibraryClip(previewClip)}
                >
                  Use This Clip
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: "#1a1a1a", color: "#cfcfcf", border: "1px solid #2a2a2a" }}
    >
      {children}
    </span>
  );
}

function LibraryResults({
  matchType,
  results,
  onPreview,
  onUse,
  onGenerateNew,
}: {
  matchType: string;
  results: HeraCacheItem[];
  onPreview: (c: HeraCacheItem) => void;
  onUse: (c: HeraCacheItem) => void;
  onGenerateNew: () => void;
}) {
  const top = results[0]?.confidence_score ?? 0;
  let tier: "strong" | "suggested" | "broad";
  if (matchType === "exact" || top >= 85) tier = "strong";
  else if (top >= 70) tier = "suggested";
  else tier = "broad";

  const cfg =
    tier === "strong"
      ? {
          title: "LIBRARY MATCH FOUND",
          titleColor: "#4caf50",
          subtitle: "Using an existing clip saves Hera credits",
          badgeColor: "#4caf50",
          generateLabel: "Generate a new clip instead →",
          generateColor: "#888",
          max: 2,
        }
      : tier === "suggested"
        ? {
            title: "SIMILAR CLIPS IN LIBRARY",
            titleColor: GOLD,
            subtitle: "Not exact matches — preview before using",
            badgeColor: GOLD,
            generateLabel: "Generate a more precise clip →",
            generateColor: GOLD,
            max: 3,
          }
        : {
            title: "CLIPS FROM SIMILAR SCENES",
            titleColor: "#888",
            subtitle: "Low confidence — these may not fit this scene",
            badgeColor: "#888",
            generateLabel: "These may not fit — generate a new clip instead →",
            generateColor: GOLD,
            max: 3,
          };

  const shown = results.slice(0, cfg.max);

  return (
    <div className="space-y-2">
      <div>
        <div
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: cfg.titleColor }}
        >
          {cfg.title}
        </div>
        <div className="text-[11px] text-muted-foreground">{cfg.subtitle}</div>
      </div>
      <div className={cn("grid gap-2", cfg.max === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {shown.map((c) => (
          <MatchCard
            key={c.id}
            clip={c}
            badgeColor={cfg.badgeColor}
            onPreview={() => onPreview(c)}
            onUse={() => onUse(c)}
          />
        ))}
      </div>
      <div className="border-t pt-2" style={{ borderColor: "#2a2a2a" }}>
        <button
          onClick={onGenerateNew}
          className="text-[11px] font-medium hover:underline"
          style={{ color: cfg.generateColor }}
        >
          {cfg.generateLabel}
        </button>
      </div>
    </div>
  );
}

function MatchCard({
  clip,
  badgeColor,
  onPreview,
  onUse,
}: {
  clip: HeraCacheItem;
  badgeColor: string;
  onPreview: () => void;
  onUse: () => void;
}) {
  const summary = useMemo(
    () => clip.prompt_text.split(/\s+/).slice(0, 10).join(" "),
    [clip.prompt_text],
  );
  return (
    <div
      className="flex flex-col gap-2 rounded-md border p-2"
      style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" }}
    >
      <div
        className="relative w-full overflow-hidden rounded"
        style={{ aspectRatio: "16 / 9", backgroundColor: "#000" }}
      >
        {clip.thumbnail_url ? (
          <img src={clip.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
            {clip.duration_seconds}s
          </div>
        )}
      </div>
      <span
        className="self-start rounded px-1.5 py-0.5 text-[10px] font-semibold"
        style={{ backgroundColor: `${badgeColor}22`, color: badgeColor }}
      >
        {clip.confidence_score}% match
      </span>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Used {clip.usage_count}×</span>
        {clip.user_rating ? (
          <span style={{ color: GOLD }}>{"★".repeat(clip.user_rating)}</span>
        ) : null}
      </div>
      <p className="line-clamp-2 text-[10.5px] leading-snug text-foreground/85">{summary}</p>
      <div className="mt-auto flex gap-1.5">
        <Button variant="outline" size="sm" className="h-7 flex-1 text-[10px]" onClick={onPreview}>
          Preview
        </Button>
        <Button
          size="sm"
          className="h-7 flex-1 text-[10px]"
          style={{ backgroundColor: GOLD, color: "#000" }}
          onClick={onUse}
        >
          Use This Clip
        </Button>
      </div>
    </div>
  );
}

function GenerationPanel({
  autoPrompt,
  prompt,
  setPrompt,
  editable,
  setEditable,
  state,
  onStart,
  onConfirmPaid,
  onCancelConfirm,
  onRetry,
  onRegenerate,
  onConfirmClip,
  libraryCount,
}: {
  autoPrompt: string;
  prompt: string;
  setPrompt: (s: string) => void;
  editable: boolean;
  setEditable: (b: boolean) => void;
  state:
    | { kind: "idle" }
    | { kind: "confirm" }
    | { kind: "generating" }
    | { kind: "complete"; result: HeraCacheItem; from_cache: boolean }
    | { kind: "error"; message: string };
  onStart: () => void;
  onConfirmPaid: () => void;
  onCancelConfirm: () => void;
  onRetry: () => void;
  onRegenerate: () => void;
  onConfirmClip: () => void;
  libraryCount: number;
}) {
  return (
    <div className="space-y-3 border-t pt-3" style={{ borderColor: "#2a2a2a" }}>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Generated Prompt
        </div>
        <div className="text-[11px] text-muted-foreground">
          Auto-built from your scene data and style profile
        </div>
      </div>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        readOnly={!editable}
        className="min-h-[120px] font-mono text-[12px]"
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[10px]"
          onClick={() => setPrompt(autoPrompt)}
        >
          <RotateCw className="mr-1 h-3 w-3" /> Reset to Auto
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={() => setEditable(!editable)}
        >
          {editable ? "Done Editing" : "Edit"}
        </Button>
      </div>

      {state.kind === "confirm" && (
        <div
          className="rounded-md border p-4"
          style={{ backgroundColor: "#1a1100", borderColor: GOLD }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" style={{ color: GOLD }} />
            <span className="text-[11px] font-bold" style={{ color: GOLD }}>
              Development Mode Active
            </span>
          </div>
          <p className="text-[11px] text-foreground/85">Generating will use 1 Hera credit.</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Library clips available: {libraryCount}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={onCancelConfirm}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-[10px]"
              style={{ backgroundColor: GOLD, color: "#000" }}
              onClick={onConfirmPaid}
            >
              Use 1 Credit — Generate
            </Button>
          </div>
        </div>
      )}

      {state.kind === "idle" && (
        <Button
          size="sm"
          className="w-full text-[11px]"
          style={{ backgroundColor: GOLD, color: "#000" }}
          onClick={onStart}
          disabled={!prompt}
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" /> Generate with Hera.video
        </Button>
      )}

      {state.kind === "generating" && (
        <div
          className="flex flex-col items-center gap-1 rounded-md border p-4"
          style={{ backgroundColor: "#0a0a0a", borderColor: "#2a2a2a" }}
        >
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
          <div className="text-[12px] font-semibold" style={{ color: GOLD }}>
            Generating clip…
          </div>
          <div className="text-[10px] text-muted-foreground">This takes 20–40 seconds</div>
        </div>
      )}

      {state.kind === "complete" && (
        <div className="space-y-2">
          <video
            key={state.result.id}
            src={state.result.output_url}
            autoPlay
            muted
            loop
            playsInline
            className="w-full rounded-md"
            style={{ aspectRatio: "16 / 9", backgroundColor: "#000" }}
          />
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#4caf50" }}>
            <Check className="h-3.5 w-3.5" />
            Clip generated successfully {state.from_cache && "(from cache)"}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={onRegenerate}>
              Regenerate
            </Button>
            <Button
              size="sm"
              className="h-7 text-[10px]"
              style={{ backgroundColor: GOLD, color: "#000" }}
              onClick={onConfirmClip}
            >
              Confirm This Clip
            </Button>
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div
          className="space-y-2 rounded-md border p-3"
          style={{ backgroundColor: "#1a0a0a", borderColor: "#5a1a1a" }}
        >
          <div className="text-[11px]" style={{ color: "#f44336" }}>
            {state.message || "Generation failed. Please try again."}
          </div>
          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={onRetry}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}

function ConfirmedPanel({ cacheId }: { cacheId: string }) {
  // Just a placeholder marker — the parent component already shows the
  // confirmed clip preview in its own ConfirmedState. This is included so
  // the HeraFlow can be embedded standalone if needed.
  return (
    <div
      className="rounded-md border p-2 text-[11px] text-muted-foreground"
      style={{ borderColor: "#2a2a2a" }}
    >
      Using Hera clip {cacheId.slice(0, 8)}…
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right-panel mini-section: Hera Library budget
// ─────────────────────────────────────────────────────────────────────────────

export function HeraBudgetPanel() {
  const { motionGraphics, project } = useStudio();
  const [stats, setStats] = useState<{
    total: number;
    inProject: number;
    creditsSaved: number;
  } | null>(null);

  // re-fetch when the set of hera_cache_ids referenced in this project changes
  const heraIdsKey = motionGraphics
    .filter((m) => m.hera_cache_id)
    .map((m) => m.hera_cache_id)
    .sort()
    .join(",");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: rows } = await (supabase as any)
          .from("hera_cache")
          .select("id, usage_count, projects_used_in");
        if (!active || !rows) return;
        const total = rows.length;
        const inProjectRows = rows.filter((r: any) =>
          (r.projects_used_in ?? []).includes(project.id),
        );
        const inProject = inProjectRows.length;
        const creditsSaved = inProjectRows.reduce(
          (sum: number, r: any) => sum + Math.max(0, (r.usage_count ?? 0) - 1),
          0,
        );
        setStats({ total, inProject, creditsSaved });
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, [project.id, heraIdsKey]);

  return (
    <div className="space-y-1.5 border-t pt-3" style={{ borderColor: "#2a2a2a" }}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Hera Library
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Stat label="Library clips" value={stats?.total ?? 0} />
        <Stat label="This project" value={stats?.inProject ?? 0} />
        <Stat label="Credits saved" value={stats?.creditsSaved ?? 0} accent />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className="rounded-md border p-2"
      style={{ backgroundColor: "#0a0a0a", borderColor: "#2a2a2a" }}
    >
      <div className="text-[14px] font-semibold" style={{ color: accent ? GOLD : "#f0f0f0" }}>
        {value}
      </div>
      <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
