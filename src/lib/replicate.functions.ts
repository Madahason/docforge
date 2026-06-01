import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REPLICATE_BASE = "https://api.replicate.com/v1";

async function pollPrediction(
  predictionId: string,
  token: string,
  maxPolls = 10,
  intervalMs = 2000,
): Promise<any> {
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) throw new Error(`Replicate poll failed: ${res.status}`);
    const json = (await res.json()) as { status: string; output?: any; error?: string };
    if (json.status === "succeeded") return json;
    if (json.status === "failed" || json.status === "canceled") {
      throw new Error(`Replicate generation ${json.status}: ${json.error ?? "unknown"}`);
    }
  }
  throw new Error("Replicate generation timed out — please try again");
}

// ----------------------------------------------------------------
// Image generation (Flux Schnell — 3 images)
// ----------------------------------------------------------------

export const generateImagesReplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        prompt: z.string().min(1).max(2000),
        sceneId: z.string().uuid(),
        projectId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");

    // Kick off 3 single-output predictions in parallel (flux-schnell num_outputs
    // is unreliable across model variants; parallel single outputs is robust).
    const urls: string[] = [];
    const runOne = async () => {
      const create = await fetch(
        `${REPLICATE_BASE}/models/black-forest-labs/flux-schnell/predictions`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
            Prefer: "wait=5",
          },
          body: JSON.stringify({
            input: {
              prompt: data.prompt,
              aspect_ratio: "16:9",
              output_format: "jpg",
              output_quality: 90,
              num_outputs: 1,
            },
          }),
        },
      );
      if (!create.ok) {
        throw new Error(`Replicate create failed: ${create.status} ${await create.text()}`);
      }
      const created = (await create.json()) as {
        id: string;
        status: string;
        output?: any;
        error?: string;
      };

      let final = created;
      if (created.status !== "succeeded") {
        final = await pollPrediction(created.id, token);
      }
      const out = final.output;
      const url = Array.isArray(out) ? out[0] : typeof out === "string" ? out : null;
      if (!url) throw new Error("Replicate returned no image URL");
      return String(url);
    };

    const results = await Promise.all([runOne(), runOne(), runOne()]);
    urls.push(...results);

    // Upsert cache row for this scene + ai_generated
    const existing = await supabase
      .from("image_assets")
      .select("id")
      .eq("scene_id", data.sceneId)
      .eq("source_type", "ai_generated")
      .maybeSingle();

    if (existing.data?.id) {
      await supabase
        .from("image_assets")
        .update({ prompt_used: data.prompt, image_urls: urls, selected_url: null })
        .eq("id", existing.data.id);
    } else {
      await supabase.from("image_assets").insert({
        user_id: userId,
        project_id: data.projectId,
        scene_id: data.sceneId,
        source_type: "ai_generated",
        prompt_used: data.prompt,
        image_urls: urls,
      });
    }

    return { urls, prompt: data.prompt };
  });

// ----------------------------------------------------------------
// Load cached AI image assets for a scene
// ----------------------------------------------------------------

export const loadImageAssetCache = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        sceneId: z.string().uuid(),
        sourceType: z.enum(["ai_generated", "animated"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const res = await supabase
      .from("image_assets")
      .select("*")
      .eq("scene_id", data.sceneId)
      .eq("source_type", data.sourceType)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return { asset: res.data };
  });

// ----------------------------------------------------------------
// Animate image (Stable Video Diffusion)
// ----------------------------------------------------------------

export const animateImageReplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        imageUrl: z.string().url(),
        sceneId: z.string().uuid(),
        projectId: z.string().uuid(),
        style: z.enum(["subtle_motion", "loop_atmosphere"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");

    // Stable Video Diffusion via stability-ai. Pin a known version.
    const create = await fetch(`${REPLICATE_BASE}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=5",
      },
      body: JSON.stringify({
        version: "3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
        input: {
          input_image: data.imageUrl,
          video_length:
            data.style === "loop_atmosphere" ? "25_frames_with_svd_xt" : "14_frames_with_svd",
          sizing_strategy: "maintain_aspect_ratio",
          frames_per_second: 6,
          motion_bucket_id: data.style === "subtle_motion" ? 60 : 127,
        },
      }),
    });
    if (!create.ok) {
      throw new Error(`Replicate animate failed: ${create.status} ${await create.text()}`);
    }
    const created = (await create.json()) as { id: string; status: string; output?: any };
    const final =
      created.status === "succeeded" ? created : await pollPrediction(created.id, token, 15, 2000);

    const out = final.output;
    const videoUrl = Array.isArray(out) ? out[0] : typeof out === "string" ? out : null;
    if (!videoUrl) throw new Error("Replicate returned no video URL");

    // Cache
    const existing = await supabase
      .from("image_assets")
      .select("id")
      .eq("scene_id", data.sceneId)
      .eq("source_type", "animated")
      .maybeSingle();

    if (existing.data?.id) {
      await supabase
        .from("image_assets")
        .update({
          image_urls: [data.imageUrl],
          selected_url: data.imageUrl,
          animation_type: data.style,
          animation_url: String(videoUrl),
        })
        .eq("id", existing.data.id);
    } else {
      await supabase.from("image_assets").insert({
        user_id: userId,
        project_id: data.projectId,
        scene_id: data.sceneId,
        source_type: "animated",
        image_urls: [data.imageUrl],
        selected_url: data.imageUrl,
        animation_type: data.style,
        animation_url: String(videoUrl),
      });
    }

    return { videoUrl: String(videoUrl) };
  });
