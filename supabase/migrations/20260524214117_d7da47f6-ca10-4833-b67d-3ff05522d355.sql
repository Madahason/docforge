
-- Ensure RLS enabled and full replica identity
ALTER TABLE public.client_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_reviews REPLICA IDENTITY FULL;
ALTER TABLE public.client_comments REPLICA IDENTITY FULL;

-- Public anon access for client review flow
DROP POLICY IF EXISTS "Public can read review by token" ON public.client_reviews;
CREATE POLICY "Public can read review by token"
  ON public.client_reviews
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Public can update review status" ON public.client_reviews;
CREATE POLICY "Public can update review status"
  ON public.client_reviews
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read comments" ON public.client_comments;
CREATE POLICY "Public can read comments"
  ON public.client_comments
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Public can insert comments" ON public.client_comments;
CREATE POLICY "Public can insert comments"
  ON public.client_comments
  FOR INSERT
  TO anon
  WITH CHECK (true);
