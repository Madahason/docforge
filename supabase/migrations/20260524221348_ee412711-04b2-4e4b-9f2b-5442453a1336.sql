ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS walkthrough_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS walkthrough_step integer NOT NULL DEFAULT 0;