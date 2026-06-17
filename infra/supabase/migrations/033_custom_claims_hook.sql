-- Create custom_access_token_hook function to inject roles and claims in JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims jsonb;
  user_id uuid;
  user_email text;
  v_role text;
  v_agency_id uuid;
  v_exam_scope uuid[];
  v_paper_batch_ids uuid[];
BEGIN
  -- Extract user ID and email
  user_id := (event->>'user_id')::uuid;
  user_email := (event->'claims'->>'email');

  -- Default claims
  v_role := 'student';
  v_agency_id := NULL;
  v_exam_scope := ARRAY[]::uuid[];
  v_paper_batch_ids := ARRAY[]::uuid[];

  -- 1. Check platform_admins
  IF EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = custom_access_token_hook.user_id) THEN
    v_role := 'platform_admin';
  ELSE
    -- 2. Check agency_staff
    DECLARE
      staff_record RECORD;
    BEGIN
      SELECT role, agency_id, is_active 
      INTO staff_record 
      FROM public.agency_staff 
      WHERE user_id = custom_access_token_hook.user_id;

      IF staff_record IS NOT NULL THEN
        IF NOT staff_record.is_active THEN
          RAISE EXCEPTION 'Access revoked: staff member is inactive';
        END IF;
        v_role := staff_record.role;
        v_agency_id := staff_record.agency_id;
      END IF;
    END;
  END IF;

  -- Get existing claims
  claims := event->'claims';

  -- Set role, agency_id, exam_scope, and paper_batch_ids in app_metadata
  claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(v_role));
  
  IF v_agency_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, agency_id}', to_jsonb(v_agency_id));
  ELSE
    claims := jsonb_set(claims, '{app_metadata, agency_id}', 'null'::jsonb);
  END IF;
  
  claims := jsonb_set(claims, '{app_metadata, exam_scope}', to_jsonb(v_exam_scope));
  claims := jsonb_set(claims, '{app_metadata, paper_batch_ids}', to_jsonb(v_paper_batch_ids));

  -- Also set top-level claims for easier extraction in api backend
  claims := jsonb_set(claims, '{role}', to_jsonb(v_role));
  IF v_agency_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{agency_id}', to_jsonb(v_agency_id));
  ELSE
    claims := jsonb_set(claims, '{agency_id}', 'null'::jsonb);
  END IF;
  claims := jsonb_set(claims, '{exam_scope}', to_jsonb(v_exam_scope));
  claims := jsonb_set(claims, '{paper_batch_ids}', to_jsonb(v_paper_batch_ids));

  -- Update event claims
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

-- Grant usage permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
