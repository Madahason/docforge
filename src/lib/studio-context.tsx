import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EmotionalTemperature =
  | "cold"
  | "tense"
  | "revelatory"
  | "heavy"
  | "urgent"
  | "contemplative";

export type VisualJob = "atmosphere" | "evidence" | "authority" | "counterpoint";

export const TEMPERATURE_COLORS: Record<EmotionalTemperature, string> = {
  cold: "#4fc3f7",
  tense: "#ff7043",
  revelatory: "#ab47bc",
  heavy: "#78909c",
  urgent: "#ef5350",
  contemplative: "#66bb6a",
};

export const VISUAL_JOB_COLORS: Record<VisualJob, string> = {
  atmosphere: "#4fc3f7",
  evidence: "#ab47bc",
  authority: "#e8c547",
  counterpoint: "#ef5350",
};

export type PacingInstruction = "slow_hold" | "medium" | "fast_cut" | "hard_punctuation";

export type ClipBrief = {
  subject: string;
  mood: string[];
  avoid: string[];
  preferred_era?: string;
  color_temperature: string;
  suggested_search_terms: string[];
};

export type RecommendedAssetType =
  | "motion_graphic"
  | "ai_image_ken_burns"
  | "stock_image_ken_burns"
  | "animated_image"
  | "stock_video"
  | "youtube_clip";

export type MotionGraphicType =
  | "counter"
  | "bar_chart"
  | "timeline"
  | "comparison"
  | "text_card"
  | "percentage_ring"
  | "map_highlight";

export type Scene = {
  id: string;
  project_id: string;
  scene_index: number;
  script_text: string;
  emotional_temperature: EmotionalTemperature | null;
  visual_job: VisualJob | null;
  estimated_seconds: number | null;
  captions_status: string;
  word_count: number | null;
  pacing_instruction: PacingInstruction | null;
  text_overlay_flag: boolean;
  text_overlay_suggestion: string | null;
  data_graphic_flag: boolean;
  data_graphic_detail: string | null;
  clip_brief: ClipBrief | null;
  youtube_source_priority: string[];
  recommended_asset_type: RecommendedAssetType;
  motion_graphic_type: MotionGraphicType | null;
  motion_graphic_data: Record<string, unknown> | null;
  is_real_footage_scene: boolean;
  clip_status?: string | null;
};

export type WordTimestamp = { word: string; start: number; end: number };

export type Voiceover = {
  id: string;
  scene_id: string;
  status: string;
  audio_url: string | null;
  voice_id: string | null;
  voice_name: string | null;
  duration_seconds: number | null;
  word_count: number | null;
  words_per_minute: number | null;
  word_timestamps: WordTimestamp[] | null;
};

export type KenBurnsConfig = {
  enabled: boolean;
  zoom?: "in" | "out";
  pan?: "none" | "left" | "right" | "up" | "down";
  speed?: "slow" | "medium" | "fast";
};

export type Clip = {
  id: string;
  project_id: string;
  scene_id: string;
  status: string;
  asset_type: string;
  source_type: string | null;
  source_url: string | null;
  source_channel: string | null;
  source_title: string | null;
  source_video_id: string | null;
  timestamp_start: string | null;
  timestamp_end: string | null;
  duration_seconds: number | null;
  resolution: string | null;
  visual_job: string | null;
  mood_tags: string[];
  content_tags: string[];
  color_temperature: string | null;
  rights_risk: "low" | "medium" | "high" | string;
  thumbnail_url: string | null;
  local_file_path: string | null;
  fetch_status: string;
  verified: boolean;
  ken_burns_config: KenBurnsConfig | null;
  animation_url: string | null;
  animation_type: string | null;
  clip_status?: string | null;
  image_url?: string | null;
};

export type VoiceOption = {
  voice_id: string;
  name: string;
  category: string;
  preview_url: string | null;
};

export type ProjectRecord = {
  id: string;
  user_id: string;
  title: string;
  status: string;
  content_type: string | null;
  target_duration: string | null;
  platform_targets: string[] | null;
  script_raw: string | null;
  style_profile_id: string | null;
  pacing_intensity: number | null;
  music_on: boolean;
  music_intensity: string | null;
  text_overlay_frequency: string | null;
  clip_source: string;
  completion_percent: number;
  thumbnail_url: string | null;
  script_parsed: boolean;
  opening_structure: string | null;
  elevenlabs_voice_id: string | null;
  elevenlabs_voice_name: string | null;
  created_at: string;
  updated_at: string;
  auto_generate_visuals?: boolean;
  auto_generation_complete?: boolean;
};

