import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Loader2, RefreshCw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateVideoMetadata } from "@/lib/metadata.functions";
import { useStudio, type VideoMetadataRecord } from "@/lib/studio-context";

type Title = { text: string; formula?: string };
type Chapter = { time: string; title: string };

export function MetadataViewer({ onClose }: { onClose: () => void }) {
  const { project, videoMetadata, setVideoMetadata } = useStudio();
  const genFn = useServerFn(generateVideoMetadata);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number>(Date.now());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generate = async (force = false) => {
    setBusy(true);
    try {
      const res = await genFn({ data: { projectId: project.id, force } });
      setVideoMetadata(res.record as VideoMetadataRecord);
      if (!res.cached) toast.success("Metadata generated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = (patch: Partial<VideoMetadataRecord>) => {
    if (!videoMetadata) return;
    const next = { ...videoMetadata, ...patch };
    setVideoMetadata(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const sb = supabase as unknown as { from: (t: string) => any };
      await sb.from("video_metadata").update(patch).eq("id", videoMetadata.id);
      setSavedAt(Date.now());
    }, 500);
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}`);
  };

  const titles = (videoMetadata?.titles ?? []) as Title[];
  const selectedTitle = videoMetadata?.selected_title ?? "";
  const description = videoMetadata?.description ?? "";
  const tags = videoMetadata?.tags ?? [];
  const hashtags = videoMetadata?.hashtags ?? [];
  const chapters = (videoMetadata?.chapters ?? []) as Chapter[];
  const pv = (videoMetadata?.platform_variations ?? {}) as Record<string, Record<string, string>>;
  const tagsCharLen = tags.join(", ").length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a]">
      <header className="flex items-center justify-between border-b border-[#2a2a2a] px-6 py-3">
        <div>
          <h2 className="text-lg font-semibold">Video Metadata</h2>
          <p className="text-xs text-muted-foreground">
            All changes saved · last save {new Date(savedAt).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-2">
          {videoMetadata && (
            <Button variant="outline" size="sm" onClick={() => generate(true)} disabled={busy}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {!videoMetadata ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-sm text-muted-foreground">No metadata yet</p>
            <Button onClick={() => generate(false)} disabled={busy}>
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Generate Metadata
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="titles" className="mx-auto max-w-4xl">
            <TabsList>
              <TabsTrigger value="titles">Titles</TabsTrigger>
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="tags">Tags</TabsTrigger>
              <TabsTrigger value="chapters">Chapters</TabsTrigger>
              <TabsTrigger value="platforms">Platforms</TabsTrigger>
            </TabsList>

            <TabsContent value="titles" className="space-y-3">
              {titles.map((t, i) => {
                const isSel = selectedTitle === t.text;
                return (
                  <div
                    key={i}
                    className="rounded-lg border bg-[#141414] p-4"
                    style={{ borderColor: isSel ? "var(--accent-gold)" : "#2a2a2a" }}
                  >
                    <div className="text-lg font-bold">{t.text}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{t.formula || "—"}</span>
                      <span>·</span>
                      <span className={t.text.length > 60 ? "text-red-400" : ""}>
                        {t.text.length}/60
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant={isSel ? "default" : "outline"}
                      className="mt-2"
                      onClick={() => save({ selected_title: t.text })}
                    >
                      {isSel ? <Check className="mr-1 h-3 w-3" /> : null}
                      {isSel ? "Selected" : "Select"}
                    </Button>
                  </div>
                );
              })}
              <div className="pt-3">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Edit Title
                </div>
                <Input
                  value={selectedTitle}
                  onChange={(e) => save({ selected_title: e.target.value })}
                />
                <div
                  className={`mt-1 text-[11px] ${selectedTitle.length > 60 ? "text-red-400" : "text-muted-foreground"}`}
                >
                  {selectedTitle.length}/60
                </div>
              </div>
            </TabsContent>

            <TabsContent value="description" className="space-y-3">
              <Textarea
                rows={14}
                value={description}
                onChange={(e) => save({ description: e.target.value })}
              />
              <div className="text-[11px] text-muted-foreground">{description.length} chars</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(description, "description")}
                >
                  <Copy className="mr-1 h-3 w-3" /> Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copy(`${description}\n\n${hashtags.join(" ")}`, "YouTube description")
                  }
                >
                  <Copy className="mr-1 h-3 w-3" /> Copy for YouTube
                </Button>
              </div>
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Hashtags
                </div>
                <div className="flex flex-wrap gap-2">
                  {hashtags.map((h, i) => (
                    <button
                      key={i}
                      className="rounded-full bg-[var(--accent-gold)]/15 px-3 py-1 text-xs text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/25"
                      onClick={() => save({ hashtags: hashtags.filter((_, j) => j !== i) })}
                    >
                      {h} ✕
                    </button>
                  ))}
                  <AddPill
                    onAdd={(v) =>
                      save({ hashtags: [...hashtags, v.startsWith("#") ? v : `#${v}`] })
                    }
                    placeholder="#new"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tags" className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {tags.map((t, i) => (
                  <button
                    key={i}
                    className="rounded-full bg-[#1f1f1f] px-3 py-1 text-xs hover:bg-[#2a2a2a]"
                    onClick={() => save({ tags: tags.filter((_, j) => j !== i) })}
                  >
                    {t} ✕
                  </button>
                ))}
                <AddPill onAdd={(v) => save({ tags: [...tags, v] })} placeholder="new tag" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{tagsCharLen} / 500 chars</span>
                <Button size="sm" variant="outline" onClick={() => copy(tags.join(", "), "tags")}>
                  <Copy className="mr-1 h-3 w-3" /> Copy All Tags
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="chapters" className="space-y-2">
              {chapters.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="w-24"
                    value={c.time}
                    onChange={(e) => {
                      const next = chapters.map((x, j) =>
                        j === i ? { ...x, time: e.target.value } : x,
                      );
                      save({ chapters: next });
                    }}
                  />
                  <Input
                    value={c.title}
                    onChange={(e) => {
                      const next = chapters.map((x, j) =>
                        j === i ? { ...x, title: e.target.value } : x,
                      );
                      save({ chapters: next });
                    }}
                  />
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  copy(chapters.map((c) => `${c.time} ${c.title}`).join("\n"), "chapters")
                }
              >
                <Copy className="mr-1 h-3 w-3" /> Copy Chapters
              </Button>
            </TabsContent>

            <TabsContent value="platforms" className="space-y-6">
              {(["linkedin", "twitter", "youtube_shorts"] as const).map((platform) => {
                const data = pv[platform] ?? {};
                const fields =
                  platform === "linkedin"
                    ? ["hook", "body", "cta"]
                    : platform === "twitter"
                      ? ["tweet", "thread_opener"]
                      : ["hook", "description"];
                return (
                  <div
                    key={platform}
                    className="rounded-lg border border-[#2a2a2a] bg-[#141414] p-4"
                  >
                    <h3 className="mb-3 text-sm font-semibold capitalize">
                      {platform.replace("_", " ")}
                    </h3>
                    {fields.map((f) => (
                      <div key={f} className="mb-2">
                        <div className="mb-1 text-[10px] uppercase text-muted-foreground">{f}</div>
                        <Textarea
                          rows={f === "body" || f === "description" ? 4 : 2}
                          value={data[f] ?? ""}
                          onChange={(e) =>
                            save({
                              platform_variations: {
                                ...pv,
                                [platform]: { ...data, [f]: e.target.value },
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copy(fields.map((f) => data[f] ?? "").join("\n\n"), platform)}
                    >
                      <Copy className="mr-1 h-3 w-3" /> Copy
                    </Button>
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function AddPill({ onAdd, placeholder }: { onAdd: (v: string) => void; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <Input
      value={v}
      placeholder={placeholder}
      className="h-7 w-32 text-xs"
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && v.trim()) {
          onAdd(v.trim());
          setV("");
        }
      }}
    />
  );
}
