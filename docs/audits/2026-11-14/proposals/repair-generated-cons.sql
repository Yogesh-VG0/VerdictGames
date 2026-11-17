-- REVIEW PROPOSAL ONLY. Not an executable migration; not applied to production.
-- Export the matching id/slug/cons rows privately before approval. This removes
-- an unsupported generated assertion, not Early Access metadata or editorial text.
BEGIN;
UPDATE public.games
SET cons = array_remove(cons, 'Still in Early Access — content may be incomplete')
WHERE 'Still in Early Access — content may be incomplete' = ANY(cons);
-- Compare affected count and resulting arrays with reviewed preview. COMMIT only
-- during the explicitly approved repair; default review leaves it rolled back.
ROLLBACK;
