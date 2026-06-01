CREATE TABLE public.image_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  scene_id uuid NOT NULL,
  source_type text NOT NULL,
  prompt_used text,
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_url text,
  ken_burns_config jsonb,
  animation_type text,
  animation_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX image_assets_scene_idx ON public.image_assets(scene_id, source_type);

ALTER TABLE public.image_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY image_assets_select_own ON public.image_assets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY image_assets_insert_own ON public.image_assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY image_assets_update_own ON public.image_assets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY image_assets_delete_own ON public.image_assets
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER image_assets_set_updated_at
  BEFORE UPDATE ON public.image_assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS animation_type text,
  ADD COLUMN IF NOT EXISTS animation_url text;