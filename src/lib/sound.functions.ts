import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createGoogleAIProvider } from "./ai-gateway";

const STORAGE_BUCKET = "docforge-assets";

const SOUND_PROFILE_SYSTEM_PROMPT = `You are a documentary sound designer.
Based on the editing style and content type provided, generate a complete sound style profile for this documentary project.

Return exactly this JSON:
{
  "aesthetic": "one sentence describing the overall sound world",
  "ambient_character": "2-3 sentences describing what ambient sounds should feel like throughout",
  "punctuation_character": "2-3 sentences describing punctuation sounds",
  "transition_character": "2-3 sentences describing transitions",
  "avoid_list": ["3-5 specific things to avoid sonically"],
  "volume_hierarchy": {
    "voiceover": 100,
    "music": 35,
    "ambient": 12,
    "punctuation": 35,
    "transitions": 20
  },
  "signature_moments": [
    { "scene_type": "string", "sound_treatment": "string" }
  ]
}

Return ONLY valid JSON. No preamble. No markdown.`;

function stripJsonFences(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  return t;
}

export const generateSoundStyleProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Cache check
    const existing = await supabase
      .from("sound_style_profiles")
      .select("*")
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (existing.data) return { cached: true as const, profile: existing.data };

    const project = await supabase
      .from("projects")
      .select("id, content_type, style_profile_id")
      .eq("id", data.projectId)
      .single();
    if (project.error || !project.data) throw new Error("Project not found");

    let editingStyle = "documentary";
    if (project.data.style_profile_id) {
      const sp = await supabase
        .from("style_profiles")
        .select("editing_style")
        .eq("id", project.data.style_profile_id)
        .maybeSingle();
      if (sp.data?.editing_style) editingStyle = sp.data.editing_style;
    }

    const scenes = await supabase
      .from("scenes")
      .select("emotional_temperature, scene_index")
      .eq("project_id", data.projectId)
      .order("scene_index", { ascending: true });
    const sceneRows = scenes.data ?? [];
    const openingTemp = sceneRows[0]?.emotional_temperature ?? "contemplative";
    const tensionRank: Record<string, number> = {
      contemplative: 1,
      cold: 2,
      heavy: 3,
      revelatory: 4,
      tense: 5,
      urgent: 6,
    };
    let climaxTemp = openingTemp;
    let maxRank = tensionRank[openingTemp] ?? 0;
    for (const s of sceneRows) {
      const r = tensionRank[s.emotional_temperature ?? ""] ?? 0;
      if (r > maxRank) {
        maxRank = r;
        climaxTemp = s.emotional_temperature ?? climaxTemp;
      }
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
    const model = createGoogleAIProvider(apiKey)("google/gemini-2.5-flash");

    const result = await generateText({
      model,
      system: SOUND_PROFILE_SYSTEM_PROMPT,
      prompt: `Editing style: ${editingStyle}
Content type: ${project.data.content_type ?? "general"}
Total scenes: ${sceneRows.length}
Opening temperature: ${openingTemp}
Climax temperature: ${climaxTemp}`,
      maxOutputTokens: 2000,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(stripJsonFences(result.text));
    } catch {
      throw new Error("Sound profile AI returned invalid JSON");
    }

    const insert = await (supabase.from("sound_style_profiles") as any)
      .insert({
        project_id: data.projectId,
        user_id: userId,
        aesthetic: String(parsed.aesthetic ?? ""),
        ambient_character: String(parsed.ambient_character ?? ""),
        punctuation_character: String(parsed.punctuation_character ?? ""),
        transition_character: String(parsed.transition_character ?? ""),
        avoid_list: (parsed.avoid_list as unknown[]) ?? [],
        volume_hierarchy: (parsed.volume_hierarchy as Record<string, unknown>) ?? {},
        signature_moments: (parsed.signature_moments as unknown[]) ?? [],
        editing_style: editingStyle,
        content_type: project.data.content_type ?? null,
      })
      .select("*")
      .single();
    if (insert.error) throw new Error(insert.error.message);
    return { cached: false as const, profile: insert.data };
  });

const SOUND_TYPE = z.enum(["ambient", "punctuation", "transition"]);

export const generateSceneSound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      sceneId: string;
      projectId: string;
      soundType: "ambient" | "punctuation" | "transition";
      description: string;
      durationSeconds?: number;
      force?: boolean;
    }) =>
      z
        .object({
          sceneId: z.string().uuid(),
          projectId: z.string().uuid(),
          soundType: SOUND_TYPE,
          description: z.string().min(3).max(2000),
          durationSeconds: z.number().min(1).max(22).optional(),
          force: z.boolean().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const urlField = `${data.soundType}_file_url` as
      | "ambient_file_url"
      | "punctuation_file_url"
      | "transition_file_url";
    const statusField = `${data.soundType}_status` as
      | "ambient_status"
      | "punctuation_status"
      | "transition_status";

    // Check cache
    const existing = await supabase
      .from("scene_sounds")
      .select(`id, ${urlField}`)
      .eq("scene_id", data.sceneId)
      .maybeSingle();
    if (existing.data && (existing.data as any)[urlField] && !data.force) {
      return {
        success: true as const,
        file_url: (existing.data as any)[urlField] as string,
        from_cache: true as const,
      };
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");

    const duration = data.durationSeconds ?? 8;
    const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
      body: JSON.stringify({
        text: data.description,
        duration_seconds: duration,
        prompt_influence: 0.3,
      }),
    });
    if (res.status === 422) throw new Error("Sound description too complex. Simplify and retry.");
    if (res.status === 401) throw new Error("ElevenLabs API key invalid.");
    if (!res.ok) throw new Error(`ElevenLabs error ${res.status}: ${await res.text()}`);
    const audioBuffer = await res.arrayBuffer();

    const path = `sounds/${data.projectId}/scene_${data.sceneId}_${data.soundType}.mp3`;
    const upload = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, audioBuffer, { contentType: "audio/mpeg", upsert: true });
    if (upload.error) throw new Error(`Storage upload failed: ${upload.error.message}`);
    const publicUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;

    if (existing.data) {
      const upd = await (supabase.from("scene_sounds") as any)
        .update({ [urlField]: publicUrl, [statusField]: "complete" })
        .eq("id", existing.data.id);
      if (upd.error) throw new Error(upd.error.message);
    } else {
      const ins = await (supabase.from("scene_sounds") as any).insert({
        project_id: data.projectId,
        scene_id: data.sceneId,
        user_id: userId,
        [urlField]: publicUrl,
        [statusField]: "complete",
      });
      if (ins.error) throw new Error(ins.error.message);
    }

    return { success: true as const, file_url: publicUrl, from_cache: false as const };
  });

export const updateSceneSoundConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sceneId: string; patch: Record<string, unknown> }) =>
    z.object({ sceneId: z.string().uuid(), patch: z.record(z.string(), z.unknown()) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const upd = await (supabase.from("scene_sounds") as any)
      .update(data.patch)
      .eq("scene_id", data.sceneId)
      .select("*")
      .maybeSingle();
    if (upd.error) throw new Error(upd.error.message);
    return { record: upd.data };
  });
