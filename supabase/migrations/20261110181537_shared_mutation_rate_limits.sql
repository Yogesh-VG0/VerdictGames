CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket text PRIMARY KEY CHECK (length(bucket) <= 100),
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_rate_limits TO service_role;
CREATE INDEX IF NOT EXISTS api_rate_limits_expiry ON public.api_rate_limits (reset_at);

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(p_bucket text, p_limit integer, p_window integer)
RETURNS TABLE (allowed boolean, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE current_count integer; expires timestamptz;
BEGIN
  IF p_limit < 1 OR p_limit > 1000 OR p_window < 1 OR p_window > 3600 THEN
    RAISE EXCEPTION 'Invalid rate limit';
  END IF;
  IF random() < 0.01 THEN DELETE FROM public.api_rate_limits r WHERE r.reset_at <= now(); END IF;
  INSERT INTO public.api_rate_limits AS r (bucket, count, reset_at)
    VALUES (p_bucket, 1, now() + make_interval(secs => p_window))
    ON CONFLICT (bucket) DO UPDATE SET
      count = CASE WHEN r.reset_at <= now() THEN 1 ELSE r.count + 1 END,
      reset_at = CASE WHEN r.reset_at <= now() THEN now() + make_interval(secs => p_window) ELSE r.reset_at END
    RETURNING r.count, r.reset_at INTO current_count, expires;
  RETURN QUERY SELECT current_count <= p_limit, greatest(0, p_limit - current_count), expires;
END $$;
REVOKE ALL ON FUNCTION public.consume_api_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text, integer, integer) TO service_role;
