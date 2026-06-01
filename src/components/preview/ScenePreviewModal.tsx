import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import {
  TEMPERATURE_COLORS,
  VISUAL_JOB_COLORS,
  type Scene,
  type Voiceover,
  type Clip,
  type MotionGraphicRecord,
} from "@/lib/studio-context";
import { useWordSync, formatClock } from "./use-word-sync";
import { GraphicPreview, type GraphicPreviewType } from "@/components/studio/MotionGraphicTab";

type Props = {
  scenes: Scene[];
  voiceovers: Voiceover[];
  clips: Clip[];
  motionGraphics: MotionGraphicRecord[];
  initialSceneId: string;
  onClose: () => void;
};

export function ScenePreviewModal({
  scenes,
  voiceovers,
  clips,
  motionGraphics,
  initialSceneId,
  onClose,
}: Props) {
  const [idx, setIdx] = useState(() =>
    Math.max(
      0,
      scenes.findIndex((s) => s.id === initialSceneId),
    ),
  );
  const scene = scenes[idx];
  const vo = useMemo(
    () => voiceovers.find((v) => v.scene_id === scene?.id) ?? null,
    [voiceovers, scene],
  );
  const clip = useMemo(() => clips.find((c) => c.scene_id === scene?.id) ?? null, [clips, scene]);
  const mg = useMemo(
    () => motionGraphics.find((m) => m.scene_id === scene?.id) ?? null,
    [motionGraphics, scene],
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const wordIdx = useWordSync(audioRef, vo?.word_timestamps);

  // reset on scene change
  useEffect(() => {
    setTime(0);
    setPlaying(false);
  }, [scene?.id]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      else if (e.key === "ArrowRight") setIdx((i) => Math.min(scenes.length - 1, i + 1));
      else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes.length, onClose]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  if (!scene) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[900px] flex-col overflow-hidden rounded-[10px]"
        style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-3"
          style={{ borderBottom: "1px solid #2a2a2a" }}
        >
          <h3 className="text-sm font-bold text-foreground">Scene {scene.scene_index} Preview</h3>
          {scene.emotional_temperature && (
            <ColoredPill color={TEMPERATURE_COLORS[scene.emotional_temperature]}>
              {scene.emotional_temperature}
            </ColoredPill>
          )}
          {scene.visual_job && (
            <ColoredPill color={VISUAL_JOB_COLORS[scene.visual_job]}>
              {scene.visual_job}
            </ColoredPill>
          )}
          <button
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[#1f1f1f] hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5 md:flex-row">
          {/* Left 60% */}
          <div className="flex flex-col gap-3" style={{ flex: "0 0 60%" }}>
            <VisualArea scene={scene} clip={clip} mg={mg} />
            <ClipInfoBar clip={clip} />
          </div>

          {/* Right 40% */}
          <div className="flex flex-col gap-3" style={{ flex: "0 0 calc(40% - 16px)" }}>
            <ScriptPanel
              scriptText={scene.script_text}
              wordTimestamps={vo?.word_timestamps ?? null}
              activeIndex={wordIdx}
            />
            <AudioPlayer
              audioRef={audioRef}
              audioUrl={vo?.audio_url ?? null}
              playing={playing}
              onPlayingChange={setPlaying}
              time={time}
              duration={duration}
              onTime={setTime}
              onDuration={setDuration}
            />
            <MetaRow scene={scene} vo={vo} />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: "1px solid #2a2a2a" }}
        >
          <button
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-[#1f1f1f] hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous Scene
          </button>
          <span className="text-xs text-muted-foreground">
            Scene {idx + 1} of {scenes.length}
          </span>
          <button
            disabled={idx === scenes.length - 1}
            onClick={() => setIdx((i) => Math.min(scenes.length - 1, i + 1))}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-[#1f1f1f] hover:text-foreground disabled:opacity-40"
          >
            Next Scene <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---- helpers ---- */

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

function VisualArea({
  scene,
  clip,
  mg,
}: {
  scene: Scene;
  clip: Clip | null;
  mg: MotionGraphicRecord | null;
}) {
  const ratio = "16 / 9";
  const baseStyle = {
    aspectRatio: ratio,
    backgroundColor: "#000",
    borderRadius: 6,
    overflow: "hidden",
  } as const;

  // Motion graphic
  if ((clip?.asset_type === "motion_graphic" || (!clip && mg)) && mg) {
    return (
      <div style={{ ...baseStyle, position: "relative" }}>
        <GraphicPreview type={mg.graphic_type as GraphicPreviewType} data={mg.graphic_data} />
      </div>
    );
  }

  if (!clip) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center text-muted-foreground"
        style={baseStyle}
      >
        <div className="text-3xl font-bold opacity-30">{scene.scene_index}</div>
        <div className="mt-2 text-xs uppercase tracking-wider opacity-60">
          {scene.visual_job ?? ""}
        </div>
        <div className="mt-1 text-[11px] opacity-50">No clip sourced for this scene</div>
      </div>
    );
  }

  // animated video file
  if (clip.animation_url) {
    return (
      <div style={baseStyle}>
        <video
          src={clip.animation_url}
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  // YouTube
  if (clip.asset_type === "youtube" && clip.source_video_id) {
    if (clip.local_file_path) {
      return (
        <div style={baseStyle}>
          <video
            src={clip.local_file_path}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
        </div>
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
    });
    if (start != null) params.set("start", String(start));
    if (end != null) params.set("end", String(end));
    return (
      <div style={baseStyle}>
        <iframe
          src={`https://www.youtube.com/embed/${clip.source_video_id}?${params.toString()}`}
          className="h-full w-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={clip.source_title ?? "YouTube clip"}
        />
      </div>
    );
  }

  // Stock video (pexels video)
  if (clip.source_type === "pexels_video" || clip.asset_type === "stock_video") {
    if (clip.source_url) {
      return (
        <div style={baseStyle}>
          <video
            src={clip.source_url}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
        </div>
      );
    }
  }

  // Static image (stock photo / ai)
  const imgSrc = clip.thumbnail_url ?? clip.source_url ?? null;
  if (imgSrc) {
    const kb = clip.ken_burns_config;
    const dur = Math.max(6, scene.estimated_seconds ?? 10);
    const direction = kb?.zoom === "out" ? "kenBurnsOut" : "kenBurnsIn";
    return (
      <div style={baseStyle}>
        <style>{`
          @keyframes kenBurnsIn {
            from { transform: scale(1) translate(0,0); }
            to   { transform: scale(1.15) translate(-2%, -2%); }
          }
          @keyframes kenBurnsOut {
            from { transform: scale(1.15) translate(-2%, -2%); }
            to   { transform: scale(1) translate(0,0); }
          }
        `}</style>
        <img
          src={imgSrc}
          alt={clip.source_title ?? ""}
          className="h-full w-full object-cover"
          style={{
            animation:
              kb?.enabled !== false
                ? `${direction} ${dur}s ease-in-out infinite alternate`
                : undefined,
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center text-xs text-muted-foreground"
      style={baseStyle}
    >
      Asset unavailable
    </div>
  );
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

function ClipInfoBar({ clip }: { clip: Clip | null }) {
  if (!clip) return null;
  const rrColor =
    clip.rights_risk === "high" ? "#ef5350" : clip.rights_risk === "medium" ? "#ffa726" : "#66bb6a";
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      {clip.source_channel && (
        <span className="rounded-full bg-[#1a1a1a] px-2 py-0.5">{clip.source_channel}</span>
      )}
      {clip.asset_type === "youtube" && (
        <ColoredPill color={rrColor}>{clip.rights_risk} risk</ColoredPill>
      )}
      {clip.asset_type !== "youtube" && (
        <span className="rounded-full bg-[#1a1a1a] px-2 py-0.5 uppercase">
          {clip.asset_type.replace("_", " ")}
        </span>
      )}
      {clip.timestamp_start && clip.timestamp_end && (
        <span>
          {clip.timestamp_start} – {clip.timestamp_end}
        </span>
      )}
    </div>
  );
}

function ScriptPanel({
  scriptText,
  wordTimestamps,
  activeIndex,
}: {
  scriptText: string;
  wordTimestamps: Array<{ word: string; start: number; end: number }> | null;
  activeIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeWordRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (activeWordRef.current) {
      activeWordRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  const tokens = wordTimestamps && wordTimestamps.length > 0 ? wordTimestamps : null;

  return (
    <div
      ref={containerRef}
      className="max-h-[260px] min-h-[200px] overflow-y-auto rounded-md p-3"
      style={{
        backgroundColor: "#0d0d0d",
        border: "1px solid #1f1f1f",
        fontSize: 14,
        lineHeight: 1.8,
        color: "#cccccc",
      }}
    >
      {tokens ? (
        tokens.map((w, i) => (
          <span
            key={i}
            ref={i === activeIndex ? activeWordRef : undefined}
            style={{
              color: i === activeIndex ? "var(--accent-gold)" : undefined,
              fontWeight: i === activeIndex ? 600 : 400,
              transition: "color 80ms linear",
            }}
          >
            {w.word}{" "}
          </span>
        ))
      ) : (
        <span>{scriptText}</span>
      )}
    </div>
  );
}

function AudioPlayer({
  audioRef,
  audioUrl,
  playing,
  onPlayingChange,
  time,
  duration,
  onTime,
  onDuration,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  audioUrl: string | null;
  playing: boolean;
  onPlayingChange: (v: boolean) => void;
  time: number;
  duration: number;
  onTime: (n: number) => void;
  onDuration: (n: number) => void;
}) {
  if (!audioUrl) {
    return (
      <div
        className="rounded-md p-3 text-center text-xs text-muted-foreground"
        style={{ backgroundColor: "#0d0d0d", border: "1px solid #1f1f1f" }}
      >
        No voiceover generated yet
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 rounded-md px-3 py-2"
      style={{ backgroundColor: "#0d0d0d", border: "1px solid #1f1f1f" }}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={(e) => onDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => onTime((e.target as HTMLAudioElement).currentTime)}
        onPlay={() => onPlayingChange(true)}
        onPause={() => onPlayingChange(false)}
        onEnded={() => onPlayingChange(false)}
        preload="metadata"
      />
      <button
        onClick={() => {
          const a = audioRef.current;
          if (!a) return;
          if (a.paused) a.play().catch(() => {});
          else a.pause();
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-black"
        style={{ backgroundColor: "var(--accent-gold)" }}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
      </button>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.05}
        value={time}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (audioRef.current) audioRef.current.currentTime = v;
          onTime(v);
        }}
        className="flex-1 accent-[var(--accent-gold)]"
        style={{ accentColor: "var(--accent-gold)" }}
      />
      <span className="w-20 text-right font-mono text-[10px] text-muted-foreground">
        {formatClock(time)} / {formatClock(duration)}
      </span>
    </div>
  );
}

function MetaRow({ scene, vo }: { scene: Scene; vo: Voiceover | null }) {
  const dur = vo?.duration_seconds ?? scene.estimated_seconds ?? 0;
  const words = vo?.word_count ?? scene.word_count ?? 0;
  const wpm = vo?.words_per_minute ?? 0;
  return (
    <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
      <Pill>{Math.round(dur)}s</Pill>
      <Pill>{words} words</Pill>
      <Pill>{Math.round(wpm)} WPM</Pill>
      {scene.emotional_temperature && (
        <ColoredPill color={TEMPERATURE_COLORS[scene.emotional_temperature]}>
          {scene.emotional_temperature}
        </ColoredPill>
      )}
      {scene.visual_job && (
        <ColoredPill color={VISUAL_JOB_COLORS[scene.visual_job]}>{scene.visual_job}</ColoredPill>
      )}
      {scene.pacing_instruction && <Pill>{scene.pacing_instruction.replace("_", " ")}</Pill>}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[#1a1a1a] px-2 py-0.5 text-[10px] font-medium">
      {children}
    </span>
  );
}
