import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createGoogleAIProvider } from "./ai-gateway";

// ---------------------------------------------------------------------------
// Channel / rights metadata
// ---------------------------------------------------------------------------

export const CHANNEL_OPTIONS: { slug: string; label: string; rights: "low" | "medium" | "high" }[] =
  [
    { slug: "ap_archive", label: "AP Archive", rights: "low" },
    { slug: "reuters", label: "Reuters", rights: "low" },
    { slug: "dw_documentary", label: "DW Documentary", rights: "low" },
    { slug: "pbs_frontline", label: "PBS Frontline", rights: "low" },
    { slug: "bloomberg", label: "Bloomberg", rights: "medium" },
    { slug: "bbc_news", label: "BBC News", rights: "medium" },
    { slug: "wsj", label: "WSJ", rights: "medium" },
    { slug: "cnbc", label: "CNBC", rights: "medium" },
    { slug: "ft_film", label: "FT Film", rights: "medium" },
    { slug: "cnn_business", label: "CNN Business", rights: "medium" },
    { slug: "vice_news", label: "Vice News", rights: "high" },
  ];

function channelLabel(slug: string) {
  return CHANNEL_OPTIONS.find((c) => c.slug === slug)?.label ?? slug;
}

function rightsForChannelTitle(title: string): "low" | "medium" | "high" {
  const t = title.toLowerCase();
  const LOW = [
    "ap archive",
    "associated press",
    "reuters",
    "dw documentary",
    "pbs frontline",
    "frontline",
  ];
  const MED = [
    "bloomberg",
    "bbc news",
    "wsj",
    "wall street journal",
    "cnbc",
    "ft film",
    "financial times",
    "cnn business",
  ];
  if (LOW.some((k) => t.includes(k))) return "low";
  if (MED.some((k) => t.includes(k))) return "medium";
  return "high";
}

// ISO 8601 duration (PT4M13S) → seconds
function parseIsoDuration(iso: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? "");
  if (!m) return 0;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  return h * 3600 + min * 60 + s;
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// search_cache helpers
// ---------------------------------------------------------------------------

