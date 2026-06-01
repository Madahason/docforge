
CREATE TABLE public.motion_graphics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  scene_id uuid NOT NULL,
  graphic_type text NOT NULL,
  graphic_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  render_method text NOT NULL DEFAULT 'remotion',
  hera_output_url text,
  hera_cache_id uuid,
  status text NOT NULL DEFAULT 'configured',
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX motion_graphics_scene_unique ON public.motion_graphics(scene_id);
CREATE INDEX motion_graphics_project_idx ON public.motion_graphics(project_id);

ALTER TABLE public.motion_graphics ENABLE ROW LEVEL SECURITY;

CREATE POLICY motion_graphics_select_own ON public.motion_graphics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY motion_graphics_insert_own ON public.motion_graphics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY motion_graphics_update_own ON public.motion_graphics
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY motion_graphics_delete_own ON public.motion_graphics
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER motion_graphics_set_updated_at
BEFORE UPDATE ON public.motion_graphics
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
