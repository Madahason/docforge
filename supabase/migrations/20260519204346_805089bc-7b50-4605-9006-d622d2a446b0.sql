
-- motion_graphics: overlay / standalone mode fields
ALTER TABLE public.motion_graphics
  ADD COLUMN IF NOT EXISTS hera_mode text NOT NULL DEFAULT 'standalone',
  ADD COLUMN IF NOT EXISTS overlay_style text,
  ADD COLUMN IF NOT EXISTS overlay_position text,
  ADD COLUMN IF NOT EXISTS overlay_timing jsonb,
  ADD COLUMN IF NOT EXISTS overlay_base_asset_id uuid REFERENCES public.clips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overlay_dim_base boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS overlay_dim_opacity numeric NOT NULL DEFAULT 0.4,
  ADD COLUMN IF NOT EXISTS hera_video_id text,
  ADD COLUMN IF NOT EXISTS hera_project_url text;

ALTER TABLE public.motion_graphics
  DROP CONSTRAINT IF EXISTS motion_graphics_hera_mode_check;
ALTER TABLE public.motion_graphics
  ADD CONSTRAINT motion_graphics_hera_mode_check
  CHECK (hera_mode IN ('standalone','overlay'));

ALTER TABLE public.motion_graphics
  DROP CONSTRAINT IF EXISTS motion_graphics_overlay_style_check;
ALTER TABLE public.motion_graphics
  ADD CONSTRAINT motion_graphics_overlay_style_check
  CHECK (overlay_style IS NULL OR overlay_style IN ('lower_third','center_reveal','corner_insert','full_frame'));

ALTER TABLE public.motion_graphics
  DROP CONSTRAINT IF EXISTS motion_graphics_overlay_position_check;
ALTER TABLE public.motion_graphics
  ADD CONSTRAINT motion_graphics_overlay_position_check
  CHECK (overlay_position IS NULL OR overlay_position IN ('bottom','center','top_left','top_right','bottom_left','bottom_right'));

-- clips: overlay metadata
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS hera_mode text NOT NULL DEFAULT 'standalone',
  ADD COLUMN IF NOT EXISTS overlay_config jsonb,
  ADD COLUMN IF NOT EXISTS has_overlay boolean NOT NULL DEFAULT false;

ALTER TABLE public.clips
  DROP CONSTRAINT IF EXISTS clips_hera_mode_check;
ALTER TABLE public.clips
  ADD CONSTRAINT clips_hera_mode_check
  CHECK (hera_mode IN ('standalone','overlay'));

-- hera_cache: mode-aware library matching
ALTER TABLE public.hera_cache
  ADD COLUMN IF NOT EXISTS graphic_type text,
  ADD COLUMN IF NOT EXISTS hera_mode text NOT NULL DEFAULT 'standalone',
  ADD COLUMN IF NOT EXISTS overlay_style text;

ALTER TABLE public.hera_cache
  DROP CONSTRAINT IF EXISTS hera_cache_hera_mode_check;
ALTER TABLE public.hera_cache
  ADD CONSTRAINT hera_cache_hera_mode_check
  CHECK (hera_mode IN ('standalone','overlay'));

ALTER TABLE public.hera_cache
  DROP CONSTRAINT IF EXISTS hera_cache_overlay_style_check;
ALTER TABLE public.hera_cache
  ADD CONSTRAINT hera_cache_overlay_style_check
  CHECK (overlay_style IS NULL OR overlay_style IN ('lower_third','center_reveal','corner_insert','full_frame'));

CREATE INDEX IF NOT EXISTS idx_hera_cache_mode_type
  ON public.hera_cache (hera_mode, graphic_type, overlay_style);
