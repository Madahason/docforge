-- 1. Storage: scope writes to per-user folder, keep public read
DROP POLICY IF EXISTS docforge_assets_authenticated_write ON storage.objects;
DROP POLICY IF EXISTS docforge_assets_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS docforge_assets_authenticated_delete ON storage.objects;

CREATE POLICY "docforge_assets_user_read_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'docforge-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "docforge_assets_user_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'docforge-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "docforge_assets_user_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'docforge-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "docforge_assets_user_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'docforge-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Anonymous viewers can read the renders/ folder (share links)
CREATE POLICY "docforge_assets_public_read_renders"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'docforge-assets'
  AND (storage.foldername(name))[1] = 'renders'
);

-- 2. Roles (separate table; never store role on profiles)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 3. error_logs table
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message text,
  error_stack text,
  page_url text,
  component text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON public.error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_user_id_idx ON public.error_logs (user_id);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "error_logs_insert_self" ON public.error_logs;
CREATE POLICY "error_logs_insert_self"
ON public.error_logs FOR INSERT TO authenticated, anon
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "error_logs_select_own" ON public.error_logs;
CREATE POLICY "error_logs_select_own"
ON public.error_logs FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "error_logs_select_admin" ON public.error_logs;
CREATE POLICY "error_logs_select_admin"
ON public.error_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Beta usage tracking on profiles (track only, not enforced)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'beta',
  ADD COLUMN IF NOT EXISTS projects_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_voiceover_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_renders integer NOT NULL DEFAULT 0;

-- Admins can read all profiles for the /admin dashboard
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can read all feedback for the /admin dashboard
DROP POLICY IF EXISTS "feedback_select_admin" ON public.feedback;
CREATE POLICY "feedback_select_admin"
ON public.feedback FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));