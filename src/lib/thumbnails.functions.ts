import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createGoogleAIProvider } from "./ai-gateway";

const SYSTEM_PROMPT = `You are a YouTube thumbnail strategist specializing in documentary and business content.
Generate 3 thumbnail concepts for this documentary video.
Each concept must create curiosity, signal the video's core tension, and stop the scroll.
For each concept return:
{
  concept_number: 1,
  strategy: one sentence explaining the psychological hook,
  visual_description: detailed description of what appears in the thumbnail image,
  title_copy: the 3-6 word text overlay on the thumbnail,
  title_position: top | bottom | left | right | center,
  color_scheme: description of dominant colors,
  ai_image_prompt: complete prompt for generating this thumbnail in Midjourney or Flux. Include style, lighting, composition, and mood. Format: detailed paragraph.,
  why_it_works: one sentence on why this would perform well
}
Return ONLY valid JSON array of 3 objects. No preamble. No markdown.`;

const VARIANT_PROMPT = `You are a YouTube thumbnail strategist. Generate ONE A/B variant of the provided concept.
Keep the same psychological hook but vary the visual angle, title copy phrasing, or color scheme.
Return ONLY a single valid JSON object with the same fields as the source concept (concept_number, strategy, visual_description, title_copy, title_position, color_scheme, ai_image_prompt, why_it_works).
No preamble. No markdown.`;

const ConceptSchema = z.object({
  concept_number: z.number().int(),
  strategy: z.string(),
  visual_description: z.string(),
  title_copy: z.string(),
  title_position: z.string(),
  color_scheme: z.string(),
  ai_image_prompt: z.string(),
  why_it_works: z.string(),
});
export type ThumbnailConcept = z.infer<typeof ConceptSchema>;

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

export const generateThumbnailConcepts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; force?: boolean }) =>
    z.object({ projectId: z.string().uuid(), force: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as { from: (t: string) => any };

    if (!data.force) {
      const existing = await sb
        .from("thumbnails")
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
      .select("scene_index, script_text, emotional_temperature, estimated_seconds")
      .eq("project_id", data.projectId)
      .order("scene_index", { ascending: true });
    const sceneList = (scenes.data ?? []) as Array<{
      scene_index: number;
      script_text: string;
      emotional_temperature: string | null;
      estimated_seconds: number | null;
    }>;
    const firstScene = sceneList[0]?.script_text ?? project.data.script_raw?.slice(0, 400) ?? "";
    const heat = ["urgent", "revelatory", "tense", "heavy"];
    const tension =
      sceneList.find((s) => s.emotional_temperature && heat.includes(s.emotional_temperature))
        ?.script_text ??
      sceneList[Math.floor(sceneList.length / 2)]?.script_text ??
      firstScene;
    const totalSeconds = sceneList.reduce((sum, s) => sum + (s.estimated_seconds ?? 0), 0);

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
    const gateway = createGoogleAIProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: `Project title: ${project.data.title}
Script hook (first scene): ${firstScene}
Central tension: ${tension}
Content type: ${project.data.content_type ?? "documentary"}
Total duration: ${formatDuration(totalSeconds)}`,
      maxOutputTokens: 4000,
    });

    const text = stripCodeFence(result.text);
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("AI returned no JSON array");
    const parsed = JSON.parse(text.slice(start, end + 1));
    const concepts = z.array(ConceptSchema).min(1).parse(parsed);

    const upsert = await sb
      .from("thumbnails")
      .upsert(
        {
          user_id: userId,
          project_id: data.projectId,
          concepts,
          status: "generated",
        },
        { onConflict: "project_id" },
      )
      .select()
      .single();
    if (upsert.error) throw new Error(upsert.error.message);

    return { cached: false as const, record: upsert.data };
  });

export const generateThumbnailVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceConcept: ThumbnailConcept }) =>
    z.object({ sourceConcept: ConceptSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
    const gateway = createGoogleAIProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const result = await generateText({
      model,
      system: VARIANT_PROMPT,
      prompt: `Source concept:\n${JSON.stringify(data.sourceConcept, null, 2)}`,
      maxOutputTokens: 1500,
    });
    const text = stripCodeFence(result.text);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("AI returned no JSON object");
    const variant = ConceptSchema.parse(JSON.parse(text.slice(start, end + 1)));
    return { variant };
  });

// Generate thumbnail image via Replicate Flux Schnell
export const generateThumbnailImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string }) =>
    z.object({ prompt: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data }) => {
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
            prompt: data.prompt,
            aspect_ratio: "16:9",
            output_format: "jpg",
            output_quality: 90,
            num_outputs: 1,
          },
        }),
      },
    );
    if (!create.ok)
      throw new Error(`Replicate create failed: ${create.status} ${await create.text()}`);
    let json = (await create.json()) as {
      id: string;
      status: string;
      output?: unknown;
      error?: string;
    };

    for (let i = 0; i < 15 && json.status !== "succeeded"; i++) {
      if (json.status === "failed" || json.status === "canceled") {
        throw new Error(`Replicate ${json.status}: ${json.error ?? "unknown"}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${json.id}`, {
        headers: { Authorization: `Token ${token}` },
      });
      json = (await poll.json()) as typeof json;
    }
    if (json.status !== "succeeded") throw new Error("Replicate timed out");
    const out = json.output;
    const url = Array.isArray(out) ? out[0] : typeof out === "string" ? out : null;
    if (!url) throw new Error("Replicate returned no URL");
    return { url: String(url) };
  });
