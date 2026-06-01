import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Helpers (server-only)
// ---------------------------------------------------------------------------

const DEFAULT_KEN_BURNS = { enabled: true, zoom: "in", pan: "none", speed: "slow" };

async function readSearchCache(supabase: any, key: string): Promise<unknown | null> {
  const { data } = await supabase
    .from("search_cache")
    .select("results, expires_at")
    .eq("query_string", key)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.results ?? null;
}

async function writeSearchCache(supabase: any, key: string, results: unknown) {
  await supabase.from("search_cache").insert({ query_string: key, results });
}

function firstSentenceWords(text: string, maxWords: number): string {
  const sentence = (text.split(/[.!?]/)[0] ?? text).trim();
  const words = sentence.split(/\s+/).slice(0, maxWords);
  return words.join(" ");
}

// ---------------------------------------------------------------------------
// Asset-type resolution & motion-graphic data derivation
// Used to recover when the AI returned a wrong/null recommended_asset_type
// or motion_graphic_data.
// ---------------------------------------------------------------------------

const JOB_TO_TYPE: Record<string, string> = {
  evidence: "motion_graphic",
  atmosphere: "ai_image_ken_burns",
  authority: "stock_video",
  counterpoint: "ai_image_ken_burns",
};

function hasNumbers(text: string): boolean {
  return /\$[\d,]+|\b[\d,]+%|\b[\d,]+\s*(billion|million|thousand|B|M|K)\b/i.test(text);
}
function hasComparison(text: string): boolean {
  return /\bvs\.?\b|\bversus\b|\bcompared to\b|\bwhile\b|\bwhereas\b/i.test(text);
}
function hasTimeline(text: string): boolean {
  const years = text.match(/\b(19|20)\d{2}\b/g) ?? [];
  return years.length >= 2;
}

function resolveAssetType(scene: any): string {
  const current = scene.recommended_asset_type as string | null | undefined;
  const text = String(scene.script_text ?? "");

  // Strong override: if scene clearly has data, force motion_graphic
  if (hasNumbers(text) || hasComparison(text) || hasTimeline(text)) {
    return "motion_graphic";
  }
  if (current && current !== "ai_image_ken_burns") return current;
  if (current === "ai_image_ken_burns") return current;
  return JOB_TO_TYPE[scene.visual_job as string] ?? "ai_image_ken_burns";
}

function extractContext(text: string, match: string): string {
  const idx = text.indexOf(match);
  if (idx < 0) return "in total value";
  const before = text
    .substring(Math.max(0, idx - 40), idx)
    .split(/\s+/)
    .filter(Boolean)
    .slice(-4)
    .join(" ");
  return before || "in total value";
}

function extractEventForYear(text: string, year: string): string {
  const idx = text.indexOf(year);
  if (idx < 0) return year;
  return text
    .substring(idx, idx + 80)
    .split(/[.!?]/)[0]
    .trim();
}

function deriveGraphicData(scene: any): {
  type: string;
  data: Record<string, unknown>;
} {
  const text = String(scene.script_text ?? "");

  // Counter — dollar/number with magnitude
  const dollarMatch = text.match(/\$?([\d,]+\.?\d*)\s*(billion|million|thousand|B|M|K|%)?/i);
  if (dollarMatch && hasNumbers(text)) {
    const suffixRaw = dollarMatch[2] ?? "";
    const suffix =
      suffixRaw.length === 1
        ? suffixRaw.toUpperCase()
        : suffixRaw
          ? suffixRaw[0].toUpperCase()
          : "";
    return {
      type: "counter",
      data: {
        value: dollarMatch[1],
        label: extractContext(text, dollarMatch[0]),
        prefix: text.includes("$") ? "$" : "",
        suffix,
        context_line: text.split(/[.!?]/)[0].substring(0, 80).trim(),
      },
    };
  }

  // Timeline — multiple years
  const years = text.match(/\b(19|20)\d{2}\b/g);
  if (years && years.length >= 2) {
    return {
      type: "timeline",
      data: {
        title: "Key Events",
        events: years.slice(0, 4).map((year) => ({
          date: year,
          event: extractEventForYear(text, year),
        })),
      },
    };
  }

  // Default — text card with strongest sentence
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const statement = (sentences[0] ?? text).trim().split(/\s+/).slice(0, 12).join(" ");
  return {
    type: "text_card",
    data: { statement, attribution: null },
  };
}

