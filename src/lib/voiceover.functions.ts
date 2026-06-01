import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ELEVEN_BASE = "https://api.elevenlabs.io";

function requireKey() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY is not configured");
  return k;
}

export type VoiceOption = {
  voice_id: string;
  name: string;
  category: string;
  preview_url: string | null;
};

export const listVoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ voices: VoiceOption[] }> => {
    const apiKey = requireKey();
    const res = await fetch(`${ELEVEN_BASE}/v1/voices`, {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) {
      throw new Error(`Failed to load voices (${res.status})`);
    }
    const json = (await res.json()) as {
      voices: Array<{
        voice_id: string;
        name: string;
        category?: string;
        preview_url?: string | null;
      }>;
    };
    return {
      voices: (json.voices ?? []).map((v) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category ?? "premade",
        preview_url: v.preview_url ?? null,
      })),
    };
  });

export const generateVoiceover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sceneId: string; regenerate?: boolean }) =>
    z.object({ sceneId: z.string().uuid(), regenerate: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = requireKey();

    // Load scene + project (RLS scoped to user)
    const sceneRes = await supabase
      .from("scenes")
      .select("id, project_id, script_text")
      .eq("id", data.sceneId)
      .single();
    if (sceneRes.error || !sceneRes.data) throw new Error("Scene not found");
    const scene = sceneRes.data as { id: string; project_id: string; script_text: string };

    const projRes = await supabase
      .from("projects")
      .select("id, elevenlabs_voice_id, elevenlabs_voice_name")
      .eq("id", scene.project_id)
      .single();
    if (projRes.error || !projRes.data) throw new Error("Project not found");
    const project = projRes.data as {
      id: string;
      elevenlabs_voice_id: string | null;
      elevenlabs_voice_name: string | null;
    };
    if (!project.elevenlabs_voice_id) throw new Error("No voice selected for this project");

    // Cache check
    if (!data.regenerate) {
      const existing = await supabase
        .from("voiceovers")
        .select("id, audio_url, status")
        .eq("scene_id", scene.id)
        .maybeSingle();
      if (existing.data && existing.data.status === "complete") {
        return { cached: true, voiceover: existing.data };
      }
    } else {
      // Delete old storage file + row
      const oldPath = `voiceovers/${scene.project_id}/${scene.id}.mp3`;
      await supabaseAdmin.storage.from("docforge-assets").remove([oldPath]);
      await supabase.from("voiceovers").delete().eq("scene_id", scene.id);
    }

    // Call ElevenLabs with timestamps
    const ttsRes = await fetch(
      `${ELEVEN_BASE}/v1/text-to-speech/${project.elevenlabs_voice_id}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          text: scene.script_text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
    );
    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      throw new Error(`ElevenLabs error ${ttsRes.status}: ${errText.slice(0, 200)}`);
    }
    const ttsJson = (await ttsRes.json()) as {
      audio_base64: string;
      alignment?: {
        characters?: string[];
        character_start_times_seconds?: number[];
        character_end_times_seconds?: number[];
      };
      normalized_alignment?: unknown;
    };

    const audioBytes = Buffer.from(ttsJson.audio_base64, "base64");

    // Compute duration from alignment end times (fall back to estimate)
    const endTimes = ttsJson.alignment?.character_end_times_seconds ?? [];
    const duration =
      endTimes.length > 0
        ? Number(endTimes[endTimes.length - 1])
        : Math.round((scene.script_text.split(/\s+/).filter(Boolean).length / 150) * 60);

    // Build word-level timestamps from character alignment
    const wordTimestamps = buildWordTimestamps(
      ttsJson.alignment?.characters ?? [],
      ttsJson.alignment?.character_start_times_seconds ?? [],
      ttsJson.alignment?.character_end_times_seconds ?? [],
    );
    const wordCount =
      wordTimestamps.length || scene.script_text.split(/\s+/).filter(Boolean).length;
    const wpm = duration > 0 ? (wordCount / duration) * 60 : 0;

    // Upload audio to storage (admin client to bypass any storage RLS quirks)
    const path = `voiceovers/${scene.project_id}/${scene.id}.mp3`;
    const upload = await supabaseAdmin.storage.from("docforge-assets").upload(path, audioBytes, {
      contentType: "audio/mpeg",
      upsert: true,
    });
    if (upload.error) throw new Error(`Upload failed: ${upload.error.message}`);

    const { data: pub } = supabaseAdmin.storage.from("docforge-assets").getPublicUrl(path);
    const audioUrl = pub.publicUrl;

    // Upsert voiceover row
    const upsert = await supabase
      .from("voiceovers")
      .upsert(
        {
          scene_id: scene.id,
          project_id: scene.project_id,
          user_id: userId,
          voice_id: project.elevenlabs_voice_id,
          voice_name: project.elevenlabs_voice_name,
          audio_url: audioUrl,
          duration_seconds: duration,
          word_count: wordCount,
          words_per_minute: wpm,
          word_timestamps: wordTimestamps,
          status: "complete",
        },
        { onConflict: "scene_id" },
      )
      .select("*")
      .single();
    if (upsert.error) throw new Error(upsert.error.message);

    return { cached: false, voiceover: upsert.data };
  });

export const saveProjectVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; voiceId: string; voiceName: string }) =>
    z
      .object({
        projectId: z.string().uuid(),
        voiceId: z.string().min(1),
        voiceName: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("projects")
      .update({
        elevenlabs_voice_id: data.voiceId,
        elevenlabs_voice_name: data.voiceName,
      })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function buildWordTimestamps(
  chars: string[],
  starts: number[],
  ends: number[],
): Array<{ word: string; start: number; end: number }> {
  if (chars.length === 0) return [];
  const result: Array<{ word: string; start: number; end: number }> = [];
  let buf = "";
  let wordStart = 0;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const isSpace = /\s/.test(c);
    if (!isSpace) {
      if (buf === "") wordStart = starts[i] ?? 0;
      buf += c;
    }
    if ((isSpace || i === chars.length - 1) && buf.length > 0) {
      const endIdx = isSpace ? i - 1 : i;
      result.push({
        word: buf,
        start: wordStart,
        end: ends[endIdx] ?? starts[endIdx] ?? wordStart,
      });
      buf = "";
    }
  }
  return result;
}
