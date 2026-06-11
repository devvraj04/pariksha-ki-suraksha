-- Create transit_batches table
CREATE TABLE transit_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  print_job_id UUID NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE UNIQUE,
  center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE RESTRICT,
  assigned_driver_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  qr_seal_payload TEXT NOT NULL,
  route_polyline TEXT NOT NULL,
  route_origin_lat DOUBLE PRECISION NOT NULL,
  route_origin_lng DOUBLE PRECISION NOT NULL,
  route_destination_lat DOUBLE PRECISION NOT NULL,
  route_destination_lng DOUBLE PRECISION NOT NULL,
  status transit_status_enum NOT NULL DEFAULT 'dispatched',
  compromised_reason TEXT,
  dispatched_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create transit_checkpoints table
CREATE TABLE transit_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES transit_batches(id) ON DELETE CASCADE,
  checkpoint_index INTEGER NOT NULL,
  label TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  scanned_at TIMESTAMPTZ,
  scanned_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_transit_checkpoints UNIQUE (batch_id, checkpoint_index)
);

-- Create transit_pings table
CREATE TABLE transit_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES transit_batches(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION,
  deviation_meters DOUBLE PRECISION,
  geofence_status TEXT NOT NULL,
  pinged_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
