import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createGoogleAIProvider } from "./ai-gateway";

const NARRATIVE_SYSTEM_PROMPT = `You are a world-class documentary sound designer and composer.
Analyze the complete documentary script and design a coherent sound narrative across all scenes.

Think like a film sound designer:
- Where does tension build?
- Where is silence most powerful?
- What sounds create motifs?
- How does audio support the emotional arc?

Return exactly this JSON:
{
  "narrative_arc": {
    "acts": [{ "name": "string", "scenes": [1,2], "sound_strategy": "string", "ambient_volume_range": "10-20", "tension_active": false, "tension_volume_range": "0-15", "music_volume": 30 }],
    "climax_scene": 0,
    "climax_treatment": "string"
  },
  "signature_moments": [{ "scene": 0, "moment": "string", "instruction": "string", "sound_action": "string" }],
  "volume_curves": [{ "scene_number": 1, "ambient_volume": 15, "tension_volume": 0, "silence": false, "silence_start_offset": null, "impact_at_seconds": null, "notes": "string" }],
  "tension_drone_needed": false,
  "tension_drone_description": "string",
  "impact_sound_description": "string"
}

Return ONLY valid JSON. No preamble. No markdown.`;

const SYNC_SYSTEM_PROMPT = `You are a documentary sound designer.
Analyze voiceover word timestamps and identify the exact moments where sound effects should hit for maximum impact.

Focus on: dollar amounts, large numbers, negative words (collapsed, failed, lost), revelation words (but, however, until), named entities, superlatives (largest, first, only), action words at key moments.

Return exactly this JSON:
{
  "sync_points": [{ "timestamp": 2.2, "word": "string", "sound_action": "string", "sound_category": "impact|whoosh|hit|texture", "volume": 40, "reasoning": "string" }],
  "ducking_curve": [{ "time": 2.1, "ambient_volume": 5, "reasoning": "string" }],
  "key_moment": { "timestamp": 0, "word": "string", "treatment": "string" }
}

Return ONLY valid JSON. No preamble. No markdown.`;

function stripFences(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  return t;
}

export const generateSoundNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Cache check
    const existing = await supabase
      .from("sound_style_profiles")
      .select("*")
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (existing.data && (existing.data as any).narrative_arc) {
      return { cached: true as const, profile: existing.data };
    }
    if (!existing.data) {
      throw new Error("Generate sound style profile first.");
    }

    const profile = existing.data as any;

    // Fetch scenes
    const scenes = await supabase
      .from("scenes")
      .select("id, scene_index, emotional_temperature, estimated_seconds, script_text")
      .eq("project_id", data.projectId)
      .order("scene_index", { ascending: true });
    const sceneRows = (scenes.data ?? []) as Array<{
      id: string;
      scene_index: number;
      emotional_temperature: string | null;
      estimated_seconds: number | null;
      script_text: string;
    }>;
    if (sceneRows.length === 0) throw new Error("No scenes found.");

    const totalDuration = sceneRows.reduce((acc, s) => acc + (s.estimated_seconds ?? 0), 0);

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not configured");
    const model = createGoogleAIProvider(apiKey)("google/gemini-2.5-flash");

    const userPrompt = `Sound aesthetic: ${profile.aesthetic ?? "documentary"}
Editing style: ${profile.editing_style ?? "documentary"}
Total duration: ${totalDuration}s
Scenes:
${sceneRows
  .map(
    (s) =>
      `Scene ${s.scene_index}: temp=${s.emotional_temperature ?? "neutral"}, dur=${s.estimated_seconds ?? 0}s — ${(s.script_text ?? "").slice(0, 140)}`,
  )
  .join("\n")}`;

    const result = await generateText({
      model,
      system: NARRATIVE_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 4000,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(stripFences(result.text));
    } catch {
      throw new Error("Narrative AI returned invalid JSON");
    }

    // Apply volume curves to scene_sounds
    const curves: any[] = Array.isArray(parsed.volume_curves) ? parsed.volume_curves : [];
    const sceneByIndex = new Map(sceneRows.map((s) => [s.scene_index, s.id]));
    let updated = 0;
    for (const c of curves) {
      const sceneId = sceneByIndex.get(c.scene_number);
      if (!sceneId) continue;
      const upd = await (supabase.from("scene_sounds") as any)
        .update({
          narrative_ambient_volume: c.ambient_volume ?? null,
          narrative_tension_volume: c.tension_volume ?? null,
          silence_scene: !!c.silence,
          silence_start_offset: c.silence_start_offset ?? null,
          impact_at_seconds: c.impact_at_seconds ?? null,
        })
        .eq("scene_id", sceneId);
      if (!upd.error) updated += 1;
    }

    // Persist profile updates
    const profUpd = await (supabase.from("sound_style_profiles") as any)
      .update({
        narrative_arc: parsed.narrative_arc ?? null,
        signature_moments: parsed.signature_moments ?? [],
        volume_curves: curves,
      })
      .eq("id", profile.id)
      .select("*")
      .single();
    if (profUpd.error) throw new Error(profUpd.error.message);

    return {
      cached: false as const,
      profile: profUpd.data,
      scenes_updated: updated,
      tension_drone_description: parsed.tension_drone_description ?? null,
      tension_drone_needed: !!parsed.tension_drone_needed,
      impact_sound_description: parsed.impact_sound_description ?? null,
    };
  });

export const generateSoundSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sceneId: string; projectId: string }) =>
    z.object({ sceneId: z.string().uuid(), projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const scene = await supabase
      .from("scenes")
      .select("id, script_text, emotional_temperature")
      .eq("id", data.sceneId)
      .single();
    if (scene.error || !scene.data) throw new Error("Scene not found");

    const vo = await supabase
      .from("voiceovers")
      .select("word_timestamps, duration_seconds")
      .eq("scene_id", data.sceneId)
      .maybeSingle();
    if (!vo.data || !vo.data.word_timestamps) {
      throw new Error("Generate voiceover first to enable sync points.");
    }

    const ss = await supabase
      .from("scene_sounds")
      .select("id, ambient_volume")
      .eq("scene_id", data.sceneId)
      .maybeSingle();
    if (!ss.data) throw new Error("No sound brief for this scene.");

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not configured");
    const model = createGoogleAIProvider(apiKey)("google/gemini-2.5-flash");

    const userPrompt = `Scene script: ${scene.data.script_text}
Emotional temperature: ${scene.data.emotional_temperature ?? "neutral"}
Scene duration: ${vo.data.duration_seconds ?? 0}s
Ambient volume: ${(ss.data as any).ambient_volume ?? 12}%
Word timestamps: ${JSON.stringify(vo.data.word_timestamps).slice(0, 6000)}`;

    const result = await generateText({
      model,
      system: SYNC_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 3000,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(stripFences(result.text));
    } catch {
      throw new Error("Sync AI returned invalid JSON");
    }

    const upd = await (supabase.from("scene_sounds") as any)
      .update({
        sync_points: parsed.sync_points ?? [],
        ducking_curve: parsed.ducking_curve ?? [],
      })
      .eq("id", (ss.data as any).id)
      .select("*")
      .single();
    if (upd.error) throw new Error(upd.error.message);

    return {
      success: true as const,
      sync_points: parsed.sync_points ?? [],
      ducking_curve: parsed.ducking_curve ?? [],
      record: upd.data,
    };
  });
