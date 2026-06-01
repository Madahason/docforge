import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createGoogleAIProvider } from "./ai-gateway";
import { splitScriptIntoChunks } from "./script-chunking";
import type { Database, Json } from "@/integrations/supabase/types";

const SYSTEM_PROMPT = `You are a documentary production analyst specializing in business and finance content.
Analyze the provided script and return a JSON array of scenes.
A scene is a distinct narrative beat — typically 2-5 sentences that share the same emotional temperature and visual logic.
Do not make scenes too short (minimum 2 sentences) or too long (maximum 6 sentences).
For each scene return exactly these fields:
scene_number: integer starting at 1
script_text: exact text of the scene, no modifications
word_count: integer
duration_estimate: seconds at 150 WPM (word_count / 150 * 60)
emotional_temperature: exactly one of: cold, tense, revelatory, heavy, urgent, contemplative
visual_job: exactly one of: atmosphere, evidence, authority, counterpoint
pacing_instruction: exactly one of: slow_hold, medium, fast_cut, hard_punctuation
text_overlay_flag: boolean true if key words or statistics should appear as text overlay on screen
text_overlay_suggestion: string or null — if text_overlay_flag is true, what specific words or numbers to show
data_graphic_flag: boolean true if scene contains a statistic, percentage, dollar amount, or claim that needs visual proof
data_graphic_detail: string or null — if data_graphic_flag is true, exactly what data needs to be visualized and what type of graphic suits it (bar chart, counter, timeline, percentage ring, comparison)
clip_brief: object with fields: subject (string), mood (array of 2-3 strings), avoid (array of 2-3 strings), preferred_era (string e.g. 2018-present), color_temperature (warm, cold, neutral, high_contrast), suggested_search_terms (array of 3-5 YouTube search queries ordered by specificity, most specific first)
youtube_source_priority: array of strings, ordered list of YouTube channels from this list only: ap_archive, bloomberg, reuters, bbc_news, dw_documentary, wsj, cnbc, ft_film, vice_news, pbs_frontline, cnn_business

Additionally for each scene return these fields:
recommended_asset_type: exactly one of: motion_graphic, ai_image_ken_burns, stock_image_ken_burns, animated_image, stock_video, youtube_clip
Use this mapping as your guide:
  visual_job = evidence -> motion_graphic
  visual_job = atmosphere -> ai_image_ken_burns
  visual_job = authority -> stock_video
  visual_job = counterpoint -> ai_image_ken_burns

CRITICAL MOTION GRAPHIC RULES:
Set recommended_asset_type = motion_graphic whenever the scene contains ANY of:
  - A number with $, %, B, M, K, billion, million, thousand
  - Any statistic or percentage
  - A named comparison between two entities (X vs Y, X compared to Y)
  - A sequence of dated events or multiple years
  - A single powerful statement that would work as a title card
  - Market share, ranking, or ordered list data
Otherwise:
  Scene contains specific real-world events, named people, or breaking news -> youtube_clip

If recommended_asset_type is motion_graphic, you MUST populate BOTH motion_graphic_type AND motion_graphic_data with a complete valid object. NEVER return null for these when recommended_asset_type is motion_graphic.

Pick motion_graphic_type:
  Contains dollar amount or large number -> counter
  Contains comparison of two things -> comparison
  Contains multiple years or sequence of dated events -> timeline
  Contains a single percentage -> percentage_ring
  Contains ranking or multiple comparable values -> bar_chart
  Powerful single statement with no data -> text_card

For text_card always return: motion_graphic_data: { statement: "<most powerful sentence, max 12 words>", attribution: null }
For counter always return: motion_graphic_data: { value: "<number as string>", label: "<what it represents>", prefix: "$ or empty", suffix: "<B|M|K|% or empty>", context_line: "<one sentence context>" }

motion_graphic_type: one of counter, bar_chart, timeline, comparison, text_card, percentage_ring, map_highlight; or null ONLY if recommended_asset_type is not motion_graphic
motion_graphic_data: object or null. Schema by motion_graphic_type:
  counter: { value: string, label: string, prefix: string, suffix: string, context_line: string }
  bar_chart: { title: string, bars: array up to 5 of { label: string, value: number } }
  timeline: { title: string, events: array up to 6 of { date: string, event: string } }
  comparison: { label_a: string, label_b: string, points: array up to 4 of { metric: string, value_a: string, value_b: string } }
  text_card: { statement: string (max 12 words), attribution: string or null }
  percentage_ring: { value: number 0-100, label: string, context_line: string }
  map_highlight: { region: string, label: string, context_line: string }
  null ONLY when motion_graphic_type is null
is_real_footage_scene: boolean — true only if recommended_asset_type is stock_video or youtube_clip; false for all others

Return ONLY a valid JSON array. No preamble, no explanation, no markdown code blocks. Start your response with [ and end with ]`;

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeTextValue = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const normalizeEnumValue = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  aliases: Record<string, T>,
  fallback: T,
): T => {
  const normalized = normalizeTextValue(value);
  if ((allowed as readonly string[]).includes(normalized)) return normalized as T;
  return aliases[normalized] ?? fallback;
};

