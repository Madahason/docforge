
-- scene_graphics table
CREATE TABLE public.scene_graphics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  scene_id uuid NOT NULL,
  graphic_category text NOT NULL CHECK (graphic_category IN ('text_overlay','data_graphic')),
  overlay_text text,
  overlay_style text,
  animation_style text,
  position text,
  text_color text,
  start_seconds numeric NOT NULL DEFAULT 0.5,
  duration_seconds numeric NOT NULL DEFAULT 2.5,
  graphic_type text,
  graphic_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  render_method text NOT NULL DEFAULT 'remotion',
  hera_output_url text,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scene_graphics_scene ON public.scene_graphics(scene_id);
CREATE INDEX idx_scene_graphics_project ON public.scene_graphics(project_id);

ALTER TABLE public.scene_graphics ENABLE ROW LEVEL SECURITY;

CREATE POLICY scene_graphics_select_own ON public.scene_graphics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY scene_graphics_insert_own ON public.scene_graphics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY scene_graphics_update_own ON public.scene_graphics
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY scene_graphics_delete_own ON public.scene_graphics
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER scene_graphics_set_updated_at
  BEFORE UPDATE ON public.scene_graphics
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- scenes.graphics_status
ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS graphics_status text NOT NULL DEFAULT 'pending'
  CHECK (graphics_status IN ('pending','partial','complete','not_required'));
