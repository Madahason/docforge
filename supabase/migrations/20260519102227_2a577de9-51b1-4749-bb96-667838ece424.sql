ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS auto_generate_visuals boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_generation_complete boolean NOT NULL DEFAULT false;

ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS clip_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS clip_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS image_url text;

-- Backfill: any scene that already has a clip is considered sourced
UPDATE public.scenes s
SET clip_status = 'sourced'
WHERE EXISTS (
  SELECT 1 FROM public.clips c WHERE c.scene_id = s.id
)
AND s.clip_status = 'pending';

-- Mark existing clips as sourced
UPDATE public.clips SET clip_status = 'sourced' WHERE clip_status = 'pending';