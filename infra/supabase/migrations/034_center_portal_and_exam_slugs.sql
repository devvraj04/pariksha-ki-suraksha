-- Migration: 034_center_portal_and_exam_slugs.sql
-- Add globally unique slug column to exam_centers
ALTER TABLE exam_centers ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Populate slugs for existing exam_centers safely using lower(name) + id
UPDATE exam_centers 
SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') || '-' || substring(id::text from 1 for 8)
WHERE slug IS NULL;

-- Make slug column NOT NULL after populating
ALTER TABLE exam_centers ALTER COLUMN slug SET NOT NULL;

-- Add center_id column to agency_staff referencing exam_centers(id)
ALTER TABLE agency_staff ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES exam_centers(id) ON DELETE SET NULL;

-- Enable public select policies or ensure RLS allows reading center detail by slug
-- Note: We already have policy "Allow public read access to active exam centers".
-- Let's add policy for center staff to read/update center profiles and operations.
CREATE POLICY "Allow assigned center staff to manage their center"
    ON exam_centers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agency_staff AS s
            WHERE s.user_id = auth.uid() AND s.center_id = exam_centers.id AND s.is_active = true
        )
    );
