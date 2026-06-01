import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─────────────────────────────────────────────────────────────────────────────
// Hera.video integration
// ─────────────────────────────────────────────────────────────────────────────
// All app-internal server logic lives in TanStack server functions (not Edge
// Functions). Three operations exposed:
//   - heraLibrarySearch  (4-layer cache search)
//   - heraGenerate       (cache-first; dev-mode gated; calls Hera API)
//   - heraTrackUsage     (usage / rejection / rating)
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "in",
  "of",
  "to",
  "and",
  "or",
  "for",
  "with",
  "on",
  "at",
  "by",
  "from",
  "as",
  "is",
  "it",
  "be",
  "this",
  "that",
  "are",
  "was",
  "were",
  "but",
  "not",
  "have",
  "has",
  "had",
  "will",
  "would",
  "could",
  "should",
]);

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
    ),
  );
}

const styleMap: Record<string, string> = {
  investigative_cold: "Clinical aesthetic. Dark high contrast. Cold blue-grey tones.",
  cinematic_deliberate: "Cinematic atmosphere. Rich shadows. Deliberate slow movement.",
  escalating_arc: "Documentary style. Building tension. Controlled camera movement.",
  fast_informative: "Clean modern aesthetic. Sharp cuts. Bright contrast.",
  systems_scale: "Wide establishing shots. Technical precision. Data-forward aesthetic.",
};

const temperatureMap: Record<string, string> = {
  cold: "Cold blue-grey lighting. Clinical and still.",
  tense: "High contrast dramatic lighting. Tension in every frame.",
  revelatory: "Light breaking through shadow. Moment of clarity.",
  heavy: "Desaturated. Weight in the air. Slow and deliberate.",
  urgent: "Kinetic energy. Fast motion. Urgency in the composition.",
  contemplative: "Quiet and still. Meditative atmosphere. Long holds.",
};

const jobMap: Record<string, string> = {
  atmosphere: "Wide establishing shot. Environmental storytelling.",
  evidence: "Clean minimal background. Focus on the subject. Documentary precision.",
  authority: "Authoritative framing. Institutional setting. Credibility in composition.",
  counterpoint: "Visual irony. Tension between subject and environment.",
};

