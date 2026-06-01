import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Film, Play, Search, Star, X, Check, ChevronDown, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  TEMPERATURE_COLORS,
  VISUAL_JOB_COLORS,
  type EmotionalTemperature,
  type VisualJob,
} from "@/lib/studio-context";
import { heraTrackUsage } from "@/lib/hera.functions";
import { cn } from "@/lib/utils";

type HeraClip = {
  id: string;
  prompt_text: string;
  output_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  resolution: string;
  visual_job: string | null;
  emotional_temperature: string | null;
  mood_tags: string[];
  content_tags: string[];
  color_temperature: string | null;
  subject: string | null;
  camera_motion: string | null;
  style_profile_name: string | null;
  editing_style: string | null;
  match_keywords: string[];
  usage_count: number;
  last_used_at: string | null;
  projects_used_in: string[];
  user_rating: number | null;
  regeneration_count: number;
  created_at: string;
};

const VISUAL_JOBS: VisualJob[] = ["atmosphere", "evidence", "authority", "counterpoint"];
const TEMPERATURES: EmotionalTemperature[] = [
  "cold",
  "tense",
  "revelatory",
  "heavy",
  "urgent",
  "contemplative",
];

type SortKey = "most_used" | "highest_rated" | "most_recent" | "longest" | "best_match";

function formatRuntime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function normalizeJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string") as string[];
  return [];
}

function normalizeClip(raw: any): HeraClip {
  return {
    id: raw.id,
    prompt_text: raw.prompt_text ?? "",
    output_url: raw.output_url ?? "",
    thumbnail_url: raw.thumbnail_url ?? null,
    duration_seconds: raw.duration_seconds ?? 6,
    resolution: raw.resolution ?? "1080p",
    visual_job: raw.visual_job ?? null,
    emotional_temperature: raw.emotional_temperature ?? null,
    mood_tags: normalizeJsonArray(raw.mood_tags),
    content_tags: normalizeJsonArray(raw.content_tags),
    color_temperature: raw.color_temperature ?? null,
    subject: raw.subject ?? null,
    camera_motion: raw.camera_motion ?? null,
    style_profile_name: raw.style_profile_name ?? null,
    editing_style: raw.editing_style ?? null,
    match_keywords: normalizeJsonArray(raw.match_keywords),
    usage_count: raw.usage_count ?? 0,
    last_used_at: raw.last_used_at ?? null,
    projects_used_in: normalizeJsonArray(raw.projects_used_in),
    user_rating: raw.user_rating ?? null,
    regeneration_count: raw.regeneration_count ?? 0,
    created_at: raw.created_at,
  };
}

