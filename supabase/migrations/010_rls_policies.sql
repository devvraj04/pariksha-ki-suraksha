-- Helper function to resolve the requesting user's role from their user profile
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role_enum AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_center_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE watermark_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transit_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE transit_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE transit_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE admit_card_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_receptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE omr_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE omr_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. user_profiles Policies
CREATE POLICY user_profiles_admin ON user_profiles FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY user_profiles_select_own ON user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 2. exams Policies
CREATE POLICY exams_admin ON exams FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY exams_select ON exams FOR SELECT TO authenticated
  USING (true);

-- 3. exam_centers Policies
CREATE POLICY exam_centers_admin ON exam_centers FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY exam_centers_select ON exam_centers FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('print_operator', 'driver', 'supervisor'));

-- 4. papers Policies
CREATE POLICY papers_admin ON papers FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY papers_print_operator ON papers FOR SELECT TO authenticated
  USING (public.get_user_role() = 'print_operator' AND EXISTS (
    SELECT 1 FROM public.print_sessions ps 
    WHERE ps.paper_id = papers.id AND ps.is_active = TRUE AND ps.expires_at > NOW()
  ));

-- 5. key_shares Policies
CREATE POLICY key_shares_admin_select ON key_shares FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY key_shares_admin_delete ON key_shares FOR DELETE TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY key_shares_authority ON key_shares FOR SELECT TO authenticated
  USING (public.get_user_role()::text = authority_role);

-- 6. print_sessions Policies
CREATE POLICY print_sessions_admin ON print_sessions FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY print_sessions_authority_insert ON print_sessions FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('authority_a', 'authority_b'));

CREATE POLICY print_sessions_operator_select ON print_sessions FOR SELECT TO authenticated
  USING (public.get_user_role() = 'print_operator' AND is_active = TRUE AND expires_at > NOW());

-- 7. print_jobs Policies
CREATE POLICY print_jobs_admin ON print_jobs FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY print_jobs_operator_insert ON print_jobs FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'print_operator' AND operator_id = auth.uid());

CREATE POLICY print_jobs_operator_select ON print_jobs FOR SELECT TO authenticated
  USING (public.get_user_role() = 'print_operator' AND operator_id = auth.uid());

-- 8. watermark_registry Policies
CREATE POLICY watermark_registry_admin_select ON watermark_registry FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');

-- 9. vision_alerts Policies
CREATE POLICY vision_alerts_admin ON vision_alerts FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY vision_alerts_select ON vision_alerts FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('print_operator', 'supervisor'));

-- 10. transit_batches Policies
CREATE POLICY transit_batches_admin ON transit_batches FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY transit_batches_driver_select ON transit_batches FOR SELECT TO authenticated
  USING (public.get_user_role() = 'driver' AND assigned_driver_id = auth.uid());

CREATE POLICY transit_batches_driver_update ON transit_batches FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'driver' AND assigned_driver_id = auth.uid());

CREATE POLICY transit_batches_supervisor_select ON transit_batches FOR SELECT TO authenticated
  USING (public.get_user_role() = 'supervisor');

-- 11. transit_checkpoints Policies
CREATE POLICY transit_checkpoints_admin ON transit_checkpoints FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY transit_checkpoints_driver_select ON transit_checkpoints FOR SELECT TO authenticated
  USING (public.get_user_role() = 'driver' AND EXISTS (
    SELECT 1 FROM public.transit_batches tb 
    WHERE tb.id = transit_checkpoints.batch_id AND tb.assigned_driver_id = auth.uid()
  ));

CREATE POLICY transit_checkpoints_driver_update ON transit_checkpoints FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'driver' AND EXISTS (
    SELECT 1 FROM public.transit_batches tb 
    WHERE tb.id = transit_checkpoints.batch_id AND tb.assigned_driver_id = auth.uid()
  ));

CREATE POLICY transit_checkpoints_supervisor_select ON transit_checkpoints FOR SELECT TO authenticated
  USING (public.get_user_role() = 'supervisor');

-- 12. transit_pings Policies
CREATE POLICY transit_pings_admin ON transit_pings FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY transit_pings_driver_insert ON transit_pings FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'driver' AND EXISTS (
    SELECT 1 FROM public.transit_batches tb 
    WHERE tb.id = transit_pings.batch_id AND tb.assigned_driver_id = auth.uid()
  ));

CREATE POLICY transit_pings_driver_select ON transit_pings FOR SELECT TO authenticated
  USING (public.get_user_role() = 'driver' AND EXISTS (
    SELECT 1 FROM public.transit_batches tb 
    WHERE tb.id = transit_pings.batch_id AND tb.assigned_driver_id = auth.uid()
  ));

-- 13. admit_cards Policies
CREATE POLICY admit_cards_admin ON admit_cards FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY admit_cards_supervisor_select ON admit_cards FOR SELECT TO authenticated
  USING (public.get_user_role() = 'supervisor' AND center_id = (
    SELECT assigned_location_id FROM public.user_profiles WHERE id = auth.uid()
  ));

-- 14. admit_card_scans Policies
CREATE POLICY admit_card_scans_admin ON admit_card_scans FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY admit_card_scans_supervisor_insert ON admit_card_scans FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'supervisor');

CREATE POLICY admit_card_scans_supervisor_select ON admit_card_scans FOR SELECT TO authenticated
  USING (public.get_user_role() = 'supervisor');

-- 15. batch_receptions Policies
CREATE POLICY batch_receptions_admin ON batch_receptions FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY batch_receptions_supervisor_insert ON batch_receptions FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'supervisor');

CREATE POLICY batch_receptions_supervisor_select ON batch_receptions FOR SELECT TO authenticated
  USING (public.get_user_role() = 'supervisor');

-- 16. omr_records Policies
CREATE POLICY omr_records_admin ON omr_records FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY omr_records_supervisor_insert ON omr_records FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'supervisor');

-- 17. omr_verifications Policies
CREATE POLICY omr_verifications_admin ON omr_verifications FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

-- 18. forensic_uploads Policies
CREATE POLICY forensic_uploads_admin ON forensic_uploads FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY forensic_uploads_public_insert ON forensic_uploads FOR INSERT TO public
  WITH CHECK (TRUE);

-- 19. forensic_reports Policies
CREATE POLICY forensic_reports_admin ON forensic_reports FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY forensic_reports_public_select ON forensic_reports FOR SELECT TO public
  USING (TRUE);

-- 20. audit_logs Policies
CREATE POLICY audit_logs_admin ON audit_logs FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');
