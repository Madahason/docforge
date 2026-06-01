import { useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  Copy,
  Download,
  Loader2,
  Plus,
  MoreHorizontal,
  Trash2,
  Split,
  Merge,
  ArrowUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  buildCaptionLines,
  buildSRT,
  buildVTT,
  type CaptionLine,
  type CaptionStyle,
  STYLE_PRESETS,
  type StylePresetId,
  MAX_CHARS_PER_LINE,
  renumber,
} from "@/lib/captions";
import { useStudio, type Scene, type Voiceover, type CaptionRecord } from "@/lib/studio-context";

const ACCENT_GOLD = "var(--accent-gold)";

export function CaptionsTab({ scene }: { scene: Scene }) {
  const { voiceovers, captions, upsertCaption } = useStudio();
  const vo = voiceovers.find((v) => v.scene_id === scene.id) ?? null;
  const record = captions.find((c) => c.scene_id === scene.id) ?? null;

  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState<StylePresetId>(
    (record?.style_preset as StylePresetId) ?? "documentary",
  );

  useEffect(() => {
    if (record?.style_preset) setPreset(record.style_preset as StylePresetId);
  }, [record?.style_preset]);

  if (!vo || !vo.audio_url) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Mic className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">Generate voiceover first</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Captions are built from your voiceover audio.
        </p>
        <p className="mt-3 text-xs" style={{ color: ACCENT_GOLD }}>
          Go to Voiceover tab →
        </p>
      </div>
    );
  }

  if (!record || record.status !== "complete") {
    return (
      <div className="space-y-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Captions
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Captions are generated from your voiceover timestamps. No API calls needed.
          </p>
        </div>
        <StylePresetPicker value={preset} onChange={setPreset} />
        <Button
          variant="outline"
          className="w-full"
          style={{ borderColor: ACCENT_GOLD, color: ACCENT_GOLD }}
          disabled={busy || !vo.word_timestamps?.length}
          onClick={async () => {
            setBusy(true);
            try {
              await generateCaptionsForScene({ scene, vo, preset, upsertCaption });
              toast.success("Captions generated");
            } catch (e) {
              toast.error((e as Error).message || "Could not generate captions");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Building caption lines...
            </>
          ) : (
            "Generate Captions"
          )}
        </Button>
        {!vo.word_timestamps?.length && (
          <p className="text-[11px] text-muted-foreground">
            Voiceover word timestamps unavailable. Regenerate the voiceover to enable captions.
          </p>
        )}
      </div>
    );
  }

  return <CaptionsEditor record={record} scene={scene} vo={vo} />;
}

