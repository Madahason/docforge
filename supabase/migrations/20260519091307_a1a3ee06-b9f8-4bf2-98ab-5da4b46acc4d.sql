-- hera_cache table
CREATE TABLE public.hera_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text text NOT NULL,
  prompt_hash text UNIQUE NOT NULL,
  output_url text NOT NULL,
  thumbnail_url text,
  duration_seconds integer NOT NULL DEFAULT 6,
  resolution text NOT NULL DEFAULT '1080p',
  visual_job text,
  emotional_temperature text,
  mood_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  color_temperature text,
  subject text,
  camera_motion text,
  style_profile_name text,
  editing_style text,
  match_keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  projects_used_in jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_rating integer,
  regeneration_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hera_cache_prompt_hash ON public.hera_cache(prompt_hash);
CREATE INDEX idx_hera_cache_visual_job ON public.hera_cache(visual_job);
CREATE INDEX idx_hera_cache_emotional_temperature ON public.hera_cache(emotional_temperature);
CREATE INDEX idx_hera_cache_usage_count ON public.hera_cache(usage_count DESC);
CREATE INDEX idx_hera_cache_match_keywords ON public.hera_cache USING GIN (match_keywords);
CREATE INDEX idx_hera_cache_mood_tags ON public.hera_cache USING GIN (mood_tags);

ALTER TABLE public.hera_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY hera_cache_select_visible ON public.hera_cache
  FOR SELECT USING (auth.uid() IS NOT NULL AND (is_shared = true OR created_by = auth.uid()));

CREATE POLICY hera_cache_insert_own ON public.hera_cache
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY hera_cache_update_own ON public.hera_cache
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY hera_cache_delete_own ON public.hera_cache
  FOR DELETE USING (auth.uid() = created_by);

CREATE TRIGGER hera_cache_set_updated_at
  BEFORE UPDATE ON public.hera_cache
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- motion_graphics: add missing prompt column (hera_cache_id and hera_output_url already exist)
ALTER TABLE public.motion_graphics
  ADD COLUMN IF NOT EXISTS hera_prompt_used text;
