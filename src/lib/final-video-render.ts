import { supabase } from "@/integrations/supabase/client";
import { RENDERER_URL, rendererHeaders } from "@/lib/services";
import { DEFAULT_BRAND_CONFIG, type BrandConfig } from "@/hooks/use-brand-config";
import type { KenBurnsConfig, CaptionLineRecord } from "@/lib/studio-context";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SceneRenderPayload = {
  scene_id: string;
  scene_index: number;
  duration_seconds: number;
  visual_type: "motion_graphic" | "image" | "video" | "color";
  visual_url: string | null;
  graphic_type: string | null;
  graphic_data: Record<string, unknown> | null;
  voiceover_url: string | null;
  voiceover_volume: number;
  text_overlay: {
    text: string;
    style: string;
    animation: string;
    position: string;
    color: string;
    start_seconds: number;
    duration_seconds: number;
  } | null;
  captions: Array<{ text: string; start: number; end: number }>;
  ambient_sound_url: string | null;
  ambient_volume: number;
  ken_burns: {
    zoom: "in" | "out";
    pan: "none" | "left" | "right" | "up" | "down";
    speed: "slow" | "medium" | "fast";
  } | null;
};

export type FinalVideoRenderStatus = "idle" | "queued" | "rendering" | "complete" | "failed";

export type FinalVideoRenderJob = {
  id: string;
  status: FinalVideoRenderStatus;
  progress_percent: number;
  output_url: string | null;
  error_message: string | null;
};

// ── buildScenesPayload ────────────────────────────────────────────────────────

export async function buildScenesPayload(projectId: string): Promise<SceneRenderPayload[]> {
  const sbAny = supabase as unknown as { from: (t: string) => any };

  const [scenesRes, clipsRes, mgRes, sgRes, capRes, soundsRes, voRes] = await Promise.all([
    supabase.from("scenes").select("*").eq("project_id", projectId).order("scene_index", { ascending: true }),
    supabase.from("clips").select("*").eq("project_id", projectId),
    sbAny.from("motion_graphics").select("*").eq("project_id", projectId),
    sbAny.from("scene_graphics").select("*").eq("project_id", projectId),
    sbAny.from("captions").select("*").eq("project_id", projectId),
    sbAny.from("scene_sounds").select("*").eq("project_id", projectId),
    supabase.from("voiceovers").select("*").eq("project_id", projectId),
  ]);

  const scenes = (scenesRes.data ?? []) as any[];
  const clips = (clipsRes.data ?? []) as any[];
  const motionGraphics = ((mgRes as any)?.data ?? []) as any[];
  const sceneGraphics = ((sgRes as any)?.data ?? []) as any[];
  const captionRecords = ((capRes as any)?.data ?? []) as any[];
  const sceneSounds = ((soundsRes as any)?.data ?? []) as any[];
  const voiceovers = (voRes.data ?? []) as any[];

  return scenes.map((scene): SceneRenderPayload => {
    // Visual priority: animation_url → image_url → source_url (non-youtube) → motion_graphic → color
    const clip = clips.find((c: any) => c.scene_id === scene.id) ?? null;
    let visual_type: SceneRenderPayload["visual_type"] = "color";
    let visual_url: string | null = null;
    let graphic_type: string | null = null;
    let graphic_data: Record<string, unknown> | null = null;

    if (clip?.animation_url) {
      visual_type = "video";
      visual_url = clip.animation_url as string;
    } else if (clip?.image_url) {
      visual_type = "image";
      visual_url = clip.image_url as string;
    } else if (clip?.source_url && clip?.asset_type !== "youtube") {
      visual_type = "video";
      visual_url = clip.source_url as string;
    } else {
      const mg = motionGraphics.find((m: any) => m.scene_id === scene.id && m.remotion_output_url);
      if (mg) {
        visual_type = "motion_graphic";
        graphic_type = (mg.graphic_type as string) ?? null;
        graphic_data = (mg.graphic_data as Record<string, unknown>) ?? null;
      }
    }

    // Voiceover
    const voiceover = voiceovers.find((v: any) => v.scene_id === scene.id) ?? null;

    // Text overlay — first scene_graphics row with graphic_category = 'text_overlay'
    const overlay =
      sceneGraphics.find((g: any) => g.scene_id === scene.id && g.graphic_category === "text_overlay") ?? null;

    // Captions from caption_lines JSON array
    const captionRecord = captionRecords.find((c: any) => c.scene_id === scene.id) ?? null;
    const captionLines = (captionRecord?.caption_lines ?? []) as CaptionLineRecord[];
    const captions = captionLines.map((cl) => ({ text: cl.text, start: cl.start, end: cl.end }));

    // Ambient sound
    const sound = sceneSounds.find((s: any) => s.scene_id === scene.id) ?? null;

    // Ken burns from clip
    const kbConfig = (clip?.ken_burns_config ?? null) as KenBurnsConfig | null;
    const ken_burns =
      kbConfig?.enabled
        ? {
            zoom: (kbConfig.zoom ?? "in") as "in" | "out",
            pan: (kbConfig.pan ?? "none") as "none" | "left" | "right" | "up" | "down",
            speed: (kbConfig.speed ?? "slow") as "slow" | "medium" | "fast",
          }
        : null;

    return {
      scene_id: scene.id as string,
      scene_index: scene.scene_index as number,
      duration_seconds: (scene.estimated_seconds ?? scene.duration_seconds ?? 5) as number,
      visual_type,
      visual_url,
      graphic_type: visual_type === "motion_graphic" ? graphic_type : null,
      graphic_data: visual_type === "motion_graphic" ? graphic_data : null,
      voiceover_url: (voiceover?.audio_url as string | null) ?? null,
      voiceover_volume: 1.0,
      text_overlay: overlay
        ? {
            text: (overlay.overlay_text as string) ?? "",
            style: (overlay.overlay_style as string) ?? "bold_statement",
            animation: (overlay.animation_style as string) ?? "fade_in",
            position: (overlay.position as string) ?? "center",
            color: (overlay.text_color as string) ?? "#f0f0f0",
            start_seconds: (overlay.start_seconds as number) ?? 0,
            duration_seconds: (overlay.duration_seconds as number) ?? 3,
          }
        : null,
      captions,
      ambient_sound_url: (sound?.ambient_file_url as string | null) ?? null,
      ambient_volume: (sound?.ambient_volume as number) ?? 0.12,
      ken_burns,
    };
  });
}

