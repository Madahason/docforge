import { useMemo, useState } from "react";
import { X, Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useStudio } from "@/lib/studio-context";
import {
  buildExportZip,
  buildFolderPreview,
  collectAssetUrls,
  countSelectedFiles,
  estimatedSizeMB,
  PLATFORM_LABELS,
  slugify,
  triggerDownload,
  type ExportPlatform,
  type ExportSelections,
} from "@/lib/export-package";

const SECTIONS: {
  label: string;
  items: {
    key: keyof ExportSelections;
    label: string;
    hint?: string;
    needs?:
      | "manifest"
      | "metadata"
      | "thumbnail"
      | "captions"
      | "voiceovers"
      | "graphics"
      | "clips";
  }[];
}[] = [
  {
    label: "DOCUMENTS",
    items: [
      { key: "manifest_json", label: "Assembly Manifest (JSON)", needs: "manifest" },
      { key: "manifest_pdf", label: "Assembly Manifest (PDF)", needs: "manifest" },
      { key: "manifest_markdown", label: "Assembly Manifest (Markdown)", needs: "manifest" },
      {
        key: "editor_brief",
        label: "Editor Brief (TXT)",
        hint: "Plain-English guide for editor.",
        needs: "manifest",
      },
      { key: "metadata_json", label: "Video Metadata (JSON)", needs: "metadata" },
      { key: "full_srt", label: "Captions — Full Video (SRT)", needs: "captions" },
      { key: "per_scene_srt", label: "Captions — Per Scene (SRTs)", needs: "captions" },
    ],
  },
  {
    label: "AUDIO",
    items: [
      {
        key: "voiceovers",
        label: "Voiceover Files (URLs)",
        hint: "Scene MP3 URLs + filename plan.",
        needs: "voiceovers",
      },
    ],
  },
  {
    label: "VISUAL REFERENCES",
    items: [
      { key: "clip_references", label: "Clip References (JSON)", needs: "clips" },
      { key: "ai_images", label: "AI Image URLs (JSON)", needs: "clips" },
      { key: "hera_videos", label: "Hera Video URLs (JSON)", needs: "graphics" },
      { key: "motion_graphic_specs", label: "Motion Graphic Specs (JSON)", needs: "graphics" },
    ],
  },
  {
    label: "PROMPTS & SPECS",
    items: [
      { key: "ai_clip_prompts", label: "AI Clip Prompts (TXT)" },
      { key: "thumbnail_concepts", label: "Thumbnail Concepts (TXT)", needs: "thumbnail" },
    ],
  },
  {
    label: "METADATA",
    items: [
      { key: "youtube_metadata", label: "YouTube Metadata (TXT)", needs: "metadata" },
      { key: "platform_copy", label: "Platform Copy (TXT)", needs: "metadata" },
    ],
  },
];

const PLATFORMS: ExportPlatform[] = ["youtube", "youtube_shorts", "linkedin", "twitter"];

