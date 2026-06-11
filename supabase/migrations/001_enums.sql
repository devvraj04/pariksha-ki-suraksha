CREATE TYPE user_role_enum AS ENUM (
  'super_admin',
  'authority_a',
  'authority_b',
  'print_operator',
  'driver',
  'supervisor'
);

CREATE TYPE exam_status_enum AS ENUM (
  'draft',
  'active',
  'completed',
  'cancelled'
);

CREATE TYPE paper_status_enum AS ENUM (
  'encrypted',
  'print_authorized',
  'printed',
  'archived'
);

CREATE TYPE print_job_status_enum AS ENUM (
  'queued',
  'printing',
  'completed',
  'aborted'
);

CREATE TYPE transit_status_enum AS ENUM (
  'dispatched',
  'in_transit',
  'compromised',
  'delivered'
);

CREATE TYPE forensic_job_status_enum AS ENUM (
  'processing',
  'completed',
  'failed',
  'no_watermark_found'
);
