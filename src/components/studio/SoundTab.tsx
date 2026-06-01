import { useState } from "react";
import { Loader2, Music, RefreshCw, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useStudio, type Scene } from "@/lib/studio-context";
import { generateSceneSound, updateSceneSoundConfig } from "@/lib/sound.functions";
import { generateSoundSync } from "@/lib/sound-narrative.functions";

const GOLD = "var(--accent-gold)";

type SoundType = "ambient" | "punctuation" | "transition";

export function SoundTab({ scene }: { scene: Scene }) {
  const { sceneSounds, upsertSceneSound, voiceovers } = useStudio();
  const record = sceneSounds.find((s) => s.scene_id === scene.id) ?? null;
  const voiceover = voiceovers.find((v) => v.scene_id === scene.id) ?? null;
  const generate = useServerFn(generateSceneSound);
  const updateConfig = useServerFn(updateSceneSoundConfig);
  const genSync = useServerFn(generateSoundSync);
  const [syncing, setSyncing] = useState(false);

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Music className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">No sound brief yet</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Run script analysis to generate sound briefs for every scene.
        </p>
      </div>
    );
  }

  const handleGenerate = async (
    soundType: SoundType,
    description: string,
    durationSeconds: number,
  ) => {
    if (!description?.trim()) {
      toast.error("No description available for this sound");
      return;
    }
    try {
      const result = await generate({
        data: {
          sceneId: scene.id,
          projectId: scene.project_id,
          soundType,
          description,
          durationSeconds,
        },
      });
      const urlField = `${soundType}_file_url` as const;
      const statusField = `${soundType}_status` as const;
      upsertSceneSound({
        ...record,
        [urlField]: result.file_url,
        [statusField]: "complete",
      } as any);
      toast.success(result.from_cache ? "Loaded from cache" : "Sound generated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const persist = async (patch: Record<string, unknown>) => {
    upsertSceneSound({ ...record, ...patch } as any);
    try {
      await updateConfig({ data: { sceneId: scene.id, patch } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* AMBIENT */}
      <SoundSection
        title="Ambient Sound"
        enabled={record.ambient_enabled !== false}
        onToggle={(v) => persist({ ambient_enabled: v })}
        description={record.ambient_description}
        reasoning={record.sound_reasoning}
        fileUrl={record.ambient_file_url}
        status={record.ambient_status}
        volume={record.ambient_volume ?? 12}
        onVolumeChange={(v) => persist({ ambient_volume: v })}
        durationOptions={[4, 6, 8, 10]}
        defaultDuration={Math.min(10, Math.max(4, Math.round(scene.estimated_seconds ?? 8)))}
        onGenerate={(dur) => handleGenerate("ambient", record.ambient_description ?? "", dur)}
      />

      {/* PUNCTUATION */}
      {record.punctuation_needed && (
        <SoundSection
          title="Punctuation Sound"
          enabled={record.punctuation_enabled !== false}
          onToggle={(v) => persist({ punctuation_enabled: v })}
          description={record.punctuation_description}
          reasoning={record.punctuation_trigger ? `Triggers: ${record.punctuation_trigger}` : null}
          fileUrl={record.punctuation_file_url}
          status={record.punctuation_status}
          volume={record.punctuation_volume ?? 35}
          onVolumeChange={(v) => persist({ punctuation_volume: v })}
          durationOptions={[1, 2, 3]}
          defaultDuration={2}
          onGenerate={(dur) =>
            handleGenerate("punctuation", record.punctuation_description ?? "", dur)
          }
        />
      )}

      {/* TRANSITION */}
      {record.transition_type && record.transition_type !== "hard_cut" && (
        <SoundSection
          title={`Transition Sound (${record.transition_type.replace("_", " ")})`}
          enabled={record.transition_enabled !== false}
          onToggle={(v) => persist({ transition_enabled: v })}
          description={record.transition_description}
          reasoning="Plays at end of this scene"
          fileUrl={record.transition_file_url}
          status={record.transition_status}
          volume={record.transition_volume ?? 20}
          onVolumeChange={(v) => persist({ transition_volume: v })}
          durationOptions={[2, 3, 4]}
          defaultDuration={3}
          onGenerate={(dur) =>
            handleGenerate("transition", record.transition_description ?? "", dur)
          }
        />
      )}

      {record.transition_type === "hard_cut" && (
        <div className="rounded-md border border-border bg-[#1a1a1a] px-3 py-2 text-xs text-muted-foreground">
          Transition: Hard Cut — No Sound
        </div>
      )}

      {/* SYNC POINTS */}
      <div className="border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: GOLD }}
          >
            Sync Points
          </h4>
          <Button
            size="sm"
            variant="outline"
            disabled={!voiceover?.word_timestamps || syncing}
            onClick={async () => {
              setSyncing(true);
              try {
                const res = await genSync({
                  data: { sceneId: scene.id, projectId: scene.project_id },
                });
                upsertSceneSound({
                  ...record,
                  sync_points: res.sync_points,
                  ducking_curve: res.ducking_curve,
                } as any);
                toast.success(`${res.sync_points.length} sync points generated`);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setSyncing(false);
              }
            }}
          >
            {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate Sync"}
          </Button>
        </div>
        {!voiceover?.word_timestamps && (
          <p className="text-xs text-muted-foreground">
            Generate voiceover first to enable sync points.
          </p>
        )}
        {Array.isArray(record.sync_points) && record.sync_points.length > 0 && (
          <div className="space-y-2">
            <SyncTimeline
              points={
                record.sync_points as Array<{ timestamp: number; word: string; volume: number }>
              }
              duration={voiceover?.duration_seconds ?? scene.estimated_seconds ?? 10}
            />
            <ul className="space-y-1 text-xs text-muted-foreground">
              {(
                record.sync_points as Array<{
                  timestamp: number;
                  word: string;
                  sound_action: string;
                  volume: number;
                }>
              ).map((p, i) => (
                <li key={i}>
                  <span style={{ color: GOLD }}>At {p.timestamp.toFixed(1)}s</span> — word "{p.word}
                  " — {p.sound_action} ({p.volume}%)
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* CONFIRM */}
      <div className="flex justify-end border-t border-border pt-4">
        <Button
          size="sm"
          onClick={() => persist({ confirmed: !record.confirmed })}
          style={
            record.confirmed
              ? { backgroundColor: GOLD, color: "#000" }
              : { borderColor: GOLD, color: GOLD, backgroundColor: "transparent" }
          }
          variant={record.confirmed ? "default" : "outline"}
        >
          {record.confirmed ? "✓ Confirmed" : "Confirm Sound Design"}
        </Button>
      </div>
    </div>
  );
}

function SoundSection({
  title,
  enabled,
  onToggle,
  description,
  reasoning,
  fileUrl,
  status,
  volume,
  onVolumeChange,
  durationOptions,
  defaultDuration,
  onGenerate,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  description: string | null;
  reasoning: string | null;
  fileUrl: string | null;
  status: string;
  volume: number;
  onVolumeChange: (v: number) => void;
  durationOptions: number[];
  defaultDuration: number;
  onGenerate: (durationSeconds: number) => Promise<void>;
}) {
  const [duration, setDuration] = useState(defaultDuration);
  const [generating, setGenerating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audio] = useState(() => (typeof Audio !== "undefined" ? new Audio() : null));

  const togglePlay = () => {
    if (!audio || !fileUrl) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.src = fileUrl;
      audio.volume = Math.min(1, volume / 100);
      audio.play();
      audio.onended = () => setPlaying(false);
      setPlaying(true);
    }
  };

  const doGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerate(duration);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
          {title}
        </h4>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {!enabled ? null : (
        <>
          {description && (
            <div className="mb-3 rounded-md bg-[#1a1a1a] p-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                AI Brief
              </div>
              <p className="text-[13px] italic text-[#cccccc]">{description}</p>
              {reasoning && <p className="mt-2 text-[11px] text-muted-foreground">{reasoning}</p>}
            </div>
          )}

          {fileUrl && status === "complete" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-md bg-[#1a1a1a] px-3 py-2">
                <button
                  onClick={togglePlay}
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: GOLD, color: "#000" }}
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <div className="flex-1">
                  <WaveformBars playing={playing} />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={doGenerate}
                  disabled={generating}
                  className="text-xs text-muted-foreground"
                >
                  {generating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Volume</span>
                  <span>{volume}%</span>
                </div>
                <Slider
                  value={[volume]}
                  onValueChange={([v]) => onVolumeChange(v)}
                  max={100}
                  step={1}
                />
              </div>
            </div>
          ) : generating ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} />
              Generating with ElevenLabs… 10-20s
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] text-muted-foreground">Duration</div>
                <div className="flex gap-1">
                  {durationOptions.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className="rounded-md border px-3 py-1 text-xs"
                      style={
                        duration === d
                          ? { borderColor: GOLD, color: GOLD, backgroundColor: "transparent" }
                          : { borderColor: "#2a2a2a", color: "#888" }
                      }
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={doGenerate}
                style={{ borderColor: GOLD, color: GOLD }}
              >
                <Music className="mr-1.5 h-3.5 w-3.5" />
                Generate {title}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WaveformBars({ playing }: { playing: boolean }) {
  return (
    <div className="flex h-6 items-end gap-[2px]">
      {Array.from({ length: 28 }).map((_, i) => (
        <div
          key={i}
          className={playing ? "animate-pulse" : ""}
          style={{
            width: 3,
            height: `${20 + Math.sin(i) * 60 + (i % 3) * 10}%`,
            backgroundColor: GOLD,
            opacity: playing ? 0.85 : 0.4,
            animationDelay: `${i * 30}ms`,
          }}
        />
      ))}
    </div>
  );
}

function SyncTimeline({
  points,
  duration,
}: {
  points: Array<{ timestamp: number; word: string; volume: number }>;
  duration: number;
}) {
  const safeDur = duration > 0 ? duration : 10;
  return (
    <div className="relative h-6 w-full rounded bg-[#1a1a1a]">
      {points.map((p, i) => {
        const left = Math.min(100, Math.max(0, (p.timestamp / safeDur) * 100));
        return (
          <div
            key={i}
            title={`${p.word} @ ${p.timestamp.toFixed(2)}s (${p.volume}%)`}
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${left}%`, backgroundColor: "var(--accent-gold)" }}
          />
        );
      })}
    </div>
  );
}
