-- Tighten error_logs insert: authenticated only, must match self
DROP POLICY IF EXISTS "error_logs_insert_self" ON public.error_logs;
CREATE POLICY "error_logs_insert_self"
ON public.error_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Lock down has_role execution
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;