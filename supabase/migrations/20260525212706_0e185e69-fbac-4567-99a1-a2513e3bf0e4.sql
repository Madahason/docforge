-- sound_style_profiles
CREATE TABLE public.sound_style_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  aesthetic text,
  ambient_character text,
  punctuation_character text,
  transition_character text,
  avoid_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  volume_hierarchy jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_moments jsonb NOT NULL DEFAULT '[]'::jsonb,
  editing_style text,
  content_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE public.sound_style_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY sound_style_profiles_select_own ON public.sound_style_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sound_style_profiles_insert_own ON public.sound_style_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY sound_style_profiles_update_own ON public.sound_style_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY sound_style_profiles_delete_own ON public.sound_style_profiles
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER sound_style_profiles_set_updated_at
  BEFORE UPDATE ON public.sound_style_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- scene_sounds
CREATE TABLE public.scene_sounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  scene_id uuid NOT NULL,
  user_id uuid NOT NULL,

  ambient_description text,
  ambient_search_terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  ambient_file_url text,
  ambient_volume integer NOT NULL DEFAULT 12,
  ambient_timing text NOT NULL DEFAULT 'full_scene',
  ambient_status text NOT NULL DEFAULT 'pending',
  ambient_enabled boolean NOT NULL DEFAULT true,

  punctuation_needed boolean NOT NULL DEFAULT false,
  punctuation_trigger text,
  punctuation_description text,
  punctuation_file_url text,
  punctuation_volume integer NOT NULL DEFAULT 35,
  punctuation_timestamp numeric,
  punctuation_status text NOT NULL DEFAULT 'pending',
  punctuation_enabled boolean NOT NULL DEFAULT true,

  transition_type text,
  transition_description text,
  transition_file_url text,
  transition_volume integer NOT NULL DEFAULT 20,
  transition_starts_before_end_seconds numeric NOT NULL DEFAULT 1.0,
  transition_status text NOT NULL DEFAULT 'pending',
  transition_enabled boolean NOT NULL DEFAULT true,

  sound_reasoning text,
  sync_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  volume_curves jsonb NOT NULL DEFAULT '[]'::jsonb,

  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scene_id)
);

ALTER TABLE public.scene_sounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY scene_sounds_select_own ON public.scene_sounds
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY scene_sounds_insert_own ON public.scene_sounds
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY scene_sounds_update_own ON public.scene_sounds
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY scene_sounds_delete_own ON public.scene_sounds
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER scene_sounds_set_updated_at
  BEFORE UPDATE ON public.scene_sounds
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX scene_sounds_project_id_idx ON public.scene_sounds(project_id);
CREATE INDEX scene_sounds_scene_id_idx ON public.scene_sounds(scene_id);

-- scenes column
ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS sound_status text NOT NULL DEFAULT 'pending';

-- manifests column
ALTER TABLE public.manifests
  ADD COLUMN IF NOT EXISTS sound_design_included boolean NOT NULL DEFAULT false;