// ── triggerFinalVideoRender ───────────────────────────────────────────────────

export async function triggerFinalVideoRender(projectId: string): Promise<string> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) throw new Error("Not authenticated");
  const userId = userRes.user.id;

  const scenes = await buildScenesPayload(projectId);

  // Brand config
  const { data: brandRow } = await supabase
    .from("brand_configs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const brand: BrandConfig = brandRow
    ? {
        primary_color: brandRow.primary_color,
        secondary_color: brandRow.secondary_color,
        background_color: brandRow.background_color,
        text_color: brandRow.text_color,
        muted_color: brandRow.muted_color,
        font_family: brandRow.font_family,
        logo_url: brandRow.logo_url,
      }
    : DEFAULT_BRAND_CONFIG;

  // Music from sound_style_profiles
  const { data: soundProfile } = await (supabase as unknown as { from: (t: string) => any })
    .from("sound_style_profiles")
    .select("tension_drone_url")
    .eq("project_id", projectId)
    .maybeSingle();

  const music_url: string | null = (soundProfile as any)?.tension_drone_url ?? null;

  // Create render job record
  const jobId = crypto.randomUUID();
  const { error: insertError } = await (supabase as unknown as { from: (t: string) => any })
    .from("render_jobs")
    .insert({
      id: jobId,
      user_id: userId,
      project_id: projectId,
      scene_id: "full_video",
      graphic_type: "full_video",
      render_type: "full_video",
      render_method: "remotion",
      status: "queued",
      progress_percent: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (insertError) throw new Error("Failed to create render job: " + insertError.message);

  // Fire POST to renderer
  let postOk = false;
  try {
    const resp = await fetch(`${RENDERER_URL}/render-video`, {
      method: "POST",
      headers: rendererHeaders,
      body: JSON.stringify({
        render_job_id: jobId,
        project_id: projectId,
        scenes,
        music_url,
        music_volume: 0.2,
        brand,
        fps: 30,
        width: 1920,
        height: 1080,
      }),
    });
    postOk = resp.ok;
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Renderer responded ${resp.status}: ${text}`);
    }
  } catch (err) {
    // Mark job failed and re-throw
    await (supabase as unknown as { from: (t: string) => any })
      .from("render_jobs")
      .update({ status: "failed", error_message: (err as Error).message, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    throw err;
  }

  void postOk; // used above
  return jobId;
}

// ── pollFinalVideoRender ──────────────────────────────────────────────────────

export async function pollFinalVideoRender(jobId: string): Promise<FinalVideoRenderJob> {
  const { data, error } = await (supabase as unknown as { from: (t: string) => any })
    .from("render_jobs")
    .select("id, status, progress_percent, output_url, error_message")
    .eq("id", jobId)
    .single();

  if (error || !data) {
    throw new Error("Failed to fetch render job: " + (error?.message ?? "not found"));
  }

  return {
    id: data.id as string,
    status: data.status as FinalVideoRenderStatus,
    progress_percent: (data.progress_percent as number) ?? 0,
    output_url: (data.output_url as string | null) ?? null,
    error_message: (data.error_message as string | null) ?? null,
  };
}
