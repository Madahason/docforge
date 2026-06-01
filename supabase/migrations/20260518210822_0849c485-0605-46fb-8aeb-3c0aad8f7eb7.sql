-- search_cache: 7-day cache for external search queries (YouTube/Pexels)
CREATE TABLE public.search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_string text NOT NULL,
  results jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
CREATE INDEX idx_search_cache_query ON public.search_cache(query_string);
CREATE INDEX idx_search_cache_expires ON public.search_cache(expires_at);

ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;
-- Cache is global (shared across users) — anyone authenticated can read/write
CREATE POLICY "search_cache_select_any" ON public.search_cache FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "search_cache_insert_any" ON public.search_cache FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "search_cache_delete_any" ON public.search_cache FOR DELETE USING (auth.uid() IS NOT NULL);

-- Expand clips table with rich sourcing metadata
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS asset_type text NOT NULL DEFAULT 'youtube',
  ADD COLUMN IF NOT EXISTS source_channel text,
  ADD COLUMN IF NOT EXISTS source_title text,
  ADD COLUMN IF NOT EXISTS source_video_id text,
  ADD COLUMN IF NOT EXISTS timestamp_start text,
  ADD COLUMN IF NOT EXISTS timestamp_end text,
  ADD COLUMN IF NOT EXISTS resolution text,
  ADD COLUMN IF NOT EXISTS visual_job text,
  ADD COLUMN IF NOT EXISTS mood_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS color_temperature text,
  ADD COLUMN IF NOT EXISTS rights_risk text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS local_file_path text,
  ADD COLUMN IF NOT EXISTS fetch_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS ken_burns_config jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clips_scene ON public.clips(scene_id);

-- clip_index: user-scoped library of previously confirmed clips for cross-project reuse
CREATE TABLE public.clip_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_url text,
  source_channel text,
  source_title text,
  source_video_id text,
  timestamp_start text,
  timestamp_end text,
  duration_seconds integer,
  thumbnail_url text,
  visual_job text,
  mood_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  color_temperature text,
  rights_risk text NOT NULL DEFAULT 'low',
  verified boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  quality_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clip_index_user ON public.clip_index(user_id);
CREATE INDEX idx_clip_index_visual_job ON public.clip_index(user_id, visual_job);

ALTER TABLE public.clip_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clip_index_select_own" ON public.clip_index FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "clip_index_insert_own" ON public.clip_index FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clip_index_update_own" ON public.clip_index FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "clip_index_delete_own" ON public.clip_index FOR DELETE USING (auth.uid() = user_id);