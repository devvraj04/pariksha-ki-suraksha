-- Create answer_sheet_visibility_scores table
CREATE TABLE IF NOT EXISTS answer_sheet_visibility_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID NOT NULL REFERENCES answer_sheet_uploads(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    visibility_score NUMERIC(4,2) NOT NULL,
    issues_detected JSONB NULL,
    scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    model_version TEXT NOT NULL
);

-- Enable Row Level Security
ALTER TABLE answer_sheet_visibility_scores ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow agency staff of the owning agency to view visibility scores
CREATE POLICY "Allow agency staff to read visibility scores"
    ON answer_sheet_visibility_scores
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM answer_sheet_uploads AS u
            JOIN exams AS e ON e.id = u.exam_id
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE u.id = answer_sheet_visibility_scores.upload_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );
