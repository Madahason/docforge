import { useEffect, useMemo, useRef, useState } from "react";
import {
  Hash,
  BarChart3,
  GitCommit,
  Columns,
  Type as TypeIcon,
  PieChart,
  Map as MapIcon,
  Code,
  Video,
  Check,
  Plus,
  X,
  RotateCw,
  PlayCircle,
  Download,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useStudio, type Scene, type MotionGraphicRecord, type Clip } from "@/lib/studio-context";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { confirmClip } from "@/lib/clip-sourcing.functions";
import { heraGenerate } from "@/lib/hera.functions";
import { HeraFlow } from "@/components/studio/HeraFlow";

const GOLD = "#e8c547";
const BG = "#000000";
const CARD_BG = "#0a0a0a";
const BORDER = "#2a2a2a";
const FG = "#f0f0f0";
const MUTED = "#888888";

const GRAPHIC_TYPES = [
  {
    id: "counter",
    label: "Counter",
    icon: Hash,
    desc: "Animated number that counts up to a value",
  },
  {
    id: "bar_chart",
    label: "Bar Chart",
    icon: BarChart3,
    desc: "Comparative bars that build on screen",
  },
  {
    id: "timeline",
    label: "Timeline",
    icon: GitCommit,
    desc: "Sequential events on a horizontal line",
  },
  {
    id: "comparison",
    label: "Comparison",
    icon: Columns,
    desc: "Two options or entities side by side",
  },
  {
    id: "text_card",
    label: "Text Card",
    icon: TypeIcon,
    desc: "Bold statement on a dark background",
  },
  {
    id: "percentage_ring",
    label: "Percentage Ring",
    icon: PieChart,
    desc: "Circular progress ring filling to a value",
  },
  {
    id: "map_highlight",
    label: "Map Highlight",
    icon: MapIcon,
    desc: "Geographic region highlighted on a world map",
  },
] as const;

type GType = (typeof GRAPHIC_TYPES)[number]["id"];

const REGIONS = [
  "North America",
  "South America",
  "Europe",
  "Africa",
  "Asia",
  "Middle East",
  "Oceania",
  "United States",
  "Canada",
  "Mexico",
  "Brazil",
  "United Kingdom",
  "France",
  "Germany",
  "Italy",
  "Spain",
  "Russia",
  "China",
  "Japan",
  "India",
  "Australia",
  "South Africa",
  "Nigeria",
  "Egypt",
  "Saudi Arabia",
  "Israel",
  "Turkey",
  "Indonesia",
];

function defaultData(type: GType): Record<string, any> {
  switch (type) {
    case "counter":
      return { value: "", label: "", prefix: "", suffix: "", context_line: "" };
    case "bar_chart":
      return { title: "", bars: [{ label: "", value: 0 }] };
    case "timeline":
      return { title: "", events: [{ date: "", description: "" }] };
    case "comparison":
      return {
        label_a: "Option A",
        label_b: "Option B",
        points: [{ metric: "", value_a: "", value_b: "" }],
      };
    case "text_card":
      return { statement: "", attribution: "" };
    case "percentage_ring":
      return { value: 50, label: "", context_line: "" };
    case "map_highlight":
      return { region: "United States", label: "", context_line: "" };
  }
}

function mergeData(type: GType, existing: any): any {
  const def = defaultData(type);
  if (!existing || typeof existing !== "object") return def;
  return { ...def, ...existing };
}

export function MotionGraphicTab({ scene }: { scene: Scene }) {
  const { project, motionGraphics, upsertMotionGraphic, upsertClip, clips } = useStudio();
  const existing = motionGraphics.find((m) => m.scene_id === scene.id) ?? null;
  const existingClip = clips.find((c) => c.scene_id === scene.id) ?? null;
  const isConfirmed = !!existing?.confirmed && existingClip?.asset_type === "motion_graphic";

  const [editing, setEditing] = useState(!isConfirmed);

  if (isConfirmed && !editing && existing) {
    return (
      <ConfirmedState
        record={existing}
        onEdit={() => setEditing(true)}
        onChangeType={() => setEditing(true)}
      />
    );
  }

  return (
    <Configurator
      scene={scene}
      projectId={project.id}
      existing={existing}
      onSaved={(m) => upsertMotionGraphic(m)}
      onConfirmed={(m, clip) => {
        upsertMotionGraphic(m);
        if (clip) upsertClip(clip);
        setEditing(false);
      }}
    />
  );
}