function labelForGraphic(type: string, data: Record<string, unknown>): string {
  if (type === "text_card") return "Motion graphic — text card";
  if (type === "counter") {
    const prefix = String(data?.prefix ?? "");
    const value = String(data?.value ?? "");
    const suffix = String(data?.suffix ?? "");
    return `Motion graphic — counter ${prefix}${value}${suffix}`.trim();
  }
  if (type === "percentage_ring") return `Motion graphic — ${data?.value ?? ""}%`;
  if (type === "comparison")
    return `Motion graphic — ${data?.label_a ?? "A"} vs ${data?.label_b ?? "B"}`;
  if (type === "timeline") {
    const events = Array.isArray((data as any).events) ? (data as any).events.length : 0;
    return `Motion graphic — timeline (${events} events)`;
  }
  if (type === "bar_chart") {
    const bars = Array.isArray((data as any).bars) ? (data as any).bars.length : 0;
    return `Motion graphic — bar chart (${bars} bars)`;
  }
  if (type === "map_highlight") return `Motion graphic — map (${data?.region ?? ""})`;
  return `Motion graphic — ${type}`;
}

function buildAiImagePrompt(brief: any): string {
  const subject = brief?.subject ?? "documentary scene";
  const moodArr = Array.isArray(brief?.mood) ? brief.mood : [];
  const moodStr = moodArr.length ? moodArr.join(", ") + " atmosphere. " : "";
  const colorStr = brief?.color_temperature ? `${brief.color_temperature} tones. ` : "";
  return `${subject}. ${moodStr}${colorStr}Documentary style. Cinematic composition. No text, no people's faces. 16:9 aspect ratio. Ultra realistic photography.`;
}

async function pollReplicate(predictionId: string, token: string): Promise<any> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) throw new Error(`Replicate poll failed: ${res.status}`);
    const json = (await res.json()) as { status: string; output?: any; error?: string };
    if (json.status === "succeeded") return json;
    if (json.status === "failed" || json.status === "canceled") {
      throw new Error(`Replicate ${json.status}: ${json.error ?? "unknown"}`);
    }
  }
  throw new Error("Replicate generation timed out");
}

async function generateOneImage(prompt: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");
  const create = await fetch(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=10",
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: "16:9",
          output_format: "jpg",
          output_quality: 90,
          num_outputs: 1,
        },
      }),
    },
  );
  if (!create.ok) {
    const text = await create.text();
    if (create.status === 429) throw new Error("RATE_LIMIT");
    throw new Error(`Replicate create failed: ${create.status} ${text}`);
  }
  const created = (await create.json()) as { id: string; status: string; output?: any };
  const final = created.status === "succeeded" ? created : await pollReplicate(created.id, token);
  const out = final.output;
  const url = Array.isArray(out) ? out[0] : typeof out === "string" ? out : null;
  if (!url) throw new Error("Replicate returned no image URL");
  return String(url);
}

async function searchPexelsPhotoFirst(supabase: any, query: string): Promise<any | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error("PEXELS_API_KEY is not configured");
  const cacheKey = `pexels_photo:${query.toLowerCase().trim()}`;
  const cached = (await readSearchCache(supabase, cacheKey)) as any[] | null;
  if (cached) return cached[0] ?? null;
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "8");
  url.searchParams.set("orientation", "landscape");
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) throw new Error(`Pexels photo search failed: ${res.status}`);
  const json = (await res.json()) as { photos?: any[] };
  const results = (json.photos ?? []).map((p) => ({
    id: String(p.id),
    thumbnail_url: p.src.medium,
    full_url: p.src.large2x ?? p.src.large,
    source_url: p.url,
    photographer: p.photographer,
  }));
  await writeSearchCache(supabase, cacheKey, results);
  return results[0] ?? null;
}