export type StyleProfileRecord = {
  id: string;
  name: string;
  editing_style: string | null;
  content_type: string | null;
};

export type MotionGraphicRecord = {
  id: string;
  project_id: string;
  scene_id: string;
  graphic_type: string;
  graphic_data: Record<string, unknown>;
  render_method: "remotion" | "hera" | string;
  hera_output_url: string | null;
  hera_cache_id: string | null;
  hera_prompt_used?: string | null;
  remotion_output_url?: string | null;
  remotion_render_job_id?: string | null;
  status: string;
  confirmed: boolean;
};

export type SceneGraphicRecord = {
  id: string;
  project_id: string;
  scene_id: string;
  graphic_category: "text_overlay" | "data_graphic";
  overlay_text: string | null;
  overlay_style: string | null;
  animation_style: string | null;
  position: string | null;
  text_color: string | null;
  start_seconds: number;
  duration_seconds: number;
  graphic_type: string | null;
  graphic_data: Record<string, unknown>;
  render_method: string;
  hera_output_url: string | null;
  confirmed: boolean;
};

export type CaptionLineRecord = {
  text: string;
  start: number;
  end: number;
  line_number: number;
};

export type CaptionRecord = {
  id: string;
  project_id: string;
  scene_id: string;
  voiceover_id: string | null;
  words: { word: string; start: number; end: number; confidence?: number }[];
  caption_lines: CaptionLineRecord[];
  style_preset: string;
  custom_styles: Record<string, unknown> | null;
  srt_content: string | null;
  vtt_content: string | null;
  status: string;
};

export type AnalysisProgress = {
  currentPart: number;
  totalParts: number;
  failedParts: number[];
};

