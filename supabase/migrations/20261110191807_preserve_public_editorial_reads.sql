-- Anonymous readers never need to evaluate the administrator helper.
ALTER POLICY "Public can read published editorial reviews" ON public.editorial_reviews
  TO anon, authenticated USING (is_published = true);
CREATE POLICY "Admins can read unpublished editorial reviews" ON public.editorial_reviews
  FOR SELECT TO authenticated USING ((SELECT public.is_admin_user()));