const emotionalTemperatures = [
  "cold",
  "tense",
  "revelatory",
  "heavy",
  "urgent",
  "contemplative",
] as const;
const visualJobs = ["atmosphere", "evidence", "authority", "counterpoint"] as const;
const pacingInstructions = ["slow_hold", "medium", "fast_cut", "hard_punctuation"] as const;
const recommendedAssetTypes = [
  "motion_graphic",
  "ai_image_ken_burns",
  "stock_image_ken_burns",
  "animated_image",
  "stock_video",
  "youtube_clip",
] as const;
const motionGraphicTypes = [
  "counter",
  "bar_chart",
  "timeline",
  "comparison",
  "text_card",
  "percentage_ring",
  "map_highlight",
] as const;

const boolish = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "yes", "1"].includes(value.trim().toLowerCase());
  return Boolean(value);
}, z.boolean());

const numberish = z.preprocess((value) => {
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}, z.number());

const SceneSchema = z.object({
  scene_number: numberish.pipe(z.number().int()),
  script_text: z.string().min(1),
  word_count: numberish.pipe(z.number().int().nonnegative()),
  duration_estimate: numberish.pipe(z.number().nonnegative()),
  emotional_temperature: z.preprocess(
    (value) =>
      normalizeEnumValue(
        value,
        emotionalTemperatures,
        {
          reflective: "contemplative",
          thoughtful: "contemplative",
          introspective: "contemplative",
          calm: "contemplative",
          analytical: "cold",
          detached: "cold",
          ominous: "tense",
          anxious: "tense",
          dramatic: "tense",
          somber: "heavy",
          sombre: "heavy",
          serious: "heavy",
          weighty: "heavy",
          high_stakes: "urgent",
          fast: "urgent",
          revealing: "revelatory",
          surprising: "revelatory",
          shocking: "revelatory",
        },
        "contemplative",
      ),
    z.enum(emotionalTemperatures),
  ),
  visual_job: z.preprocess(
    (value) =>
      normalizeEnumValue(
        value,
        visualJobs,
        {
          context: "atmosphere",
          mood: "atmosphere",
          establishing: "atmosphere",
          proof: "evidence",
          data: "evidence",
          statistic: "evidence",
          stats: "evidence",
          expert: "authority",
          interview: "authority",
          person: "authority",
          contrast: "counterpoint",
          irony: "counterpoint",
          opposition: "counterpoint",
        },
        "atmosphere",
      ),
    z.enum(visualJobs),
  ),
  pacing_instruction: z.preprocess(
    (value) =>
      normalizeEnumValue(
        value,
        pacingInstructions,
        {
          slow: "slow_hold",
          hold: "slow_hold",
          slowhold: "slow_hold",
          moderate: "medium",
          normal: "medium",
          quick: "fast_cut",
          fast: "fast_cut",
          hard: "hard_punctuation",
          punctuation: "hard_punctuation",
        },
        "medium",
      ),
    z.enum(pacingInstructions),
  ),
  text_overlay_flag: boolish,
  text_overlay_suggestion: z.string().nullable().optional(),
  data_graphic_flag: boolish,
  data_graphic_detail: z.string().nullable().optional(),
  clip_brief: z.object({
    subject: z.string(),
    mood: z.preprocess(normalizeStringArray, z.array(z.string())),
    avoid: z.preprocess(normalizeStringArray, z.array(z.string())),
    preferred_era: z.string().optional().default(""),
    color_temperature: z.string(),
    suggested_search_terms: z.preprocess(normalizeStringArray, z.array(z.string())),
  }),
  youtube_source_priority: z.preprocess(normalizeStringArray, z.array(z.string())),
  recommended_asset_type: z
    .preprocess(
      (value) =>
        normalizeEnumValue(
          value,
          recommendedAssetTypes,
          {
            motion_graphics: "motion_graphic",
            graphic: "motion_graphic",
            data_visualization: "motion_graphic",
            ai_image: "ai_image_ken_burns",
            ken_burns_image: "ai_image_ken_burns",
            stock_image: "stock_image_ken_burns",
            image: "stock_image_ken_burns",
            animation: "animated_image",
            video: "stock_video",
            footage: "stock_video",
            youtube: "youtube_clip",
            youtube_video: "youtube_clip",
          },
          "ai_image_ken_burns",
        ),
      z.enum(recommendedAssetTypes),
    )
    .default("ai_image_ken_burns"),
  motion_graphic_type: z
    .preprocess((value) => {
      if (value === null || value === undefined || value === "") return null;
      return normalizeEnumValue(
        value,
        motionGraphicTypes,
        {
          bar: "bar_chart",
          chart: "bar_chart",
          line: "timeline",
          text: "text_card",
          title_card: "text_card",
          percentage: "percentage_ring",
          percent_ring: "percentage_ring",
          map: "map_highlight",
        },
        "text_card",
      );
    }, z.enum(motionGraphicTypes).nullable())
    .nullable()
    .optional(),
  motion_graphic_data: z.record(z.string(), z.unknown()).nullable().optional(),
  is_real_footage_scene: boolish.optional().default(false),
});

