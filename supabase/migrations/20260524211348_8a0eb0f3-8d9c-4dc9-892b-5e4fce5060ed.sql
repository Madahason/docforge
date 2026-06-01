
-- Extend motion_graphics with Remotion render output tracking
ALTER TABLE public.motion_graphics
  ADD COLUMN IF NOT EXISTS remotion_output_url text,
  ADD COLUMN IF NOT EXISTS remotion_render_job_id uuid;

-- Render jobs table
CREATE TABLE IF NOT EXISTS public.render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  scene_id uuid NOT NULL,
  motion_graphic_id uuid,
  render_method text NOT NULL DEFAULT 'remotion',
  graphic_type text,
  graphic_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_seconds integer NOT NULL DEFAULT 6,
  status text NOT NULL DEFAULT 'pending',
  progress_percent integer NOT NULL DEFAULT 0,
  output_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY render_jobs_select_own ON public.render_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY render_jobs_insert_own ON public.render_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY render_jobs_update_own ON public.render_jobs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY render_jobs_delete_own ON public.render_jobs
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER render_jobs_set_updated_at
  BEFORE UPDATE ON public.render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS render_jobs_project_idx ON public.render_jobs(project_id);
CREATE INDEX IF NOT EXISTS render_jobs_scene_idx ON public.render_jobs(scene_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.render_jobs;
ALTER TABLE public.render_jobs REPLICA IDENTITY FULL;