async function readCache(supabase: any, key: string): Promise<unknown | null> {
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

async function writeCache(supabase: any, key: string, results: unknown) {
  await supabase.from("search_cache").insert({ query_string: key, results });
}

// ---------------------------------------------------------------------------
// YouTube search
// ---------------------------------------------------------------------------

export type YouTubeCandidate = {
  video_id: string;
  title: string;
  channel_title: string;
  channel_id: string;
  thumbnail_url: string;
  published_at: string;
  duration_seconds: number;
  duration_label: string;
  rights_risk: "low" | "medium" | "high";
};

export const searchYouTube = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        query: z.string().min(1).max(200),
        channels: z.array(z.string().min(1).max(64)).max(15).default([]),
        rightsFilter: z.enum(["low", "medium", "any"]).default("low"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY is not configured");

    const channelsKey = [...data.channels].sort().join(",");
    const cacheKey = `youtube:${data.query.toLowerCase().trim()}:${channelsKey}:${data.rightsFilter}`;

    const cached = await readCache(supabase, cacheKey);
    if (cached) {
      return { cached: true as const, results: cached as YouTubeCandidate[] };
    }

    // Append channel names into query when specific channels are selected
    const hasAny = data.channels.includes("any") || data.channels.length === 0;
    const channelTerms = hasAny ? "" : " " + data.channels.map(channelLabel).join(" OR ");
    const qParam = (data.query + channelTerms).trim();

    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("key", apiKey);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", qParam);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", "8");
    searchUrl.searchParams.set("videoDefinition", "high");
    searchUrl.searchParams.set("relevanceLanguage", "en");

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      throw new Error(`YouTube search failed: ${searchRes.status} ${await searchRes.text()}`);
    }
    const searchJson = (await searchRes.json()) as {
      items?: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          channelId: string;
          publishedAt: string;
          thumbnails: any;
        };
      }>;
    };

    const items = searchJson.items ?? [];
    if (items.length === 0) {
      await writeCache(supabase, cacheKey, []);
      return { cached: false as const, results: [] };
    }

    // Batch single /videos call for all IDs
    const ids = items
      .map((i) => i.id.videoId)
      .filter(Boolean)
      .join(",");
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("key", apiKey);
    detailsUrl.searchParams.set("part", "snippet,contentDetails,statistics");
    detailsUrl.searchParams.set("id", ids);
    const detailsRes = await fetch(detailsUrl);
    if (!detailsRes.ok) {
      throw new Error(`YouTube video details failed: ${detailsRes.status}`);
    }
    const detailsJson = (await detailsRes.json()) as {
      items?: Array<{
        id: string;
        snippet: {
          title: string;
          channelTitle: string;
          channelId: string;
          publishedAt: string;
          thumbnails: any;
        };
        contentDetails: { duration: string };
      }>;
    };

    let candidates: YouTubeCandidate[] = (detailsJson.items ?? []).map((v) => {
      const secs = parseIsoDuration(v.contentDetails?.duration ?? "");
      return {
        video_id: v.id,
        title: v.snippet.title,
        channel_title: v.snippet.channelTitle,
        channel_id: v.snippet.channelId,
        thumbnail_url:
          v.snippet.thumbnails?.high?.url ??
          v.snippet.thumbnails?.medium?.url ??
          v.snippet.thumbnails?.default?.url ??
          "",
        published_at: v.snippet.publishedAt,
        duration_seconds: secs,
        duration_label: formatDuration(secs),
        rights_risk: rightsForChannelTitle(v.snippet.channelTitle),
      };
    });

    // Filter by rights
    if (data.rightsFilter === "low") {
      candidates = candidates.filter((c) => c.rights_risk === "low");
    } else if (data.rightsFilter === "medium") {
      candidates = candidates.filter((c) => c.rights_risk !== "high");
    }

    await writeCache(supabase, cacheKey, candidates);
    return { cached: false as const, results: candidates };
  });

// ---------------------------------------------------------------------------
// Clip index lookup
// ---------------------------------------------------------------------------

export const checkClipIndex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        visualJob: z.string().nullable().optional(),
        moodTags: z.array(z.string()).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("clip_index")
      .select("*")
      .order("usage_count", { ascending: false })
      .limit(8);
    if (data.visualJob) q = q.eq("visual_job", data.visualJob);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Optional in-memory filter by mood overlap
    let filtered = (rows ?? []) as Array<{ mood_tags: string[] }>;
    if (data.moodTags.length > 0) {
      filtered = filtered.filter((r) =>
        Array.isArray(r.mood_tags) ? r.mood_tags.some((m) => data.moodTags.includes(m)) : false,
      );
    }
    return { matches: filtered.length > 0 ? filtered : (rows ?? []) };
  });

// ---------------------------------------------------------------------------
// Confirm clip — saves to clips + clip_index
// ---------------------------------------------------------------------------

const ConfirmClipSchema = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().uuid(),
  assetType: z.enum([
    "youtube",
    "stock_footage",
    "static_image",
    "animated_image",
    "motion_graphic",
  ]),
  sourceUrl: z.string().url().nullable().optional(),
  sourceChannel: z.string().nullable().optional(),
  sourceTitle: z.string().nullable().optional(),
  sourceVideoId: z.string().nullable().optional(),
  timestampStart: z.string().nullable().optional(),
  timestampEnd: z.string().nullable().optional(),
  durationSeconds: z.number().int().nullable().optional(),
  resolution: z.string().nullable().optional(),
  visualJob: z.string().nullable().optional(),
  moodTags: z.array(z.string()).default([]),
  contentTags: z.array(z.string()).default([]),
  colorTemperature: z.string().nullable().optional(),
  rightsRisk: z.enum(["low", "medium", "high"]).default("low"),
  thumbnailUrl: z.string().url().nullable().optional(),
  kenBurnsConfig: z
    .object({
      enabled: z.boolean(),
      zoom: z.enum(["in", "out"]).optional(),
      pan: z.enum(["none", "left", "right", "up", "down"]).optional(),
      speed: z.enum(["slow", "medium", "fast"]).optional(),
    })
    .nullable()
    .optional(),
  animationType: z.string().nullable().optional(),
  animationUrl: z.string().url().nullable().optional(),
  promptUsed: z.string().nullable().optional(),
});

