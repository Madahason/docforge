import { useMemo, useState } from "react";
import { Check, Plus, Pencil, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useStudio, type Scene, type SceneGraphicRecord } from "@/lib/studio-context";
import { GraphicPreview, type GraphicPreviewType } from "./MotionGraphicTab";

const GOLD = "#e8c547";

const OVERLAY_STYLES = [
  {
    id: "bold_statement",
    label: "Bold Statement",
    desc: "Large centered white text. Appears and holds.",
  },
  {
    id: "lower_third",
    label: "Lower Third",
    desc: "Name/title bar at bottom. Classic documentary.",
  },
  { id: "kinetic_word", label: "Kinetic Word", desc: "Key word animates in with impact." },
  { id: "subtitle", label: "Subtitle", desc: "Standard caption style at bottom center." },
] as const;

const ANIMATIONS = ["Fade In", "Slide Up", "Slide Left", "Pop", "None"] as const;

const GRAPHIC_TYPES = [
  { id: "counter", label: "Counter" },
  { id: "bar_chart", label: "Bar Chart" },
  { id: "timeline", label: "Timeline" },
  { id: "comparison", label: "Comparison" },
  { id: "text_card", label: "Text Card" },
  { id: "percentage_ring", label: "Pct Ring" },
  { id: "map_highlight", label: "Map" },
] as const;
type GType = (typeof GRAPHIC_TYPES)[number]["id"];

const PLACEMENTS = [
  { id: "full_scene", label: "Full Scene" },
  { id: "lower_third", label: "Lower Third" },
  { id: "center_overlay", label: "Center Overlay" },
  { id: "corner_insert", label: "Corner Insert" },
] as const;

const RENDER_METHODS = [
  {
    id: "remotion",
    label: "Remotion",
    desc: "Rendered programmatically at export. No credits needed.",
    badge: "Recommended",
  },
  {
    id: "hera",
    label: "Hera.video",
    desc: "AI motion graphic. Uses Hera credits.",
    badge: "Uses credits",
  },
  {
    id: "static_image",
    label: "Static Image",
    desc: "Export as PNG for manual placement in editor.",
    badge: "Manual",
  },
] as const;

export function GraphicsTab({ scene }: { scene: Scene }) {
  const { sceneGraphics } = useStudio();
  const records = sceneGraphics.filter((g) => g.scene_id === scene.id);
  const textRecord = records.find((r) => r.graphic_category === "text_overlay");
  const dataRecord = records.find((r) => r.graphic_category === "data_graphic");

  const [showText, setShowText] = useState(false);
  const [showData, setShowData] = useState(false);

  const showTextSection = scene.text_overlay_flag || showText || !!textRecord;
  const showDataSection = scene.data_graphic_flag || showData || !!dataRecord;

  if (!showTextSection && !showDataSection) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="text-sm text-muted-foreground">
          No graphics needed for this scene.
          <br />
          The analyzer found no text overlays or data graphics required.
        </div>
        <div className="text-[11px] text-muted-foreground/70">Add manually if needed</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowText(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add Text Overlay
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowData(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add Data Graphic
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showTextSection && <TextOverlaySection scene={scene} record={textRecord} />}
      {showDataSection && <DataGraphicSection scene={scene} record={dataRecord} />}
    </div>
  );
}

/* =================== TEXT OVERLAY =================== */