function StylePresetPicker({
  value,
  onChange,
}: {
  value: StylePresetId;
  onChange: (v: StylePresetId) => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Caption Style
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {(Object.keys(STYLE_PRESETS) as StylePresetId[]).map((id) => {
          const preset = STYLE_PRESETS[id];
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "rounded-md border bg-card p-2 text-left text-xs transition-colors",
                selected ? "border-[var(--accent-gold)]" : "border-border hover:border-border/80",
              )}
            >
              <PresetMiniPreview style={preset.style} />
              <div className="mt-2 text-[11px] font-medium">{preset.label}</div>
              <div className="text-[10px] text-muted-foreground">{preset.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PresetMiniPreview({ style }: { style: CaptionStyle }) {
  return (
    <div className="relative flex h-16 w-full overflow-hidden rounded bg-black">
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 px-2 py-0.5 text-[9px]",
          style.position === "top" && "top-1.5",
          style.position === "center" && "top-1/2 -translate-y-1/2",
          style.position === "bottom" && "bottom-1.5",
        )}
        style={{
          color: style.text_color,
          fontWeight:
            style.font_weight === "bold" ? 700 : style.font_weight === "extra-bold" ? 800 : 400,
          backgroundColor:
            style.background === "dark_bar" || style.background === "dark_box"
              ? `rgba(0,0,0,${style.background_opacity})`
              : "transparent",
          textShadow:
            style.text_shadow === "hard"
              ? "2px 2px 0 rgba(0,0,0,0.8)"
              : style.text_shadow === "soft"
                ? "0 1px 2px rgba(0,0,0,0.9)"
                : "none",
        }}
      >
        Caption text
      </div>
    </div>
  );
}

function CaptionsEditor({
  record,
  scene,
  vo,
}: {
  record: CaptionRecord;
  scene: Scene;
  vo: Voiceover;
}) {
  const { upsertCaption, scenes, captions, voiceovers, project } = useStudio();
  const [lines, setLines] = useState<CaptionLine[]>(record.caption_lines);
  const [preset, setPreset] = useState<StylePresetId>(record.style_preset as StylePresetId);
  const [showStyle, setShowStyle] = useState(false);
  const [customStyle, setCustomStyle] = useState<CaptionStyle>(
    (record.custom_styles as CaptionStyle | null) ?? STYLE_PRESETS[preset].style,
  );
  const [copyLabel, setCopyLabel] = useState("Copy SRT");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setLines(record.caption_lines), [record.caption_lines]);

  const isLastScene = useMemo(() => {
    const sorted = scenes.slice().sort((a, b) => a.scene_index - b.scene_index);
    return sorted[sorted.length - 1]?.id === scene.id;
  }, [scenes, scene.id]);

  const saveLines = (
    next: CaptionLine[],
    opts?: { presetOverride?: StylePresetId; style?: CaptionStyle },
  ) => {
    const ordered = renumber(next);
    setLines(ordered);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const srt = buildSRT(ordered);
      const vtt = buildVTT(ordered);
      const usedPreset = opts?.presetOverride ?? preset;
      const usedStyle = opts?.style ?? customStyle;
      const patch = {
        caption_lines: ordered as unknown as object,
        srt_content: srt,
        vtt_content: vtt,
        style_preset: usedPreset,
        custom_styles: usedStyle as unknown as object,
        status: "complete",
      };
      const { data, error } = await (
        supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }
      )
        .from("captions")
        .update(patch)
        .eq("id", record.id)
        .select()
        .single();
      if (error) {
        toast.error("Could not save captions");
        return;
      }
      upsertCaption(data as unknown as CaptionRecord);
    }, 400);
  };

  const updateLineText = (idx: number, text: string) => {
    const next = lines.slice();
    next[idx] = { ...next[idx], text };
    saveLines(next);
  };

  const deleteLine = (idx: number) => {
    const next = lines.filter((_, i) => i !== idx);
    saveLines(next);
  };

  const insertLineAbove = (idx: number) => {
    const at = lines[idx];
    const newLine: CaptionLine = {
      text: "New caption",
      start: Math.max(0, (at?.start ?? 0) - 0.5),
      end: at?.start ?? 0.5,
      line_number: 0,
    };
    const next = [...lines.slice(0, idx), newLine, ...lines.slice(idx)];
    saveLines(next);
  };

  const addLineEnd = () => {
    const last = lines[lines.length - 1];
    const start = (last?.end ?? 0) + 0.1;
    const next = [...lines, { text: "New caption", start, end: start + 2, line_number: 0 }];
    saveLines(next);
  };

  const splitLine = (idx: number) => {
    const line = lines[idx];
    const words = line.text.split(" ");
    if (words.length < 2) return;
    const mid = Math.ceil(words.length / 2);
    const midTime = line.start + (line.end - line.start) / 2;
    const a: CaptionLine = {
      text: words.slice(0, mid).join(" "),
      start: line.start,
      end: midTime,
      line_number: 0,
    };
    const b: CaptionLine = {
      text: words.slice(mid).join(" "),
      start: midTime,
      end: line.end,
      line_number: 0,
    };
    const next = [...lines.slice(0, idx), a, b, ...lines.slice(idx + 1)];
    saveLines(next);
  };

  const mergeWithNext = (idx: number) => {
    if (idx >= lines.length - 1) return;
    const a = lines[idx];
    const b = lines[idx + 1];
    const merged: CaptionLine = {
      text: `${a.text} ${b.text}`.trim(),
      start: a.start,
      end: b.end,
      line_number: 0,
    };
    const next = [...lines.slice(0, idx), merged, ...lines.slice(idx + 2)];
    saveLines(next);
  };

  const regenerate = async () => {
    if (!vo.word_timestamps?.length) {
      toast.error("No word timestamps available");
      return;
    }
    const built = buildCaptionLines(
      vo.word_timestamps as unknown as { word: string; start: number; end: number }[],
    );
    saveLines(built);
    toast.success("Captions rebuilt from voiceover");
  };

  const copySrt = async () => {
    const srt = buildSRT(lines);
    await navigator.clipboard.writeText(srt);
    setCopyLabel("Copied!");
    setTimeout(() => setCopyLabel("Copy SRT"), 2000);
  };

  const downloadSrt = () => {
    const srt = buildSRT(lines);
    downloadFile(`scene_${scene.scene_index + 1}_captions.srt`, srt);
  };

  const copyAllScenesSrt = async () => {
    const combined = buildCombinedSrt(scenes, captions, voiceovers);
    await navigator.clipboard.writeText(combined);
    toast.success("Combined SRT copied to clipboard");
  };

  const applyPresetChange = (id: StylePresetId) => {
    setPreset(id);
    const nextStyle = STYLE_PRESETS[id].style;
    setCustomStyle(nextStyle);
    saveLines(lines, { presetOverride: id, style: nextStyle });
  };

  const saveCustomStyle = (style: CaptionStyle) => {
    setCustomStyle(style);
    saveLines(lines, { style });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{lines.length} caption lines</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowStyle((v) => !v)}>
            Edit Style
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-muted-foreground"
            onClick={regenerate}
          >
            Regenerate
          </Button>
        </div>
      </div>

      <StylePresetPicker value={preset} onChange={applyPresetChange} />

      {showStyle && (
        <StyleCustomizer
          style={customStyle}
          onSave={saveCustomStyle}
          onReset={() => {
            const reset = STYLE_PRESETS[preset].style;
            setCustomStyle(reset);
            saveLines(lines, { style: reset });
          }}
        />
      )}

      <div
        className="max-h-[420px] overflow-y-auto rounded-md border"
        style={{ borderColor: "#222" }}
      >
        {lines.map((line, idx) => (
          <CaptionRow
            key={idx}
            line={line}
            index={idx}
            isLast={idx === lines.length - 1}
            onTextChange={(t) => updateLineText(idx, t)}
            onSplit={() => splitLine(idx)}
            onMerge={() => mergeWithNext(idx)}
            onDelete={() => deleteLine(idx)}
            onInsertAbove={() => insertLineAbove(idx)}
          />
        ))}
        {lines.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground">No caption lines.</div>
        )}
      </div>

      <Button size="sm" variant="outline" onClick={addLineEnd}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add Line
      </Button>

      <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "#222" }}>
        <Button size="sm" variant="outline" onClick={copySrt}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          {copyLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={downloadSrt}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Download SRT
        </Button>
        {isLastScene && (
          <Button size="sm" variant="outline" onClick={copyAllScenesSrt}>
            <Copy className="mr-1 h-3.5 w-3.5" />
            Copy All Scenes SRT
          </Button>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground">Project: {project.title}</div>
    </div>
  );
}

function CaptionRow({
  line,
  index,
  isLast,
  onTextChange,
  onSplit,
  onMerge,
  onDelete,
  onInsertAbove,
}: {
  line: CaptionLine;
  index: number;
  isLast: boolean;
  onTextChange: (t: string) => void;
  onSplit: () => void;
  onMerge: () => void;
  onDelete: () => void;
  onInsertAbove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(line.text);
  useEffect(() => setDraft(line.text), [line.text]);

  const duration = Math.max(0, line.end - line.start);
  const tooLong = line.text.length > MAX_CHARS_PER_LINE;
  const tooSlow = duration > 4;
  const warn = tooLong || tooSlow;

  const commit = () => {
    setEditing(false);
    if (draft !== line.text) onTextChange(draft);
  };

  return (
    <TooltipProvider>
      <div
        className={cn(
          "group flex items-center gap-3 border-b px-3 py-2 text-xs last:border-b-0",
          warn && "border-l-2",
        )}
        style={{
          borderColor: "#222",
          borderLeftColor: warn ? "#facc15" : "transparent",
        }}
      >
        <div className="w-6 shrink-0 text-muted-foreground">{index + 1}</div>
        <div className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">
          {fmtShort(line.start)} — {fmtShort(line.end)}
        </div>
        <div className="flex-1">
          {editing ? (
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(line.text);
                  setEditing(false);
                }
              }}
              className="h-7 text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-full truncate text-left text-foreground hover:text-[var(--accent-gold)]"
            >
              {line.text || <span className="text-muted-foreground italic">(empty)</span>}
            </button>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{
                color: warn ? "#facc15" : ACCENT_GOLD,
                backgroundColor: warn ? "rgba(250,204,21,0.12)" : "rgba(232,197,71,0.12)",
              }}
            >
              {duration.toFixed(1)}s
            </span>
          </TooltipTrigger>
          <TooltipContent side="left">
            {tooLong
              ? "Line may be too long"
              : tooSlow
                ? "Consider splitting this line"
                : "Duration"}
          </TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Line actions"
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSplit}>
              <Split className="mr-2 h-3.5 w-3.5" /> Split Line
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMerge} disabled={isLast}>
              <Merge className="mr-2 h-3.5 w-3.5" /> Merge with Next
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onInsertAbove}>
              <ArrowUp className="mr-2 h-3.5 w-3.5" /> Insert Line Above
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Line
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}