async function cacheYouTubeSearch(supabase: any, query: string): Promise<any[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];
  const cacheKey = `youtube:${query.toLowerCase().trim()}::low`;
  const cached = (await readSearchCache(supabase, cacheKey)) as any[] | null;
  if (cached) return cached;
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "8");
  searchUrl.searchParams.set("videoDefinition", "high");
  const res = await fetch(searchUrl);
  if (!res.ok) return [];
  const json = (await res.json()) as { items?: any[] };
  const items = (json.items ?? []).map((i: any) => ({
    video_id: i.id?.videoId,
    title: i.snippet?.title,
    channel_title: i.snippet?.channelTitle,
    thumbnail_url: i.snippet?.thumbnails?.high?.url ?? i.snippet?.thumbnails?.medium?.url ?? "",
    published_at: i.snippet?.publishedAt,
  }));
  await writeSearchCache(supabase, cacheKey, items);
  return items;
}

async function cachePexelsVideoSearch(supabase: any, query: string): Promise<any[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];
  const cacheKey = `pexels_video:${query.toLowerCase().trim()}`;
  const cached = (await readSearchCache(supabase, cacheKey)) as any[] | null;
  if (cached) return cached;
  const url = new URL("https://api.pexels.com/videos/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "8");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("size", "large");
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) return [];
  const json = (await res.json()) as { videos?: any[] };
  const results = (json.videos ?? []).map((v: any) => {
    const files = Array.isArray(v.video_files) ? v.video_files : [];
    const hd =
      files.find((f: any) => f.quality === "hd" && (f.width ?? 0) <= 1920) ??
      files.find((f: any) => f.quality === "hd") ??
      files.find((f: any) => f.quality === "sd") ??
      files[0];
    return {
      id: String(v.id),
      duration_seconds: v.duration,
      thumbnail_url: v.image,
      video_url: hd?.link ?? null,
      source_url: v.url,
      user_name: v.user?.name ?? null,
    };
  });
  await writeSearchCache(supabase, cacheKey, results);
  return results;
}

// ---------------------------------------------------------------------------
// previewAutoGeneration — counts for the re-analyze confirmation dialog
// ---------------------------------------------------------------------------

export const previewAutoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const scenes = await supabase
      .from("scenes")
      .select("id, clip_status")
      .eq("project_id", data.projectId);
    if (scenes.error) throw new Error(scenes.error.message);
    const rows = (scenes.data ?? []) as Array<{ clip_status: string | null }>;
    const sourced = rows.filter((r) => r.clip_status === "sourced").length;
    const pending = rows.length - sourced;
    return { sourced, pending, total: rows.length };
  });

// ---------------------------------------------------------------------------
// setAutoGenerateVisuals — settings toggle
// ---------------------------------------------------------------------------

