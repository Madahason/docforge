
-- Extend projects table for project-level voice
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS elevenlabs_voice_id text,
  ADD COLUMN IF NOT EXISTS elevenlabs_voice_name text;

-- Extend voiceovers table with timing + metadata
ALTER TABLE public.voiceovers
  ADD COLUMN IF NOT EXISTS voice_name text,
  ADD COLUMN IF NOT EXISTS word_count integer,
  ADD COLUMN IF NOT EXISTS words_per_minute numeric,
  ADD COLUMN IF NOT EXISTS word_timestamps jsonb;

-- Change duration_seconds to numeric to support fractional seconds
ALTER TABLE public.voiceovers
  ALTER COLUMN duration_seconds TYPE numeric USING duration_seconds::numeric;

-- Unique voiceover per scene (one voiceover record per scene)
CREATE UNIQUE INDEX IF NOT EXISTS voiceovers_scene_id_unique ON public.voiceovers(scene_id);

-- Storage bucket for audio assets (public read for playback)
INSERT INTO storage.buckets (id, name, public)
VALUES ('docforge-assets', 'docforge-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read for bucket
DROP POLICY IF EXISTS "docforge_assets_public_read" ON storage.objects;
CREATE POLICY "docforge_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'docforge-assets');

-- Authenticated users can upload to their own folder (path: voiceovers/{project_id}/{scene_id}.mp3)
DROP POLICY IF EXISTS "docforge_assets_authenticated_write" ON storage.objects;
CREATE POLICY "docforge_assets_authenticated_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'docforge-assets');

DROP POLICY IF EXISTS "docforge_assets_authenticated_update" ON storage.objects;
CREATE POLICY "docforge_assets_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'docforge-assets');

DROP POLICY IF EXISTS "docforge_assets_authenticated_delete" ON storage.objects;
CREATE POLICY "docforge_assets_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'docforge-assets');