export const confirmClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ConfirmClipSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify scene belongs to user/project
    const scene = await supabase
      .from("scenes")
      .select("id, project_id, user_id")
      .eq("id", data.sceneId)
      .single();
    if (scene.error || !scene.data) throw new Error("Scene not found");
    if (scene.data.user_id !== userId) throw new Error("Not authorized");

    const payload = {
      project_id: data.projectId,
      scene_id: data.sceneId,
      user_id: userId,
      asset_type: data.assetType,
      source_type: data.assetType,
      source_url: data.sourceUrl ?? null,
      source_channel: data.sourceChannel ?? null,
      source_title: data.sourceTitle ?? null,
      source_video_id: data.sourceVideoId ?? null,
      timestamp_start: data.timestampStart ?? null,
      timestamp_end: data.timestampEnd ?? null,
      duration_seconds: data.durationSeconds ?? null,
      resolution: data.resolution ?? null,
      visual_job: data.visualJob ?? null,
      mood_tags: data.moodTags,
      content_tags: data.contentTags,
      color_temperature: data.colorTemperature ?? null,
      rights_risk: data.rightsRisk,
      thumbnail_url: data.thumbnailUrl ?? null,
      ken_burns_config: data.kenBurnsConfig ?? null,
      animation_type: data.animationType ?? null,
      animation_url: data.animationUrl ?? null,
      notes: data.promptUsed ?? null,
      fetch_status: "pending",
      status: "sourced",
      verified: true,
    };

    // Upsert clip (one per scene via unique index)
    const upsert = await supabase
      .from("clips")
      .upsert(payload, { onConflict: "scene_id" })
      .select("*")
      .single();
    if (upsert.error) throw new Error(upsert.error.message);

    // Mirror into clip_index for cross-project reuse (only for sourced media)
    if (data.assetType === "youtube" || data.assetType === "stock_footage") {
      await supabase.from("clip_index").insert({
        user_id: userId,
        source_url: data.sourceUrl ?? null,
        source_channel: data.sourceChannel ?? null,
        source_title: data.sourceTitle ?? null,
        source_video_id: data.sourceVideoId ?? null,
        timestamp_start: data.timestampStart ?? null,
        timestamp_end: data.timestampEnd ?? null,
        duration_seconds: data.durationSeconds ?? null,
        thumbnail_url: data.thumbnailUrl ?? null,
        visual_job: data.visualJob ?? null,
        mood_tags: data.moodTags,
        content_tags: data.contentTags,
        color_temperature: data.colorTemperature ?? null,
        rights_risk: data.rightsRisk,
        verified: true,
      });
    }

    return { clip: upsert.data };
  });

// ---------------------------------------------------------------------------
// Pexels — videos and photos
// ---------------------------------------------------------------------------

export type PexelsVideoCandidate = {
  id: string;
  title: string;
  thumbnail_url: string;
  preview_url: string;
  duration_seconds: number;
  duration_label: string;
  resolution: string;
  source_url: string;
  user_name: string;
};

