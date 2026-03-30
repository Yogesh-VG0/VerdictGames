CREATE OR REPLACE FUNCTION public.sync_review_helpful_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  _review_id UUID;
  _helpful INTEGER;
BEGIN
  _review_id := COALESCE(NEW.review_id, OLD.review_id);
  SELECT COUNT(*)::INTEGER INTO _helpful
  FROM public.review_votes
  WHERE review_id = _review_id
    AND value = 1;
  UPDATE public.reviews
  SET helpful = _helpful
  WHERE id = _review_id;
  RETURN NULL;
END;
$$;

UPDATE public.reviews AS r
SET helpful = (
  SELECT COUNT(*)::INTEGER
  FROM public.review_votes AS rv
  WHERE rv.review_id = r.id
    AND rv.value = 1
);
