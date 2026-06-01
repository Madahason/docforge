import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CONTENT_TYPES, EDITING_STYLES } from "@/lib/project-options";
import { WORDS_PER_CHUNK } from "@/lib/script-chunking";
import { toast } from "sonner";
import type { ProjectRow } from "@/components/ProjectCard";
import { useWalkthroughGate } from "@/lib/walkthrough-context";

export const Route = createFileRoute("/_app/projects/new")({
  component: NewProjectPage,
});

type TextOverlay = "minimal" | "selective" | "heavy";
type ClipSource = "youtube_first" | "stock_youtube" | "youtube_only";
type MusicIntensity = "atmospheric" | "moderate" | "driving";
type OpeningStructure = "cold_open" | "scene_setting" | "data_hook" | "question_hook";
type TargetDuration = "5min" | "8min" | "12min" | "15min_plus";

const DURATIONS: { value: TargetDuration; label: string }[] = [
  { value: "5min", label: "5 min" },
  { value: "8min", label: "8 min" },
  { value: "12min", label: "12 min" },
  { value: "15min_plus", label: "15 min+" },
];

const PLATFORMS = ["YouTube", "YouTube Shorts", "LinkedIn", "Twitter"] as const;
type Platform = (typeof PLATFORMS)[number];

const OPENINGS: { value: OpeningStructure; label: string; tooltip: string }[] = [
  { value: "cold_open", label: "Cold Open", tooltip: "Drop into the crisis before any context" },
  {
    value: "scene_setting",
    label: "Scene Setting",
    tooltip: "Establish the world before the conflict",
  },
  { value: "data_hook", label: "Data Hook", tooltip: "Open with a shocking statistic" },
  {
    value: "question_hook",
    label: "Question Hook",
    tooltip: "Open with a question the video will answer",
  },
];

const DURATION_TARGET_MIN: Record<TargetDuration, number> = {
  "5min": 5,
  "8min": 8,
  "12min": 12,
  "15min_plus": 15,
};

function NewProjectPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Load default style profile once, cache per session
  const { data: styleProfile, isLoading: spLoading } = useQuery({
    queryKey: ["style_profile_default", user?.id],
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("style_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_default", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Form state
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<string | null>(null);
  const [targetDuration, setTargetDuration] = useState<TargetDuration>("8min");
  const [platforms, setPlatforms] = useState<Platform[]>(["YouTube"]);
  const [editingStyle, setEditingStyle] = useState<string>("cinematic");
  const [opening, setOpening] = useState<OpeningStructure>("cold_open");
  const [pacing, setPacing] = useState(5);
  const [musicOn, setMusicOn] = useState(true);
  const [musicIntensity, setMusicIntensity] = useState<MusicIntensity>("moderate");
  const [textOverlay, setTextOverlay] = useState<TextOverlay>("selective");
  const [clipSource, setClipSource] = useState<ClipSource>("youtube_first");
  const [script, setScript] = useState("");

  const [hydrated, setHydrated] = useState(false);
  const [titleErr, setTitleErr] = useState(false);
  const [scriptErr, setScriptErr] = useState(false);
  const [submitting, setSubmitting] = useState<"draft" | "create" | null>(null);

  // Walkthrough gate: script step requires non-empty script
  useWalkthroughGate("script-textarea", script.trim().length > 0);

  // Hydrate from style profile once
  if (styleProfile && !hydrated) {
    if (styleProfile.content_type) setContentType(styleProfile.content_type);
    if (styleProfile.editing_style) setEditingStyle(styleProfile.editing_style);
    if (typeof styleProfile.pacing_intensity === "number") setPacing(styleProfile.pacing_intensity);
    if (styleProfile.music_intensity)
      setMusicIntensity(styleProfile.music_intensity as MusicIntensity);
    if (styleProfile.text_overlay_frequency)
      setTextOverlay(styleProfile.text_overlay_frequency as TextOverlay);
    if (styleProfile.clip_source_ratio) setClipSource(styleProfile.clip_source_ratio as ClipSource);
    setHydrated(true);
  }

  const { words, chars, estSec } = useMemo(() => {
    const trimmed = script.trim();
    const wordCount = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
    return {
      words: wordCount,
      chars: script.length,
      estSec: Math.round((wordCount / 150) * 60),
    };
  }, [script]);

  const estColor = useMemo(() => {
    if (words === 0) return "var(--text-muted)";
    const targetMin = DURATION_TARGET_MIN[targetDuration];
    const estMin = estSec / 60;
    const diff = Math.abs(estMin - targetMin) / targetMin;
    if (diff <= 0.2) return "var(--success)";
    if (diff <= 0.4) return "var(--accent-gold)";
    return "var(--error)";
  }, [estSec, words, targetDuration]);
  const chunkEstimate = Math.ceil(words / WORDS_PER_CHUNK);

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const buildPayload = (status: "draft" | "in_production") => ({
    user_id: user!.id,
    title: title.trim() || "Untitled",
    status,
    content_type: contentType,
    target_duration: targetDuration,
    platform_targets: platforms,
    style_profile_id: styleProfile?.id ?? null,
    opening_structure: opening,
    pacing_intensity: pacing,
    music_on: musicOn,
    music_intensity: musicOn ? musicIntensity : null,
    text_overlay_frequency: textOverlay,
    clip_source: clipSource,
    script_raw: script || null,
    completion_percent: 0,
  });

  const pushToProjectsCache = (row: ProjectRow) => {
    qc.setQueryData<ProjectRow[] | undefined>(["projects", user?.id], (prev) =>
      prev ? [row, ...prev] : [row],
    );
  };

  const handleSaveDraft = async () => {
    if (!user) return;
    setSubmitting("draft");
    const { data, error } = await supabase
      .from("projects")
      .insert(buildPayload("draft"))
      .select("id,title,status,content_type,completion_percent,thumbnail_url,updated_at")
      .single();
    setSubmitting(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    pushToProjectsCache(data as ProjectRow);
    toast.success("Draft saved");
    navigate({ to: "/projects" });
  };

  const handleCreate = async () => {
    if (!user) return;
    const noTitle = !title.trim();
    const noScript = !script.trim();
    setTitleErr(noTitle);
    setScriptErr(noScript);
    if (noTitle || noScript) return;
    setSubmitting("create");
    const { data, error } = await supabase
      .from("projects")
      .insert(buildPayload("in_production"))
      .select("id,title,status,content_type,completion_percent,thumbnail_url,updated_at")
      .single();
    setSubmitting(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    pushToProjectsCache(data as ProjectRow);
    toast.success("Project created");
    navigate({ to: "/projects/$projectId", params: { projectId: (data as { id: string }).id } });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto w-full max-w-[720px] px-6 pb-16 pt-6">
        <Link
          to="/projects"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
          <p className="mt-1 text-sm text-muted-foreground">Set up your documentary project</p>
        </div>

        {/* Section 1 — Project Details */}
        <Section label="Project Details">
          <Field label="Project Title" error={titleErr ? "Project title is required" : undefined}>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleErr) setTitleErr(false);
              }}
              placeholder="e.g. The Rise and Fall of WeWork"
              className="bg-[var(--surface)]"
            />
          </Field>

          <Field label="Content Type">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CONTENT_TYPES.map((c) => {
                const Icon = c.icon;
                const selected = contentType === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setContentType(c.id)}
                    className={cn(
                      "flex flex-col items-start rounded-md border p-3.5 text-left transition-colors",
                      selected
                        ? "border-[var(--accent-gold)] bg-[var(--surface-elevated)]"
                        : "border-border bg-[var(--surface)] hover:bg-[var(--surface-elevated)]",
                    )}
                  >
                    <Icon
                      className="mb-2 h-4 w-4"
                      style={{ color: selected ? "var(--accent-gold)" : "var(--text-muted)" }}
                    />
                    <div className="text-sm font-semibold">{c.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{c.description}</div>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Target Duration">
            <PillToggle value={targetDuration} onChange={setTargetDuration} options={DURATIONS} />
          </Field>

          <Field label="Publishing Platforms" subtext="Select all that apply">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const selected = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                      selected
                        ? "border-[var(--accent-gold)] bg-[var(--accent-gold)] text-[var(--background)]"
                        : "border-border bg-[var(--surface)] text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </Field>
        </Section>

        {/* Section 2 — Style Settings */}
        <Section
          label="Style Settings"
          subtitle={
            spLoading
              ? "Loading defaults…"
              : "Inherited from your default profile. Adjust for this project if needed."
          }
        >
          <Field label="Editing Style">
            <div data-walkthrough="editing-style">
              <Select value={editingStyle} onValueChange={setEditingStyle}>
                <SelectTrigger className="bg-[var(--surface)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDITING_STYLES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Field>

          <Field label="Opening Structure">
            <div className="flex flex-wrap gap-2">
              {OPENINGS.map((o) => {
                const selected = opening === o.value;
                return (
                  <Tooltip key={o.value}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setOpening(o.value)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                          selected
                            ? "border-[var(--accent-gold)] bg-[var(--accent-gold)] text-[var(--background)]"
                            : "border-border bg-[var(--surface)] text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {o.label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{o.tooltip}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </Field>

          <Field label="Pacing Intensity">
            <Slider
              value={[pacing]}
              onValueChange={(v) => setPacing(v[0])}
              min={1}
              max={10}
              step={1}
            />
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>Deliberate</span>
              <span style={{ color: "var(--accent-gold)" }}>{pacing}</span>
              <span>Aggressive</span>
            </div>
          </Field>

          <Field label="Music">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={musicOn} onCheckedChange={setMusicOn} />
                <span className="text-xs text-muted-foreground">{musicOn ? "On" : "Off"}</span>
              </div>
              {musicOn && (
                <PillToggle<MusicIntensity>
                  value={musicIntensity}
                  onChange={setMusicIntensity}
                  options={[
                    { value: "atmospheric", label: "Atmospheric" },
                    { value: "moderate", label: "Moderate" },
                    { value: "driving", label: "Driving" },
                  ]}
                />
              )}
            </div>
          </Field>

          <Field label="Text Overlays">
            <PillToggle<TextOverlay>
              value={textOverlay}
              onChange={setTextOverlay}
              options={[
                { value: "minimal", label: "Minimal" },
                { value: "selective", label: "Selective" },
                { value: "heavy", label: "Heavy" },
              ]}
            />
          </Field>

          <Field label="Clip Source Priority">
            <PillToggle<ClipSource>
              value={clipSource}
              onChange={setClipSource}
              options={[
                { value: "youtube_first", label: "YouTube First" },
                { value: "stock_youtube", label: "Stock + YouTube" },
                { value: "youtube_only", label: "YouTube Only" },
              ]}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              AI generation available manually per scene
            </p>
          </Field>
        </Section>

        {/* Section 3 — Script */}
        <Section label="Script">
          <div>
            <Textarea
              data-walkthrough="script-textarea"
              value={script}
              onChange={(e) => {
                setScript(e.target.value);
                if (scriptErr) setScriptErr(false);
              }}
              placeholder={
                "Paste your documentary script here...\n\nThe script analyzer will break it into scenes, identify emotional temperature, assign visual jobs, and generate clip briefs for each scene."
              }
              className={cn(
                "min-h-[320px] resize-y bg-[var(--surface)] font-mono text-sm",
                scriptErr && "border-[var(--error)]",
              )}
              style={{ lineHeight: 1.7 }}
            />

            <div className="mt-2 flex items-start justify-between text-[11px] text-muted-foreground">
              <div className="flex flex-col gap-0.5">
                <span>{words} words</span>
                <span style={{ color: estColor }}>
                  ≈ {Math.floor(estSec / 60)} min {estSec % 60} sec at 150 WPM
                </span>
                {words > WORDS_PER_CHUNK && (
                  <span>Long script — will be analyzed in ~{chunkEstimate} parts</span>
                )}
              </div>
              <span>{chars} characters</span>
            </div>
            {scriptErr && (
              <p className="mt-2 text-xs" style={{ color: "var(--error)" }}>
                Script is required to create a project
              </p>
            )}
          </div>
        </Section>

        {/* Bottom actions */}
        <div className="mt-8 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            disabled={submitting !== null}
            onClick={handleSaveDraft}
            className="border-border bg-transparent"
          >
            {submitting === "draft" ? "Saving…" : "Save Draft"}
          </Button>
          <Button
            disabled={submitting !== null}
            onClick={handleCreate}
            className="bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
          >
            {submitting === "create" ? "Creating…" : "Create Project"}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Section({
  label,
  subtitle,
  children,
}: {
  label: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-8 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </div>
        {subtitle && <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  subtext,
  error,
  children,
}: {
  label: string;
  subtext?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2">
        <div className="text-sm font-medium">{label}</div>
        {subtext && <div className="mt-0.5 text-xs text-muted-foreground">{subtext}</div>}
      </div>
      {children}
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function PillToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-md border border-border bg-[var(--surface)] p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-[var(--accent-gold)] text-[var(--background)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
