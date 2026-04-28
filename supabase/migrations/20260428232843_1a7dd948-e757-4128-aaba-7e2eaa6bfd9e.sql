-- Defense-in-depth: explicitly deny writes on user_roles to authenticated role.
-- Only service_role (edge functions) can manage roles.
CREATE POLICY "Deny insert user_roles to authenticated"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny update user_roles to authenticated"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny delete user_roles to authenticated"
  ON public.user_roles FOR DELETE TO authenticated
  USING (false);

-- Receipts bucket: allow owner to update their own files (was missing).
CREATE POLICY "Owners update own receipts"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'receipts' AND auth.uid() = owner);