export interface UserProfile {
  id: string;
  full_name: string;
  role: 'super_admin' | 'authority_a' | 'authority_b' | 'print_operator' | 'driver' | 'supervisor';
  assigned_location_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at?: string | null;
}

export interface ExamCenter {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  capacity: number;
  contact_supervisor_id: string | null;
  created_at: string;
}

export interface Paper {
  id: string;
  exam_id: string;
  title: string;
  encrypted_blob_path: string;
  iv_hex: string;
  auth_tag_hex: string;
  file_size_bytes: number;
  page_count: number | null;
  status: 'encrypted' | 'print_authorized' | 'printed' | 'archived';
  uploaded_by: string;
  created_at: string;
  updated_at?: string | null;
}

export interface KeyShare {
  id: string;
  paper_id: string;
  authority_role: 'authority_a' | 'authority_b';
  share_value_encrypted: string;
  is_retrieved: boolean;
  retrieved_at: string | null;
  retrieved_by: string | null;
  created_at: string;
}

export interface PrintSession {
  id: string;
  paper_id: string;
  authorized_by_a: string;
  authorized_by_b: string;
  authorized_copies: number;
  authorized_centers: string[];
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export interface PrintJob {
  id: string;
  paper_id: string;
  print_session_id: string;
  center_id: string;
  printer_id: string;
  operator_id: string;
  copies_requested: number;
  copies_printed: number;
  watermark_batch_id: string;
  status: 'queued' | 'printing' | 'completed' | 'aborted';
  aborted_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface WatermarkRegistry {
  id: string;
  print_job_id: string;
  watermark_batch_id: string;
  copy_index: number;
  page_index: number;
  tmc_payload: {
    printer_id: string;
    operator_id: string;
    center_id: string;
    batch_id: string;
    timestamp_unix: number;
    copy_index: number;
    page_index: number;
  };
  tmc_code_hex: string;
  created_at: string;
}

export interface VisionAlert {
  id: string;
  agent_id: string;
  location_type: 'print_room' | 'exam_hall';
  location_id: string;
  detected_class: 'mobile_phone' | 'earpiece' | 'headphones';
  confidence: number;
  linked_job_id: string | null;
  frame_storage_path: string | null;
  is_reviewed: boolean;
  triggered_abort: boolean;
  created_at: string;
}

export interface VaultViewToken {
  id: string;
  paper_id: string;
  token: string;
  is_used: boolean;
  expires_at: string;
  created_at: string;
}

export interface TransitBatch {
  id: string;
  print_job_id: string;
  center_id: string;
  assigned_driver_id: string;
  qr_seal_payload: string;
  route_polyline: string;
  route_origin_lat: number;
  route_origin_lng: number;
  route_destination_lat: number;
  route_destination_lng: number;
  status: 'dispatched' | 'in_transit' | 'compromised' | 'delivered';
  compromised_reason: 'deviation' | 'stationary' | null;
  dispatched_at: string;
  delivered_at: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface TransitPing {
  id: string;
  batch_id: string;
  lat: number;
  lng: number;
  accuracy_meters: number | null;
  deviation_meters: number | null;
  geofence_status: 'ok' | 'deviation' | 'stationary';
  pinged_at: string;
  created_at: string;
}

export interface AdmitCard {
  id: string;
  student_id: string;
  exam_id: string;
  center_id: string;
  jwt_payload_hash: string;
  issued_at: string;
  expires_at: string;
  is_revoked: boolean;
  created_at: string;
}

export interface AdmitCardScan {
  id: string;
  admit_card_id: string;
  center_id: string;
  scanned_by: string;
  is_valid: boolean;
  failure_reason: 'expired' | 'invalid_signature' | 'wrong_center' | null;
  scanned_at: string;
  created_at: string;
}

export interface BatchReception {
  id: string;
  batch_id: string;
  center_id: string;
  received_by: string;
  paper_count_expected: number;
  paper_count_received: number;
  count_mismatch: boolean;
  qr_seal_verified: boolean;
  received_at: string;
  created_at: string;
}

export interface OmrRecord {
  id: string;
  student_id: string;
  exam_id: string;
  center_id: string;
  sha256_hash: string;
  storage_path: string;
  file_size_bytes: number;
  uploaded_by: string;
  uploaded_at: string;
  created_at: string;
}

export interface OmrVerification {
  id: string;
  omr_record_id: string;
  recomputed_hash: string;
  is_match: boolean;
  verified_by: string;
  verified_at: string;
  created_at: string;
}

export interface ForensicUpload {
  id: string;
  storage_path: string;
  file_size_bytes: number;
  original_filename: string | null;
  description: string | null;
  uploader_ip_hash: string | null;
  status: 'processing' | 'completed' | 'failed' | 'no_watermark_found';
  created_at: string;
  updated_at?: string | null;
}

export interface ForensicReport {
  id: string;
  upload_id: string;
  tmc_decoded: {
    printer_id: string;
    operator_id: string;
    center_id: string;
    batch_id: string;
    timestamp_unix: number;
    copy_index: number;
    page_index: number;
  } | null;
  primary_suspect_operator_id: string | null;
  primary_suspect_printer_id: string | null;
  primary_suspect_center_id: string | null;
  leaked_at: string | null;
  custody_chain: Array<{
    event: string;
    actor: string;
    timestamp: string;
    details?: string;
  }> | null;
  confidence_score: number | null;
  processing_notes: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action_type:
    | 'paper_uploaded'
    | 'key_share_retrieved'
    | 'print_authorized'
    | 'print_job_created'
    | 'print_job_aborted'
    | 'batch_dispatched'
    | 'batch_compromised'
    | 'admit_card_verified'
    | 'omr_uploaded'
    | 'forensic_upload'
    | 'forensic_report_generated'
    | 'vision_alert_fired';
  entity_type: string;
  entity_id: string;
  metadata: any | null;
  created_at: string;
}