export function ExportPackageModal({ onClose }: { onClose: () => void }) {
  const {
    project,
    scenes,
    voiceovers,
    clips,
    motionGraphics,
    captions,
    manifests,
    thumbnail,
    videoMetadata,
  } = useStudio();

  const manifest = useMemo(() => manifests.find((m) => m.is_current) ?? null, [manifests]);

  const availability = useMemo(
    () => ({
      manifest: !!manifest,
      metadata: !!videoMetadata,
      thumbnail: !!thumbnail,
      captions: captions.length > 0,
      voiceovers: voiceovers.some((v) => !!v.audio_url),
      graphics: motionGraphics.length > 0,
      clips: clips.length > 0,
    }),
    [manifest, videoMetadata, thumbnail, captions, voiceovers, motionGraphics, clips],
  );

  const [selections, setSelections] = useState<ExportSelections>(() => ({
    manifest_json: availability.manifest,
    manifest_pdf: availability.manifest,
    manifest_markdown: availability.manifest,
    editor_brief: availability.manifest,
    metadata_json: availability.metadata,
    full_srt: availability.captions,
    per_scene_srt: availability.captions,
    voiceovers: availability.voiceovers,
    clip_references: availability.clips,
    ai_images: availability.clips,
    hera_videos: availability.graphics,
    motion_graphic_specs: availability.graphics,
    ai_clip_prompts: true,
    thumbnail_concepts: availability.thumbnail,
    youtube_metadata: availability.metadata,
    platform_copy: availability.metadata,
  }));

  const [platforms, setPlatforms] = useState<ExportPlatform[]>(["youtube"]);
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [done, setDone] = useState(false);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);

  const inputs = useMemo(
    () => ({
      project,
      scenes,
      voiceovers,
      clips,
      motionGraphics,
      captions,
      manifest,
      thumbnail,
      videoMetadata,
    }),
    [
      project,
      scenes,
      voiceovers,
      clips,
      motionGraphics,
      captions,
      manifest,
      thumbnail,
      videoMetadata,
    ],
  );

  const folderLines = useMemo(
    () => buildFolderPreview(selections, inputs, platforms),
    [selections, inputs, platforms],
  );
  const fileCount = useMemo(
    () => countSelectedFiles(selections, inputs, platforms),
    [selections, inputs, platforms],
  );
  const sizeMB = useMemo(() => estimatedSizeMB(selections, inputs), [selections, inputs]);
  const voiceoverCount = voiceovers.filter((v) => v.audio_url).length;

  function isAvailable(needs?: string) {
    if (!needs) return true;
    return Boolean(availability[needs as keyof typeof availability]);
  }

  function toggle(key: keyof ExportSelections) {
    setSelections((s) => ({ ...s, [key]: !s[key] }));
  }

  function togglePlatform(p: ExportPlatform) {
    setPlatforms((arr) => (arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]));
  }

  async function handleBuild() {
    setBuilding(true);
    setDone(false);
    setProgress(5);
    setProgressMsg("Preparing…");
    try {
      // Fake progress ticks while zip builds.
      let pct = 10;
      const interval = setInterval(() => {
        pct = Math.min(pct + 7, 90);
        setProgress(pct);
      }, 200);
      const blob = await buildExportZip(inputs, selections, platforms, (m) => setProgressMsg(m));
      clearInterval(interval);
      setProgress(100);
      setProgressMsg("Download ready!");
      setLastBlob(blob);
      triggerDownload(blob, `${slugify(project.title)}_docforge_export.zip`);
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to build export package");
      setBuilding(false);
    }
  }

  function handleDownloadAgain() {
    if (!lastBlob) return;
    triggerDownload(lastBlob, `${slugify(project.title)}_docforge_export.zip`);
  }

  async function handleCopyUrls() {
    const urls = collectAssetUrls(inputs);
    if (!urls.length) {
      toast.message("No asset URLs available yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(urls.join("\n"));
      setCopied(true);
      toast.success(`Copied ${urls.length} asset URL${urls.length === 1 ? "" : "s"}`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard access blocked");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0d0d0d]">
      {/* Top bar */}
      <div
        className="flex items-center justify-between border-b px-6"
        style={{ height: 56, borderColor: "#2a2a2a" }}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold">Export Package</div>
          <div className="truncate text-xs text-muted-foreground">{project.title}</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="mr-1 h-4 w-4" /> Close
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — checklist */}
        <div className="w-2/5 overflow-y-auto border-r p-6" style={{ borderColor: "#2a2a2a" }}>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Package Contents
          </div>
          <div className="mb-4 text-xs text-muted-foreground">Select what to include</div>

          <div className="space-y-5">
            {SECTIONS.map((sec) => (
              <div key={sec.label}>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {sec.label}
                </div>
                <div className="space-y-2">
                  {sec.items.map((it) => {
                    const available = isAvailable(it.needs);
                    return (
                      <label
                        key={it.key}
                        className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${
                          available
                            ? "cursor-pointer hover:bg-[var(--surface-elevated)]"
                            : "opacity-40"
                        }`}
                      >
                        <Checkbox
                          checked={available && selections[it.key]}
                          disabled={!available}
                          onCheckedChange={() => available && toggle(it.key)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm">{it.label}</div>
                          {it.hint && (
                            <div className="text-xs text-muted-foreground">{it.hint}</div>
                          )}
                          {!available && (
                            <div className="text-[11px] text-muted-foreground">
                              Not available yet
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — preview & build */}
        <div className="flex w-3/5 flex-col overflow-y-auto p-6">
          {/* Summary card */}
          <div
            className="mb-5 rounded-lg p-5"
            style={{
              backgroundColor: "#141414",
              border: "1px solid #2a2a2a",
              borderRadius: 8,
            }}
          >
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-muted-foreground">Selected items</div>
              <div className="text-right font-medium">{fileCount} files</div>
              <div className="text-muted-foreground">Estimated size</div>
              <div className="text-right font-medium">~{sizeMB} MB</div>
              <div className="text-muted-foreground">Voiceover files</div>
              <div className="text-right font-medium">{voiceoverCount} MP3s</div>
              <div className="text-muted-foreground">Scene count</div>
              <div className="text-right font-medium">{scenes.length} scenes</div>
            </div>
          </div>

          {/* Platforms */}
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Platform Targets
          </div>
          <div className="mb-5 flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const active = platforms.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    active
                      ? "border-[var(--accent-gold)] bg-[var(--accent-gold)] text-black"
                      : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              );
            })}
          </div>

          {/* Folder preview */}
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Folder Structure Preview
          </div>
          <pre
            className="mb-6 max-h-80 overflow-auto rounded-lg p-4 text-[11px] leading-relaxed text-muted-foreground"
            style={{ backgroundColor: "#0a0a0a", border: "1px solid #2a2a2a" }}
          >
            {folderLines.join("\n")}
          </pre>

          {/* Build actions */}
          {building || done ? (
            <div
              className="mb-5 rounded-lg p-5"
              style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a" }}
            >
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className={done ? "text-green-400" : ""}>
                  {done ? "Download ready!" : "Building package…"}
                </span>
                <span className="text-xs text-muted-foreground">{progressMsg}</span>
              </div>
              <Progress value={progress} />
              {done && (
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadAgain}
                    className="border-border bg-transparent"
                  >
                    Download Again
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setBuilding(false);
                      setDone(false);
                      setProgress(0);
                    }}
                    className="bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
                  >
                    Build Another
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-auto flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleCopyUrls}
                className="border-border bg-transparent"
              >
                {copied ? (
                  <Check className="mr-1.5 h-4 w-4" />
                ) : (
                  <Copy className="mr-1.5 h-4 w-4" />
                )}
                Copy Asset URLs to Clipboard
              </Button>
              <Button
                size="lg"
                onClick={handleBuild}
                disabled={fileCount === 0}
                className="bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
              >
                <Download className="mr-1.5 h-4 w-4" />
                Download Selected Files
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
