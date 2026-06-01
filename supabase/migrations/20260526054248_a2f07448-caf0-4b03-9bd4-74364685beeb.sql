ALTER TABLE public.sound_style_profiles
  ADD COLUMN IF NOT EXISTS narrative_arc jsonb,
  ADD COLUMN IF NOT EXISTS tension_drone_url text,
  ADD COLUMN IF NOT EXISTS tension_drone_generated boolean NOT NULL DEFAULT false;

ALTER TABLE public.scene_sounds
  ADD COLUMN IF NOT EXISTS ducking_curve jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS narrative_ambient_volume integer,
  ADD COLUMN IF NOT EXISTS narrative_tension_volume integer,
  ADD COLUMN IF NOT EXISTS silence_scene boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS silence_start_offset numeric,
  ADD COLUMN IF NOT EXISTS impact_sound_url text,
  ADD COLUMN IF NOT EXISTS impact_at_seconds numeric;