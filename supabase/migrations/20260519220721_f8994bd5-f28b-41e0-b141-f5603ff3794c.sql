
CREATE TABLE IF NOT EXISTS public.captions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  scene_id uuid NOT NULL,
  voiceover_id uuid,
  words jsonb NOT NULL DEFAULT '[]'::jsonb,
  caption_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  style_preset text NOT NULL DEFAULT 'documentary',
  custom_styles jsonb,
  srt_content text,
  vtt_content text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scene_id)
);

CREATE INDEX IF NOT EXISTS captions_project_id_idx ON public.captions(project_id);
CREATE INDEX IF NOT EXISTS captions_scene_id_idx ON public.captions(scene_id);

ALTER TABLE public.captions ENABLE ROW LEVEL SECURITY;

CREATE POLICY captions_select_own ON public.captions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY captions_insert_own ON public.captions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY captions_update_own ON public.captions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY captions_delete_own ON public.captions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER captions_set_updated_at
  BEFORE UPDATE ON public.captions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
