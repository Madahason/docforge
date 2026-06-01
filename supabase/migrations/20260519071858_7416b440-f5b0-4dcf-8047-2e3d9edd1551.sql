ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS recommended_asset_type text NOT NULL DEFAULT 'ai_image_ken_burns',
  ADD COLUMN IF NOT EXISTS motion_graphic_type text,
  ADD COLUMN IF NOT EXISTS motion_graphic_data jsonb,
  ADD COLUMN IF NOT EXISTS is_real_footage_scene boolean NOT NULL DEFAULT false;