export const setAutoGenerateVisuals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const res = await supabase
      .from("projects")
      .update({ auto_generate_visuals: data.enabled })
      .eq("id", data.projectId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// finalizeAutoGeneration — flip completion flag
// ---------------------------------------------------------------------------

export const finalizeAutoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid(), complete: z.boolean().default(true) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const res = await supabase
      .from("projects")
      .update({ auto_generation_complete: data.complete })
      .eq("id", data.projectId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// autoGenerateScene — single scene processor
// ---------------------------------------------------------------------------

type AutoResult =
  | { status: "complete"; label: string; assetType: string }
  | { status: "skipped"; label: string }
  | { status: "needs_manual"; label: string; assetType: string }
  | { status: "failed"; label: string; error: string };

export const autoGenerateScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        sceneId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AutoResult> => {
    const { supabase, userId } = context;

    // Step 1 — re-check: skip if sourced clip already exists
    const existingClip = await supabase
      .from("clips")
      .select("id, clip_status, asset_type")
      .eq("scene_id", data.sceneId)
      .limit(1)
      .maybeSingle();
    if (existingClip.data && existingClip.data.clip_status === "sourced") {
      await supabase.from("scenes").update({ clip_status: "sourced" }).eq("id", data.sceneId);
      return { status: "skipped", label: "Already sourced" };
    }

    // Load scene
    const sceneRes = await supabase.from("scenes").select("*").eq("id", data.sceneId).single();
    if (sceneRes.error || !sceneRes.data) {
      return { status: "failed", label: "Scene not found", error: "Scene not found" };
    }
    const scene = sceneRes.data as any;
    const assetType: string = resolveAssetType(scene);

    try {
      // ── motion_graphic ──
      if (assetType === "motion_graphic") {
        // Skip if confirmed motion graphic exists
        const mgExisting = await supabase
          .from("motion_graphics")
          .select("id, confirmed")
          .eq("scene_id", data.sceneId)
          .eq("confirmed", true)
          .limit(1)
          .maybeSingle();
        if (mgExisting.data) {
          await supabase.from("scenes").update({ clip_status: "sourced" }).eq("id", data.sceneId);
          return { status: "skipped", label: "Motion graphic already configured" };
        }

        let graphicType: string | null = scene.motion_graphic_type ?? null;
        let graphicData: Record<string, unknown> | null =
          (scene.motion_graphic_data as Record<string, unknown> | null) ?? null;
        if (!graphicType || !graphicData) {
          const derived = deriveGraphicData(scene);
          graphicType = derived.type;
          graphicData = derived.data;
        }

        // Clear any prior motion_graphics + clip rows for this scene so we
        // don't violate uniqueness (no unique constraint on scene_id) and
        // don't leave a stale wrong asset (e.g. previously-generated image).
        await supabase.from("motion_graphics").delete().eq("scene_id", data.sceneId);
        await supabase.from("clips").delete().eq("scene_id", data.sceneId);

        const mgInsert = await supabase
          .from("motion_graphics")
          .insert({
            user_id: userId,
            project_id: data.projectId,
            scene_id: data.sceneId,
            graphic_type: graphicType!,
            graphic_data: graphicData as never,
            render_method: "remotion",
            confirmed: true,
            status: "configured",
          })
          .select("*")
          .single();
        if (mgInsert.error) throw new Error(mgInsert.error.message);

        const clipUpsert = await supabase.from("clips").insert({
          user_id: userId,
          project_id: data.projectId,
          scene_id: data.sceneId,
          asset_type: "motion_graphic",
          source_type: "motion_graphic",
          source_channel: "remotion",
          status: "sourced",
          clip_status: "sourced",
          fetch_status: "ready",
          verified: true,
        });
        if (clipUpsert.error) throw new Error(`clips insert failed: ${clipUpsert.error.message}`);

        const sceneUpdate = await supabase
          .from("scenes")
          .update({
            clip_status: "sourced",
            motion_graphic_type: graphicType,
            motion_graphic_data: graphicData as never,
            recommended_asset_type: "motion_graphic",
          })
          .eq("id", data.sceneId);
        if (sceneUpdate.error) throw new Error(`scene update failed: ${sceneUpdate.error.message}`);

        return {
          status: "complete",
          label: labelForGraphic(graphicType!, graphicData!),
          assetType: "motion_graphic",
        };
      }

      // ── ai_image_ken_burns / animated_image ──
      if (assetType === "ai_image_ken_burns" || assetType === "animated_image") {
        const prompt = buildAiImagePrompt(scene.clip_brief);
        let imageUrl: string;
        try {
          imageUrl = await generateOneImage(prompt);
        } catch (err) {
          if ((err as Error).message === "RATE_LIMIT") {
            await new Promise((r) => setTimeout(r, 5000));
            imageUrl = await generateOneImage(prompt);
          } else {
            throw err;
          }
        }

        await supabase.from("clips").upsert(
          {
            user_id: userId,
            project_id: data.projectId,
            scene_id: data.sceneId,
            asset_type: "static_image",
            source_type: "ai_generated",
            source_channel: "ai_generated",
            image_url: imageUrl,
            source_url: imageUrl,
            thumbnail_url: imageUrl,
            ken_burns_config: DEFAULT_KEN_BURNS as never,
            status: "sourced",
            clip_status: "sourced",
            fetch_status: "ready",
            verified: true,
            notes: prompt,
          },
          { onConflict: "scene_id" } as any,
        );

        await supabase.from("scenes").update({ clip_status: "sourced" }).eq("id", data.sceneId);

        return {
          status: "complete",
          label:
            assetType === "animated_image"
              ? "Base image generated (animate manually)"
              : "AI image generated",
          assetType: "static_image",
        };
      }

      // ── stock_image_ken_burns ──
      if (assetType === "stock_image_ken_burns") {
        const query =
          scene.clip_brief?.suggested_search_terms?.[0] ??
          scene.clip_brief?.subject ??
          "documentary footage";
        const photo = await searchPexelsPhotoFirst(supabase, query);
        if (!photo) {
          await supabase
            .from("scenes")
            .update({ clip_status: "needs_manual" })
            .eq("id", data.sceneId);
          return {
            status: "needs_manual",
            label: "No stock photos found — pick manually",
            assetType: "static_image",
          };
        }

        await supabase.from("clips").upsert(
          {
            user_id: userId,
            project_id: data.projectId,
            scene_id: data.sceneId,
            asset_type: "static_image",
            source_type: "stock_photo",
            source_channel: "pexels",
            source_title: `Photo by ${photo.photographer}`,
            image_url: photo.full_url,
            source_url: photo.source_url,
            thumbnail_url: photo.thumbnail_url,
            ken_burns_config: DEFAULT_KEN_BURNS as never,
            status: "sourced",
            clip_status: "sourced",
            fetch_status: "ready",
            verified: true,
          },
          { onConflict: "scene_id" } as any,
        );

        await supabase.from("scenes").update({ clip_status: "sourced" }).eq("id", data.sceneId);

        return {
          status: "complete",
          label: "Stock image sourced",
          assetType: "static_image",
        };
      }

      // ── stock_video / youtube_clip — auto-pick first result ──
      if (assetType === "stock_video" || assetType === "youtube_clip") {
        const query =
          scene.clip_brief?.suggested_search_terms?.[0] ??
          scene.clip_brief?.subject ??
          "documentary footage";

        if (assetType === "youtube_clip") {
          const results = await cacheYouTubeSearch(supabase, query);
          const pick = results.find((r: any) => r?.video_id);
          if (!pick) {
            await supabase
              .from("scenes")
              .update({ clip_status: "needs_manual" })
              .eq("id", data.sceneId);
            return {
              status: "needs_manual",
              label: "No YouTube results — select manually",
              assetType,
            };
          }
          await supabase.from("clips").upsert(
            {
              user_id: userId,
              project_id: data.projectId,
              scene_id: data.sceneId,
              asset_type: "youtube",
              source_type: "youtube",
              source_channel: pick.channel_title ?? "youtube",
              source_title: pick.title ?? null,
              source_video_id: pick.video_id,
              source_url: `https://www.youtube.com/watch?v=${pick.video_id}`,
              thumbnail_url: pick.thumbnail_url ?? null,
              status: "sourced",
              clip_status: "sourced",
              fetch_status: "ready",
              verified: false,
            },
            { onConflict: "scene_id" } as any,
          );
          await supabase.from("scenes").update({ clip_status: "sourced" }).eq("id", data.sceneId);
          return {
            status: "complete",
            label: "YouTube clip selected",
            assetType: "youtube",
          };
        }

        // stock_video (Pexels)
        const results = await cachePexelsVideoSearch(supabase, query);
        const pick = results.find((r: any) => r?.video_url);
        if (!pick) {
          await supabase
            .from("scenes")
            .update({ clip_status: "needs_manual" })
            .eq("id", data.sceneId);
          return {
            status: "needs_manual",
            label: "No stock videos — select manually",
            assetType,
          };
        }
        await supabase.from("clips").upsert(
          {
            user_id: userId,
            project_id: data.projectId,
            scene_id: data.sceneId,
            asset_type: "stock_video",
            source_type: "stock_video",
            source_channel: "pexels",
            source_title: pick.user_name ? `Video by ${pick.user_name}` : null,
            source_url: pick.video_url,
            thumbnail_url: pick.thumbnail_url ?? null,
            duration_seconds: pick.duration_seconds ?? null,
            status: "sourced",
            clip_status: "sourced",
            fetch_status: "ready",
            verified: true,
          },
          { onConflict: "scene_id" } as any,
        );
        await supabase.from("scenes").update({ clip_status: "sourced" }).eq("id", data.sceneId);
        return {
          status: "complete",
          label: "Stock video selected",
          assetType: "stock_video",
        };
      }

      // Unknown type — leave manual
      await supabase.from("scenes").update({ clip_status: "needs_manual" }).eq("id", data.sceneId);
      return {
        status: "needs_manual",
        label: "Manual selection required",
        assetType,
      };
    } catch (err) {
      await supabase.from("scenes").update({ clip_status: "failed" }).eq("id", data.sceneId);
      return {
        status: "failed",
        label: "Failed — click to retry",
        error: (err as Error).message ?? "Unknown error",
      };
    }
  });

// ---------------------------------------------------------------------------
// diagnoseProjectAssets — read-only inspection
// ---------------------------------------------------------------------------

export const diagnoseProjectAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [scenesRes, clipsRes, mgRes] = await Promise.all([
      supabase
        .from("scenes")
        .select(
          "id, scene_index, recommended_asset_type, motion_graphic_type, motion_graphic_data, clip_status, script_text",
        )
        .eq("project_id", data.projectId)
        .order("scene_index", { ascending: true }),
      supabase
        .from("clips")
        .select("scene_id, asset_type, clip_status")
        .eq("project_id", data.projectId),
      supabase
        .from("motion_graphics")
        .select("scene_id, graphic_type, confirmed")
        .eq("project_id", data.projectId),
    ]);
    if (scenesRes.error) throw new Error(scenesRes.error.message);

    const scenes = (scenesRes.data ?? []) as any[];
    const clips = (clipsRes.data ?? []) as any[];
    const mgs = (mgRes.data ?? []) as any[];

    // Aggregate by recommended_asset_type
    const typeCounts: Record<string, number> = {};
    for (const s of scenes) {
      const t = s.recommended_asset_type ?? "null";
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }

    // Per-scene motion graphic data flags
    const motionScenes = scenes
      .filter((s) => s.recommended_asset_type === "motion_graphic")
      .map((s) => ({
        scene_index: s.scene_index,
        motion_graphic_type: s.motion_graphic_type,
        has_data: !!s.motion_graphic_data,
      }));

    // Mismatch detection: scenes recommending motion_graphic but with
    // a clip whose asset_type is NOT motion_graphic
    const sceneById = new Map(scenes.map((s) => [s.id, s]));
    const rows = clips.map((c) => {
      const s = sceneById.get(c.scene_id);
      const mg = mgs.find((m) => m.scene_id === c.scene_id);
      return {
        scene_index: s?.scene_index ?? null,
        recommended_asset_type: s?.recommended_asset_type ?? null,
        clip_asset_type: c.asset_type ?? null,
        motion_graphic_type: mg?.graphic_type ?? null,
        mg_confirmed: mg?.confirmed ?? null,
      };
    });

    const mismatched = rows.filter(
      (r) =>
        r.recommended_asset_type === "motion_graphic" &&
        r.clip_asset_type &&
        r.clip_asset_type !== "motion_graphic",
    ).length;

    return { typeCounts, motionScenes, rows, mismatched, total: scenes.length };
  });

