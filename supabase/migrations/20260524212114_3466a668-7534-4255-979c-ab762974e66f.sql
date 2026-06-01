
CREATE TABLE IF NOT EXISTS public.client_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  client_email text,
  client_name text,
  share_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  overall_comment text,
  viewed_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_reviews_select_own ON public.client_reviews
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY client_reviews_insert_own ON public.client_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY client_reviews_update_own ON public.client_reviews
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY client_reviews_delete_own ON public.client_reviews
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER client_reviews_set_updated_at
  BEFORE UPDATE ON public.client_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS client_reviews_project_idx ON public.client_reviews(project_id);
CREATE INDEX IF NOT EXISTS client_reviews_token_idx ON public.client_reviews(share_token);

CREATE TABLE IF NOT EXISTS public.client_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  review_id uuid NOT NULL,
  project_id uuid NOT NULL,
  scene_id uuid,
  comment_type text NOT NULL DEFAULT 'general',
  comment_text text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_comments_select_own ON public.client_comments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY client_comments_insert_own ON public.client_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY client_comments_update_own ON public.client_comments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY client_comments_delete_own ON public.client_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS client_comments_review_idx ON public.client_comments(review_id);
CREATE INDEX IF NOT EXISTS client_comments_project_idx ON public.client_comments(project_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.client_reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_comments;
ALTER TABLE public.client_reviews REPLICA IDENTITY FULL;
ALTER TABLE public.client_comments REPLICA IDENTITY FULL;