function buildHeraPrompt(input: {
  visual_job?: string | null;
  emotional_temperature?: string | null;
  subject?: string | null;
  camera_motion?: string | null;
  duration?: number;
  editing_style?: string | null;
}): string {
  const parts: string[] = ["Cinematic documentary clip."];
  if (input.editing_style && styleMap[input.editing_style])
    parts.push(styleMap[input.editing_style]);
  if (input.emotional_temperature && temperatureMap[input.emotional_temperature])
    parts.push(temperatureMap[input.emotional_temperature]);
  if (input.visual_job && jobMap[input.visual_job]) parts.push(jobMap[input.visual_job]);
  if (input.subject) parts.push(`Subject: ${input.subject}.`);
  parts.push(`${input.camera_motion || "Slow push forward"}.`);
  parts.push(`Duration: ${input.duration ?? 6} seconds.`);
  parts.push("No text, no logos, no people's faces.");
  parts.push("Ultra realistic. 4K quality.");
  return parts.join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTION GRAPHICS PROMPT BUILDER (mode-aware: standalone | overlay)
// ─────────────────────────────────────────────────────────────────────────────
export type HeraMode = "standalone" | "overlay";
export type OverlayStyle = "lower_third" | "center_reveal" | "corner_insert" | "full_frame";
export type OverlayPosition =
  | "bottom"
  | "center"
  | "top_left"
  | "top_right"
  | "bottom_left"
  | "bottom_right";

export type OverlayTiming = {
  start_at_seconds?: number;
  duration_seconds?: number;
  fade_in?: number;
  fade_out?: number;
};

function buildMotionGraphicsPrompt(
  graphicType: string,
  graphicData: Record<string, any> | null | undefined,
  heraMode: HeraMode = "standalone",
  overlayStyle?: OverlayStyle | null,
  overlayPosition?: OverlayPosition | null,
  overlayTiming?: OverlayTiming | null,
): string {
  const d: Record<string, any> = graphicData ?? {};

  const baseStyle = `
Dark background #000000.
Gold accent color #e8c547.
White primary text #f0f0f0.
Muted secondary text #888888.
Inter font family.
Clinical documentary aesthetic.
Minimal and precise design.
No logos. No watermarks.`;

  const standaloneFrame = `
Full frame composition.
Content centered in frame.
Dark background fills entire canvas.`;

  const overlayFrames: Record<OverlayStyle, string> = {
    lower_third: `
Content contained in lower 25% of frame only.
Dark semi-transparent panel in bottom portion of frame.
Panel background: rgba(0,0,0,0.85)
Upper 75% of frame is completely empty and transparent.
Design for overlay over footage.
Panel height: 200px of 1080px total.
Content left-aligned within panel with 32px padding.`,
    center_reveal: `
Content centered in middle of frame.
Dark vignette radiating from center.
Center panel background: rgba(0,0,0,0.9)
Panel width: 70% of frame.
Panel height: auto to content.
Edges of frame remain visible for underlying footage to show.
Design for dramatic center overlay.`,
    corner_insert: `
Small compact panel in ${overlayPosition || "bottom_right"} corner of frame.
Panel dimensions: approximately 400x200px within 1920x1080 frame.
Dark panel background: rgba(0,0,0,0.85)
Rounded corners: 8px.
16px margin from frame edge.
Rest of frame completely empty.
Design for non-intrusive corner overlay.
Content must be very concise to fit small panel.`,
    full_frame: `
Full frame composition initially.
Content centered prominently.
Designed to temporarily take full visual focus.
Dark background fills frame.
Same as standalone but with fade in and fade out handles at start and end of clip.`,
  };

  const frameInstruction =
    heraMode === "overlay"
      ? (overlayFrames[(overlayStyle ?? "lower_third") as OverlayStyle] ??
        overlayFrames.lower_third)
      : standaloneFrame;

  const isCornerInsert = heraMode === "overlay" && overlayStyle === "corner_insert";

  let contentInstruction = "";
  switch (graphicType) {
    case "text_card": {
      const wordCount = String(d.statement ?? "")
        .split(/\s+/)
        .filter(Boolean).length;
      const fontSize = isCornerInsert
        ? "medium (28px)"
        : wordCount > 8
          ? "large (56px)"
          : "very large (72px)";
      contentInstruction = `
Bold white text ${fontSize}:
"${d.statement ?? "Key insight"}"
${d.attribution ? `Small attribution below (18px): "${d.attribution}"` : ""}
Gold accent underline 2px appears after text settles.
Text animates: slight upward drift and fade in over 0.5 seconds.`;
      break;
    }
    case "counter": {
      contentInstruction = `
Animated number counter.
${isCornerInsert ? "Compact layout for corner." : "Large prominent display."}
Number counts from 0 to ${d.prefix ?? ""}${d.value ?? "0"}${d.suffix ?? ""}.
Number color: gold #e8c547.
Font size: ${isCornerInsert ? "36px" : "96px"}.
Label below in white: "${d.label ?? ""}"
${d.context_line && !isCornerInsert ? `Context line smaller (20px) muted: "${d.context_line}"` : ""}
Smooth easing animation over 3 seconds.
Hold on final value for 2 seconds.`;
      break;
    }
    case "bar_chart": {
      const barsText = Array.isArray(d.bars)
        ? d.bars
            .slice(0, 5)
            .map((b: any) => `${b.label}: ${b.value}`)
            .join("\n")
        : "";
      contentInstruction = `
Horizontal bar chart.
${heraMode === "overlay" ? "Compact layout." : "Full size display."}
Title in white: "${d.title ?? "Comparison"}"
Bars data:
${barsText}
Gold bars (#e8c547) animate in from left simultaneously.
Bar labels in white left of bars.
Values in gold at end of bars.
Clean dark grid lines #1a1a1a.
Animation duration: 2 seconds.`;
      break;
    }
    case "timeline": {
      const eventsText = Array.isArray(d.events)
        ? d.events
            .slice(0, 6)
            .map((e: any) => `${e.date}: ${e.event ?? e.description ?? ""}`)
            .join(" → ")
        : "";
      contentInstruction = `
Horizontal timeline.
Title: "${d.title ?? "Timeline"}"
Events: ${eventsText}
Gold dots (#e8c547) on horizontal white line.
Dates above dots in gold.
Event text below dots in white.
Line draws left to right over 4 seconds.
Each dot pulses as it appears.`;
      break;
    }
    case "comparison": {
      const pointsText = Array.isArray(d.points)
        ? d.points
            .slice(0, 4)
            .map((p: any) => `${p.metric}: ${p.value_a} vs ${p.value_b}`)
            .join("\n")
        : "";
      contentInstruction = `
Two column comparison layout.
${heraMode === "overlay" ? "Compact two column." : "Full width display."}
Left header: "${d.label_a ?? "Option A"}"
Right header: "${d.label_b ?? "Option B"}"
Thin gold dividing line in center.
Data rows:
${pointsText}
Rows animate in from center outward sequentially.
Stronger value highlighted in gold.`;
      break;
    }
    case "percentage_ring": {
      contentInstruction = `
Circular progress ring.
${isCornerInsert ? "Small compact ring." : "Large prominent ring."}
Ring diameter: ${isCornerInsert ? "120px" : "280px"}.
Gold ring (#e8c547) on dark track (#1a1a1a).
Ring stroke width: 12px.
Fills clockwise from top to ${d.value ?? 0}%.
Percentage number centered inside ring in gold.
Label below ring in white: "${d.label ?? ""}"
${d.context_line && overlayStyle !== "corner_insert" ? `Context: "${d.context_line}"` : ""}
Animation: 2.5 seconds fill.`;
      break;
    }
    case "map_highlight": {
      contentInstruction = `
Simplified flat world map.
${heraMode === "overlay" ? "Map sized for overlay panel." : "Full frame map display."}
All countries: dark grey #2a2a2a.
${d.region ?? "USA"} highlighted in gold #e8c547.
Subtle gold pulse animation on highlighted region.
Label in white appears next to region: "${d.label ?? ""}"
${d.context_line ? `Context at bottom: "${d.context_line}"` : ""}
Map animates in over 1 second.`;
      break;
    }
    default:
      contentInstruction = `
Bold white text centered.
Clean minimal animation.
Gold accent elements.`;
  }

  const timingInstruction =
    heraMode === "overlay"
      ? `Total duration: ${overlayTiming?.duration_seconds ?? 4} seconds.
Fade in: ${overlayTiming?.fade_in ?? 0.3} seconds at start.
Fade out: ${overlayTiming?.fade_out ?? 0.3} seconds at end.`
      : `Total duration: 6 seconds.
Clean entrance animation.
Hold on final state.`;

  return `Motion graphics video.
${baseStyle}
${frameInstruction}
${contentInstruction}
${timingInstruction}
Professional documentary quality.
No people. No faces.
No stock footage elements.
Pure motion graphics only.`.trim();
}

function durationForRequest(
  graphicType: string | null | undefined,
  heraMode: HeraMode,
  overlayTiming?: OverlayTiming | null,
): number {
  if (heraMode === "overlay") {
    return Math.min(60, Math.max(1, Math.round(overlayTiming?.duration_seconds ?? 4)));
  }
  if (graphicType === "timeline" || graphicType === "comparison") return 8;
  return 6;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1-4: Library search
// ─────────────────────────────────────────────────────────────────────────────

const SearchInput = z.object({
  visual_job: z.string().nullable().optional(),
  emotional_temperature: z.string().nullable().optional(),
  mood_tags: z.array(z.string()).optional().default([]),
  content_tags: z.array(z.string()).optional().default([]),
  color_temperature: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  prompt_hash: z.string().optional(),
  graphic_type: z.string().nullable().optional(),
  hera_mode: z.enum(["standalone", "overlay"]).optional().default("standalone"),
  overlay_style: z
    .enum(["lower_third", "center_reveal", "corner_insert", "full_frame"])
    .nullable()
    .optional(),
});

type CacheRow = {
  id: string;
  output_url: string;
  thumbnail_url: string | null;
  prompt_text: string;
  duration_seconds: number;
  visual_job: string | null;
  emotional_temperature: string | null;
  mood_tags: string[];
  match_keywords: string[];
  subject: string | null;
  usage_count: number;
  user_rating: number | null;
};

export const heraLibrarySearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SearchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Layer 1 — exact hash match
    if (data.prompt_hash) {
      const { data: exact } = await supabase
        .from("hera_cache" as any)
        .select("*")
        .eq("prompt_hash", data.prompt_hash)
        .limit(1)
        .maybeSingle();
      if (exact) {
        return {
          match_type: "exact" as const,
          results: [{ ...(exact as any), confidence_score: 100, match_type: "exact" }],
        };
      }
    }

    const keywords = extractKeywords(data.subject || "");
    const moods = data.mood_tags || [];

    // Layer 2 — keyword + mood overlap
    if (keywords.length > 0 || moods.length > 0) {
      const orParts: string[] = [];
      if (keywords.length) orParts.push(`match_keywords.ov.{${keywords.join(",")}}`);
      if (moods.length) orParts.push(`mood_tags.ov.{${moods.join(",")}}`);
      const { data: rows } = await supabase
        .from("hera_cache" as any)
        .select("*")
        .or(orParts.join(","))
        .order("usage_count", { ascending: false })
        .limit(20);

      const scored = ((rows ?? []) as unknown as CacheRow[]).map((r) => {
        const rk = (r.match_keywords as string[]) || [];
        const rm = (r.mood_tags as string[]) || [];
        const keywordOverlap = keywords.length
          ? rk.filter((k) => keywords.includes(k)).length / Math.max(keywords.length, 1)
          : 0;
        const moodOverlap = moods.length
          ? rm.filter((m) => moods.includes(m)).length / Math.max(moods.length, 1)
          : 0;
        const jobMatch = data.visual_job && r.visual_job === data.visual_job ? 1 : 0;
        const tempMatch =
          data.emotional_temperature && r.emotional_temperature === data.emotional_temperature
            ? 1
            : 0;
        const rRow = r as unknown as Record<string, any>;
        const rMode = (rRow.hera_mode as string) ?? "standalone";
        const rOverlay = (rRow.overlay_style as string | null) ?? null;
        const modeBoost = rMode === data.hera_mode ? 0.2 : -0.3;
        const overlayBoost =
          data.hera_mode === "overlay" && data.overlay_style && rOverlay === data.overlay_style
            ? 0.1
            : 0;
        const base = keywordOverlap * 0.4 + moodOverlap * 0.3 + jobMatch * 0.2 + tempMatch * 0.1;
        const score = Math.max(0, Math.min(1, base + modeBoost + overlayBoost)) * 100;
        return { ...r, confidence_score: Math.round(score), match_type: "semantic" as const };
      });
      const kept = scored.filter((r) => r.confidence_score >= 70).slice(0, 5);
      if (kept.length > 0) return { match_type: "semantic" as const, results: kept };
    }

    // Layer 3 — tag intersection (job + temperature, mode-filtered)
    if (data.visual_job && data.emotional_temperature) {
      const q = supabase
        .from("hera_cache" as any)
        .select("*")
        .eq("visual_job", data.visual_job)
        .eq("emotional_temperature", data.emotional_temperature)
        .eq("hera_mode", data.hera_mode);
      const { data: rows } = await q
        .order("usage_count", { ascending: false })
        .order("user_rating", { ascending: false })
        .limit(3);

      if (rows && rows.length) {
        return {
          match_type: "tag" as const,
          results: (rows as any[]).map((r) => ({ ...r, confidence_score: 60, match_type: "tag" })),
        };
      }
    }

    // Layer 4 — broad match (job + mode)
    if (data.visual_job) {
      const { data: rows } = await supabase
        .from("hera_cache" as any)
        .select("*")
        .eq("visual_job", data.visual_job)
        .eq("hera_mode", data.hera_mode)
        .order("usage_count", { ascending: false })
        .limit(3);

      if (rows && rows.length) {
        return {
          match_type: "broad" as const,
          results: (rows as any[]).map((r) => ({
            ...r,
            confidence_score: 40,
            match_type: "broad",
          })),
        };
      }
    }

    return { match_type: "none" as const, results: [] };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Generate (cache-first, dev-mode gated)
// ─────────────────────────────────────────────────────────────────────────────

const GenerateInput = z.object({
  scene_id: z.string().uuid(),
  project_id: z.string().uuid(),
  visual_job: z.string().nullable().optional(),
  emotional_temperature: z.string().nullable().optional(),
  mood_tags: z.array(z.string()).optional().default([]),
  content_tags: z.array(z.string()).optional().default([]),
  subject: z.string().nullable().optional(),
  color_temperature: z.string().nullable().optional(),
  camera_motion: z.string().nullable().optional(),
  style_profile: z
    .object({
      name: z.string().nullable().optional(),
      editing_style: z.string().nullable().optional(),
    })
    .optional()
    .default({}),
  duration: z.number().min(2).max(15).optional().default(6),
  confirm_paid_call: z.boolean().optional().default(false),
  prompt_override: z.string().min(1).max(4000).optional(),
  // When provided, Hera builds a motion-graphics prompt for the given
  // graphic_type + graphic_data instead of a cinematic-clip prompt.
  graphic_type: z.string().optional(),
  graphic_data: z.record(z.string(), z.any()).optional(),
  // Mode controls layout and timing of the generated motion graphic.
  hera_mode: z.enum(["standalone", "overlay"]).optional().default("standalone"),
  overlay_style: z
    .enum(["lower_third", "center_reveal", "corner_insert", "full_frame"])
    .nullable()
    .optional(),
  overlay_position: z
    .enum(["bottom", "center", "top_left", "top_right", "bottom_left", "bottom_right"])
    .nullable()
    .optional(),
  overlay_timing: z
    .object({
      start_at_seconds: z.number().optional(),
      duration_seconds: z.number().optional(),
      fade_in: z.number().optional(),
      fade_out: z.number().optional(),
    })
    .nullable()
    .optional(),
});

// Lightweight helper: returns the auto-built prompt for a scene without
// touching the Hera API or consuming credits. Used by the client UI to
// seed the editable prompt textarea.
export const heraPreviewPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GenerateInput.parse(input))
  .handler(async ({ data }) => {
    const prompt = data.graphic_type
      ? buildMotionGraphicsPrompt(
          data.graphic_type,
          data.graphic_data,
          data.hera_mode,
          data.overlay_style ?? null,
          data.overlay_position ?? null,
          data.overlay_timing ?? null,
        )
      : buildHeraPrompt({
          visual_job: data.visual_job,
          emotional_temperature: data.emotional_temperature,
          subject: data.subject,
          camera_motion: data.camera_motion,
          duration: data.duration,
          editing_style: data.style_profile?.editing_style ?? null,
        });
    return { prompt };
  });

async function callHeraApi(prompt: string, durationSeconds: number) {
  const apiKey = process.env.HERA_API_KEY;
  // Default to the official Hera.Video API host. Env override allowed but
  // we normalize trailing slashes and ensure /v1 is present.
  let baseUrl = (process.env.HERA_API_BASE_URL || "https://api.hera.video/v1").replace(/\/+$/, "");
  if (!/\/v\d+$/.test(baseUrl)) baseUrl = `${baseUrl}/v1`;
  if (!apiKey) throw new Error("HERA_API_KEY is not configured");

  // POST /videos — Hera.Video official API
  // Auth header is x-api-key (NOT Bearer).
  // Required body: { prompt, outputs: [{ format, aspect_ratio, fps, resolution }] }
  const body = {
    prompt,
    duration_seconds: Math.min(60, Math.max(1, Math.round(durationSeconds))),
    outputs: [{ format: "mp4", aspect_ratio: "16:9", fps: "30", resolution: "1080p" }],
  };
  const submit = await fetch(`${baseUrl}/videos`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!submit.ok) {
    const errText = await submit.text().catch(() => "");
    throw new Error(`Hera submit failed: ${submit.status} ${errText.slice(0, 300)}`);
  }
  const submitJson = (await submit.json()) as Record<string, unknown>;
  const videoId = submitJson.video_id as string | undefined;
  if (!videoId) throw new Error("Hera response missing video_id");

  // Poll GET /videos/{video_id}. Video renders can take a few minutes — poll up to ~5min.
  const maxAttempts = 100;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(`${baseUrl}/videos/${videoId}`, {
      headers: { "x-api-key": apiKey },
    });
    if (!poll.ok) continue;
    const pj = (await poll.json()) as Record<string, unknown>;
    const status = String(pj.status ?? "").toLowerCase();
    const outputs = (pj.outputs as Array<Record<string, unknown>> | undefined) ?? [];
    const firstSuccess = outputs.find(
      (o) => String(o.status ?? "").toLowerCase() === "success" && o.file_url,
    );
    if (status === "success" && firstSuccess) {
      return {
        output_url: firstSuccess.file_url as string,
        thumbnail_url: null,
      };
    }
    if (status === "failed") {
      const errMsg = outputs.find((o) => o.error)?.error ?? "Hera reported failed status";
      throw new Error(`Hera generation failed: ${String(errMsg)}`);
    }
  }
  throw new Error("Hera generation timed out after 5 minutes");
}

