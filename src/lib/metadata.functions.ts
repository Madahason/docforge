import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createGoogleAIProvider } from "./ai-gateway";

const SYSTEM_PROMPT = `You are a YouTube SEO specialist for documentary and business content.
Generate complete video metadata.
Return exactly this JSON structure:
{
  titles: [
    array of exactly 5 title options.
    Each title uses one of these formulas:
    1. Surface paradox + hidden mechanic
    2. Number + shocking claim
    3. Why X actually Y
    4. The truth about X
    5. How X [unexpected outcome]
    Each title max 60 characters.
    Optimize for curiosity and clicks.
    Each entry: { text: string, formula: string }
  ],
  description: complete YouTube description. First 2 lines must be compelling standalone hook (shown before 'Show more' cutoff). Include: what the video covers, 3 key moments with timestamps (use 0:00 placeholders), call to action. Max 400 words. No hashtags in description body.,
  tags: array of exactly 20 tags. Mix of: broad topic tags, specific entity tags, question-style tags, year tags. Each tag max 30 characters.,
  hashtags: array of 5 hashtags for description footer. Format: #tag (no spaces).,
  chapters: array of chapter markers. One per major narrative section. Format: { time: '0:00', title: string }. Use actual scene timecodes from the manifest data provided.,
  platform_variations: {
    linkedin: { hook: string, body: string, cta: string },
    twitter: { tweet: string, thread_opener: string },
    youtube_shorts: { hook: string, description: string }
  }
}
Return ONLY valid JSON. No preamble. No markdown.`;

const TitleSchema = z.object({ text: z.string(), formula: z.string().optional().default("") });
const ChapterSchema = z.object({ time: z.string(), title: z.string() });
const PlatformVariations = z
  .object({
    linkedin: z
      .object({ hook: z.string(), body: z.string(), cta: z.string() })
      .partial()
      .passthrough(),
    twitter: z.object({ tweet: z.string(), thread_opener: z.string() }).partial().passthrough(),
    youtube_shorts: z.object({ hook: z.string(), description: z.string() }).partial().passthrough(),
  })
  .partial();

const MetadataSchema = z.object({
  titles: z.array(TitleSchema),
  description: z.string(),
  tags: z.array(z.string()),
  hashtags: z.array(z.string()),
  chapters: z.array(ChapterSchema),
  platform_variations: PlatformVariations,
});
export type VideoMetadataPayload = z.infer<typeof MetadataSchema>;

function stripCodeFence(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  return t;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const generateVideoMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; force?: boolean }) =>
    z.object({ projectId: z.string().uuid(), force: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as { from: (t: string) => any };

    if (!data.force) {
      const existing = await sb
        .from("video_metadata")
        .select("*")
        .eq("project_id", data.projectId)
        .maybeSingle();
      if (existing.data) return { cached: true as const, record: existing.data };
    }

    const project = await supabase
      .from("projects")
      .select("title, content_type, script_raw")
      .eq("id", data.projectId)
      .single();
    if (project.error || !project.data) throw new Error("Project not found");

    const scenes = await supabase
      .from("scenes")
      .select("scene_index, script_text, estimated_seconds")
      .eq("project_id", data.projectId)
      .order("scene_index", { ascending: true });
    const sceneList = (scenes.data ?? []) as Array<{
      scene_index: number;
      script_text: string;
      estimated_seconds: number | null;
    }>;

    let cumulative = 0;
    const chapterLines = sceneList.map((s) => {
      const line = `${s.scene_index + 1}: ${(s.script_text ?? "").slice(0, 60)} at ${formatDuration(cumulative)}`;
      cumulative += s.estimated_seconds ?? 0;
      return line;
    });
    const totalSeconds = cumulative;

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
    const gateway = createGoogleAIProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: `Project title: ${project.data.title}
Content type: ${project.data.content_type ?? "documentary"}
Total duration: ${formatDuration(totalSeconds)}
Scene count: ${sceneList.length}
Key topics from script:
${(project.data.script_raw ?? "").slice(0, 500)}

Chapter markers from manifest:
${chapterLines.join("\n")}`,
      maxOutputTokens: 4000,
    });

    const text = stripCodeFence(result.text);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("AI returned no JSON object");
    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(text.slice(start, end + 1));
    } catch (e) {
      throw new Error(`AI JSON parse failed: ${(e as Error).message}`);
    }

    // Coerce title strings into {text, formula}
    if (parsedRaw && typeof parsedRaw === "object" && "titles" in parsedRaw) {
      const rec = parsedRaw as { titles: unknown };
      if (Array.isArray(rec.titles)) {
        rec.titles = rec.titles.map((t) => (typeof t === "string" ? { text: t, formula: "" } : t));
      }
    }
    const metadata = MetadataSchema.parse(parsedRaw);

    const upsert = await sb
      .from("video_metadata")
      .upsert(
        {
          user_id: userId,
          project_id: data.projectId,
          titles: metadata.titles,
          selected_title: metadata.titles[0]?.text ?? null,
          description: metadata.description,
          tags: metadata.tags,
          hashtags: metadata.hashtags,
          chapters: metadata.chapters,
          platform_variations: metadata.platform_variations,
          status: "generated",
        },
        { onConflict: "project_id" },
      )
      .select()
      .single();
    if (upsert.error) throw new Error(upsert.error.message);

    return { cached: false as const, record: upsert.data };
  });