type ParsedScene = z.infer<typeof SceneSchema>;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CHUNK_SCENE_STRIDE = 100;

type SceneInsertRow = Database["public"]["Tables"]["scenes"]["Insert"];
type SceneRow = Database["public"]["Tables"]["scenes"]["Row"];

function buildChunkPrompt(
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  sceneOffset: number,
) {
  return `Analyze this PORTION of a larger documentary script.
This is part ${chunkIndex + 1} of ${totalChunks}.
Start scene_number from ${sceneOffset + 1}.
Each scene must be 2-5 sentences maximum, with minimum 2 sentences per scene.
Return ONLY a valid JSON array that starts with [ and ends with ]. No markdown, no explanation.

Script portion:\n\n${chunk}`;
}

async function analyzeChunkWithAi({
  model,
  chunk,
  chunkIndex,
  totalChunks,
  sceneOffset,
}: {
  model: Parameters<typeof generateText>[0]["model"];
  chunk: string;
  chunkIndex: number;
  totalChunks: number;
  sceneOffset: number;
}) {
  const chunkLabel = `part ${chunkIndex + 1}/${totalChunks}`;
  const result = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: buildChunkPrompt(chunk, chunkIndex, totalChunks, sceneOffset),
    maxOutputTokens: 16000,
  });
  const finishReason = (result as { finishReason?: string }).finishReason;
  if (finishReason === "length") {
    console.error("[analyzeScript] AI response hit output limit", chunkLabel);
    throw new Error(`AI response was truncated while analyzing ${chunkLabel}.`);
  }
  return parseSceneArray(result.text, finishReason, chunkLabel);
}

