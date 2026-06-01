import { supabase } from "@/integrations/supabase/client";
import type {
  CaptionRecord,
  Clip,
  MotionGraphicRecord,
  ProjectRecord,
  Scene,
  SceneGraphicRecord,
  StyleProfileRecord,
  Voiceover,
} from "@/lib/studio-context";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type ManifestRow = {
  id: string;
  user_id: string;
  project_id: string;
  version: number;
  status: string;
  manifest_data: ManifestData;
  total_scenes: number | null;
  total_duration_seconds: number | null;
  real_footage_seconds: number | null;
  motion_graphic_scenes: number | null;
  ai_image_scenes: number | null;
  stock_scenes: number | null;
  youtube_scenes: number | null;
  hera_scenes: number | null;
  caption_scenes: number | null;
  graphic_scenes: number | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export type ManifestData = {
  manifest_version: number;
  generated_at: string;
  project: {
    id: string;
    title: string;
    total_duration_seconds: number;
    total_duration_formatted: string;
    target_duration: string | null;
    platform_targets: string[];
    style_profile: Record<string, unknown>;
  };
  music: {
    mood: string | null;
    intensity: string | null;
    instruction: string;
    suggested_tracks: string[];
  };
  scenes: ManifestScene[];
  assembly_summary: AssemblySummary;
  editor_brief: EditorBrief;
};

export type ManifestScene = {
  scene_number: number;
  scene_id: string;
  timeline_start: number;
  timeline_end: number;
  timeline_start_formatted: string;
  timeline_end_formatted: string;
  duration_seconds: number;
  emotional_temperature: string | null;
  visual_job: string | null;
  pacing_instruction: string | null;
  recommended_asset_type: string;
  script: { text: string; word_count: number | null; wpm: number | null };
  voiceover: {
    status: string;
    audio_url: string | null;
    duration_seconds: number | null;
    voice_name: string | null;
    wpm: number | null;
  };
  visual: ManifestVisual;
  graphics: ManifestGraphics;
  captions: {
    status: string;
    line_count: number;
    preview: string[];
  };
  cut_instructions: { cut_in: string; cut_out: string; transition_note: string };
  music_instruction: { action: string; note: string };
};

export type ManifestVisual = {
  asset_type: string;
  status: string;
  image_url: string | null;
  ken_burns: Record<string, unknown> | null;
  youtube_url: string | null;
  youtube_channel: string | null;
  youtube_timestamp_start: string | null;
  youtube_timestamp_end: string | null;
  fetch_status: string | null;
  stock_url: string | null;
  stock_source: string | null;
  motion_graphic: {
    graphic_type: string;
    graphic_data: Record<string, unknown>;
    render_method: string;
  } | null;
  hera_standalone: {
    graphic_type: string;
    output_url: string | null;
    duration_seconds: number;
  } | null;
  hera_overlay: {
    overlay_style: string | null;
    output_url: string | null;
    start_seconds: number;
    duration_seconds: number;
    dim_opacity: number;
    base_asset_id: string | null;
  } | null;
  editor_instruction: string;
};

export type ManifestGraphics = {
  has_text_overlay: boolean;
  text_overlay: {
    text: string;
    style: string | null;
    animation: string | null;
    position: string | null;
    color: string | null;
    start_at: number;
    duration: number;
    editor_instruction: string;
  } | null;
  has_data_graphic: boolean;
  data_graphic: {
    graphic_type: string | null;
    graphic_data: Record<string, unknown>;
    render_method: string;
    duration: number;
    editor_instruction: string;
  } | null;
};

export type AssemblySummary = {
  total_scenes: number;
  total_duration_seconds: number;
  total_duration_formatted: string;
  asset_breakdown: {
    motion_graphic_scenes: number;
    ai_image_scenes: number;
    stock_image_scenes: number;
    stock_video_scenes: number;
    youtube_scenes: number;
    hera_standalone_scenes: number;
    hera_overlay_scenes: number;
  };
  real_footage_percentage: number;
  caption_lines_total: number;
  graphics_total: number;
  missing_assets: string[];
  warnings: string[];
};

export type EditorBrief = {
  overview: string;
  color_grade: string;
  pacing_notes: string;
  music_notes: string;
  export_specs: Record<string, Record<string, string | number>>;
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

export function formatTimecode(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function durationFor(scene: Scene, vo: Voiceover | undefined): number {
  const d = vo?.duration_seconds;
  if (typeof d === "number" && d > 0) return d;
  return scene.estimated_seconds ?? 0;
}

/* -------------------------------------------------------------------------- */
/*  Editor instruction builders                                               */
/* -------------------------------------------------------------------------- */

function instructionForVisual(
  scene: Scene,
  clip: Clip | undefined,
  mg: MotionGraphicRecord | undefined,
  durationSeconds: number,
): { visual: ManifestVisual; type: string } {
  const dSec = Math.round(durationSeconds * 10) / 10;

  // Hera standalone / overlay
  if (mg?.render_method === "hera") {
    const isOverlay = (mg.graphic_data as { hera_mode?: string })?.hera_mode === "overlay";
    if (isOverlay) {
      const od = mg.graphic_data as Record<string, unknown>;
      const overlay = {
        overlay_style: (od.overlay_style as string) ?? null,
        output_url: mg.hera_output_url,
        start_seconds: Number((od.overlay_start as number) ?? 0),
        duration_seconds: Number((od.overlay_duration as number) ?? dSec),
        dim_opacity: Number((od.overlay_dim_opacity as number) ?? 0.4),
        base_asset_id: (od.overlay_base_asset_id as string) ?? null,
      };
      return {
        type: "hera_overlay",
        visual: {
          asset_type: "hera_overlay",
          status: mg.confirmed ? "confirmed" : "configured",
          image_url: null,
          ken_burns: null,
          youtube_url: null,
          youtube_channel: null,
          youtube_timestamp_start: null,
          youtube_timestamp_end: null,
          fetch_status: null,
          stock_url: null,
          stock_source: null,
          motion_graphic: null,
          hera_standalone: null,
          hera_overlay: overlay,
          editor_instruction:
            `HERA OVERLAY — ${overlay.overlay_style ?? "lower_third"}.\n` +
            `Overlay video: ${overlay.output_url ?? "[MISSING — render pending]"}\n` +
            `Appears at: ${overlay.start_seconds}s. Duration: ${overlay.duration_seconds}s.\n` +
            `Dim base clip to ${Math.round(overlay.dim_opacity * 100)}%.`,
        },
      };
    }
    return {
      type: "hera_standalone",
      visual: {
        asset_type: "hera_standalone",
        status: mg.confirmed ? "confirmed" : "configured",
        image_url: null,
        ken_burns: null,
        youtube_url: null,
        youtube_channel: null,
        youtube_timestamp_start: null,
        youtube_timestamp_end: null,
        fetch_status: null,
        stock_url: null,
        stock_source: null,
        motion_graphic: null,
        hera_overlay: null,
        hera_standalone: {
          graphic_type: mg.graphic_type,
          output_url: mg.hera_output_url,
          duration_seconds: dSec,
        },
        editor_instruction:
          `HERA STANDALONE GRAPHIC.\n` +
          `Video at: ${mg.hera_output_url ?? "[MISSING — render pending]"}\n` +
          `Type: ${mg.graphic_type}. Duration: ${dSec}s.`,
      },
    };
  }

  // Remotion motion graphic
  if (mg && mg.render_method !== "hera") {
    return {
      type: "motion_graphic",
      visual: {
        asset_type: "motion_graphic",
        status: mg.confirmed ? "confirmed" : "configured",
        image_url: null,
        ken_burns: null,
        youtube_url: null,
        youtube_channel: null,
        youtube_timestamp_start: null,
        youtube_timestamp_end: null,
        fetch_status: null,
        stock_url: null,
        stock_source: null,
        hera_standalone: null,
        hera_overlay: null,
        motion_graphic: {
          graphic_type: mg.graphic_type,
          graphic_data: mg.graphic_data,
          render_method: mg.render_method,
        },
        editor_instruction:
          `MOTION GRAPHIC — ${mg.graphic_type}.\n` +
          `Render with Remotion at export time.\n` +
          `Duration: ${dSec}s.`,
      },
    };
  }

  // No clip yet
  if (!clip) {
    const assetType = scene.recommended_asset_type ?? "ai_image_ken_burns";
    return {
      type: assetType,
      visual: {
        asset_type: assetType,
        status: "missing",
        image_url: null,
        ken_burns: null,
        youtube_url: null,
        youtube_channel: null,
        youtube_timestamp_start: null,
        youtube_timestamp_end: null,
        fetch_status: null,
        stock_url: null,
        stock_source: null,
        motion_graphic: null,
        hera_standalone: null,
        hera_overlay: null,
        editor_instruction: `[MISSING] No clip selected. Recommended: ${assetType}.`,
      },
    };
  }

  const at = clip.asset_type;

  if (at === "youtube" || clip.source_type === "youtube") {
    return {
      type: "youtube_clip",
      visual: {
        asset_type: "youtube_clip",
        status: clip.status,
        image_url: null,
        ken_burns: null,
        youtube_url: clip.source_url,
        youtube_channel: clip.source_channel,
        youtube_timestamp_start: clip.timestamp_start,
        youtube_timestamp_end: clip.timestamp_end,
        fetch_status: clip.fetch_status,
        stock_url: null,
        stock_source: null,
        motion_graphic: null,
        hera_standalone: null,
        hera_overlay: null,
        editor_instruction:
          `YouTube clip from ${clip.source_channel ?? "unknown"}.\n` +
          `Source: ${clip.source_url ?? "[MISSING url]"}\n` +
          `Timestamp: ${clip.timestamp_start ?? "?"} to ${clip.timestamp_end ?? "?"}.\n` +
          `Duration: ${dSec}s.\n` +
          (clip.fetch_status === "fetched" && clip.local_file_path
            ? `File ready at: ${clip.local_file_path}.`
            : `Fetch status: ${clip.fetch_status ?? "pending"} — fetch before edit.`),
      },
    };
  }

  if (at === "stock_video" || clip.source_type === "pexels_video") {
    return {
      type: "stock_video",
      visual: {
        asset_type: "stock_video",
        status: clip.status,
        image_url: null,
        ken_burns: null,
        youtube_url: null,
        youtube_channel: null,
        youtube_timestamp_start: null,
        youtube_timestamp_end: null,
        fetch_status: clip.fetch_status,
        stock_url: clip.source_url,
        stock_source: clip.source_type ?? "stock",
        motion_graphic: null,
        hera_standalone: null,
        hera_overlay: null,
        editor_instruction:
          `Stock video from ${clip.source_type ?? "stock"}.\n` +
          `Download at: ${clip.source_url ?? "[MISSING url]"}\n` +
          `Trim to ${clip.timestamp_start ?? "0"} – ${clip.timestamp_end ?? "?"}.\n` +
          `Duration: ${dSec}s.`,
      },
    };
  }

  // Image (AI or stock) with optional Ken Burns
  const isStock = at === "stock_image" || clip.source_type === "pexels_photo";
  const kb = clip.ken_burns_config ?? null;
  return {
    type: isStock ? "stock_image_ken_burns" : "ai_image_ken_burns",
    visual: {
      asset_type: isStock ? "stock_image_ken_burns" : "ai_image_ken_burns",
      status: clip.status,
      image_url: clip.image_url ?? clip.source_url ?? clip.thumbnail_url,
      ken_burns: kb,
      youtube_url: null,
      youtube_channel: null,
      youtube_timestamp_start: null,
      youtube_timestamp_end: null,
      fetch_status: clip.fetch_status,
      stock_url: isStock ? clip.source_url : null,
      stock_source: isStock ? (clip.source_type ?? "stock") : null,
      motion_graphic: null,
      hera_standalone: null,
      hera_overlay: null,
      editor_instruction:
        `${isStock ? "Stock image" : "AI generated image"}` +
        (clip.image_url || clip.source_url ? ` at ${clip.image_url ?? clip.source_url}` : "") +
        `.\n` +
        (kb?.enabled
          ? `Apply Ken Burns ${kb.zoom ?? "in"} ${kb.pan ?? "none"} at ${kb.speed ?? "slow"} speed.\n`
          : `No Ken Burns animation configured.\n`) +
        `Hold for full ${dSec}s duration.`,
    },
  };
}

function buildGraphicsBlock(
  graphics: SceneGraphicRecord[],
  defaultDuration: number,
): ManifestGraphics {
  const textOverlay = graphics.find((g) => g.graphic_category === "text_overlay");
  const dataGraphic = graphics.find((g) => g.graphic_category === "data_graphic");

  return {
    has_text_overlay: !!textOverlay,
    text_overlay: textOverlay
      ? {
          text: textOverlay.overlay_text ?? "",
          style: textOverlay.overlay_style,
          animation: textOverlay.animation_style,
          position: textOverlay.position,
          color: textOverlay.text_color,
          start_at: textOverlay.start_seconds,
          duration: textOverlay.duration_seconds,
          editor_instruction:
            `Add ${textOverlay.overlay_style ?? "text"} ` +
            `${textOverlay.position ?? "centered"} text ` +
            `at ${textOverlay.start_seconds.toFixed(1)}s ` +
            `for ${textOverlay.duration_seconds.toFixed(1)}s. ` +
            `${textOverlay.animation_style ?? "fade_in"} animation. ` +
            `Color ${textOverlay.text_color ?? "#f0f0f0"}.`,
        }
      : null,
    has_data_graphic: !!dataGraphic,
    data_graphic: dataGraphic
      ? {
          graphic_type: dataGraphic.graphic_type,
          graphic_data: dataGraphic.graphic_data,
          render_method: dataGraphic.render_method,
          duration: dataGraphic.duration_seconds || defaultDuration,
          editor_instruction:
            `Render ${dataGraphic.graphic_type ?? "data graphic"} ` +
            `via ${dataGraphic.render_method}. ` +
            `Duration ${(dataGraphic.duration_seconds || defaultDuration).toFixed(1)}s.`,
        }
      : null,
  };
}

function cutInstructionsFor(
  index: number,
  total: number,
  pacing: string | null,
): { cut_in: string; cut_out: string; transition_note: string } {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const cut = pacing === "slow_hold" ? "soft_cut" : "hard_cut";
  return {
    cut_in: isFirst ? "fade_from_black" : cut,
    cut_out: isLast ? "fade_to_black" : cut,
    transition_note:
      `${isFirst ? "Fade from black." : `${cut.replace("_", " ")} in from previous scene.`} ` +
      `${isLast ? "Fade to black." : `${cut.replace("_", " ")} out to next scene.`}`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Main builder                                                              */
/* -------------------------------------------------------------------------- */

export type BuildManifestInput = {
  project: ProjectRecord;
  styleProfile: StyleProfileRecord | null;
  scenes: Scene[];
  voiceovers: Voiceover[];
  clips: Clip[];
  motionGraphics: MotionGraphicRecord[];
  sceneGraphics: SceneGraphicRecord[];
  captions: CaptionRecord[];
};

export function buildManifest(input: BuildManifestInput): ManifestData {
  const ordered = [...input.scenes].sort((a, b) => a.scene_index - b.scene_index);

  let offset = 0;
  const breakdown = {
    motion_graphic_scenes: 0,
    ai_image_scenes: 0,
    stock_image_scenes: 0,
    stock_video_scenes: 0,
    youtube_scenes: 0,
    hera_standalone_scenes: 0,
    hera_overlay_scenes: 0,
  };
  const warnings: string[] = [];
  const missing: string[] = [];
  let realFootage = 0;
  let totalCaptionLines = 0;
  let totalGraphics = 0;

  const scenes: ManifestScene[] = ordered.map((scene, i) => {
    const vo = input.voiceovers.find((v) => v.scene_id === scene.id);
    const clip = input.clips.find((c) => c.scene_id === scene.id);
    const mg = input.motionGraphics.find((m) => m.scene_id === scene.id);
    const cap = input.captions.find((c) => c.scene_id === scene.id);
    const sceneGfx = input.sceneGraphics.filter((g) => g.scene_id === scene.id);

    const duration = durationFor(scene, vo);
    const start = offset;
    const end = offset + duration;
    offset = end;

    if (!vo || (vo.status !== "complete" && vo.status !== "ready")) {
      missing.push(`Scene ${scene.scene_index + 1}: voiceover missing`);
      warnings.push(`Scene ${scene.scene_index + 1}: voiceover not ready`);
    }
    if (!clip && !mg) {
      missing.push(`Scene ${scene.scene_index + 1}: visual asset missing`);
      warnings.push(`Scene ${scene.scene_index + 1}: no visual asset`);
    }
    if (clip?.fetch_status === "pending" && clip.asset_type === "youtube") {
      warnings.push(`Scene ${scene.scene_index + 1}: YouTube clip not yet fetched`);
    }

    const { visual, type } = instructionForVisual(scene, clip, mg, duration);
    if (type === "motion_graphic") breakdown.motion_graphic_scenes += 1;
    else if (type === "ai_image_ken_burns") breakdown.ai_image_scenes += 1;
    else if (type === "stock_image_ken_burns") breakdown.stock_image_scenes += 1;
    else if (type === "stock_video") {
      breakdown.stock_video_scenes += 1;
      realFootage += duration;
    } else if (type === "youtube_clip") {
      breakdown.youtube_scenes += 1;
      realFootage += duration;
    } else if (type === "hera_standalone") breakdown.hera_standalone_scenes += 1;
    else if (type === "hera_overlay") breakdown.hera_overlay_scenes += 1;

    const graphics = buildGraphicsBlock(sceneGfx, duration);
    if (graphics.has_text_overlay) totalGraphics += 1;
    if (graphics.has_data_graphic) totalGraphics += 1;

    const captionLines = cap?.caption_lines?.length ?? 0;
    totalCaptionLines += captionLines;

    return {
      scene_number: scene.scene_index + 1,
      scene_id: scene.id,
      timeline_start: Math.round(start * 10) / 10,
      timeline_end: Math.round(end * 10) / 10,
      timeline_start_formatted: formatTimecode(start),
      timeline_end_formatted: formatTimecode(end),
      duration_seconds: Math.round(duration * 10) / 10,
      emotional_temperature: scene.emotional_temperature,
      visual_job: scene.visual_job,
      pacing_instruction: scene.pacing_instruction,
      recommended_asset_type: scene.recommended_asset_type ?? "ai_image_ken_burns",
      script: {
        text: scene.script_text,
        word_count: scene.word_count,
        wpm: vo?.words_per_minute ?? null,
      },
      voiceover: {
        status: vo?.status ?? "missing",
        audio_url: vo?.audio_url ?? null,
        duration_seconds: vo?.duration_seconds ?? null,
        voice_name: vo?.voice_name ?? null,
        wpm: vo?.words_per_minute ?? null,
      },
      visual,
      graphics,
      captions: {
        status: cap?.status ?? scene.captions_status ?? "pending",
        line_count: captionLines,
        preview: (cap?.caption_lines ?? []).slice(0, 2).map((l) => l.text),
      },
      cut_instructions: cutInstructionsFor(i, ordered.length, scene.pacing_instruction),
      music_instruction: {
        action: i === 0 ? "start" : i === ordered.length - 1 ? "resolve" : "continue",
        note:
          i === 0
            ? "Music begins under opening."
            : i === ordered.length - 1
              ? "Music resolves to silence."
              : "Music continues under scene.",
      },
    };
  });

  const totalDuration = scenes.reduce((acc, s) => acc + s.duration_seconds, 0);
  const realPct = totalDuration > 0 ? (realFootage / totalDuration) * 100 : 0;

  const styleProfile: Record<string, unknown> = input.styleProfile
    ? {
        editing_style: input.styleProfile.editing_style,
        content_type: input.styleProfile.content_type,
        name: input.styleProfile.name,
      }
    : {};
  if (input.project.opening_structure)
    styleProfile.opening_structure = input.project.opening_structure;
  if (input.project.music_intensity) styleProfile.music_intensity = input.project.music_intensity;
  if (input.project.text_overlay_frequency)
    styleProfile.text_overlay_frequency = input.project.text_overlay_frequency;

  return {
    manifest_version: 1,
    generated_at: new Date().toISOString(),
    project: {
      id: input.project.id,
      title: input.project.title,
      total_duration_seconds: Math.round(totalDuration * 10) / 10,
      total_duration_formatted: formatTimecode(totalDuration),
      target_duration: input.project.target_duration,
      platform_targets: Array.isArray(input.project.platform_targets)
        ? input.project.platform_targets
        : [],
      style_profile: styleProfile,
    },
    music: {
      mood: input.project.music_intensity ?? null,
      intensity: input.project.music_intensity ?? null,
      instruction: input.project.music_on
        ? "Music underscore throughout. Match intensity to pacing curve."
        : "No music — voiceover and ambient sound only.",
      suggested_tracks: input.project.music_on
        ? ["Sparse piano underscore", "Dark ambient bed", "Tension build electronic"]
        : [],
    },
    scenes,
    assembly_summary: {
      total_scenes: scenes.length,
      total_duration_seconds: Math.round(totalDuration * 10) / 10,
      total_duration_formatted: formatTimecode(totalDuration),
      asset_breakdown: breakdown,
      real_footage_percentage: Math.round(realPct * 10) / 10,
      caption_lines_total: totalCaptionLines,
      graphics_total: totalGraphics,
      missing_assets: missing,
      warnings,
    },
    editor_brief: {
      overview: `${input.styleProfile?.content_type ?? "Documentary-style"} video. ${
        input.styleProfile?.editing_style ?? "Standard cut"
      } structure.`,
      color_grade: "Match scene emotional temperature. Maintain consistent grade across cuts.",
      pacing_notes:
        "Open deliberately. Build through middle. Resolve quietly. Follow per-scene pacing instructions.",
      music_notes: input.project.music_on
        ? `Intensity: ${input.project.music_intensity ?? "moderate"}. Layer under voiceover.`
        : "No music bed.",
      export_specs: {
        youtube: {
          resolution: "1920x1080",
          fps: 30,
          format: "MP4 H.264",
          audio: "AAC 320kbps",
        },
        youtube_shorts: {
          resolution: "1080x1920",
          fps: 30,
          format: "MP4 H.264",
          note: "Clip strongest 60 seconds vertically",
        },
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Persistence                                                               */
/* -------------------------------------------------------------------------- */

export async function saveManifest(input: BuildManifestInput): Promise<ManifestRow> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const manifest = buildManifest(input);
  const summary = manifest.assembly_summary;

  // demote previous current
  const client = supabase as unknown as {
    from: (t: string) => ReturnType<typeof supabase.from>;
  };
  await client
    .from("manifests")
    .update({ is_current: false })
    .eq("project_id", input.project.id)
    .eq("is_current", true);

  // next version number
  const { data: latest } = await client
    .from("manifests")
    .select("version")
    .eq("project_id", input.project.id)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion =
    Array.isArray(latest) && latest.length > 0 ? (latest[0] as { version: number }).version + 1 : 1;

  const row = {
    user_id: userId,
    project_id: input.project.id,
    version: nextVersion,
    status: summary.warnings.length > 0 ? "draft" : "ready",
    manifest_data: { ...manifest, manifest_version: nextVersion },
    total_scenes: summary.total_scenes,
    total_duration_seconds: summary.total_duration_seconds,
    real_footage_seconds:
      Math.round((summary.real_footage_percentage / 100) * summary.total_duration_seconds * 10) /
      10,
    motion_graphic_scenes: summary.asset_breakdown.motion_graphic_scenes,
    ai_image_scenes: summary.asset_breakdown.ai_image_scenes,
    stock_scenes:
      summary.asset_breakdown.stock_image_scenes + summary.asset_breakdown.stock_video_scenes,
    youtube_scenes: summary.asset_breakdown.youtube_scenes,
    hera_scenes:
      summary.asset_breakdown.hera_standalone_scenes + summary.asset_breakdown.hera_overlay_scenes,
    caption_scenes: input.captions.filter((c) => (c.caption_lines?.length ?? 0) > 0).length,
    graphic_scenes: input.sceneGraphics.length,
    is_current: true,
  };

  const { data, error } = await client.from("manifests").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as unknown as ManifestRow;
}

export async function fetchManifests(projectId: string): Promise<ManifestRow[]> {
  const client = supabase as unknown as {
    from: (t: string) => ReturnType<typeof supabase.from>;
  };
  const { data, error } = await client
    .from("manifests")
    .select("*")
    .eq("project_id", projectId)
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ManifestRow[];
}

export async function restoreManifestVersion(
  projectId: string,
  sourceVersion: ManifestRow,
): Promise<ManifestRow> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const client = supabase as unknown as {
    from: (t: string) => ReturnType<typeof supabase.from>;
  };
  await client
    .from("manifests")
    .update({ is_current: false })
    .eq("project_id", projectId)
    .eq("is_current", true);

  const { data: latest } = await client
    .from("manifests")
    .select("version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion =
    Array.isArray(latest) && latest.length > 0 ? (latest[0] as { version: number }).version + 1 : 1;

  const row = {
    ...sourceVersion,
    id: undefined,
    user_id: userId,
    version: nextVersion,
    is_current: true,
    created_at: undefined,
    updated_at: undefined,
    manifest_data: { ...sourceVersion.manifest_data, manifest_version: nextVersion },
  };
  const { data, error } = await client.from("manifests").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as unknown as ManifestRow;
}

/* -------------------------------------------------------------------------- */
/*  Export helpers                                                            */
/* -------------------------------------------------------------------------- */

export function manifestToMarkdown(m: ManifestData): string {
  const lines: string[] = [];
  lines.push(`# Assembly Manifest — ${m.project.title}`);
  lines.push("");
  lines.push(`Version: ${m.manifest_version}`);
  lines.push(`Generated: ${m.generated_at}`);
  lines.push(
    `Duration: ${m.project.total_duration_formatted} (${m.project.total_duration_seconds}s)`,
  );
  lines.push(`Platforms: ${m.project.platform_targets.join(", ") || "—"}`);
  lines.push("");
  lines.push(`## Editor Brief`);
  lines.push(m.editor_brief.overview);
  lines.push("");
  lines.push(`**Color grade**: ${m.editor_brief.color_grade}`);
  lines.push(`**Pacing**: ${m.editor_brief.pacing_notes}`);
  lines.push(`**Music**: ${m.editor_brief.music_notes}`);
  lines.push("");
  lines.push(`## Scenes`);
  for (const s of m.scenes) {
    lines.push("");
    lines.push(
      `### Scene ${s.scene_number} — ${s.timeline_start_formatted} → ${s.timeline_end_formatted}`,
    );
    lines.push(`- Asset: ${s.visual.asset_type} (${s.visual.status})`);
    lines.push(`- Voiceover: ${s.voiceover.status} (${s.voiceover.duration_seconds ?? 0}s)`);
    lines.push(`- Script: ${s.script.text.slice(0, 200)}${s.script.text.length > 200 ? "…" : ""}`);
    lines.push(``);
    lines.push("```");
    lines.push(s.visual.editor_instruction);
    lines.push("```");
    if (s.graphics.has_text_overlay) {
      lines.push(`- Text overlay: ${s.graphics.text_overlay?.text}`);
    }
    if (s.graphics.has_data_graphic) {
      lines.push(`- Data graphic: ${s.graphics.data_graphic?.graphic_type}`);
    }
  }
  if (m.assembly_summary.warnings.length > 0) {
    lines.push("");
    lines.push(`## Warnings`);
    for (const w of m.assembly_summary.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

export function downloadBlob(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