export type ManifestSummary = {
  id: string;
  project_id: string;
  version: number;
  status: string;
  manifest_data: unknown;
  total_scenes: number | null;
  total_duration_seconds: number | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export type ThumbnailRecord = {
  id: string;
  project_id: string;
  concepts: unknown[];
  selected_concept_index: number | null;
  custom_title_copy: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type VideoMetadataRecord = {
  id: string;
  project_id: string;
  titles: unknown[];
  selected_title: string | null;
  description: string | null;
  tags: string[];
  chapters: { time: string; title: string }[];
  hashtags: string[];
  platform_variations: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SceneSoundRecord = {
  id: string;
  project_id: string;
  scene_id: string;
  ambient_description: string | null;
  ambient_search_terms: string[];
  ambient_file_url: string | null;
  ambient_volume: number;
  ambient_timing: string;
  ambient_status: string;
  ambient_enabled: boolean;
  punctuation_needed: boolean;
  punctuation_trigger: string | null;
  punctuation_description: string | null;
  punctuation_file_url: string | null;
  punctuation_volume: number;
  punctuation_timestamp: number | null;
  punctuation_status: string;
  punctuation_enabled: boolean;
  transition_type: string | null;
  transition_description: string | null;
  transition_file_url: string | null;
  transition_volume: number;
  transition_starts_before_end_seconds: number;
  transition_status: string;
  transition_enabled: boolean;
  sound_reasoning: string | null;
  confirmed: boolean;
  // Phase 2
  sync_points?: unknown[];
  ducking_curve?: unknown[];
  narrative_ambient_volume?: number | null;
  narrative_tension_volume?: number | null;
  silence_scene?: boolean;
  silence_start_offset?: number | null;
  impact_sound_url?: string | null;
  impact_at_seconds?: number | null;
};

export type SoundStyleProfileRecord = {
  id: string;
  project_id: string;
  aesthetic: string | null;
  ambient_character: string | null;
  punctuation_character: string | null;
  transition_character: string | null;
  avoid_list: unknown[];
  volume_hierarchy: Record<string, unknown>;
  signature_moments: unknown[];
  editing_style: string | null;
  content_type: string | null;
  // Phase 2
  narrative_arc?: Record<string, unknown> | null;
  volume_curves?: unknown[];
  tension_drone_url?: string | null;
  tension_drone_generated?: boolean;
};

type StudioState = {
  project: ProjectRecord;
  styleProfile: StyleProfileRecord | null;
  scenes: Scene[];
  voiceovers: Voiceover[];
  clips: Clip[];
  motionGraphics: MotionGraphicRecord[];
  sceneGraphics: SceneGraphicRecord[];
  captions: CaptionRecord[];
  manifests: ManifestSummary[];
  manifestReady: boolean;
  thumbnail: ThumbnailRecord | null;
  videoMetadata: VideoMetadataRecord | null;
  thumbnailReady: boolean;
  metadataReady: boolean;
  sceneSounds: SceneSoundRecord[];
  soundStyleProfile: SoundStyleProfileRecord | null;
};

type StudioContextValue = StudioState & {
  setProject: (p: Partial<ProjectRecord>) => void;
  setScenes: (s: Scene[]) => void;
  setVoiceovers: (v: Voiceover[]) => void;
  upsertVoiceover: (v: Voiceover) => void;
  setClips: (c: Clip[]) => void;
  upsertClip: (c: Clip) => void;
  upsertMotionGraphic: (m: MotionGraphicRecord) => void;
  upsertSceneGraphic: (g: SceneGraphicRecord) => void;
  removeSceneGraphic: (id: string) => void;
  upsertCaption: (c: CaptionRecord) => void;
  removeCaption: (id: string) => void;
  setManifests: (m: ManifestSummary[]) => void;
  setThumbnail: (t: ThumbnailRecord | null) => void;
  setVideoMetadata: (m: VideoMetadataRecord | null) => void;
  upsertSceneSound: (s: SceneSoundRecord) => void;
  setSoundStyleProfile: (p: SoundStyleProfileRecord | null) => void;

  analyzing: boolean;
  setAnalyzing: (v: boolean) => void;
  analysisProgress: AnalysisProgress | null;
  setAnalysisProgress: (v: AnalysisProgress | null) => void;
  voices: VoiceOption[];
  voicesLoaded: boolean;
  setVoices: (v: VoiceOption[]) => void;
};

const Ctx = createContext<StudioContextValue | null>(null);

export function useStudio() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStudio must be used inside StudioProvider");
  return v;
}

export function StudioProvider({
  projectId,
  children,
  fallback,
}: {
  projectId: string;
  children: ReactNode;
  fallback: ReactNode;
}) {
  const [state, setState] = useState<StudioState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [voices, setVoicesState] = useState<VoiceOption[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sbAny = supabase as unknown as { from: (t: string) => any };
      const [
        projectRes,
        scenesRes,
        voRes,
        clipRes,
        mgRes,
        sgRes,
        capRes,
        manRes,
        thumbRes,
        metaRes,
        soundsRes,
        soundProfRes,
      ] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase
          .from("scenes")
          .select("*")
          .eq("project_id", projectId)
          .order("scene_index", { ascending: true }),
        supabase.from("voiceovers").select("*").eq("project_id", projectId),
        supabase.from("clips").select("*").eq("project_id", projectId),
        sbAny.from("motion_graphics").select("*").eq("project_id", projectId),
        sbAny.from("scene_graphics").select("*").eq("project_id", projectId),
        sbAny.from("captions").select("*").eq("project_id", projectId),
        sbAny
          .from("manifests")
          .select(
            "id,project_id,version,status,manifest_data,total_scenes,total_duration_seconds,is_current,created_at,updated_at",
          )
          .eq("project_id", projectId)
          .order("version", { ascending: false }),
        sbAny.from("thumbnails").select("*").eq("project_id", projectId).maybeSingle(),
        sbAny.from("video_metadata").select("*").eq("project_id", projectId).maybeSingle(),
        sbAny.from("scene_sounds").select("*").eq("project_id", projectId),
        sbAny.from("sound_style_profiles").select("*").eq("project_id", projectId).maybeSingle(),
      ]);

      if (cancelled) return;
      if (projectRes.error || !projectRes.data) {
        setError(projectRes.error?.message ?? "Project not found");
        return;
      }

      const project = projectRes.data as unknown as ProjectRecord;
      let styleProfile: StyleProfileRecord | null = null;
      if (project.style_profile_id) {
        const sp = await supabase
          .from("style_profiles")
          .select("id,name,editing_style,content_type")
          .eq("id", project.style_profile_id)
          .maybeSingle();
        if (!cancelled) styleProfile = (sp.data as StyleProfileRecord | null) ?? null;
      }

      const thumbnail = (thumbRes?.data ?? null) as ThumbnailRecord | null;
      const videoMetadata = (metaRes?.data ?? null) as VideoMetadataRecord | null;
      setState({
        project,
        styleProfile,
        scenes: (scenesRes.data ?? []) as unknown as Scene[],
        voiceovers: (voRes.data ?? []) as unknown as Voiceover[],
        clips: (clipRes.data ?? []) as unknown as Clip[],
        motionGraphics: ((mgRes as { data?: unknown[] })?.data ?? []) as MotionGraphicRecord[],
        sceneGraphics: ((sgRes as { data?: unknown[] })?.data ?? []) as SceneGraphicRecord[],
        captions: ((capRes as { data?: unknown[] })?.data ?? []) as CaptionRecord[],
        manifests: ((manRes as { data?: unknown[] })?.data ?? []) as ManifestSummary[],
        manifestReady: ((manRes as { data?: ManifestSummary[] })?.data ?? []).some(
          (m) => m.is_current,
        ),
        thumbnail,
        videoMetadata,
        thumbnailReady: !!thumbnail && thumbnail.selected_concept_index != null,
        metadataReady: !!videoMetadata,
        sceneSounds: ((soundsRes as { data?: unknown[] })?.data ?? []) as SceneSoundRecord[],
        soundStyleProfile: ((soundProfRes as { data?: unknown })?.data ??
          null) as SoundStyleProfileRecord | null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const value = useMemo<StudioContextValue | null>(() => {
    if (!state) return null;
    return {
      ...state,
      setProject: (patch) =>
        setState((s) => (s ? { ...s, project: { ...s.project, ...patch } } : s)),
      setScenes: (scenes) => setState((s) => (s ? { ...s, scenes } : s)),
      setVoiceovers: (voiceovers) => setState((s) => (s ? { ...s, voiceovers } : s)),
      upsertVoiceover: (vo) =>
        setState((s) => {
          if (!s) return s;
          const others = s.voiceovers.filter((x) => x.scene_id !== vo.scene_id);
          return { ...s, voiceovers: [...others, vo] };
        }),
      setClips: (clips) => setState((s) => (s ? { ...s, clips } : s)),
      upsertClip: (clip) =>
        setState((s) => {
          if (!s) return s;
          const others = s.clips.filter((x) => x.scene_id !== clip.scene_id);
          return { ...s, clips: [...others, clip] };
        }),
      upsertMotionGraphic: (mg) =>
        setState((s) => {
          if (!s) return s;
          const others = s.motionGraphics.filter((x) => x.scene_id !== mg.scene_id);
          return { ...s, motionGraphics: [...others, mg] };
        }),
      upsertSceneGraphic: (g) =>
        setState((s) => {
          if (!s) return s;
          const others = s.sceneGraphics.filter(
            (x) => !(x.scene_id === g.scene_id && x.graphic_category === g.graphic_category),
          );
          return { ...s, sceneGraphics: [...others, g] };
        }),
      removeSceneGraphic: (id) =>
        setState((s) =>
          s ? { ...s, sceneGraphics: s.sceneGraphics.filter((x) => x.id !== id) } : s,
        ),
      upsertCaption: (c) =>
        setState((s) => {
          if (!s) return s;
          const others = s.captions.filter((x) => x.scene_id !== c.scene_id);
          return { ...s, captions: [...others, c] };
        }),
      removeCaption: (id) =>
        setState((s) => (s ? { ...s, captions: s.captions.filter((x) => x.id !== id) } : s)),
      setManifests: (manifests) =>
        setState((s) =>
          s
            ? {
                ...s,
                manifests,
                manifestReady: manifests.some((m) => m.is_current),
              }
            : s,
        ),
      setThumbnail: (thumbnail) =>
        setState((s) =>
          s
            ? {
                ...s,
                thumbnail,
                thumbnailReady: !!thumbnail && thumbnail.selected_concept_index != null,
              }
            : s,
        ),
      setVideoMetadata: (videoMetadata) =>
        setState((s) => (s ? { ...s, videoMetadata, metadataReady: !!videoMetadata } : s)),
      upsertSceneSound: (snd) =>
        setState((s) => {
          if (!s) return s;
          const others = s.sceneSounds.filter((x) => x.scene_id !== snd.scene_id);
          return { ...s, sceneSounds: [...others, snd] };
        }),
      setSoundStyleProfile: (soundStyleProfile) =>
        setState((s) => (s ? { ...s, soundStyleProfile } : s)),

      analyzing,
      setAnalyzing,
      analysisProgress,
      setAnalysisProgress,
      voices,
      voicesLoaded,
      setVoices: (v) => {
        setVoicesState(v);
        setVoicesLoaded(true);
      },
    };
  }, [state, analyzing, analysisProgress, voices, voicesLoaded]);

  if (error) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