function scenesToRows(
  scenes: ParsedScene[],
  projectId: string,
  userId: string,
  sceneIndexStart: number,
): SceneInsertRow[] {
  return scenes.map((s, index) => ({
    project_id: projectId,
    user_id: userId,
    scene_index: sceneIndexStart + index,
    script_text: s.script_text,
    word_count: s.word_count,
    estimated_seconds: Math.round(s.duration_estimate),
    emotional_temperature: s.emotional_temperature,
    visual_job: s.visual_job,
    pacing_instruction: s.pacing_instruction,
    text_overlay_flag: s.text_overlay_flag,
    text_overlay_suggestion: s.text_overlay_suggestion ?? null,
    data_graphic_flag: s.data_graphic_flag,
    data_graphic_detail: s.data_graphic_detail ?? null,
    clip_brief: s.clip_brief as Json,
    youtube_source_priority: s.youtube_source_priority as Json,
    recommended_asset_type: s.recommended_asset_type,
    motion_graphic_type: s.motion_graphic_type ?? null,
    motion_graphic_data: (s.motion_graphic_data ?? null) as Json,
    is_real_footage_scene: s.is_real_footage_scene,
    captions_status: "pending",
  }));
}

function parseSceneArray(
  rawResponse: string,
  finishReason: string | undefined,
  chunkLabel: string,
): ParsedScene[] {
  let raw = rawResponse.trim();
  if (!raw) {
    console.error("[analyzeScript] Empty AI response.", chunkLabel, "finishReason:", finishReason);
    throw new Error("AI returned an empty response while analyzing part of the script.");
  }
  if (raw.startsWith("```")) {
    raw = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) {
    console.error(
      "[analyzeScript] No JSON brackets.",
      chunkLabel,
      "finishReason:",
      finishReason,
      "head:",
      raw.slice(0, 300),
      "tail:",
      raw.slice(-300),
    );
    throw new Error("AI output was truncated while analyzing part of the script.");
  }

  const jsonText = raw.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    console.error(
      "[analyzeScript] JSON.parse failed.",
      chunkLabel,
      "finishReason:",
      finishReason,
      "len:",
      jsonText.length,
      "tail:",
      jsonText.slice(-300),
      "err:",
      (e as Error).message,
    );
    throw new Error("AI output was truncated mid-scene while analyzing part of the script.");
  }

  const arr = z.array(SceneSchema).safeParse(parsed);
  if (!arr.success) {
    console.error(
      "[analyzeScript] Schema validation failed:",
      chunkLabel,
      arr.error.issues.slice(0, 5),
    );
    throw new Error(
      `AI returned invalid scene structure: ${arr.error.issues[0]?.path.join(".") ?? "field"} — ${arr.error.issues[0]?.message ?? ""}`,
    );
  }
  return arr.data;
}