export const heraGenerate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const isMotionGraphic = !!data.graphic_type;
    const effectiveDuration = isMotionGraphic
      ? durationForRequest(data.graphic_type, data.hera_mode, data.overlay_timing ?? null)
      : data.duration;

    const prompt = data.prompt_override?.trim()
      ? data.prompt_override.trim()
      : isMotionGraphic
        ? buildMotionGraphicsPrompt(
            data.graphic_type!,
            data.graphic_data,
            data.hera_mode,
            data.overlay_style ?? null,
            data.overlay_position ?? null,
            data.overlay_timing ?? null,
          )
        : buildHeraPrompt({
            visual_job: data.visual_job,
            emotional_temperature: data.emotional_temperature,
            subject: data.subject,
            camera_motion: data.camera_motion,
            duration: data.duration,
            editing_style: data.style_profile?.editing_style ?? null,
          });

    const hash = sha256(prompt);

    // Cache check (Layer 1 of generate)
    const { data: cached } = await supabase
      .from("hera_cache" as any)
      .select("*")
      .eq("prompt_hash", hash)
      .maybeSingle();

    if (cached) {
      const c: any = cached;
      const projectsUsedIn: string[] = Array.isArray(c.projects_used_in) ? c.projects_used_in : [];
      const newProjects = projectsUsedIn.includes(data.project_id)
        ? projectsUsedIn
        : [...projectsUsedIn, data.project_id];
      await supabase
        .from("hera_cache" as any)
        .update({
          usage_count: (c.usage_count ?? 0) + 1,
          last_used_at: new Date().toISOString(),
          projects_used_in: newProjects,
        })
        .eq("id", c.id);
      return { from_cache: true, requires_confirmation: false, prompt, prompt_hash: hash, data: c };
    }

    // Dev-mode gate
    const devMode = String(process.env.HERA_DEV_MODE || "").toLowerCase() === "true";
    if (devMode && !data.confirm_paid_call) {
      return {
        from_cache: false,
        requires_confirmation: true,
        prompt,
        prompt_hash: hash,
        message: "Dev mode active. Confirm to use 1 Hera credit.",
        data: null,
      };
    }

    // Live API call (can take several minutes — the user's JWT may expire
    // during polling, so use the service-role admin client for the cache
    // write that follows).
    const result = await callHeraApi(prompt, effectiveDuration);
    const keywords = extractKeywords(prompt);

    const { data: inserted, error } = await supabaseAdmin
      .from("hera_cache" as any)
      .insert({
        prompt_text: prompt,
        prompt_hash: hash,
        output_url: result.output_url,
        thumbnail_url: result.thumbnail_url,
        duration_seconds: effectiveDuration,
        visual_job: isMotionGraphic ? "motion_graphic" : (data.visual_job ?? null),
        emotional_temperature: data.emotional_temperature ?? null,
        mood_tags: data.mood_tags,
        content_tags: data.content_tags,
        color_temperature: data.color_temperature ?? null,
        subject: data.subject ?? null,
        camera_motion: data.camera_motion ?? null,
        style_profile_name: data.style_profile?.name ?? null,
        editing_style: data.style_profile?.editing_style ?? null,
        match_keywords: keywords,
        graphic_type: data.graphic_type ?? null,
        hera_mode: data.hera_mode,
        overlay_style: data.overlay_style ?? null,
        usage_count: 1,
        last_used_at: new Date().toISOString(),
        projects_used_in: [data.project_id],
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to cache Hera result: ${error.message}`);

    return {
      from_cache: false,
      requires_confirmation: false,
      prompt,
      prompt_hash: hash,
      data: inserted,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Usage tracking
// ─────────────────────────────────────────────────────────────────────────────

const TrackInput = z.object({
  cache_id: z.string().uuid(),
  action: z.enum(["used", "rejected", "rated"]),
  project_id: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export const heraTrackUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => TrackInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("hera_cache" as any)
      .select("usage_count, regeneration_count, projects_used_in")
      .eq("id", data.cache_id)
      .maybeSingle();
    if (!row) throw new Error("Cache record not found");
    const r: any = row;

    if (data.action === "used") {
      const projects: string[] = Array.isArray(r.projects_used_in) ? r.projects_used_in : [];
      const newProjects =
        data.project_id && !projects.includes(data.project_id)
          ? [...projects, data.project_id]
          : projects;
      await supabase
        .from("hera_cache" as any)
        .update({
          usage_count: (r.usage_count ?? 0) + 1,
          last_used_at: new Date().toISOString(),
          projects_used_in: newProjects,
        })
        .eq("id", data.cache_id);
    } else if (data.action === "rejected") {
      await supabase
        .from("hera_cache" as any)
        .update({ regeneration_count: (r.regeneration_count ?? 0) + 1 })
        .eq("id", data.cache_id);
    } else if (data.action === "rated") {
      if (!data.rating) throw new Error("rating required for action=rated");
      await supabase
        .from("hera_cache" as any)
        .update({ user_rating: data.rating })
        .eq("id", data.cache_id);
    }

    return { success: true };
  });