export const searchPexelsVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ query: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) throw new Error("PEXELS_API_KEY is not configured");

    const cacheKey = `pexels_video:${data.query.toLowerCase().trim()}`;
    const cached = await readCache(supabase, cacheKey);
    if (cached) return { cached: true as const, results: cached as PexelsVideoCandidate[] };

    const url = new URL("https://api.pexels.com/videos/search");
    url.searchParams.set("query", data.query);
    url.searchParams.set("per_page", "8");
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("size", "large");

    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (!res.ok) throw new Error(`Pexels video search failed: ${res.status}`);
    const json = (await res.json()) as {
      videos?: Array<{
        id: number;
        duration: number;
        url: string;
        image: string;
        user: { name: string };
        video_files: Array<{ link: string; width: number; height: number; quality: string }>;
      }>;
    };

    const results: PexelsVideoCandidate[] = (json.videos ?? []).map((v) => {
      const best = v.video_files.find((f) => f.quality === "hd") ?? v.video_files[0] ?? null;
      return {
        id: String(v.id),
        title: `Pexels video ${v.id}`,
        thumbnail_url: v.image,
        preview_url: best?.link ?? "",
        duration_seconds: v.duration,
        duration_label: formatDuration(v.duration),
        resolution: best ? `${best.width}x${best.height}` : "",
        source_url: v.url,
        user_name: v.user?.name ?? "Pexels",
      };
    });

    await writeCache(supabase, cacheKey, results);
    return { cached: false as const, results };
  });

export type PexelsPhotoCandidate = {
  id: string;
  thumbnail_url: string;
  full_url: string;
  source_url: string;
  photographer: string;
};

export const searchPexelsPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ query: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) throw new Error("PEXELS_API_KEY is not configured");

    const cacheKey = `pexels_photo:${data.query.toLowerCase().trim()}`;
    const cached = await readCache(supabase, cacheKey);
    if (cached) return { cached: true as const, results: cached as PexelsPhotoCandidate[] };

    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", data.query);
    url.searchParams.set("per_page", "8");
    url.searchParams.set("orientation", "landscape");

    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (!res.ok) throw new Error(`Pexels photo search failed: ${res.status}`);
    const json = (await res.json()) as {
      photos?: Array<{
        id: number;
        url: string;
        photographer: string;
        src: { large: string; large2x: string; medium: string };
      }>;
    };

    const results: PexelsPhotoCandidate[] = (json.photos ?? []).map((p) => ({
      id: String(p.id),
      thumbnail_url: p.src.medium,
      full_url: p.src.large2x ?? p.src.large,
      source_url: p.url,
      photographer: p.photographer,
    }));

    await writeCache(supabase, cacheKey, results);
    return { cached: false as const, results };
  });

// ---------------------------------------------------------------------------
// AI image prompt for "Generate with AI" path
// ---------------------------------------------------------------------------

export const generateImagePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ sceneId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const scene = await supabase
      .from("scenes")
      .select("emotional_temperature, visual_job, clip_brief")
      .eq("id", data.sceneId)
      .single();
    if (scene.error || !scene.data) throw new Error("Scene not found");
    const s = scene.data as {
      emotional_temperature: string | null;
      visual_job: string | null;
      clip_brief: { subject?: string; mood?: string[]; color_temperature?: string } | null;
    };

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
    const gateway = createGoogleAIProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const ctx = [
      `Subject: ${s.clip_brief?.subject ?? "general"}`,
      `Visual job: ${s.visual_job ?? "atmosphere"}`,
      `Emotional temperature: ${s.emotional_temperature ?? "neutral"}`,
      `Mood: ${(s.clip_brief?.mood ?? []).join(", ")}`,
      `Color temperature: ${s.clip_brief?.color_temperature ?? "neutral"}`,
    ].join("\n");

    const result = await generateText({
      model,
      system:
        "You are a senior documentary visual director writing a single, concrete image-generation prompt suitable for Midjourney or Flux. Output ONE paragraph, 30-60 words. No preamble, no quotes, no markdown. Be specific about composition, lighting, lens, color palette, and mood.",
      prompt: ctx,
    });

    return { prompt: result.text.trim() };
  });