export const analyzeScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Cache check: if scenes already exist, return them without calling AI
    const existing = await supabase
      .from("scenes")
      .select("id")
      .eq("project_id", data.projectId)
      .limit(1);
    if (existing.error) throw new Error(existing.error.message);
    if ((existing.data ?? []).length > 0) {
      return { cached: true as const };
    }

    const project = await supabase
      .from("projects")
      .select("id, script_raw, user_id")
      .eq("id", data.projectId)
      .single();
    if (project.error || !project.data) throw new Error("Project not found");
    const script = (project.data as { script_raw: string | null }).script_raw;
    if (!script || !script.trim()) throw new Error("Project has no script to analyze");

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");

    const gateway = createGoogleAIProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const chunks = splitScriptIntoChunks(script);
    const insertedScenes: SceneRow[] = [];
    const failedParts: number[] = [];

    // Process chunks in parallel batches to keep latency low while
    // respecting AI gateway rate limits.
    const CONCURRENCY = 4;
    const analyzeOne = async (i: number): Promise<ParsedScene[] | null> => {
      try {
        return await analyzeChunkWithAi({
          model,
          chunk: chunks[i],
          chunkIndex: i,
          totalChunks: chunks.length,
          sceneOffset: i * CHUNK_SCENE_STRIDE,
        });
      } catch (firstError) {
        console.error("[analyzeScript] Chunk failed, retrying once:", i + 1, firstError);
        await wait(1500);
        try {
          return await analyzeChunkWithAi({
            model,
            chunk: chunks[i],
            chunkIndex: i,
            totalChunks: chunks.length,
            sceneOffset: i * CHUNK_SCENE_STRIDE,
          });
        } catch (retryError) {
          console.error("[analyzeScript] Chunk failed after retry:", i + 1, retryError);
          failedParts.push(i + 1);
          return null;
        }
      }
    };

    for (let batchStart = 0; batchStart < chunks.length; batchStart += CONCURRENCY) {
      const batch = chunks
        .slice(batchStart, batchStart + CONCURRENCY)
        .map((_, idx) => batchStart + idx);
      const results = await Promise.all(batch.map((i) => analyzeOne(i)));

      // Insert sequentially in order so DB writes don't interleave per chunk.
      for (let b = 0; b < results.length; b += 1) {
        const chunkScenes = results[b];
        const i = batch[b];
        if (chunkScenes?.length) {
          const sceneIndexStart = i * CHUNK_SCENE_STRIDE + 1;
          const rows = scenesToRows(chunkScenes, data.projectId, userId, sceneIndexStart);
          const inserted = await supabase.from("scenes").insert(rows).select("*");
          if (inserted.error) throw new Error(inserted.error.message);
          insertedScenes.push(...(inserted.data ?? []));
        }
      }
    }

    if (insertedScenes.length === 0) {
      throw new Error("AI returned zero scenes. The script may be too short.");
    }

    await supabase
      .from("projects")
      .update({ script_parsed: true, completion_percent: 10 })
      .eq("id", data.projectId);

    return {
      cached: false as const,
      scenes: insertedScenes,
      totalChunks: chunks.length,
      failedParts,
    };
  });

export const retryScriptAnalysisPart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; partNumber: number }) =>
    z.object({ projectId: z.string().uuid(), partNumber: z.number().int().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const project = await supabase
      .from("projects")
      .select("id, script_raw")
      .eq("id", data.projectId)
      .single();
    if (project.error || !project.data) throw new Error("Project not found");
    const script = (project.data as { script_raw: string | null }).script_raw;
    if (!script?.trim()) throw new Error("Project has no script to analyze");
    const chunks = splitScriptIntoChunks(script);
    const chunkIndex = data.partNumber - 1;
    if (!chunks[chunkIndex]) throw new Error("Analysis part not found");

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
    const model = createGoogleAIProvider(apiKey)("google/gemini-2.5-flash");
    const chunkScenes = await analyzeChunkWithAi({
      model,
      chunk: chunks[chunkIndex],
      chunkIndex,
      totalChunks: chunks.length,
      sceneOffset: chunkIndex * CHUNK_SCENE_STRIDE,
    });
    const start = chunkIndex * CHUNK_SCENE_STRIDE + 1;
    const end = start + CHUNK_SCENE_STRIDE - 1;
    await supabase
      .from("scenes")
      .delete()
      .eq("project_id", data.projectId)
      .gte("scene_index", start)
      .lte("scene_index", end);
    const inserted = await supabase
      .from("scenes")
      .insert(scenesToRows(chunkScenes, data.projectId, userId, start))
      .select("*");
    if (inserted.error) throw new Error(inserted.error.message);
    return { scenes: (inserted.data ?? []) as SceneRow[], partNumber: data.partNumber };
  });
