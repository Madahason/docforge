import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const tokenSchema = z.object({
  token: z.string().min(8).max(64),
});

export const getReviewByToken = createServerFn({ method: "POST" })
  .inputValidator((input) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: review, error } = await supabaseAdmin
      .from("client_reviews")
      .select("*")
      .eq("share_token", data.token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!review) return { ok: false as const, reason: "not_found" as const };

    // Mark as viewed on first open
    if (review.status === "pending") {
      await supabaseAdmin
        .from("client_reviews")
        .update({ status: "viewed", viewed_at: new Date().toISOString() })
        .eq("id", review.id);
      review.status = "viewed";
      review.viewed_at = new Date().toISOString();
    } else if (!review.viewed_at) {
      await supabaseAdmin
        .from("client_reviews")
        .update({ viewed_at: new Date().toISOString() })
        .eq("id", review.id);
    }

    const projectId = review.project_id;

    const [projectRes, scenesRes, voRes, clipsRes, mgRes, imgRes, thumbRes, metaRes] =
      await Promise.all([
        supabaseAdmin.from("projects").select("*").eq("id", projectId).maybeSingle(),
        supabaseAdmin
          .from("scenes")
          .select("*")
          .eq("project_id", projectId)
          .order("scene_index", { ascending: true }),
        supabaseAdmin.from("voiceovers").select("*").eq("project_id", projectId),
        supabaseAdmin.from("clips").select("*").eq("project_id", projectId),
        supabaseAdmin.from("motion_graphics").select("*").eq("project_id", projectId),
        supabaseAdmin.from("image_assets").select("*").eq("project_id", projectId),
        supabaseAdmin.from("thumbnails").select("*").eq("project_id", projectId).maybeSingle(),
        supabaseAdmin.from("video_metadata").select("*").eq("project_id", projectId).maybeSingle(),
      ]);

    return {
      ok: true as const,
      review,
      project: projectRes.data,
      scenes: scenesRes.data ?? [],
      voiceovers: voRes.data ?? [],
      clips: clipsRes.data ?? [],
      motionGraphics: mgRes.data ?? [],
      imageAssets: imgRes.data ?? [],
      thumbnail: thumbRes.data ?? null,
      videoMetadata: metaRes.data ?? null,
    };
  });

const submitSchema = z.object({
  token: z.string().min(8).max(64),
  decision: z.enum(["approved", "changes_requested"]),
  overall_comment: z.string().max(5000).optional().nullable(),
  comments: z
    .array(
      z.object({
        scene_id: z.string().uuid().nullable().optional(),
        comment_type: z.enum(["scene", "script", "voiceover", "visual", "general"]),
        comment_text: z.string().min(1).max(2000),
      }),
    )
    .max(200),
});

export const submitClientReview = createServerFn({ method: "POST" })
  .inputValidator((input) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: review, error: revErr } = await supabaseAdmin
      .from("client_reviews")
      .select("*")
      .eq("share_token", data.token)
      .maybeSingle();

    if (revErr) throw new Error(revErr.message);
    if (!review) throw new Error("Review not found");

    const now = new Date().toISOString();

    if (data.comments.length > 0) {
      const rows = data.comments.map((c) => ({
        user_id: review.user_id,
        review_id: review.id,
        project_id: review.project_id,
        scene_id: c.scene_id ?? null,
        comment_type: c.comment_type,
        comment_text: c.comment_text,
        status: "open",
      }));
      const { error: insErr } = await supabaseAdmin.from("client_comments").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    const { error: updErr } = await supabaseAdmin
      .from("client_reviews")
      .update({
        status: data.decision,
        overall_comment: data.overall_comment ?? null,
        responded_at: now,
      })
      .eq("id", review.id);

    if (updErr) throw new Error(updErr.message);

    return { ok: true as const, client_name: review.client_name };
  });
