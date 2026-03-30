-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 020: Editorial Reviews (Admin Reviews)
-- ══════════════════════════════════════════════════════════════════════════════
-- Adds editorial_reviews table for admin/editor reviews that are shown prominently
-- on game pages. These are curated, high-quality reviews written by site editors.

CREATE TABLE IF NOT EXISTS editorial_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Review content
  title TEXT, -- Optional headline for the review
  content TEXT NOT NULL, -- Main review body (supports markdown)
  score INTEGER CHECK (score >= 0 AND score <= 100), -- Optional score override
  verdict_label TEXT, -- Optional verdict override (MUST PLAY, WORTH IT, etc.)
  
  -- Pros and cons for this specific review
  pros TEXT[] DEFAULT '{}',
  cons TEXT[] DEFAULT '{}',
  
  -- Metadata
  playtime_hours DECIMAL(6,1), -- How many hours the reviewer played
  platform_played TEXT, -- Which platform they played on
  version_reviewed TEXT, -- Game version at time of review
  
  -- Status
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false, -- Featured review shown first
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ,
  
  -- Ensure one review per game per author
  UNIQUE(game_id, author_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'editorial_reviews_game_id_author_id_key'
      AND conrelid = 'editorial_reviews'::regclass
  ) THEN
    ALTER TABLE editorial_reviews
      ADD CONSTRAINT editorial_reviews_game_id_author_id_key UNIQUE (game_id, author_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_editorial_reviews_game_id ON editorial_reviews(game_id);
CREATE INDEX IF NOT EXISTS idx_editorial_reviews_author_id ON editorial_reviews(author_id);
CREATE INDEX IF NOT EXISTS idx_editorial_reviews_published ON editorial_reviews(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_editorial_reviews_featured ON editorial_reviews(is_featured, published_at DESC);

-- RLS policies
ALTER TABLE editorial_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read published editorial reviews
DROP POLICY IF EXISTS "Public can read published editorial reviews" ON editorial_reviews;
CREATE POLICY "Public can read published editorial reviews"
  ON editorial_reviews FOR SELECT
  USING (is_published = true);

-- Admins can do everything
DROP POLICY IF EXISTS "Admins can manage editorial reviews" ON editorial_reviews;
CREATE POLICY "Admins can manage editorial reviews"
  ON editorial_reviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_editorial_review_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  -- Set published_at when first published
  IF NEW.is_published = true AND OLD.is_published = false THEN
    NEW.published_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS editorial_reviews_updated_at ON editorial_reviews;
CREATE TRIGGER editorial_reviews_updated_at
  BEFORE UPDATE ON editorial_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_editorial_review_timestamp();

-- Grant permissions
GRANT SELECT ON editorial_reviews TO anon;
GRANT SELECT ON editorial_reviews TO authenticated;
GRANT ALL ON editorial_reviews TO service_role;
