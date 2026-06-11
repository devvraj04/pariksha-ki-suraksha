-- user_profiles
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- exams
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_exams_scheduled_at ON exams(scheduled_at);

-- exam_center_assignments
CREATE INDEX idx_exam_center_assignments_exam_id ON exam_center_assignments(exam_id);
CREATE INDEX idx_exam_center_assignments_center_id ON exam_center_assignments(center_id);

-- papers
CREATE INDEX idx_papers_exam_id ON papers(exam_id);
CREATE INDEX idx_papers_status ON papers(status);

-- key_shares
CREATE INDEX idx_key_shares_paper_id ON key_shares(paper_id);

-- print_sessions
CREATE INDEX idx_print_sessions_paper_id ON print_sessions(paper_id);
CREATE INDEX idx_print_sessions_is_active ON print_sessions(is_active);

-- print_jobs
CREATE INDEX idx_print_jobs_paper_id ON print_jobs(paper_id);
CREATE INDEX idx_print_jobs_operator_id ON print_jobs(operator_id);
CREATE INDEX idx_print_jobs_status ON print_jobs(status);

-- watermark_registry
CREATE INDEX idx_watermark_registry_print_job_id ON watermark_registry(print_job_id);
CREATE INDEX idx_watermark_registry_batch_id ON watermark_registry(watermark_batch_id);
CREATE INDEX idx_watermark_registry_tmc_operator ON watermark_registry((tmc_payload->>'operator_id'));

-- transit_batches
CREATE INDEX idx_transit_batches_status ON transit_batches(status);
CREATE INDEX idx_transit_batches_driver ON transit_batches(assigned_driver_id);
CREATE INDEX idx_transit_batches_center_id ON transit_batches(center_id);

-- transit_pings (most queried by batch_id + time)
CREATE INDEX idx_transit_pings_batch_id ON transit_pings(batch_id);
CREATE INDEX idx_transit_pings_batch_time ON transit_pings(batch_id, pinged_at DESC);

-- admit_cards
CREATE INDEX idx_admit_cards_student_id ON admit_cards(student_id);
CREATE INDEX idx_admit_cards_exam_id ON admit_cards(exam_id);

-- omr_records
CREATE INDEX idx_omr_records_exam_id ON omr_records(exam_id);
CREATE INDEX idx_omr_records_student_id ON omr_records(student_id);

-- forensic_uploads
CREATE INDEX idx_forensic_uploads_status ON forensic_uploads(status);

-- audit_logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