function Configurator({
  scene,
  projectId,
  existing,
  onSaved,
  onConfirmed,
}: {
  scene: Scene;
  projectId: string;
  existing: MotionGraphicRecord | null;
  onSaved: (m: MotionGraphicRecord) => void;
  onConfirmed: (m: MotionGraphicRecord, clip: Clip | null) => void;
}) {
  const recommended = (scene.motion_graphic_type as GType) || "counter";
  const initialType: GType = (existing?.graphic_type as GType) || recommended;

  const [type, setType] = useState<GType>(initialType);
  const seedData = existing?.graphic_data ?? scene.motion_graphic_data ?? null;
  const [data, setData] = useState<any>(mergeData(initialType, seedData));
  const [renderMethod, setRenderMethod] = useState<"remotion" | "hera">(
    (existing?.render_method as "remotion" | "hera") || "remotion",
  );
  const [replayKey, setReplayKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const onPickType = (newType: GType) => {
    setType(newType);
    setData((prev: any) => mergeData(newType, prev));
    setReplayKey((k) => k + 1);
  };

  const confirmFn = useServerFn(confirmClip);
  const heraGenFn = useServerFn(heraGenerate);

  const saveRecord = async (
    markConfirmed: boolean,
    extra: Partial<MotionGraphicRecord> = {},
  ): Promise<MotionGraphicRecord | null> => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      toast.error("Not signed in");
      return null;
    }
    const payload = {
      user_id: userId,
      project_id: projectId,
      scene_id: scene.id,
      graphic_type: type,
      graphic_data: data,
      render_method: renderMethod,
      status: "configured",
      confirmed: markConfirmed,
      ...extra,
    };
    const { data: row, error } = await (supabase as any)
      .from("motion_graphics")
      .upsert(payload, { onConflict: "scene_id" })
      .select("*")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    return row as MotionGraphicRecord;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const row = await saveRecord(!!existing?.confirmed);
      if (row) {
        onSaved(row);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const runHeraGenerate = async (confirmPaid: boolean) => {
    return heraGenFn({
      data: {
        scene_id: scene.id,
        project_id: projectId,
        visual_job: "motion_graphic",
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
        graphic_type: type,
        graphic_data: data as Record<string, any>,
      },
    });
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      let extra: Partial<MotionGraphicRecord> = {};
      if (renderMethod === "hera") {
        let res = await runHeraGenerate(false);
        if (res?.requires_confirmation) {
          const ok =
            typeof window !== "undefined" &&
            window.confirm(
              `Hera dev mode is active.\n\nPrompt:\n${res.prompt}\n\nProceed and use 1 Hera credit?`,
            );
          if (!ok) {
            toast.message("Hera generation cancelled");
            return;
          }
          res = await runHeraGenerate(true);
        }
        const cache = (res as any)?.data;
        if (!cache?.output_url) {
          toast.error("Hera generation did not return a clip");
          return;
        }
        extra = {
          hera_cache_id: cache.id,
          hera_output_url: cache.output_url,
        } as Partial<MotionGraphicRecord>;
        toast.success(res.from_cache ? "Loaded from Hera library" : "Hera clip generated");
      }
      const row = await saveRecord(true, extra);
      if (!row) return;
      const confirmRes = await confirmFn({
        data: {
          projectId,
          sceneId: scene.id,
          assetType: "motion_graphic",
          visualJob: scene.visual_job,
          moodTags: scene.clip_brief?.mood ?? [],
          rightsRisk: "low",
        },
      });
      onConfirmed(row, (confirmRes?.clip ?? null) as Clip | null);
      toast.success("Motion graphic confirmed");
    } catch (e) {
      toast.error((e as Error).message || "Could not confirm");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Graphic Type
        </div>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-2">
            {GRAPHIC_TYPES.map((g) => {
              const Icon = g.icon;
              const active = type === g.id;
              const isRec = recommended === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => onPickType(g.id)}
                  className={cn(
                    "flex w-[140px] shrink-0 flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-colors",
                    active
                      ? "border-[var(--accent-gold)] bg-[rgba(232,197,71,0.08)]"
                      : "border-border bg-[#0f0f0f] hover:bg-[#141414]",
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <Icon className="h-3.5 w-3.5" style={{ color: active ? GOLD : MUTED }} />
                    {isRec && (
                      <span className="text-[9px] font-semibold" style={{ color: GOLD }}>
                        REC
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold text-foreground">{g.label}</div>
                  <div className="text-[10px] leading-tight text-muted-foreground">{g.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Configuration
          </div>
          <ConfigFields type={type} data={data} setData={setData} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Preview
            </div>
            <button
              onClick={() => setReplayKey((k) => k + 1)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <RotateCw className="h-3 w-3" />
              Replay
            </button>
          </div>
          <div
            className="relative w-full overflow-hidden"
            style={{
              backgroundColor: BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              aspectRatio: "16 / 9",
            }}
          >
            <GraphicPreview key={replayKey} type={type} data={data} />
          </div>

          <div className="pt-2">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Render Method
            </div>
            <div className="grid grid-cols-2 gap-2">
              <RenderMethodCard
                active={renderMethod === "remotion"}
                onClick={() => setRenderMethod("remotion")}
                icon={Code}
                title="Remotion"
                desc="Programmatic render. Exact data, perfect style. Rendered at export time."
                badges={[
                  { label: "Recommended", color: GOLD },
                  { label: "No extra cost", color: "#4caf50" },
                ]}
              />
              <RenderMethodCard
                active={renderMethod === "hera"}
                onClick={() => setRenderMethod("hera")}
                icon={Video}
                title="Hera.video"
                desc="AI-generated cinematic version. More atmospheric. Uses Hera credits."
                badges={[{ label: "Uses credits", color: GOLD }]}
              />
            </div>
          </div>
        </div>
      </div>

      {renderMethod === "hera" ? (
        <HeraFlow
          scene={scene}
          projectId={projectId}
          confirmedCacheId={existing?.hera_cache_id ?? null}
          onConfirm={async (payload) => {
            const row = await saveRecord(true, {
              hera_cache_id: payload.cache_id,
              hera_output_url: payload.output_url,
              hera_prompt_used: payload.prompt_text,
            } as Partial<MotionGraphicRecord>);
            if (!row) return;
            const confirmRes = await confirmFn({
              data: {
                projectId,
                sceneId: scene.id,
                assetType: "motion_graphic",
                visualJob: scene.visual_job,
                moodTags: scene.clip_brief?.mood ?? [],
                rightsRisk: "low",
                sourceUrl: payload.output_url,
                thumbnailUrl: payload.thumbnail_url ?? undefined,
                durationSeconds: payload.duration_seconds,
              },
            });
            onConfirmed(row, (confirmRes?.clip ?? null) as Clip | null);
          }}
        />
      ) : (
        <div
          className="flex items-center justify-end gap-2 border-t pt-3"
          style={{ borderColor: BORDER }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saving || confirming}
            className="text-[11px]"
          >
            {savedFlash ? (
              <>
                <Check className="mr-1 h-3 w-3" /> Saved
              </>
            ) : saving ? (
              "Saving…"
            ) : (
              "Save Configuration"
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={confirming || saving}
            className="text-[11px]"
            style={{ backgroundColor: GOLD, color: "#000" }}
          >
            {confirming ? "Confirming…" : "Confirm Graphic"}
          </Button>
        </div>
      )}
    </div>
  );
}

function RenderMethodCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
  badges,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Code;
  title: string;
  desc: string;
  badges: { label: string; color: string }[];
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border p-2.5 text-left transition-colors",
        active
          ? "border-[var(--accent-gold)] bg-[rgba(232,197,71,0.08)]"
          : "border-border bg-[#0f0f0f] hover:bg-[#141414]",
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color: active ? GOLD : MUTED }} />
        <span className="text-[11px] font-semibold text-foreground">{title}</span>
      </div>
      <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground">{desc}</p>
      <div className="flex flex-wrap gap-1">
        {badges.map((b) => (
          <span
            key={b.label}
            className="rounded px-1.5 py-0.5 text-[9px] font-semibold"
            style={{ backgroundColor: `${b.color}22`, color: b.color }}
          >
            {b.label}
          </span>
        ))}
      </div>
    </button>
  );
}

function ConfigFields({
  type,
  data,
  setData,
}: {
  type: GType;
  data: any;
  setData: (d: any) => void;
}) {
  const upd = (patch: any) => setData({ ...data, ...patch });

  if (type === "counter") {
    return (
      <div className="space-y-2.5">
        <Field label="Value">
          <Input
            value={data.value ?? ""}
            onChange={(e) => upd({ value: e.target.value })}
            placeholder="e.g. 47"
          />
        </Field>
        <Field label="Label">
          <Input
            value={data.label ?? ""}
            onChange={(e) => upd({ label: e.target.value })}
            placeholder="e.g. billion in revenue"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Prefix" note="Appears before the number">
            <Input
              value={data.prefix ?? ""}
              maxLength={3}
              onChange={(e) => upd({ prefix: e.target.value })}
              placeholder="$"
            />
          </Field>
          <Field label="Suffix" note="Appears after the number">
            <Input
              value={data.suffix ?? ""}
              maxLength={3}
              onChange={(e) => upd({ suffix: e.target.value })}
              placeholder="B"
            />
          </Field>
        </div>
        <Field label="Context Line">
          <Input
            value={data.context_line ?? ""}
            onChange={(e) => upd({ context_line: e.target.value })}
            placeholder="One sentence of context"
          />
        </Field>
      </div>
    );
  }

  if (type === "bar_chart") {
    const bars = Array.isArray(data.bars) ? data.bars : [];
    return (
      <div className="space-y-2.5">
        <Field label="Chart Title">
          <Input value={data.title ?? ""} onChange={(e) => upd({ title: e.target.value })} />
        </Field>
        <div className="space-y-1.5">
          {bars.map((b: any, i: number) => (
            <div key={i} className="grid grid-cols-[1fr_80px_24px] gap-1.5">
              <Input
                value={b.label ?? ""}
                onChange={(e) => {
                  const next = [...bars];
                  next[i] = { ...next[i], label: e.target.value };
                  upd({ bars: next });
                }}
                placeholder="Label"
              />
              <Input
                type="number"
                value={b.value ?? 0}
                onChange={(e) => {
                  const next = [...bars];
                  next[i] = { ...next[i], value: Number(e.target.value) };
                  upd({ bars: next });
                }}
                placeholder="0"
              />
              <button
                onClick={() => upd({ bars: bars.filter((_: any, j: number) => j !== i) })}
                className="rounded border border-border text-muted-foreground hover:text-foreground"
              >
                <X className="mx-auto h-3 w-3" />
              </button>
            </div>
          ))}
          {bars.length < 5 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => upd({ bars: [...bars, { label: "", value: 0 }] })}
              className="h-7 w-full text-[10px]"
            >
              <Plus className="mr-1 h-3 w-3" /> Add Bar
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (type === "timeline") {
    const events = Array.isArray(data.events) ? data.events : [];
    return (
      <div className="space-y-2.5">
        <Field label="Timeline Title">
          <Input value={data.title ?? ""} onChange={(e) => upd({ title: e.target.value })} />
        </Field>
        <div className="space-y-1.5">
          {events.map((ev: any, i: number) => (
            <div key={i} className="grid grid-cols-[90px_1fr_24px] gap-1.5">
              <Input
                value={ev.date ?? ""}
                onChange={(e) => {
                  const next = [...events];
                  next[i] = { ...next[i], date: e.target.value };
                  upd({ events: next });
                }}
                placeholder="Date"
              />
              <Input
                value={ev.description ?? ""}
                onChange={(e) => {
                  const next = [...events];
                  next[i] = { ...next[i], description: e.target.value };
                  upd({ events: next });
                }}
                placeholder="Event"
              />
              <button
                onClick={() => upd({ events: events.filter((_: any, j: number) => j !== i) })}
                className="rounded border border-border text-muted-foreground hover:text-foreground"
              >
                <X className="mx-auto h-3 w-3" />
              </button>
            </div>
          ))}
          {events.length < 6 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => upd({ events: [...events, { date: "", description: "" }] })}
              className="h-7 w-full text-[10px]"
            >
              <Plus className="mr-1 h-3 w-3" /> Add Event
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (type === "comparison") {
    const points = Array.isArray(data.points) ? data.points : [];
    return (
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Label A">
            <Input value={data.label_a ?? ""} onChange={(e) => upd({ label_a: e.target.value })} />
          </Field>
          <Field label="Label B">
            <Input value={data.label_b ?? ""} onChange={(e) => upd({ label_b: e.target.value })} />
          </Field>
        </div>
        <div className="space-y-2">
          {points.map((p: any, i: number) => (
            <div key={i} className="space-y-1 rounded border border-border p-1.5">
              <div className="grid grid-cols-[1fr_24px] gap-1.5">
                <Input
                  value={p.metric ?? ""}
                  placeholder="Metric"
                  onChange={(e) => {
                    const next = [...points];
                    next[i] = { ...next[i], metric: e.target.value };
                    upd({ points: next });
                  }}
                />
                <button
                  onClick={() => upd({ points: points.filter((_: any, j: number) => j !== i) })}
                  className="rounded border border-border text-muted-foreground hover:text-foreground"
                >
                  <X className="mx-auto h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  value={p.value_a ?? ""}
                  placeholder="Value A"
                  onChange={(e) => {
                    const next = [...points];
                    next[i] = { ...next[i], value_a: e.target.value };
                    upd({ points: next });
                  }}
                />
                <Input
                  value={p.value_b ?? ""}
                  placeholder="Value B"
                  onChange={(e) => {
                    const next = [...points];
                    next[i] = { ...next[i], value_b: e.target.value };
                    upd({ points: next });
                  }}
                />
              </div>
            </div>
          ))}
          {points.length < 4 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => upd({ points: [...points, { metric: "", value_a: "", value_b: "" }] })}
              className="h-7 w-full text-[10px]"
            >
              <Plus className="mr-1 h-3 w-3" /> Add Point
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (type === "text_card") {
    const words = (data.statement ?? "").trim().split(/\s+/).filter(Boolean).length;
    return (
      <div className="space-y-2.5">
        <Field label="Statement" note={`${words} / 12 words`}>
          <Textarea
            value={data.statement ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const w = v.trim().split(/\s+/).filter(Boolean);
              if (w.length > 12) {
                upd({ statement: w.slice(0, 12).join(" ") });
              } else {
                upd({ statement: v });
              }
            }}
            placeholder="The most powerful sentence from this scene"
            rows={3}
          />
        </Field>
        <Field label="Attribution (optional)">
          <Input
            value={data.attribution ?? ""}
            onChange={(e) => upd({ attribution: e.target.value })}
            placeholder="Source or speaker"
          />
        </Field>
      </div>
    );
  }

  if (type === "percentage_ring") {
    return (
      <div className="space-y-2.5">
        <Field label="Percentage Value">
          <Input
            type="number"
            min={0}
            max={100}
            value={data.value ?? 0}
            onChange={(e) =>
              upd({ value: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
            }
          />
        </Field>
        <Field label="Label">
          <Input
            value={data.label ?? ""}
            onChange={(e) => upd({ label: e.target.value })}
            placeholder="e.g. market share"
          />
        </Field>
        <Field label="Context Line">
          <Input
            value={data.context_line ?? ""}
            onChange={(e) => upd({ context_line: e.target.value })}
          />
        </Field>
      </div>
    );
  }

  if (type === "map_highlight") {
    return (
      <div className="space-y-2.5">
        <Field label="Region">
          <select
            value={data.region ?? ""}
            onChange={(e) => upd({ region: e.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r} className="bg-background">
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Label">
          <Input
            value={data.label ?? ""}
            onChange={(e) => upd({ label: e.target.value })}
            placeholder="e.g. Largest market"
          />
        </Field>
        <Field label="Context Line">
          <Input
            value={data.context_line ?? ""}
            onChange={(e) => upd({ context_line: e.target.value })}
          />
        </Field>
      </div>
    );
  }

  return null;
}

function Field({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        {note && <span className="text-[10px] text-muted-foreground">{note}</span>}
      </div>
      {children}
    </div>
  );
}

export function GraphicPreview({ type, data }: { type: GType; data: any }) {
  if (type === "counter") return <CounterPreview data={data} />;
  if (type === "bar_chart") return <BarChartPreview data={data} />;
  if (type === "timeline") return <TimelinePreview data={data} />;
  if (type === "comparison") return <ComparisonPreview data={data} />;
  if (type === "text_card") return <TextCardPreview data={data} />;
  if (type === "percentage_ring") return <PercentageRingPreview data={data} />;
  if (type === "map_highlight") return <MapHighlightPreview data={data} />;
  return null;
}
export type GraphicPreviewType = GType;

function CounterPreview({ data }: { data: any }) {
  const target = useMemo(() => {
    const n = parseFloat(String(data.value ?? "").replace(/[^0-9.-]/g, ""));
    return isFinite(n) ? n : 0;
  }, [data.value]);
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const display = Number.isInteger(target) ? Math.round(n).toString() : n.toFixed(1);

  return (
    <PreviewFrame>
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ fontFamily: "Inter" }}
      >
        <div
          style={{ color: FG, fontWeight: 700, fontSize: "clamp(28px, 8vw, 72px)", lineHeight: 1 }}
        >
          <span style={{ color: GOLD }}>{data.prefix || ""}</span>
          {display}
          <span style={{ color: GOLD }}>{data.suffix || ""}</span>
        </div>
        {data.label && (
          <div style={{ color: FG, fontSize: "clamp(11px, 2vw, 16px)", marginTop: 8 }}>
            {data.label}
          </div>
        )}
        {data.context_line && (
          <div style={{ color: MUTED, fontSize: "clamp(9px, 1.4vw, 12px)", marginTop: 12 }}>
            {data.context_line}
          </div>
        )}
      </div>
    </PreviewFrame>
  );
}

function BarChartPreview({ data }: { data: any }) {
  const bars: { label: string; value: number }[] = Array.isArray(data.bars) ? data.bars : [];
  const max = Math.max(1, ...bars.map((b) => Number(b.value) || 0));
  return (
    <PreviewFrame>
      <div className="flex h-full w-full flex-col" style={{ fontFamily: "Inter" }}>
        {data.title && (
          <div style={{ color: FG, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
            {data.title}
          </div>
        )}
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          {bars.map((b, i) => {
            const pct = ((Number(b.value) || 0) / max) * 100;
            return (
              <div key={i} className="flex items-center gap-2">
                <div style={{ color: FG, fontSize: 10, width: 80, textAlign: "right" }}>
                  {b.label || "—"}
                </div>
                <div
                  className="relative h-3 flex-1"
                  style={{ backgroundColor: "#1a1a1a", borderRadius: 2 }}
                >
                  <div
                    style={{
                      backgroundColor: GOLD,
                      height: "100%",
                      width: `${pct}%`,
                      borderRadius: 2,
                      animation: `mgBarGrow 0.8s ease-out ${i * 0.1}s both`,
                      transformOrigin: "left",
                    }}
                  />
                </div>
                <div style={{ color: GOLD, fontSize: 10, width: 40, fontWeight: 700 }}>
                  {b.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes mgBarGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
    </PreviewFrame>
  );
}

function TimelinePreview({ data }: { data: any }) {
  const events: { date: string; description: string }[] = Array.isArray(data.events)
    ? data.events
    : [];
  return (
    <PreviewFrame>
      <div className="flex h-full w-full flex-col" style={{ fontFamily: "Inter" }}>
        {data.title && (
          <div style={{ color: FG, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            {data.title}
          </div>
        )}
        <div className="relative flex flex-1 items-center">
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              height: 1,
              backgroundColor: "#2a2a2a",
            }}
          />
          <div className="flex w-full justify-between">
            {events.map((ev, i) => (
              <div
                key={i}
                className="flex flex-col items-center"
                style={{
                  flex: 1,
                  animation: `mgFade 0.4s ease-out ${i * 0.15}s both`,
                }}
              >
                <div style={{ color: GOLD, fontSize: 9, fontWeight: 700, marginBottom: 6 }}>
                  {ev.date || "—"}
                </div>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: GOLD,
                    boxShadow: `0 0 0 3px ${BG}`,
                    zIndex: 1,
                  }}
                />
                <div
                  style={{
                    color: FG,
                    fontSize: 9,
                    marginTop: 6,
                    textAlign: "center",
                    maxWidth: 90,
                    lineHeight: 1.2,
                  }}
                >
                  {ev.description || ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes mgFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </PreviewFrame>
  );
}

function ComparisonPreview({ data }: { data: any }) {
  const points: { metric: string; value_a: string; value_b: string }[] = Array.isArray(data.points)
    ? data.points
    : [];
  const winnerOf = (a: string, b: string): "a" | "b" | null => {
    const na = parseFloat(String(a).replace(/[^0-9.-]/g, ""));
    const nb = parseFloat(String(b).replace(/[^0-9.-]/g, ""));
    if (!isFinite(na) || !isFinite(nb) || na === nb) return null;
    return na > nb ? "a" : "b";
  };
  return (
    <PreviewFrame>
      <div className="flex h-full w-full flex-col" style={{ fontFamily: "Inter" }}>
        <div className="mb-2 grid grid-cols-[1fr_80px_1fr] items-center gap-2">
          <div style={{ color: GOLD, fontWeight: 700, fontSize: 12, textAlign: "right" }}>
            {data.label_a || "A"}
          </div>
          <div />
          <div style={{ color: GOLD, fontWeight: 700, fontSize: 12, textAlign: "left" }}>
            {data.label_b || "B"}
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          {points.map((p, i) => {
            const w = winnerOf(p.value_a, p.value_b);
            return (
              <div
                key={i}
                className="grid grid-cols-[1fr_100px_1fr] items-center gap-2"
                style={{ animation: `mgScaleIn 0.4s ease-out ${i * 0.1}s both` }}
              >
                <div
                  style={{
                    color: w === "a" ? GOLD : FG,
                    fontWeight: w === "a" ? 700 : 400,
                    fontSize: 12,
                    textAlign: "right",
                  }}
                >
                  {p.value_a || "—"}
                </div>
                <div style={{ color: MUTED, fontSize: 10, textAlign: "center" }}>
                  {p.metric || "—"}
                </div>
                <div
                  style={{
                    color: w === "b" ? GOLD : FG,
                    fontWeight: w === "b" ? 700 : 400,
                    fontSize: 12,
                    textAlign: "left",
                  }}
                >
                  {p.value_b || "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes mgScaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }`}</style>
    </PreviewFrame>
  );
}

function TextCardPreview({ data }: { data: any }) {
  return (
    <PreviewFrame>
      <div
        className="flex h-full w-full flex-col items-center justify-center text-center"
        style={{ fontFamily: "Inter", animation: "mgFade 0.6s ease-out" }}
      >
        <div
          style={{
            color: FG,
            fontWeight: 700,
            fontSize: "clamp(14px, 3vw, 28px)",
            lineHeight: 1.25,
            maxWidth: "90%",
          }}
        >
          {data.statement || "Your bold statement"}
        </div>
        <div style={{ width: 48, height: 2, backgroundColor: GOLD, marginTop: 12 }} />
        {data.attribution && (
          <div style={{ color: MUTED, fontSize: 11, marginTop: 10 }}>— {data.attribution}</div>
        )}
      </div>
    </PreviewFrame>
  );
}

function PercentageRingPreview({ data }: { data: any }) {
  const target = Math.max(0, Math.min(100, Number(data.value) || 0));
  const [pct, setPct] = useState(0);
  useEffect(() => {
    setPct(0);
    const start = performance.now();
    const dur = 1100;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setPct(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const size = 130;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <PreviewFrame>
      <div
        className="flex h-full w-full flex-col items-center justify-center text-center"
        style={{ fontFamily: "Inter" }}
      >
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#1a1a1a"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={GOLD}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div
          style={{
            marginTop: -size / 2 - 18,
            position: "relative",
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          <div style={{ color: FG, fontWeight: 700, fontSize: 26 }}>
            {Math.round(pct)}
            <span style={{ color: GOLD, fontSize: 18 }}>%</span>
          </div>
          {data.label && <div style={{ color: FG, fontSize: 10, marginTop: 2 }}>{data.label}</div>}
        </div>
        {data.context_line && (
          <div style={{ color: MUTED, fontSize: 10, marginTop: size / 2 - 4 }}>
            {data.context_line}
          </div>
        )}
      </div>
    </PreviewFrame>
  );
}

function MapHighlightPreview({ data }: { data: any }) {
  const REGION_POS: Record<string, { x: number; y: number; w?: number; h?: number }> = {
    "North America": { x: 22, y: 32, w: 28, h: 22 },
    "South America": { x: 38, y: 60, w: 14, h: 28 },
    Europe: { x: 96, y: 30, w: 14, h: 14 },
    Africa: { x: 102, y: 55, w: 18, h: 26 },
    Asia: { x: 130, y: 35, w: 38, h: 24 },
    "Middle East": { x: 112, y: 42, w: 14, h: 10 },
    Oceania: { x: 158, y: 75, w: 22, h: 12 },
    "United States": { x: 28, y: 38, w: 22, h: 12 },
    Canada: { x: 28, y: 24, w: 26, h: 12 },
    Mexico: { x: 30, y: 48, w: 12, h: 8 },
    Brazil: { x: 44, y: 64, w: 14, h: 16 },
    "United Kingdom": { x: 92, y: 28, w: 4, h: 5 },
    France: { x: 95, y: 33, w: 6, h: 6 },
    Germany: { x: 99, y: 30, w: 5, h: 5 },
    Italy: { x: 100, y: 36, w: 5, h: 7 },
    Spain: { x: 91, y: 37, w: 6, h: 5 },
    Russia: { x: 120, y: 22, w: 50, h: 14 },
    China: { x: 142, y: 38, w: 20, h: 14 },
    Japan: { x: 168, y: 38, w: 6, h: 8 },
    India: { x: 134, y: 50, w: 12, h: 12 },
    Australia: { x: 158, y: 72, w: 20, h: 14 },
    "South Africa": { x: 108, y: 78, w: 10, h: 8 },
    Nigeria: { x: 100, y: 58, w: 6, h: 6 },
    Egypt: { x: 110, y: 47, w: 6, h: 6 },
    "Saudi Arabia": { x: 115, y: 48, w: 8, h: 8 },
    Israel: { x: 112, y: 44, w: 2, h: 3 },
    Turkey: { x: 110, y: 38, w: 8, h: 5 },
    Indonesia: { x: 152, y: 62, w: 16, h: 6 },
  };
  const pos = REGION_POS[data.region] ?? REGION_POS["North America"];

  return (
    <PreviewFrame>
      <div className="flex h-full w-full flex-col" style={{ fontFamily: "Inter" }}>
        <div className="relative flex-1">
          <svg
            viewBox="0 0 200 100"
            preserveAspectRatio="xMidYMid meet"
            style={{ width: "100%", height: "100%" }}
          >
            <g fill="#2a2a2a">
              <ellipse cx="36" cy="32" rx="18" ry="14" />
              <ellipse cx="44" cy="68" rx="10" ry="20" />
              <ellipse cx="100" cy="32" rx="14" ry="10" />
              <ellipse cx="108" cy="65" rx="14" ry="22" />
              <ellipse cx="148" cy="42" rx="28" ry="16" />
              <ellipse cx="166" cy="78" rx="14" ry="8" />
            </g>
            <rect
              x={pos.x}
              y={pos.y}
              width={pos.w ?? 6}
              height={pos.h ?? 6}
              fill={GOLD}
              rx={2}
              style={{ animation: "mgPulse 1.6s ease-in-out infinite" }}
            />
            {data.label && (
              <text
                x={pos.x + (pos.w ?? 6) + 3}
                y={pos.y + (pos.h ?? 6) / 2 + 2}
                fill={FG}
                fontSize={5}
                fontWeight={700}
              >
                {data.label}
              </text>
            )}
          </svg>
        </div>
        {data.context_line && (
          <div style={{ color: MUTED, fontSize: 10, textAlign: "center", marginTop: 4 }}>
            {data.context_line}
          </div>
        )}
      </div>
      <style>{`@keyframes mgPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }`}</style>
    </PreviewFrame>
  );
}

function PreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex" style={{ backgroundColor: BG, padding: 24 }}>
      <div className="flex h-full w-full items-center justify-center">{children}</div>
    </div>
  );
}

function summarize(record: MotionGraphicRecord): string {
  const d: any = record.graphic_data || {};
  switch (record.graphic_type) {
    case "counter":
      return `${d.prefix || ""}${d.value ?? ""} — ${d.label ?? ""}`;
    case "bar_chart":
      return `${(d.bars ?? []).length} bars — ${d.title ?? ""}`;
    case "timeline":
      return `${(d.events ?? []).length} events — ${d.title ?? ""}`;
    case "comparison":
      return `${d.label_a ?? "A"} vs ${d.label_b ?? "B"}`;
    case "text_card": {
      const words = String(d.statement ?? "")
        .split(/\s+/)
        .slice(0, 8)
        .join(" ");
      return words + (String(d.statement ?? "").split(/\s+/).length > 8 ? "..." : "");
    }
    case "percentage_ring":
      return `${d.value ?? 0}% — ${d.label ?? ""}`;
    case "map_highlight":
      return `${d.region ?? ""} — ${d.label ?? ""}`;
    default:
      return "";
  }
}

function ConfirmedState({
  record,
  onEdit,
  onChangeType,
}: {
  record: MotionGraphicRecord;
  onEdit: () => void;
  onChangeType: () => void;
}) {
  const { upsertMotionGraphic } = useStudio();
  const typeLabel =
    GRAPHIC_TYPES.find((g) => g.id === record.graphic_type)?.label ?? record.graphic_type;
  const isHera = record.render_method === "hera";
  const isRemotion = record.render_method === "remotion";
  const renderMethodLabel = isHera ? "Hera.video" : "Remotion";
  const hasOutput = !!record.remotion_output_url;

  return (
    <div
      className="space-y-3 rounded-md border p-3"
      style={{ borderColor: BORDER, backgroundColor: "#0f0f0f" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="rounded px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `${GOLD}22`, color: GOLD }}
        >
          {typeLabel}
        </span>
        <span
          className="rounded px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            color: MUTED,
            border: `1px solid ${BORDER}`,
          }}
        >
          {renderMethodLabel}
        </span>
        <Check className="ml-auto h-4 w-4" style={{ color: "#4caf50" }} />
      </div>

      {hasOutput && isRemotion ? (
        <div
          className="relative w-full overflow-hidden"
          style={{
            backgroundColor: BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            aspectRatio: "16 / 9",
          }}
        >
          <video
            src={record.remotion_output_url ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <div
          className="relative w-full overflow-hidden"
          style={{
            backgroundColor: BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            aspectRatio: "16 / 9",
          }}
        >
          <StaticPreview type={record.graphic_type as GType} data={record.graphic_data} />
          <span
            className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: "rgba(0,0,0,0.6)",
              color: MUTED,
              border: `1px solid ${BORDER}`,
            }}
          >
            Static preview
          </span>
        </div>
      )}

      <div className="text-[11px] text-foreground">{summarize(record)}</div>

      {isRemotion && <RemotionRenderPanel record={record} onUpdated={upsertMotionGraphic} />}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onEdit} className="h-7 text-[11px]">
          Edit
        </Button>
        <Button variant="outline" size="sm" onClick={onChangeType} className="h-7 text-[11px]">
          Change Type
        </Button>
      </div>
    </div>
  );
}

function StaticPreview({ type, data }: { type: GType; data: any }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="absolute inset-0">
      <GraphicPreview type={type} data={data} />
    </div>
  );
}

function RemotionRenderPanel({
  record,
  onUpdated,
}: {
  record: MotionGraphicRecord;
  onUpdated: (m: MotionGraphicRecord) => void;
}) {
  const [jobId, setJobId] = useState<string | null>(record.remotion_render_job_id ?? null);
  const [status, setStatus] = useState<string>(record.remotion_output_url ? "complete" : "idle");
  const [progress, setProgress] = useState<number>(record.remotion_output_url ? 100 : 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Resume listening to an in-flight job after remount
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    void supabase
      .from("render_jobs")
      .select("status, progress_percent, output_url, error_message")
      .eq("id", jobId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setStatus(data.status);
        setProgress(data.progress_percent ?? 0);
        if (data.error_message) setError(data.error_message);
      });

    const channel = supabase
      .channel(`render_job_${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "render_jobs", filter: `id=eq.${jobId}` },
        (payload) => {
          const row = payload.new as {
            status: string;
            progress_percent: number;
            output_url: string | null;
            error_message: string | null;
          };
          setStatus(row.status);
          setProgress(row.progress_percent ?? 0);
          if (row.error_message) setError(row.error_message);
          if (row.status === "complete" && row.output_url) {
            const outputUrl = row.output_url;
            void supabase
              .from("motion_graphics")
              .update({
                remotion_output_url: outputUrl,
                remotion_render_job_id: jobId,
              })
              .eq("id", record.id)
              .then(() => {
                onUpdated({
                  ...record,
                  remotion_output_url: outputUrl,
                  remotion_render_job_id: jobId,
                });
              });
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [jobId, record, onUpdated]);

  const handleRender = async () => {
    setBusy(true);
    setError(null);
    setProgress(0);
    setStatus("pending");
    try {
      const { triggerRemotionRender } = await import("@/lib/remotion-render");
      const job = await triggerRemotionRender({
        project_id: record.project_id,
        scene_id: record.scene_id,
        motion_graphic_id: record.id,
        graphic_type: record.graphic_type,
        graphic_data: record.graphic_data as Record<string, unknown>,
        duration_seconds: 6,
      });
      setJobId(job.id);
      await supabase
        .from("motion_graphics")
        .update({ remotion_render_job_id: job.id })
        .eq("id", record.id);
      onUpdated({ ...record, remotion_render_job_id: job.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start render";
      setError(msg);
      setStatus("failed");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const isRendering = status === "pending" || status === "running" || (busy && status !== "failed");
  const isFailed = status === "failed";
  const isComplete = status === "complete" && !!record.remotion_output_url;

  const label = (() => {
    if (isFailed) return "Failed";
    if (isComplete) return "Complete";
    if (progress >= 90) return "Uploading...";
    if (progress >= 50) return "Rendering frames...";
    if (progress >= 30) return "Preparing composition...";
    if (progress >= 10) return "Bundling...";
    return "Queued...";
  })();

  if (isComplete && record.remotion_output_url) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          asChild
          className="h-7 text-[11px]"
          style={{ borderColor: GOLD, color: GOLD }}
        >
          <a href={record.remotion_output_url} download target="_blank" rel="noreferrer">
            <Download className="h-3 w-3" />
            Download MP4
          </a>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRender}
          disabled={busy}
          className="h-7 text-[11px]"
          style={{ color: MUTED }}
        >
          <RotateCw className="h-3 w-3" />
          Re-render
        </Button>
      </div>
    );
  }

  if (isRendering || (jobId && !isFailed)) {
    return (
      <div className="space-y-1.5">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: "rgba(232,197,71,0.12)" }}
        >
          <div
            className="h-full transition-all"
            style={{ width: `${Math.max(5, progress)}%`, backgroundColor: GOLD }}
          />
        </div>
        <div className="flex items-center gap-2 text-[10px]" style={{ color: MUTED }}>
          <Loader2 className="h-3 w-3 animate-spin" style={{ color: GOLD }} />
          <span>{label}</span>
          <span className="ml-auto">{Math.round(progress)}%</span>
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="space-y-2">
        <div
          className="flex items-start gap-2 rounded-md border p-2 text-[10px]"
          style={{
            borderColor: "rgba(239,68,68,0.4)",
            backgroundColor: "rgba(239,68,68,0.08)",
            color: "#fca5a5",
          }}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error ?? "Render failed."}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRender}
          disabled={busy}
          className="h-7 text-[11px]"
          style={{ borderColor: GOLD, color: GOLD }}
        >
          <RotateCw className="h-3 w-3" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRender}
      disabled={busy}
      className="h-7 text-[11px]"
      style={{ borderColor: GOLD, color: GOLD }}
    >
      <PlayCircle className="h-3 w-3" />
      Render Graphic
    </Button>
  );
}
