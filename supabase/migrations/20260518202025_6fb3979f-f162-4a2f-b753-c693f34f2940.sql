
ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS word_count integer,
  ADD COLUMN IF NOT EXISTS pacing_instruction text,
  ADD COLUMN IF NOT EXISTS text_overlay_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS text_overlay_suggestion text,
  ADD COLUMN IF NOT EXISTS data_graphic_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_graphic_detail text,
  ADD COLUMN IF NOT EXISTS clip_brief jsonb,
  ADD COLUMN IF NOT EXISTS youtube_source_priority jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS script_parsed boolean NOT NULL DEFAULT false;
