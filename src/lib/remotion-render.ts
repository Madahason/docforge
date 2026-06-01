import { supabase } from "@/integrations/supabase/client";

export type RenderJob = {
  id: string;
  user_id: string;
  project_id: string;
  scene_id: string;
  motion_graphic_id: string | null;
  render_method: string;
  graphic_type: string | null;
  graphic_data: Record<string, unknown>;
  duration_seconds: number;
  status: string;
  progress_percent: number;
  output_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type TriggerRenderInput = {
  project_id: string;
  scene_id: string;
  motion_graphic_id?: string | null;
  graphic_type: string;
  graphic_data: Record<string, unknown>;
  duration_seconds?: number;
};

export async function triggerRemotionRender(input: TriggerRenderInput): Promise<RenderJob> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) throw new Error("Not authenticated");

  const duration = input.duration_seconds ?? 6;

  const { data: job, error: insErr } = await supabase
    .from("render_jobs")
    .insert({
      user_id: userRes.user.id,
      project_id: input.project_id,
      scene_id: input.scene_id,
      motion_graphic_id: input.motion_graphic_id ?? null,
      render_method: "remotion",
      graphic_type: input.graphic_type,
      graphic_data: input.graphic_data as never,
      duration_seconds: duration,
      status: "pending",
      progress_percent: 0,
    })
    .select()
    .single();

  if (insErr || !job) throw new Error(insErr?.message ?? "Failed to create render job");

  // Fire-and-forget POST to the external Remotion render service
  const serviceUrl = (import.meta.env.VITE_CLIP_SERVICE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  );
  if (serviceUrl) {
    fetch(`${serviceUrl}/render-remotion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        render_job_id: job.id,
        project_id: input.project_id,
        scene_id: input.scene_id,
        graphic_type: input.graphic_type,
        graphic_data: input.graphic_data,
        duration_seconds: duration,
      }),
    }).catch(() => {
      // Errors are surfaced via render_jobs.status updates from the service
    });
  }

  return job as RenderJob;
}

export function statusLabelForProgress(percent: number, status: string): string {
  if (status === "failed") return "Failed";
  if (status === "complete" || percent >= 100) return "Complete";
  if (percent >= 90) return "Uploading...";
  if (percent >= 50) return "Rendering frames...";
  if (percent >= 30) return "Preparing composition...";
  if (percent >= 10) return "Bundling...";
  return "Queued...";
}