function TextOverlaySection({
  scene,
  record,
}: {
  scene: Scene;
  record: SceneGraphicRecord | undefined;
}) {
  const { upsertSceneGraphic } = useStudio();
  const [enabled, setEnabled] = useState(true);
  const [editing, setEditing] = useState(!record?.confirmed);
  const [saving, setSaving] = useState(false);

  const [text, setText] = useState<string>(
    record?.overlay_text ?? scene.text_overlay_suggestion ?? "",
  );
  const [style, setStyle] = useState<string>(record?.overlay_style ?? "bold_statement");
  const [animation, setAnimation] = useState<string>(record?.animation_style ?? "Fade In");
  const [position, setPosition] = useState<string>(
    record?.position ?? (style === "bold_statement" ? "Center" : "Bottom"),
  );
  const [color, setColor] = useState<string>(record?.text_color ?? "#f0f0f0");
  const [startSec, setStartSec] = useState<number>(record?.start_seconds ?? 0.5);
  const [durationSec, setDurationSec] = useState<number>(record?.duration_seconds ?? 2.5);

  const showPosition = style === "bold_statement" || style === "kinetic_word";

  async function save() {
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user_id = userRes.user?.id;
      if (!user_id) throw new Error("Not authenticated");

      const payload = {
        user_id,
        project_id: scene.project_id,
        scene_id: scene.id,
        graphic_category: "text_overlay" as const,
        overlay_text: text.slice(0, 60),
        overlay_style: style,
        animation_style: animation,
        position: showPosition ? position : null,
        text_color: color,
        start_seconds: startSec,
        duration_seconds: durationSec,
        confirmed: true,
      };

      const client = supabase as unknown as {
        from: (t: string) => ReturnType<typeof supabase.from>;
      };
      let res;
      if (record) {
        res = await client
          .from("scene_graphics")
          .update(payload)
          .eq("id", record.id)
          .select()
          .single();
      } else {
        res = await client.from("scene_graphics").insert(payload).select().single();
      }
      if (res.error) throw res.error;
      upsertSceneGraphic(res.data as unknown as SceneGraphicRecord);
      setEditing(false);
      toast.success("Text overlay configured");
    } catch (e) {
      toast.error((e as Error).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (record?.confirmed && !editing) {
    return (
      <section className="space-y-3">
        <SectionHeader title="Text Overlay" enabled={enabled} onToggle={setEnabled} />
        {enabled ? (
          <div className="space-y-2 rounded-md border p-3" style={{ borderColor: "#222" }}>
            <div className="flex items-center gap-2 text-xs">
              <Check className="h-3.5 w-3.5" style={{ color: "#5cb85c" }} />
              <span className="text-foreground">Text overlay configured</span>
            </div>
            <PreviewCard
              text={record.overlay_text ?? ""}
              style={record.overlay_style ?? "bold_statement"}
              position={record.position ?? "Center"}
              color={record.text_color ?? "#f0f0f0"}
            />
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-3 w-3" /> Edit
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Text overlay disabled for this scene</p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <SectionHeader title="Text Overlay" enabled={enabled} onToggle={setEnabled} />
      {!enabled ? (
        <p className="text-xs text-muted-foreground">Text overlay disabled for this scene</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Overlay Text</Label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 60))}
              maxLength={60}
            />
            <div className="text-right text-[10px] text-muted-foreground">{text.length} / 60</div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Text Style</Label>
            <div className="flex flex-wrap gap-1.5">
              {OVERLAY_STYLES.map((s) => (
                <PillButton
                  key={s.id}
                  active={style === s.id}
                  title={s.desc}
                  onClick={() => {
                    setStyle(s.id);
                    if (s.id === "bold_statement") setPosition("Center");
                    else setPosition("Bottom");
                  }}
                >
                  {s.label}
                </PillButton>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Appears at</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step={0.1}
                  value={startSec}
                  onChange={(e) => setStartSec(parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
                <span className="text-[10px] text-muted-foreground">sec start</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duration</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step={0.1}
                  value={durationSec}
                  onChange={(e) => setDurationSec(parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
                <span className="text-[10px] text-muted-foreground">sec</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Animation</Label>
            <div className="flex flex-wrap gap-1.5">
              {ANIMATIONS.map((a) => (
                <PillButton key={a} active={animation === a} onClick={() => setAnimation(a)}>
                  {a}
                </PillButton>
              ))}
            </div>
          </div>

          {showPosition && (
            <div className="space-y-1.5">
              <Label className="text-xs">Position</Label>
              <div className="flex gap-1.5">
                {(["Top", "Center", "Bottom"] as const).map((p) => (
                  <PillButton key={p} active={position === p} onClick={() => setPosition(p)}>
                    {p}
                  </PillButton>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Text Color</Label>
            <div className="flex items-center gap-2">
              {[
                { v: "#f0f0f0", label: "White" },
                { v: "#e8c547", label: "Gold" },
              ].map((c) => (
                <button
                  key={c.v}
                  onClick={() => setColor(c.v)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2",
                    color === c.v ? "ring-2 ring-offset-1 ring-offset-background" : "",
                  )}
                  style={{
                    backgroundColor: c.v,
                    borderColor: color === c.v ? GOLD : "#333",
                  }}
                  title={c.label}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-10 cursor-pointer rounded border bg-transparent"
                style={{ borderColor: "#333" }}
                title="Custom"
              />
            </div>
          </div>

          <PreviewCard text={text} style={style} position={position} color={color} />

          <Button
            onClick={save}
            disabled={saving || !text.trim()}
            className="w-full"
            style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
          >
            {saving ? "Saving…" : "Confirm Text Overlay"}
          </Button>
        </div>
      )}
    </section>
  );
}

function PreviewCard({
  text,
  style,
  position,
  color,
}: {
  text: string;
  style: string;
  position: string;
  color: string;
}) {
  const justify =
    position === "Top" ? "items-start" : position === "Bottom" ? "items-end" : "items-center";

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-md border p-4 flex justify-center",
        justify,
      )}
      style={{ backgroundColor: "#0a0a0a", borderColor: "#222" }}
    >
      {style === "lower_third" ? (
        <div
          className="absolute bottom-3 left-3 right-3 rounded-sm px-3 py-1.5 text-xs font-semibold"
          style={{ backgroundColor: "rgba(0,0,0,0.7)", borderLeft: `3px solid ${GOLD}`, color }}
        >
          {text || "Lower third text"}
        </div>
      ) : style === "subtitle" ? (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-sm bg-black/70 px-2 py-1 text-[11px]"
          style={{ color }}
        >
          {text || "Subtitle text"}
        </div>
      ) : style === "kinetic_word" ? (
        <div className="text-2xl font-black uppercase tracking-tight" style={{ color }}>
          {text || "WORD"}
        </div>
      ) : (
        <div className="text-center text-xl font-bold leading-tight" style={{ color }}>
          {text || "Bold statement"}
        </div>
      )}
    </div>
  );
}

/* =================== DATA GRAPHIC =================== */

function DataGraphicSection({
  scene,
  record,
}: {
  scene: Scene;
  record: SceneGraphicRecord | undefined;
}) {
  const { upsertSceneGraphic } = useStudio();
  const [enabled, setEnabled] = useState(true);
  const [editing, setEditing] = useState(!record?.confirmed);
  const [saving, setSaving] = useState(false);

  const recommendedType = (scene.motion_graphic_type as GType) || "counter";
  const [type, setType] = useState<GType>(
    ((record?.graphic_type as GType) || recommendedType) as GType,
  );
  const [data, setData] = useState<Record<string, any>>(
    (record?.graphic_data as any) || (scene.motion_graphic_data as any) || {},
  );
  const [renderMethod, setRenderMethod] = useState<string>(record?.render_method ?? "remotion");
  const [placement, setPlacement] = useState<string>(record?.position ?? "full_scene");
  const [startSec, setStartSec] = useState<number>(record?.start_seconds ?? 1.0);
  const [durationSec, setDurationSec] = useState<number>(record?.duration_seconds ?? 3.0);

  async function save() {
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user_id = userRes.user?.id;
      if (!user_id) throw new Error("Not authenticated");

      const payload = {
        user_id,
        project_id: scene.project_id,
        scene_id: scene.id,
        graphic_category: "data_graphic" as const,
        graphic_type: type,
        graphic_data: data,
        render_method: renderMethod,
        position: placement,
        start_seconds: startSec,
        duration_seconds: durationSec,
        confirmed: true,
      };

      const client = supabase as unknown as {
        from: (t: string) => ReturnType<typeof supabase.from>;
      };
      let res;
      if (record) {
        res = await client
          .from("scene_graphics")
          .update(payload)
          .eq("id", record.id)
          .select()
          .single();
      } else {
        res = await client.from("scene_graphics").insert(payload).select().single();
      }
      if (res.error) throw res.error;
      upsertSceneGraphic(res.data as unknown as SceneGraphicRecord);
      setEditing(false);
      toast.success("Data graphic configured");
    } catch (e) {
      toast.error((e as Error).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (record?.confirmed && !editing) {
    return (
      <section className="space-y-3">
        <SectionHeader title="Data Graphic" enabled={enabled} onToggle={setEnabled} />
        {enabled ? (
          <div className="space-y-2 rounded-md border p-3" style={{ borderColor: "#222" }}>
            <div className="flex items-center gap-2 text-xs">
              <Check className="h-3.5 w-3.5" style={{ color: "#5cb85c" }} />
              <span>
                Data graphic configured · {record.graphic_type} ·{" "}
                <span className="text-muted-foreground">{record.render_method}</span>
              </span>
            </div>
            <div
              className="aspect-video w-full overflow-hidden rounded-md border"
              style={{ borderColor: "#222" }}
            >
              <GraphicPreview
                type={record.graphic_type as GraphicPreviewType}
                data={record.graphic_data}
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-3 w-3" /> Edit
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Data graphic disabled for this scene</p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <SectionHeader title="Data Graphic" enabled={enabled} onToggle={setEnabled} />
      {!enabled ? (
        <p className="text-xs text-muted-foreground">Data graphic disabled for this scene</p>
      ) : (
        <div className="space-y-4">
          {scene.data_graphic_detail && (
            <div
              className="rounded-md border p-2.5 text-xs"
              style={{ backgroundColor: "#1a1100", borderColor: "#333" }}
            >
              <span className="text-muted-foreground">Detected:</span>{" "}
              <span className="text-foreground">{scene.data_graphic_detail}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Graphic Type</Label>
            <div className="flex flex-wrap gap-1.5">
              {GRAPHIC_TYPES.map((g) => (
                <PillButton key={g.id} active={type === g.id} onClick={() => setType(g.id)}>
                  {g.label}
                </PillButton>
              ))}
            </div>
          </div>

          <DataGraphicFields type={type} data={data} setData={setData} />

          <div className="space-y-1.5">
            <Label className="text-xs">How to render this graphic</Label>
            <div className="space-y-1.5">
              {RENDER_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setRenderMethod(m.id)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left transition-colors",
                    renderMethod === m.id ? "border-[var(--accent-gold)]" : "",
                  )}
                  style={{ borderColor: renderMethod === m.id ? GOLD : "#222" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{m.label}</span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                      style={{
                        backgroundColor: m.id === "remotion" ? "rgba(232,197,71,0.15)" : "#1a1a1a",
                        color: m.id === "remotion" ? GOLD : "#888",
                        border: m.id === "remotion" ? `1px solid ${GOLD}55` : "1px solid #333",
                      }}
                    >
                      {m.badge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {renderMethod !== "hera" && (
            <div
              className="aspect-video w-full overflow-hidden rounded-md border"
              style={{ borderColor: "#222" }}
            >
              <GraphicPreview type={type} data={data} />
            </div>
          )}

          {renderMethod === "hera" && (
            <div
              className="rounded-md border p-3 text-xs text-muted-foreground"
              style={{ borderColor: "#222" }}
            >
              Hera generation is available in the Motion Graphic asset tab. This scene will
              reference the generated Hera output when exported.
            </div>
          )}

          {renderMethod === "static_image" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Static image export runs at export time")}
            >
              <Download className="mr-1 h-3 w-3" /> Generate Preview Image
            </Button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Appears at</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step={0.1}
                  value={startSec}
                  onChange={(e) => setStartSec(parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
                <span className="text-[10px] text-muted-foreground">sec</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duration</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step={0.1}
                  value={durationSec}
                  onChange={(e) => setDurationSec(parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
                <span className="text-[10px] text-muted-foreground">sec</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Placement</Label>
            <div className="flex flex-wrap gap-1.5">
              {PLACEMENTS.map((p) => (
                <PillButton
                  key={p.id}
                  active={placement === p.id}
                  onClick={() => setPlacement(p.id)}
                >
                  {p.label}
                </PillButton>
              ))}
            </div>
          </div>

          <Button
            onClick={save}
            disabled={saving}
            className="w-full"
            style={{ backgroundColor: GOLD, color: "#0a0a0a" }}
          >
            {saving ? "Saving…" : "Confirm Data Graphic"}
          </Button>
        </div>
      )}
    </section>
  );
}

function DataGraphicFields({
  type,
  data,
  setData,
}: {
  type: GType;
  data: Record<string, any>;
  setData: (d: Record<string, any>) => void;
}) {
  const update = (patch: Record<string, any>) => setData({ ...data, ...patch });

  if (type === "counter") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Field label="Value">
          <Input value={data.value ?? ""} onChange={(e) => update({ value: e.target.value })} />
        </Field>
        <Field label="Label">
          <Input value={data.label ?? ""} onChange={(e) => update({ label: e.target.value })} />
        </Field>
      </div>
    );
  }
  if (type === "text_card") {
    return (
      <Field label="Headline">
        <Input value={data.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} />
      </Field>
    );
  }
  if (type === "percentage_ring") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Field label="Percent (0–100)">
          <Input
            type="number"
            value={data.percent ?? ""}
            onChange={(e) => update({ percent: parseFloat(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Label">
          <Input value={data.label ?? ""} onChange={(e) => update({ label: e.target.value })} />
        </Field>
      </div>
    );
  }
  if (type === "comparison") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Field label="Left label">
          <Input
            value={data.left_label ?? ""}
            onChange={(e) => update({ left_label: e.target.value })}
          />
        </Field>
        <Field label="Right label">
          <Input
            value={data.right_label ?? ""}
            onChange={(e) => update({ right_label: e.target.value })}
          />
        </Field>
        <Field label="Left value">
          <Input
            value={data.left_value ?? ""}
            onChange={(e) => update({ left_value: e.target.value })}
          />
        </Field>
        <Field label="Right value">
          <Input
            value={data.right_value ?? ""}
            onChange={(e) => update({ right_value: e.target.value })}
          />
        </Field>
      </div>
    );
  }
  if (type === "map_highlight") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Field label="Region">
          <Input value={data.region ?? ""} onChange={(e) => update({ region: e.target.value })} />
        </Field>
        <Field label="Label">
          <Input value={data.label ?? ""} onChange={(e) => update({ label: e.target.value })} />
        </Field>
      </div>
    );
  }
  return (
    <Field label="Data (JSON)">
      <Input
        value={(() => {
          try {
            return JSON.stringify(data);
          } catch {
            return "";
          }
        })()}
        onChange={(e) => {
          try {
            setData(JSON.parse(e.target.value || "{}"));
          } catch {
            /* ignore parse error */
          }
        }}
      />
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* =================== SHARED =================== */

function SectionHeader({
  title,
  enabled,
  onToggle,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between border-b pb-2"
      style={{ borderColor: "#222" }}
    >
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: GOLD }}>
        {title}
      </h4>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}

function PillButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-[var(--accent-gold)] bg-[rgba(232,197,71,0.12)] text-foreground"
          : "border-[#333] text-muted-foreground hover:text-foreground",
      )}
      style={{ borderColor: active ? GOLD : "#333" }}
    >
      {children}
    </button>
  );
}

/* =================== STATUS HELPER =================== */

export function computeGraphicsStats(
  scenes: Scene[],
  sceneGraphics: SceneGraphicRecord[],
): { flagged: number; complete: number } {
  let flagged = 0;
  let complete = 0;
  for (const s of scenes) {
    const needsText = s.text_overlay_flag;
    const needsData = s.data_graphic_flag;
    if (!needsText && !needsData) continue;
    flagged += 1;
    const sg = sceneGraphics.filter((g) => g.scene_id === s.id && g.confirmed);
    const textOk = !needsText || sg.some((g) => g.graphic_category === "text_overlay");
    const dataOk = !needsData || sg.some((g) => g.graphic_category === "data_graphic");
    if (textOk && dataOk) complete += 1;
  }
  return { flagged, complete };
}