// ---------------------------------------------------------------------------
// fixAssetTypes — delete wrong clips & reset scenes to pending
// ---------------------------------------------------------------------------

export const fixAssetTypes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const scenesRes = await supabase
      .from("scenes")
      .select("id, recommended_asset_type, script_text, visual_job")
      .eq("project_id", data.projectId);
    if (scenesRes.error) throw new Error(scenesRes.error.message);
    const scenes = (scenesRes.data ?? []) as any[];

    const clipsRes = await supabase
      .from("clips")
      .select("id, scene_id, asset_type")
      .eq("project_id", data.projectId);
    if (clipsRes.error) throw new Error(clipsRes.error.message);
    const clips = (clipsRes.data ?? []) as any[];

    const wrongSceneIds: string[] = [];
    for (const s of scenes) {
      const resolved = resolveAssetType(s);
      const clip = clips.find((c) => c.scene_id === s.id);
      // Wrong = resolved type is motion_graphic, but clip is not a motion graphic
      if (resolved === "motion_graphic" && clip && clip.asset_type !== "motion_graphic") {
        wrongSceneIds.push(s.id);
      }
    }

    if (wrongSceneIds.length === 0) return { reset: 0 };

    // Delete bad clips & reset scenes
    await supabase.from("clips").delete().in("scene_id", wrongSceneIds);
    await supabase
      .from("scenes")
      .update({ clip_status: "pending", recommended_asset_type: "motion_graphic" })
      .in("id", wrongSceneIds);
    await supabase
      .from("projects")
      .update({ auto_generation_complete: false })
      .eq("id", data.projectId);

    return { reset: wrongSceneIds.length };
  });
