import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  RotateCcw,
} from "lucide-react";
import {
  TEMPERATURE_COLORS,
  VISUAL_JOB_COLORS,
  type Scene,
  type Voiceover,
  type Clip,
  type MotionGraphicRecord,
  type SceneSoundRecord,
} from "@/lib/studio-context";
import { useWordSync, formatClock } from "./use-word-sync";
import { GraphicPreview, type GraphicPreviewType } from "@/components/studio/MotionGraphicTab";

type Props = {
  projectTitle: string;
  scenes: Scene[];
  voiceovers: Voiceover[];
  clips: Clip[];
  motionGraphics: MotionGraphicRecord[];
  sceneSounds?: SceneSoundRecord[];
  onClose: () => void;
};

export function FullVideoPreview({
  projectTitle,
  scenes,
  voiceovers,
  clips,
  motionGraphics,
  sceneSounds = [],
  onClose,
}: Props) {
  const sceneData = useMemo(() => {
    return scenes.map((s) => {
      const vo = voiceovers.find((v) => v.scene_id === s.id) ?? null;
      const clip = clips.find((c) => c.scene_id === s.id) ?? null;
      const mg = motionGraphics.find((m) => m.scene_id === s.id) ?? null;
      const snd = sceneSounds.find((x) => x.scene_id === s.id) ?? null;
      const dur = vo?.duration_seconds ?? s.estimated_seconds ?? 0;
      return { scene: s, vo, clip, mg, snd, duration: dur };
    });
  }, [scenes, voiceovers, clips, motionGraphics, sceneSounds]);

  const cumulative = useMemo(() => {
    const arr: number[] = [0];
    for (const d of sceneData) arr.push(arr[arr.length - 1] + d.duration);
    return arr;
  }, [sceneData]);
  const totalDuration = cumulative[cumulative.length - 1] ?? 0;

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [sceneTime, setSceneTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [fading, setFading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const current = sceneData[idx];
  const wordIdx = useWordSync(audioRef, current?.vo?.word_timestamps);

  // load audio + autoplay on scene change
  useEffect(() => {
    setFading(true);
    const t = setTimeout(() => setFading(false), 300);
    setSceneTime(0);
    const a = audioRef.current;
    if (a) {
      a.playbackRate = speed;
      if (playing) a.play().catch(() => {});
    }
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // playback rate
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // toggle play
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.play().catch(() => {});
    else a.pause();
  }, [playing]);

  const goNext = () => {
    if (idx < sceneData.length - 1) {
      setIdx((i) => i + 1);
    } else {
      setPlaying(false);
      setCompleted(true);
    }
  };
  const goPrev = () => setIdx((i) => Math.max(0, i - 1));

  const seekMaster = (t: number) => {
    // find scene that contains t
    let target = sceneData.length - 1;
    for (let i = 0; i < cumulative.length - 1; i++) {
      if (t >= cumulative[i] && t < cumulative[i + 1]) {
        target = i;
        break;
      }
    }
    const offset = t - cumulative[target];
    if (target !== idx) setIdx(target);
    requestAnimationFrame(() => {
      const a = audioRef.current;
      if (a) {
        try {
          a.currentTime = Math.min(offset, (sceneData[target].duration || 0) - 0.05);
        } catch {
          // audio currentTime may throw if element isn't ready
        }
      }
    });
  };

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, sceneData.length]);

  const masterTime = (cumulative[idx] ?? 0) + sceneTime;
  const next = sceneData[idx + 1];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: "#000" }}>
      {/* Top bar */}
      <div
        className="flex items-center px-4"
        style={{ height: 52, backgroundColor: "#0d0d0d", borderBottom: "1px solid #2a2a2a" }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-[#1f1f1f] hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Studio
        </button>
        <div className="mx-auto flex items-center gap-2 text-sm">
          <span className="font-semibold">{projectTitle}</span>
          <span className="text-xs text-muted-foreground">— Full Preview</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Scene {idx + 1} of {sceneData.length} playing
        </span>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left 70% */}
        <div className="flex flex-col" style={{ flex: "0 0 70%", backgroundColor: "#000" }}>
          <div className="relative flex-1 flex items-center justify-center p-4">
            <div className="relative w-full" style={{ maxWidth: "100%", aspectRatio: "16 / 9" }}>
              <div
                className="absolute inset-0 transition-opacity"
                style={{
                  opacity: fading ? 0 : 1,
                  transitionDuration: "500ms",
                }}
              >
                <SceneVisual scene={current.scene} clip={current.clip} mg={current.mg} />
              </div>
              {/* intra-scene progress */}
              <div
                className="absolute bottom-0 left-0 h-[3px]"
                style={{
                  width: `${current.duration ? (sceneTime / current.duration) * 100 : 0}%`,
                  backgroundColor: "var(--accent-gold)",
                }}
              />
              {completed && (
                <EndCard
                  title={projectTitle}
                  totalDuration={totalDuration}
                  onReplay={() => {
                    setCompleted(false);
                    setIdx(0);
                    setSceneTime(0);
                    setPlaying(true);
                  }}
                  onBack={onClose}
                />
              )}
            </div>
          </div>

          {/* Audio (hidden control) */}
          {current.vo?.audio_url && (
            <audio
              ref={audioRef}
              src={current.vo.audio_url}
              autoPlay={playing}
              onTimeUpdate={(e) => setSceneTime((e.target as HTMLAudioElement).currentTime)}
              onEnded={() => goNext()}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          )}
          <SceneSoundLayer
            key={`snd-${current.scene.id}`}
            snd={current.snd}
            playing={playing}
            sceneTime={sceneTime}
            speed={speed}
          />

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 py-2">
            <CtrlBtn onClick={goPrev} aria="Previous scene">
              <SkipBack className="h-4 w-4" />
            </CtrlBtn>
            <CtrlBtn
              onClick={() => {
                const a = audioRef.current;
                if (a) a.currentTime = Math.max(0, a.currentTime - 5);
              }}
              aria="Rewind 5s"
            >
              <Rewind className="h-4 w-4" />
            </CtrlBtn>
            <button
              onClick={() => setPlaying((p) => !p)}
              className="flex h-12 w-12 items-center justify-center rounded-full text-black"
              style={{ backgroundColor: "var(--accent-gold)" }}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
            </button>
            <CtrlBtn
              onClick={() => {
                const a = audioRef.current;
                if (a) a.currentTime = Math.min(a.duration || 0, a.currentTime + 5);
              }}
              aria="Forward 5s"
            >
              <FastForward className="h-4 w-4" />
            </CtrlBtn>
            <CtrlBtn onClick={goNext} aria="Next scene">
              <SkipForward className="h-4 w-4" />
            </CtrlBtn>
          </div>

          {/* Master seek bar */}
          <div className="relative px-4 pb-2">
            <div className="relative h-2 rounded-full" style={{ backgroundColor: "#1f1f1f" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: totalDuration ? `${(masterTime / totalDuration) * 100}%` : "0%",
                  backgroundColor: "var(--accent-gold)",
                }}
              />
              {cumulative.slice(1, -1).map((c, i) => (
                <div
                  key={i}
                  title={`Scene ${i + 2}`}
                  className="absolute top-0 h-full w-[2px] bg-white/70"
                  style={{ left: `${(c / totalDuration) * 100}%` }}
                />
              ))}
              <input
                type="range"
                min={0}
                max={totalDuration}
                step={0.1}
                value={masterTime}
                onChange={(e) => seekMaster(parseFloat(e.target.value))}
                className="absolute inset-0 w-full cursor-pointer opacity-0"
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="font-mono">{formatClock(masterTime)}</span>
              <div className="flex items-center gap-1">
                {[0.5, 0.75, 1, 1.25].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className="rounded px-1.5 py-0.5"
                    style={{
                      backgroundColor: speed === s ? "var(--accent-gold)" : "transparent",
                      color: speed === s ? "#000" : undefined,
                    }}
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <span className="font-mono">{formatClock(totalDuration)}</span>
            </div>
          </div>

          {/* Timeline strip */}
          <div
            className="flex gap-2 overflow-x-auto px-4 py-3"
            style={{
              height: 80,
              backgroundColor: "#0d0d0d",
              borderTop: "1px solid #2a2a2a",
            }}
          >
            {sceneData.map((s, i) => (
              <button
                key={s.scene.id}
                onClick={() => setIdx(i)}
                className="relative flex-shrink-0 overflow-hidden rounded text-left"
                style={{
                  width: 100,
                  height: 60,
                  border: i === idx ? "2px solid var(--accent-gold)" : "1px solid #2a2a2a",
                  opacity: i < idx ? 0.55 : 1,
                  backgroundColor: "#1a1a1a",
                }}
              >
                {s.clip?.thumbnail_url ? (
                  <img src={s.clip.thumbnail_url} alt="" className="h-full w-full object-cover" />
                ) : null}
                <span className="absolute left-1 top-0.5 text-[10px] font-bold text-white drop-shadow">
                  {s.scene.scene_index}
                </span>
                <span className="absolute bottom-0.5 right-1 text-[9px] text-white/80 drop-shadow">
                  {Math.round(s.duration)}s
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right 30% */}
        <div
          className="flex flex-col gap-3 overflow-y-auto"
          style={{
            flex: "0 0 30%",
            backgroundColor: "#0d0d0d",
            borderLeft: "1px solid #2a2a2a",
            padding: 16,
          }}
        >
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold">Scene {current.scene.scene_index}</span>
            <span className="font-mono text-muted-foreground">
              {formatClock(cumulative[idx])} – {formatClock(cumulative[idx + 1])}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {current.scene.emotional_temperature && (
              <ColoredPill color={TEMPERATURE_COLORS[current.scene.emotional_temperature]}>
                {current.scene.emotional_temperature}
              </ColoredPill>
            )}
            {current.scene.visual_job && (
              <ColoredPill color={VISUAL_JOB_COLORS[current.scene.visual_job]}>
                {current.scene.visual_job}
              </ColoredPill>
            )}
          </div>

          <ScriptHighlight
            scriptText={current.scene.script_text}
            timestamps={current.vo?.word_timestamps ?? null}
            activeIndex={wordIdx}
          />

          {next && (
            <div className="mt-4 rounded-md p-3" style={{ border: "1px solid #1f1f1f" }}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Next scene
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {next.scene.emotional_temperature && (
                  <ColoredPill color={TEMPERATURE_COLORS[next.scene.emotional_temperature]}>
                    {next.scene.emotional_temperature}
                  </ColoredPill>
                )}
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {next.scene.script_text.split(/\s+/).slice(0, 15).join(" ")}…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---- helpers ---- */

function CtrlBtn({
  onClick,
  aria,
  children,
}: {
  onClick: () => void;
  aria: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-[#1f1f1f] hover:text-foreground"
    >
      {children}
    </button>
  );
}

function ColoredPill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
      style={{
        color,
        backgroundColor: color + "22",
        border: `1px solid ${color}55`,
      }}
    >
      {children}
    </span>
  );
}

function SceneVisual({
  scene,
  clip,
  mg,
}: {
  scene: Scene;
  clip: Clip | null;
  mg: MotionGraphicRecord | null;
}) {
  const baseStyle = {
    height: "100%",
    width: "100%",
    backgroundColor: "#000",
    overflow: "hidden",
  } as const;

  // Motion graphic — render even if no clip row (use mg directly)
  if ((clip?.asset_type === "motion_graphic" || (!clip && mg)) && mg) {
    return (
      <div style={{ ...baseStyle, position: "relative" }}>
        <GraphicPreview type={mg.graphic_type as GraphicPreviewType} data={mg.graphic_data} />
      </div>
    );
  }

  if (!clip) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
        <div className="text-5xl font-bold opacity-30">{scene.scene_index}</div>
        <div className="mt-2 text-xs uppercase tracking-wider opacity-60">
          {scene.visual_job ?? "No clip"}
        </div>
      </div>
    );
  }
  if (clip.animation_url) {
    return (
      <video
        src={clip.animation_url}
        autoPlay
        muted
        loop
        playsInline
        style={baseStyle}
        className="object-cover"
      />
    );
  }
  if (clip.asset_type === "youtube" && clip.source_video_id) {
    if (clip.local_file_path) {
      return (
        <video
          src={clip.local_file_path}
          autoPlay
          muted
          loop
          playsInline
          style={baseStyle}
          className="object-cover"
        />
      );
    }
    const start = parseTs(clip.timestamp_start);
    const end = parseTs(clip.timestamp_end);
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      controls: "0",
      modestbranding: "1",
      rel: "0",
      loop: "1",
      playlist: clip.source_video_id,
    });
    if (start != null) params.set("start", String(start));
    if (end != null) params.set("end", String(end));
    return (
      <iframe
        src={`https://www.youtube.com/embed/${clip.source_video_id}?${params.toString()}`}
        style={baseStyle}
        allow="autoplay; encrypted-media"
        title={clip.source_title ?? "YouTube clip"}
      />
    );
  }
  if (
    (clip.source_type === "pexels_video" || clip.asset_type === "stock_video") &&
    clip.source_url
  ) {
    return (
      <video
        src={clip.source_url}
        autoPlay
        muted
        loop
        playsInline
        style={baseStyle}
        className="object-cover"
      />
    );
  }
  const imgSrc = clip.thumbnail_url ?? clip.source_url ?? null;
  if (imgSrc) {
    const dur = Math.max(6, scene.estimated_seconds ?? 10);
    const direction = clip.ken_burns_config?.zoom === "out" ? "kbOut" : "kbIn";
    return (
      <>
        <style>{`
          @keyframes kbIn { from{transform:scale(1)} to{transform:scale(1.15) translate(-2%,-2%)} }
          @keyframes kbOut { from{transform:scale(1.15) translate(-2%,-2%)} to{transform:scale(1)} }
        `}</style>
        <img
          src={imgSrc}
          alt=""
          className="h-full w-full object-cover"
          style={{ animation: `${direction} ${dur}s ease-in-out infinite alternate` }}
        />
      </>
    );
  }
  return <div style={baseStyle} />;
}

function parseTs(t: string | null | undefined): number | null {
  if (!t) return null;
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const parts = t.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

function ScriptHighlight({
  scriptText,
  timestamps,
  activeIndex,
}: {
  scriptText: string;
  timestamps: Array<{ word: string; start: number; end: number }> | null;
  activeIndex: number;
}) {
  const activeRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <div
      className="overflow-y-auto rounded-md p-3"
      style={{
        backgroundColor: "#141414",
        border: "1px solid #1f1f1f",
        maxHeight: 260,
        fontSize: 13,
        lineHeight: 1.8,
        color: "#cccccc",
      }}
    >
      {timestamps && timestamps.length > 0
        ? timestamps.map((w, i) => (
            <span
              key={i}
              ref={i === activeIndex ? activeRef : undefined}
              style={{
                color: i === activeIndex ? "var(--accent-gold)" : undefined,
                fontWeight: i === activeIndex ? 600 : 400,
              }}
            >
              {w.word}{" "}
            </span>
          ))
        : scriptText}
    </div>
  );
}

function EndCard({
  title,
  totalDuration,
  onReplay,
  onBack,
}: {
  title: string;
  totalDuration: number;
  onReplay: () => void;
  onBack: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center"
      style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
    >
      <div className="text-lg font-bold">{title}</div>
      <div className="text-xs text-muted-foreground">
        Total duration: {formatClock(totalDuration)}
      </div>
      <div className="text-sm" style={{ color: "var(--accent-gold)" }}>
        Preview Complete
      </div>
      <div className="mt-2 flex gap-3">
        <button
          onClick={onBack}
          className="rounded-md border border-border px-4 py-2 text-xs hover:bg-[#1f1f1f]"
        >
          Back to Studio
        </button>
        <button
          onClick={onReplay}
          className="flex items-center gap-1.5 rounded-md px-4 py-2 text-xs text-black"
          style={{ backgroundColor: "var(--accent-gold)" }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Replay
        </button>
      </div>
    </div>
  );
}

function SceneSoundLayer({
  snd,
  playing,
  sceneTime,
  speed,
}: {
  snd: SceneSoundRecord | null;
  playing: boolean;
  sceneTime: number;
  speed: number;
}) {
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const punctRef = useRef<HTMLAudioElement | null>(null);
  const punctFiredRef = useRef(false);

  useEffect(() => {
    punctFiredRef.current = false;
  }, [snd?.id]);

  useEffect(() => {
    const a = ambientRef.current;
    if (!a) return;
    a.playbackRate = speed;
    if (playing) a.play().catch(() => {});
    else a.pause();
  }, [playing, speed, snd?.ambient_file_url]);

  useEffect(() => {
    if (!snd?.punctuation_enabled || !snd?.punctuation_file_url) return;
    const trigger = snd.punctuation_timestamp ?? 0;
    if (!punctFiredRef.current && sceneTime >= trigger && playing) {
      const p = punctRef.current;
      if (p) {
        p.currentTime = 0;
        p.play().catch(() => {});
        punctFiredRef.current = true;
      }
    }
  }, [sceneTime, playing, snd]);

  if (!snd) return null;
  return (
    <>
      {snd.ambient_enabled && snd.ambient_file_url && (
        <audio
          ref={ambientRef}
          src={snd.ambient_file_url}
          loop
          autoPlay={playing}
          onLoadedMetadata={(e) => {
            (e.target as HTMLAudioElement).volume = Math.max(
              0,
              Math.min(1, snd.ambient_volume ?? 0.3),
            );
          }}
        />
      )}
      {snd.punctuation_enabled && snd.punctuation_file_url && (
        <audio
          ref={punctRef}
          src={snd.punctuation_file_url}
          preload="auto"
          onLoadedMetadata={(e) => {
            (e.target as HTMLAudioElement).volume = Math.max(
              0,
              Math.min(1, snd.punctuation_volume ?? 0.6),
            );
          }}
        />
      )}
    </>
  );
}