function StyleCustomizer({
  style,
  onSave,
  onReset,
}: {
  style: CaptionStyle;
  onSave: (s: CaptionStyle) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<CaptionStyle>(style);
  useEffect(() => setDraft(style), [style]);
  const update = (patch: Partial<CaptionStyle>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="space-y-3 rounded-md border p-3" style={{ borderColor: "#222" }}>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <Label className="text-[10px] text-muted-foreground">Font Size</Label>
          <Input
            type="number"
            min={16}
            max={40}
            value={draft.font_size}
            onChange={(e) =>
              update({ font_size: Math.min(40, Math.max(16, Number(e.target.value) || 22)) })
            }
            className="h-8"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Font Weight</Label>
          <Select
            value={draft.font_weight}
            onValueChange={(v) => update({ font_weight: v as CaptionStyle["font_weight"] })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="bold">Bold</SelectItem>
              <SelectItem value="extra-bold">Extra Bold</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Text Color</Label>
          <Input
            type="color"
            value={draft.text_color}
            onChange={(e) => update({ text_color: e.target.value })}
            className="h-8 w-full"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Background</Label>
          <Select
            value={draft.background}
            onValueChange={(v) => update({ background: v as CaptionStyle["background"] })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="dark_bar">Dark Bar</SelectItem>
              <SelectItem value="dark_box">Dark Box</SelectItem>
              <SelectItem value="blur">Blur</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] text-muted-foreground">
            Background Opacity ({Math.round(draft.background_opacity * 100)}%)
          </Label>
          <Slider
            value={[draft.background_opacity * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => update({ background_opacity: v / 100 })}
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Position</Label>
          <Select
            value={draft.position}
            onValueChange={(v) => update({ position: v as CaptionStyle["position"] })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Horizontal</Label>
          <Select
            value={draft.horizontal}
            onValueChange={(v) => update({ horizontal: v as CaptionStyle["horizontal"] })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Text Shadow</Label>
          <Select
            value={draft.text_shadow}
            onValueChange={(v) => update({ text_shadow: v as CaptionStyle["text_shadow"] })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="soft">Soft</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Letter Spacing</Label>
          <Select
            value={draft.letter_spacing}
            onValueChange={(v) => update({ letter_spacing: v as CaptionStyle["letter_spacing"] })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="wide">Wide</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          style={{ borderColor: ACCENT_GOLD, color: ACCENT_GOLD }}
          onClick={() => onSave(draft)}
        >
          Save as Custom Style
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset}>
          Reset to Preset
        </Button>
      </div>
    </div>
  );
}

// ---------- helpers ----------

function fmtShort(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function downloadFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function generateCaptionsForScene({
  scene,
  vo,
  preset,
  upsertCaption,
}: {
  scene: Scene;
  vo: Voiceover;
  preset: StylePresetId;
  upsertCaption: (c: CaptionRecord) => void;
}) {
  const words = (vo.word_timestamps ?? []) as { word: string; start: number; end: number }[];
  if (!words.length) throw new Error("Voiceover has no word timestamps");
  const lines = buildCaptionLines(words);
  const srt = buildSRT(lines);
  const vtt = buildVTT(lines);
  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id;
  if (!userId) throw new Error("Not signed in");

  const payload = {
    user_id: userId,
    project_id: scene.project_id,
    scene_id: scene.id,
    voiceover_id: vo.id,
    words: words as unknown as object,
    caption_lines: lines as unknown as object,
    style_preset: preset,
    custom_styles: STYLE_PRESETS[preset].style as unknown as object,
    srt_content: srt,
    vtt_content: vtt,
    status: "complete",
  };

  const sb = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };
  const { data, error } = await sb
    .from("captions")
    .upsert(payload, { onConflict: "scene_id" })
    .select()
    .single();
  if (error) throw error;
  upsertCaption(data as unknown as CaptionRecord);

  await supabase.from("scenes").update({ captions_status: "complete" }).eq("id", scene.id);
}

export function buildCombinedSrt(
  scenes: Scene[],
  captions: CaptionRecord[],
  voiceovers: Voiceover[],
): string {
  const ordered = scenes.slice().sort((a, b) => a.scene_index - b.scene_index);
  let timeOffset = 0;
  let lineCounter = 0;
  const blocks: string[] = [];
  for (const scene of ordered) {
    const cap = captions.find((c) => c.scene_id === scene.id);
    const vo = voiceovers.find((v) => v.scene_id === scene.id);
    if (cap?.caption_lines?.length) {
      for (const line of cap.caption_lines) {
        lineCounter += 1;
        const startStr = formatSrt(line.start + timeOffset);
        const endStr = formatSrt(line.end + timeOffset);
        blocks.push(`${lineCounter}\n${startStr} --> ${endStr}\n${line.text}\n`);
      }
    }
    timeOffset += vo?.duration_seconds ?? scene.estimated_seconds ?? 0;
  }
  return blocks.join("\n");
}

function formatSrt(seconds: number) {
  // Re-export of the formatter so this file is self-contained for combined SRT.
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function downloadCombinedSrt(filename: string, contents: string) {
  downloadFile(filename, contents);
}