export function HeraLibraryTab() {
  const navigate = useNavigate();
  const trackUsage = useServerFn(heraTrackUsage);

  const [clips, setClips] = useState<HeraClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState<Set<string>>(new Set(VISUAL_JOBS));
  const [tempFilter, setTempFilter] = useState<Set<string>>(new Set(TEMPERATURES));
  const [moodFilter, setMoodFilter] = useState<Set<string>>(new Set());
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<SortKey>("most_used");
  const [visibleCount, setVisibleCount] = useState(24);

  const [previewClip, setPreviewClip] = useState<HeraClip | null>(null);
  const [editTagsClip, setEditTagsClip] = useState<HeraClip | null>(null);
  const [useInProjectClip, setUseInProjectClip] = useState<HeraClip | null>(null);

  // Load once on mount
  const fetchClips = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hera_cache" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load Hera library");
    } else {
      setClips((data ?? []).map(normalizeClip));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClips();
    // Realtime
    const channel = supabase
      .channel("hera_cache_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "hera_cache" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setClips((prev) => [normalizeClip(payload.new), ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setClips((prev) =>
            prev.map((c) => (c.id === (payload.new as any).id ? normalizeClip(payload.new) : c)),
          );
        } else if (payload.eventType === "DELETE") {
          setClips((prev) => prev.filter((c) => c.id !== (payload.old as any).id));
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allMoodTags = useMemo(() => {
    const s = new Set<string>();
    clips.forEach((c) => c.mood_tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [clips]);

  // Client-side filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = clips.filter((c) => {
      if (q) {
        const hay = [c.prompt_text, c.subject ?? "", ...c.match_keywords, ...c.mood_tags]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (c.visual_job && !jobFilter.has(c.visual_job)) return false;
      if (!c.visual_job && jobFilter.size !== VISUAL_JOBS.length) return false;
      if (c.emotional_temperature && !tempFilter.has(c.emotional_temperature)) return false;
      if (!c.emotional_temperature && tempFilter.size !== TEMPERATURES.length) return false;
      if (moodFilter.size > 0) {
        const has = c.mood_tags.some((t) => moodFilter.has(t));
        if (!has) return false;
      }
      if (minRating > 0 && (c.user_rating ?? 0) < minRating) return false;
      return true;
    });

    const sorters: Record<SortKey, (a: HeraClip, b: HeraClip) => number> = {
      most_used: (a, b) => b.usage_count - a.usage_count,
      highest_rated: (a, b) => (b.user_rating ?? 0) - (a.user_rating ?? 0),
      most_recent: (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
      longest: (a, b) => b.duration_seconds - a.duration_seconds,
      best_match: (a, b) => {
        if (!q) return 0;
        const score = (c: HeraClip) => {
          const hay = [c.prompt_text, c.subject ?? "", ...c.match_keywords].join(" ").toLowerCase();
          return (hay.match(new RegExp(q, "g")) ?? []).length;
        };
        return score(b) - score(a);
      },
    };
    result = [...result].sort(sorters[sort]);
    return result;
  }, [clips, search, jobFilter, tempFilter, moodFilter, minRating, sort]);

  // Reset render window when filters/sort change
  useEffect(() => {
    setVisibleCount(24);
  }, [search, jobFilter, tempFilter, moodFilter, minRating, sort]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const stats = useMemo(() => {
    const totalRuntime = clips.reduce((s, c) => s + c.duration_seconds, 0);
    const creditsSaved = clips.reduce((s, c) => s + (c.usage_count > 1 ? c.usage_count - 1 : 0), 0);
    const rated = clips.filter((c) => c.user_rating != null);
    const avgRating =
      rated.length > 0 ? rated.reduce((s, c) => s + (c.user_rating ?? 0), 0) / rated.length : null;
    return { total: clips.length, totalRuntime, creditsSaved, avgRating };
  }, [clips]);

  const togglePill = (set: Set<string>, setter: (s: Set<string>) => void, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const resetFilters = () => {
    setSearch("");
    setJobFilter(new Set(VISUAL_JOBS));
    setTempFilter(new Set(TEMPERATURES));
    setMoodFilter(new Set());
    setMinRating(0);
    setSort("most_used");
  };

  const handleTagsSaved = (updated: HeraClip) => {
    setClips((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setEditTagsClip(null);
    toast.success("Tags updated");
  };

  const handleClipUsed = async (
    clip: HeraClip,
    projectId: string,
    sceneId: string,
    projectName: string,
    sceneNumber: number,
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not signed in");
      return;
    }
    const { error } = await supabase.from("clips" as any).insert({
      user_id: user.id,
      project_id: projectId,
      scene_id: sceneId,
      asset_type: "hera",
      source_url: clip.output_url,
      thumbnail_url: clip.thumbnail_url,
      duration_seconds: clip.duration_seconds,
      status: "sourced",
      fetch_status: "ready",
      resolution: clip.resolution,
      visual_job: clip.visual_job,
      mood_tags: clip.mood_tags,
      content_tags: clip.content_tags,
    });
    if (error) {
      toast.error("Failed to add clip");
      return;
    }
    try {
      await trackUsage({ data: { cache_id: clip.id, action: "used", project_id: projectId } });
    } catch {
      // non-fatal
    }
    toast.success(`Clip added to ${projectName} · Scene ${sceneNumber}`, {
      icon: <Check className="h-4 w-4 text-green-500" />,
    });
    setUseInProjectClip(null);
    setPreviewClip(null);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading Hera library…
      </div>
    );
  }

  return (
    <TooltipProvider>
      {/* Stats bar */}
      <div
        className="-mx-6 mb-6 flex flex-wrap items-center gap-8 border-b px-6 py-4"
        style={{ background: "#141414", borderColor: "#2a2a2a" }}
      >
        <Stat label="Total Clips" value={String(stats.total)} />
        <Stat label="Total Runtime" value={formatRuntime(stats.totalRuntime)} />
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Stat label="Credits Saved" value={String(stats.creditsSaved)} />
            </div>
          </TooltipTrigger>
          <TooltipContent>Each reuse of a cached clip saves 1 Hera credit</TooltipContent>
        </Tooltip>
        {stats.avgRating != null && (
          <Stat label="Avg Rating" value={`${stats.avgRating.toFixed(1)} ★`} />
        )}
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={fetchClips}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Filter library
          </p>

          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search prompts, subjects, tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <FilterGroup label="Visual Job">
            <div className="flex flex-wrap gap-1.5">
              {VISUAL_JOBS.map((j) => (
                <Pill
                  key={j}
                  active={jobFilter.has(j)}
                  color={VISUAL_JOB_COLORS[j]}
                  onClick={() => togglePill(jobFilter, setJobFilter, j)}
                >
                  {j}
                </Pill>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="Temperature">
            <div className="flex flex-wrap gap-1.5">
              {TEMPERATURES.map((t) => (
                <Pill
                  key={t}
                  active={tempFilter.has(t)}
                  color={TEMPERATURE_COLORS[t]}
                  onClick={() => togglePill(tempFilter, setTempFilter, t)}
                >
                  {t}
                </Pill>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="Mood">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span className="truncate">
                    {moodFilter.size > 0 ? `${moodFilter.size} selected` : "Select mood tags..."}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="max-h-60 overflow-y-auto">
                  {allMoodTags.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-muted-foreground">No mood tags yet</p>
                  ) : (
                    allMoodTags.map((tag) => (
                      <label
                        key={tag}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          checked={moodFilter.has(tag)}
                          onChange={() => togglePill(moodFilter, setMoodFilter, tag)}
                        />
                        <span>{tag}</span>
                      </label>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </FilterGroup>

          <FilterGroup label="Minimum Rating">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMinRating(minRating === n ? 0 : n)}
                  className="p-0.5"
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      n <= minRating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground",
                    )}
                  />
                </button>
              ))}
              {minRating > 0 && (
                <button
                  type="button"
                  onClick={() => setMinRating(0)}
                  className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Any rating
                </button>
              )}
            </div>
          </FilterGroup>

          <FilterGroup label="Sort By">
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="most_used">Most Used</SelectItem>
                <SelectItem value="highest_rated">Highest Rated</SelectItem>
                <SelectItem value="most_recent">Most Recent</SelectItem>
                <SelectItem value="longest">Longest Runtime</SelectItem>
                {search.trim() && <SelectItem value="best_match">Best Match</SelectItem>}
              </SelectContent>
            </Select>
          </FilterGroup>

          <button
            type="button"
            onClick={resetFilters}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Reset Filters
          </button>
        </aside>

        {/* Main grid */}
        <main className="min-w-0 flex-1">
          {clips.length === 0 ? (
            <EmptyState onGo={() => navigate({ to: "/projects" })} />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Showing {filtered.length} of {clips.length} clips
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    onPreview={() => setPreviewClip(clip)}
                    onUse={() => setUseInProjectClip(clip)}
                    onEditTags={() => setEditTagsClip(clip)}
                  />
                ))}
              </div>
              {visible.length < filtered.length && (
                <div className="mt-6 flex justify-center">
                  <Button variant="outline" onClick={() => setVisibleCount((n) => n + 24)}>
                    Load more ({filtered.length - visible.length} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Preview modal */}
      {previewClip && (
        <PreviewModal
          clip={previewClip}
          onClose={() => setPreviewClip(null)}
          onUse={() => {
            setUseInProjectClip(previewClip);
          }}
          onEditTags={() => {
            setEditTagsClip(previewClip);
            setPreviewClip(null);
          }}
        />
      )}

      {/* Edit tags modal */}
      {editTagsClip && (
        <EditTagsModal
          clip={editTagsClip}
          onClose={() => setEditTagsClip(null)}
          onSaved={handleTagsSaved}
        />
      )}

      {/* Use in project modal */}
      {useInProjectClip && (
        <UseInProjectModal
          clip={useInProjectClip}
          onClose={() => setUseInProjectClip(null)}
          onConfirm={handleClipUsed}
        />
      )}
    </TooltipProvider>
  );
}

// ───────────────────────────────────────────────────────────────────
// Subcomponents
// ───────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{label}</p>
      {children}
    </div>
  );
}

function Pill({
  active,
  color,
  children,
  onClick,
}: {
  active: boolean;
  color?: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs capitalize transition-colors",
        active
          ? "border-transparent text-background"
          : "border-border bg-transparent text-muted-foreground hover:text-foreground",
      )}
      style={active && color ? { background: color } : undefined}
    >
      {children}
    </button>
  );
}

function ClipCard({
  clip,
  onPreview,
  onUse,
  onEditTags,
}: {
  clip: HeraClip;
  onPreview: () => void;
  onUse: () => void;
  onEditTags: () => void;
}) {
  return (
    <div
      className="group overflow-hidden rounded-lg border"
      style={{ background: "#141414", borderColor: "#2a2a2a" }}
    >
      <div className="relative aspect-video bg-black">
        {clip.thumbnail_url ? (
          <img
            src={clip.thumbnail_url}
            alt="Clip thumbnail"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Play className="h-10 w-10 text-muted-foreground" />
          </div>
        )}

        <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {clip.duration_seconds}s
        </span>

        {clip.usage_count > 5 && (
          <Badge
            className="absolute right-2 top-2"
            style={{ background: "var(--accent-gold)", color: "#000" }}
          >
            Popular
          </Badge>
        )}
        {clip.usage_count === 0 && (
          <Badge variant="secondary" className="absolute right-2 top-2">
            Unused
          </Badge>
        )}

        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreview}
            style={{ borderColor: "var(--accent-gold)", color: "var(--accent-gold)" }}
          >
            <Play className="mr-1 h-3 w-3" /> Preview
          </Button>
          <Button
            size="sm"
            onClick={onUse}
            style={{ background: "var(--accent-gold)", color: "#000" }}
          >
            Use in Project
          </Button>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex flex-wrap gap-1">
          {clip.visual_job && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium capitalize"
              style={{
                background: `${VISUAL_JOB_COLORS[clip.visual_job as VisualJob] ?? "#666"}22`,
                color: VISUAL_JOB_COLORS[clip.visual_job as VisualJob] ?? "#aaa",
              }}
            >
              {clip.visual_job}
            </span>
          )}
          {clip.emotional_temperature && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium capitalize"
              style={{
                background: `${TEMPERATURE_COLORS[clip.emotional_temperature as EmotionalTemperature] ?? "#666"}22`,
                color:
                  TEMPERATURE_COLORS[clip.emotional_temperature as EmotionalTemperature] ?? "#aaa",
              }}
            >
              {clip.emotional_temperature}
            </span>
          )}
        </div>

        <p className="truncate text-[13px]" style={{ color: "#cccccc" }}>
          {clip.subject || clip.prompt_text}
        </p>

        {clip.mood_tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {clip.mood_tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
            {clip.mood_tags.length > 2 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                +{clip.mood_tags.length - 2} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Used {clip.usage_count} times</span>
          {clip.user_rating != null ? (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {clip.user_rating.toFixed(1)}
            </span>
          ) : (
            <span>Unrated</span>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onEditTags}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Edit Tags
          </button>
          <Button size="sm" variant="outline" onClick={onUse} className="h-7 text-xs">
            Use in Project
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({
  clip,
  onClose,
  onUse,
  onEditTags,
}: {
  clip: HeraClip;
  onClose: () => void;
  onUse: () => void;
  onEditTags: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{clip.subject || "Hera clip"}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video overflow-hidden rounded-md bg-black">
          {clip.output_url ? (
            <video src={clip.output_url} controls autoPlay loop className="h-full w-full" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Play className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">{clip.prompt_text}</p>
          <div className="flex flex-wrap gap-1">
            {clip.mood_tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Used {clip.usage_count} times · {clip.duration_seconds}s · {clip.resolution}
            {clip.user_rating != null && ` · ${clip.user_rating} ★`}
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onEditTags}>
            Edit Tags
          </Button>
          <Button onClick={onUse} style={{ background: "var(--accent-gold)", color: "#000" }}>
            Use in Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setInput("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1.5">
      {value.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        className="min-w-[80px] flex-1 bg-transparent text-sm outline-none"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

function EditTagsModal({
  clip,
  onClose,
  onSaved,
}: {
  clip: HeraClip;
  onClose: () => void;
  onSaved: (clip: HeraClip) => void;
}) {
  const [visualJob, setVisualJob] = useState(clip.visual_job ?? "");
  const [temperature, setTemperature] = useState(clip.emotional_temperature ?? "");
  const [moodTags, setMoodTags] = useState<string[]>(clip.mood_tags);
  const [contentTags, setContentTags] = useState<string[]>(clip.content_tags);
  const [subject, setSubject] = useState(clip.subject ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("hera_cache" as any)
      .update({
        visual_job: visualJob || null,
        emotional_temperature: temperature || null,
        mood_tags: moodTags,
        content_tags: contentTags,
        subject: subject || null,
      })
      .eq("id", clip.id)
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("Failed to update tags");
      return;
    }
    onSaved(normalizeClip(data));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Tags</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Visual Job</label>
            <Select value={visualJob} onValueChange={setVisualJob}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {VISUAL_JOBS.map((j) => (
                  <SelectItem key={j} value={j} className="capitalize">
                    {j}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Emotional Temperature</label>
            <Select value={temperature} onValueChange={setTemperature}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {TEMPERATURES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Mood Tags</label>
            <TagInput value={moodTags} onChange={setMoodTags} placeholder="Add mood tag…" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Content Tags</label>
            <TagInput
              value={contentTags}
              onChange={setContentTags}
              placeholder="Add content tag…"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Subject</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Tags"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ProjectRow = { id: string; title: string; status: string; updated_at: string };
type SceneRow = { id: string; scene_index: number; script_text: string };

function UseInProjectModal({
  clip,
  onClose,
  onConfirm,
}: {
  clip: HeraClip;
  onClose: () => void;
  onConfirm: (
    clip: HeraClip,
    projectId: string,
    sceneId: string,
    projectName: string,
    sceneNumber: number,
  ) => void;
}) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [scenes, setScenes] = useState<SceneRow[]>([]);
  const [projectId, setProjectId] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id,title,status,updated_at")
        .order("updated_at", { ascending: false });
      setProjects((data ?? []) as ProjectRow[]);
    })();
  }, []);

  useEffect(() => {
    if (!projectId) {
      setScenes([]);
      setSceneId("");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("scenes")
        .select("id,scene_index,script_text")
        .eq("project_id", projectId)
        .order("scene_index", { ascending: true });
      setScenes((data ?? []) as SceneRow[]);
      setSceneId("");
    })();
  }, [projectId]);

  const project = projects.find((p) => p.id === projectId);
  const scene = scenes.find((s) => s.id === sceneId);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select a project to use this clip in</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Project</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a project…" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.title}
                      <Badge variant="secondary" className="text-[10px]">
                        {p.status}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {projectId && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Scene</label>
              <Select value={sceneId} onValueChange={setSceneId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a scene…" />
                </SelectTrigger>
                <SelectContent>
                  {scenes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Scene {s.scene_index + 1} · {s.script_text.split(/\s+/).slice(0, 8).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!projectId || !sceneId || submitting}
            onClick={async () => {
              if (!project || !scene) return;
              setSubmitting(true);
              await onConfirm(clip, project.id, scene.id, project.title, scene.scene_index + 1);
              setSubmitting(false);
            }}
            style={{ background: "var(--accent-gold)", color: "#000" }}
          >
            Add to Scene
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ onGo }: { onGo: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-[var(--surface)] px-6 py-20 text-center">
      <Film className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="text-base font-semibold">Your Hera library is empty</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Generate clips in any project to build your library. Clips are cached here automatically and
        reused to save credits.
      </p>
      <Button variant="outline" className="mt-4" onClick={onGo}>
        Go to a Project
      </Button>
    </div>
  );
}
