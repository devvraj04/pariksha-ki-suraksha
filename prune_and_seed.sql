-- =============================================================================
-- PARIKSHASETU — COMPLETE DEMO SEED
-- Three exams with full lifecycle data, 100 students, all tables populated
-- =============================================================================

-- Disable triggers/constraints for a clean truncate
SET session_replication_role = 'replica';

TRUNCATE TABLE 
    public.audit_logs,
    public.grievance_cctv_attachments,
    public.student_grievances,
    public.whistleblower_reports,
    public.leak_reports,
    public.exam_results,
    public.evaluation_discrepancies,
    public.evaluation_marks,
    public.evaluator_assignments,
    public.answer_sheet_visibility_scores,
    public.answer_sheet_uploads,
    public.cbt_exam_sessions,
    public.room_allocations,
    public.surveillance_alerts,
    public.checkin_events,
    public.transit_geofence_violations,
    public.transit_events,
    public.transit_trunks,
    public.print_room_surveillance_alerts,
    public.print_watermark_registry,
    public.print_jobs,
    public.paper_vault_access_logs,
    public.question_papers,
    public.admit_cards,
    public.center_allocations,
    public.exam_registrations,
    public.students,
    public.exam_rooms,
    public.exam_centers,
    public.exams,
    public.agency_staff,
    public.agencies,
    public.platform_admins
    RESTART IDENTITY CASCADE;

-- Clear auth tables
DELETE FROM auth.identities CASCADE;
DELETE FROM auth.users CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- =============================================================================
-- 1. PLATFORM ADMIN
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, confirmation_token, recovery_token)
VALUES (
  'a8c0356e-57b1-4a41-b0db-ea3ee64c3911',
  '00000000-0000-0000-0000-000000000000',
  'admin@parikshasetu.in',
  extensions.crypt('AdminPassword123', extensions.gen_salt('bf', 10)),
  now(), now(), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"role": "platform_admin"}'::jsonb,
  false, 'authenticated', 'authenticated', '', ''
);

INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
VALUES (
  'a8c0356e-57b1-4a41-b0db-ea3ee64c3911',
  'a8c0356e-57b1-4a41-b0db-ea3ee64c3911',
  'email', 'a8c0356e-57b1-4a41-b0db-ea3ee64c3911',
  '{"sub": "a8c0356e-57b1-4a41-b0db-ea3ee64c3911", "email": "admin@parikshasetu.in"}'::jsonb,
  now(), now(), now()
);

INSERT INTO public.platform_admins (id, user_id, full_name, email)
VALUES ('a8c0356e-57b1-4a41-b0db-ea3ee64c3911', 'a8c0356e-57b1-4a41-b0db-ea3ee64c3911', 'Platform Admin', 'admin@parikshasetu.in');

-- =============================================================================
-- 2. AGENCY — National Testing Agency
-- =============================================================================
INSERT INTO public.agencies (id, name, slug, official_email, pan_number, address, city, state, pincode, phone, status, approved_at, approved_by)
VALUES (
  'e0000000-0000-0000-0000-000000000000',
  'National-Testing-Agency',
  'national-testing-agency',
  'hod@nta.in',
  'AAACN1234A',
  'NTA Headquarters, Okhla Industrial Area Phase-2',
  'New Delhi', 'Delhi', '110020',
  '011-69227700',
  'ACTIVE',
  now(),
  'a8c0356e-57b1-4a41-b0db-ea3ee64c3911'
);

-- =============================================================================
-- 3. AGENCY HEAD
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, confirmation_token, recovery_token)
VALUES (
  'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  '00000000-0000-0000-0000-000000000000',
  'hod@nta.in',
  extensions.crypt('AdminPassword123', extensions.gen_salt('bf', 10)),
  now(), now(), now(),
  '{"provider": "email", "providers": ["email"], "role": "agency_head", "agency_id": "e0000000-0000-0000-0000-000000000000"}'::jsonb,
  '{"role": "agency_head", "agency_id": "e0000000-0000-0000-0000-000000000000"}'::jsonb,
  false, 'authenticated', 'authenticated', '', ''
);
INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
VALUES (
  'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  'email', 'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  '{"sub": "b0c0356e-57b1-4a41-b0db-ea3ee64c3922", "email": "hod@nta.in"}'::jsonb,
  now(), now(), now()
);
INSERT INTO public.agency_staff (id, agency_id, user_id, full_name, email, phone, role, is_active, joined_at)
VALUES (
  'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  'e0000000-0000-0000-0000-000000000000',
  'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  'NTA Director General',
  'hod@nta.in', '9999999999',
  'agency_head', true, now()
);

-- =============================================================================
-- 4. 50 STAFF MEMBERS (managers, operators, transit, center officers, evaluators)
-- =============================================================================
DO $$
DECLARE
  i INTEGER;
  v_role TEXT;
  v_user_id UUID;
BEGIN
  FOR i IN 1..50 LOOP
    IF    i <= 4  THEN v_role := 'manager';
    ELSIF i <= 9  THEN v_role := 'operator';
    ELSIF i <= 14 THEN v_role := 'transit_manager';
    ELSIF i <= 29 THEN v_role := 'center_officer';
    ELSIF i <= 34 THEN v_role := 'chief_moderator';
    ELSIF i <= 39 THEN v_role := 'moderator';
    ELSE               v_role := 'grading_teacher';
    END IF;

    v_user_id := ('c0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;

    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, confirmation_token, recovery_token)
    VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000',
      'staff' || i || '@nta.in',
      extensions.crypt('AdminPassword123', extensions.gen_salt('bf', 10)),
      now(), now(), now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role',v_role,'agency_id','e0000000-0000-0000-0000-000000000000'),
      jsonb_build_object('role',v_role,'agency_id','e0000000-0000-0000-0000-000000000000'),
      false, 'authenticated', 'authenticated', '', ''
    );

    INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
    VALUES (
      v_user_id, v_user_id, 'email', v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', 'staff' || i || '@nta.in'),
      now(), now(), now()
    );

    INSERT INTO public.agency_staff (id, agency_id, user_id, full_name, email, phone, role, is_active, joined_at)
    VALUES (
      v_user_id,
      'e0000000-0000-0000-0000-000000000000',
      v_user_id,
      'NTA Staff ' || i || ' (' || initcap(replace(v_role,'_',' ')) || ')',
      'staff' || i || '@nta.in',
      '98765432' || lpad(i::text, 2, '0'),
      v_role, true, now()
    );
  END LOOP;
END $$;

-- =============================================================================
-- 5. THREE EXAMS
--    Exam A (NEET UG 2026) — status: REGISTRATION_OPEN   → 100 registrations, NO admit cards yet (user will generate)
--    Exam B (JEE Main 2026) — status: RESULT_DECLARED    → full lifecycle: question paper, checkins, results, CBT
--    Exam C (UGC NET 2026)  — status: EVALUATION_IN_PROGRESS → offline, answer sheets uploaded, evaluation locked
-- =============================================================================
INSERT INTO public.exams (id, agency_id, created_by, name, slug, mode, exam_date, start_time, duration_minutes, fee_inr, total_seats, eligibility_criteria, syllabus, status, registration_open_at, registration_close_at)
VALUES
(
  'f0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000000',
  'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  'NEET UG 2026',
  'neet-ug-2026',
  'OFFLINE',
  current_date + interval '30 days',
  '10:00:00+05:30'::timetz,
  180, 1700.00, 1000,
  '{"min_age": 17, "max_age": 25, "qualification": "12th Pass with PCB"}'::jsonb,
  'Physics: Mechanics, Optics, Thermodynamics. Chemistry: Organic, Inorganic, Physical. Biology: Genetics, Human Physiology, Ecology.',
  'REGISTRATION_OPEN',
  current_date - interval '10 days',
  current_date + interval '10 days'
),
(
  'f0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000000',
  'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  'JEE Main 2026',
  'jee-main-2026',
  'ONLINE',
  current_date - interval '5 days',
  '09:00:00+05:30'::timetz,
  180, 1000.00, 1000,
  '{"min_age": 16, "max_age": 24, "qualification": "12th Pass with PCM"}'::jsonb,
  'Mathematics: Calculus, Algebra, Coordinate Geometry. Physics: Mechanics, Electromagnetism. Chemistry: Organic & Physical.',
  'RESULT_DECLARED',
  current_date - interval '40 days',
  current_date - interval '20 days'
),
(
  'f0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000000',
  'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  'UGC NET December 2026',
  'ugc-net-dec-2026',
  'OFFLINE',
  current_date - interval '10 days',
  '14:00:00+05:30'::timetz,
  180, 1150.00, 1000,
  '{"min_age": 21, "qualification": "Post Graduate with 55%"}'::jsonb,
  'Paper 1: Teaching & Research Aptitude. Paper 2: Subject-specific core syllabus.',
  'EVALUATION_IN_PROGRESS',
  current_date - interval '60 days',
  current_date - interval '30 days'
);

-- =============================================================================
-- 6. EXAM CENTERS (3 per exam, 9 total)
-- =============================================================================
INSERT INTO public.exam_centers (id, exam_id, agency_id, name, address, city, state, pincode, latitude, longitude, center_code, total_capacity, center_officer_id, slug)
VALUES
-- NEET Centers
('a0000000-0000-0000-0000-000000000011','f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000000','NEET UG Delhi Center 1','Okhla Education Zone, Phase 2','Delhi','Delhi','110020',28.5355,77.2500,'NEE-DEL-01',400,'c0000000-0000-0000-0000-000000000015','neet-del-01'),
('a0000000-0000-0000-0000-000000000012','f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000000','NEET UG Mumbai Center 1','Andheri West Knowledge Hub','Mumbai','Maharashtra','400053',19.1136,72.8697,'NEE-MUM-01',300,'c0000000-0000-0000-0000-000000000016','neet-mum-01'),
('a0000000-0000-0000-0000-000000000013','f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000000','NEET UG Bangalore Center 1','Whitefield Tech Park Road','Bangalore','Karnataka','560066',12.9698,77.7500,'NEE-BAN-01',300,'c0000000-0000-0000-0000-000000000017','neet-ban-01'),
-- JEE Centers
('a0000000-0000-0000-0000-000000000021','f0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000000','JEE Main Delhi CBT Center','Dwarka Sector 10 IT Park','Delhi','Delhi','110075',28.5823,77.0500,'JEE-DEL-01',400,'c0000000-0000-0000-0000-000000000018','jee-del-01'),
('a0000000-0000-0000-0000-000000000022','f0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000000','JEE Main Mumbai CBT Center','Powai IIT Adjacent Academic Zone','Mumbai','Maharashtra','400076',19.1324,72.9181,'JEE-MUM-01',300,'c0000000-0000-0000-0000-000000000019','jee-mum-01'),
('a0000000-0000-0000-0000-000000000023','f0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000000','JEE Main Bangalore CBT Center','Electronic City Phase 1 Campus','Bangalore','Karnataka','560100',12.8398,77.6778,'JEE-BAN-01',300,'c0000000-0000-0000-0000-000000000020','jee-ban-01'),
-- UGC NET Centers
('a0000000-0000-0000-0000-000000000031','f0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000000','UGC NET Delhi Examination Hall','Rohini Sector 15, Delhi University Annex','Delhi','Delhi','110085',28.7200,77.1200,'UGC-DEL-01',400,'c0000000-0000-0000-0000-000000000021','ugc-del-01'),
('a0000000-0000-0000-0000-000000000032','f0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000000','UGC NET Mumbai Examination Hall','Thane East University Area','Mumbai','Maharashtra','400603',19.1860,72.9754,'UGC-MUM-01',300,'c0000000-0000-0000-0000-000000000022','ugc-mum-01'),
('a0000000-0000-0000-0000-000000000033','f0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000000','UGC NET Bangalore Examination Hall','Jayanagar 4th Block, Bangalore South','Bangalore','Karnataka','560011',12.9250,77.5938,'UGC-BAN-01',300,'c0000000-0000-0000-0000-000000000023','ugc-ban-01');

-- Assign center_id to center officers in agency_staff
UPDATE public.agency_staff SET center_id = 'a0000000-0000-0000-0000-000000000011' WHERE id = 'c0000000-0000-0000-0000-000000000015';
UPDATE public.agency_staff SET center_id = 'a0000000-0000-0000-0000-000000000012' WHERE id = 'c0000000-0000-0000-0000-000000000016';
UPDATE public.agency_staff SET center_id = 'a0000000-0000-0000-0000-000000000013' WHERE id = 'c0000000-0000-0000-0000-000000000017';
UPDATE public.agency_staff SET center_id = 'a0000000-0000-0000-0000-000000000021' WHERE id = 'c0000000-0000-0000-0000-000000000018';
UPDATE public.agency_staff SET center_id = 'a0000000-0000-0000-0000-000000000022' WHERE id = 'c0000000-0000-0000-0000-000000000019';
UPDATE public.agency_staff SET center_id = 'a0000000-0000-0000-0000-000000000023' WHERE id = 'c0000000-0000-0000-0000-000000000020';
UPDATE public.agency_staff SET center_id = 'a0000000-0000-0000-0000-000000000031' WHERE id = 'c0000000-0000-0000-0000-000000000021';
UPDATE public.agency_staff SET center_id = 'a0000000-0000-0000-0000-000000000032' WHERE id = 'c0000000-0000-0000-0000-000000000022';
UPDATE public.agency_staff SET center_id = 'a0000000-0000-0000-0000-000000000033' WHERE id = 'c0000000-0000-0000-0000-000000000023';

-- =============================================================================
-- 7. EXAM ROOMS (5 per center)
-- =============================================================================
DO $$
DECLARE
  v_center RECORD;
  r INTEGER;
BEGIN
  FOR v_center IN SELECT id, exam_id, total_capacity FROM public.exam_centers LOOP
    FOR r IN 1..5 LOOP
      INSERT INTO public.exam_rooms (id, center_id, exam_id, room_code, seating_capacity, current_occupancy)
      VALUES (
        gen_random_uuid(),
        v_center.id,
        v_center.exam_id,
        'ROOM-' || lpad(r::text, 2, '0'),
        v_center.total_capacity / 5,
        0
      );
    END LOOP;
  END LOOP;
END $$;

-- =============================================================================
-- 8. CREATE 100 STUDENTS
-- =============================================================================
DO $$
DECLARE
  i INTEGER;
  v_user_id UUID;
  v_names TEXT[] := ARRAY[
    'Aarav Sharma','Vivaan Singh','Aditya Verma','Vihaan Gupta','Arjun Kumar',
    'Sai Reddy','Reyansh Joshi','Ayaan Khan','Krishna Patel','Ishaan Nair',
    'Shaurya Mishra','Atharv Rao','Advik Iyer','Pranav Pillai','Rudra Menon',
    'Kabir Tiwari','Rishi Chopra','Arnav Bose','Aayan Das','Dhruv Jain',
    'Saanvi Sharma','Ananya Singh','Diya Verma','Pari Gupta','Anvi Kumar',
    'Aadhya Reddy','Myra Joshi','Kiara Khan','Riya Patel','Sara Nair',
    'Anika Mishra','Isha Rao','Kavya Iyer','Pooja Pillai','Shreya Menon',
    'Deepa Tiwari','Priya Chopra','Swati Bose','Neha Das','Tanvi Jain',
    'Aryan Mehta','Rahul Pandey','Vikram Sinha','Suraj Yadav','Manav Dubey',
    'Nikhil Bajaj','Rohan Saxena','Tarun Aggarwal','Karan Malhotra','Dev Kapoor',
    'Aman Trivedi','Harsh Srivastava','Gaurav Chauhan','Rishabh Bhatt','Mohit Rawat',
    'Sumit Shukla','Ajay Pathak','Vijay Dixit','Sanjay Dwivedi','Manoj Misra',
    'Priyanka Sharma','Sunita Singh','Rekha Verma','Geeta Gupta','Meena Kumar',
    'Lata Reddy','Seema Joshi','Kavita Khan','Usha Patel','Veena Nair',
    'Savita Mishra','Anita Rao','Smita Iyer','Manjula Pillai','Radha Menon',
    'Sudha Tiwari','Pushpa Chopra','Sarla Bose','Kamla Das','Mala Jain',
    'Ravi Khanna','Sunil Kohli','Anil Malhotra','Mukesh Kapoor','Rakesh Bajaj',
    'Dinesh Saxena','Ramesh Aggarwal','Naresh Pandey','Mahesh Yadav','Umesh Sinha',
    'Girish Dubey','Rajesh Mehta','Santosh Trivedi','Hitesh Srivastava','Jitesh Chauhan',
    'Pritesh Bhatt','Lokesh Rawat','Mukesh Shukla','Ramesh Pathak','Suresh Dixit'
  ];
  v_genders TEXT[] := ARRAY['MALE','FEMALE'];
  v_cities TEXT[] := ARRAY['Delhi','Mumbai','Bangalore','Chennai','Kolkata','Hyderabad','Pune','Jaipur'];
  v_states TEXT[] := ARRAY['Delhi','Maharashtra','Karnataka','Tamil Nadu','West Bengal','Telangana','Maharashtra','Rajasthan'];
BEGIN
  FOR i IN 1..100 LOOP
    v_user_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;

    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, confirmation_token, recovery_token)
    VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000',
      'student' || i || '@gmail.com',
      extensions.crypt('AdminPassword123', extensions.gen_salt('bf', 10)),
      now(), now(), now(),
      '{"provider": "email", "providers": ["email"], "role": "student"}'::jsonb,
      '{"role": "student"}'::jsonb,
      false, 'authenticated', 'authenticated', '', ''
    );

    INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
    VALUES (
      v_user_id, v_user_id, 'email', v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', 'student' || i || '@gmail.com'),
      now(), now(), now()
    );

    INSERT INTO public.students (id, user_id, full_name, email, phone, date_of_birth, gender, address, city, state, pincode, photo_path)
    VALUES (
      v_user_id, v_user_id,
      v_names[((i - 1) % 100) + 1],
      'student' || i || '@gmail.com',
      '99' || lpad(i::text, 9, '0'),
      ('2000-01-01'::date + ((i * 13) % 730 || ' days')::interval)::date,
      v_genders[((i-1) % 2) + 1],
      i || ' Demo Colony, Lane ' || ((i % 10) + 1),
      v_cities[((i-1) % 8) + 1],
      v_states[((i-1) % 8) + 1],
      '1100' || lpad((i % 100)::text, 2, '0'),
      v_user_id::text || '/profile.jpg'
    );
  END LOOP;
END $$;

-- =============================================================================
-- 9. EXAM A (NEET UG): 100 Registrations — REGISTRATION_OPEN, no admit cards
--    User will generate admit cards from the portal
-- =============================================================================
DO $$
DECLARE
  i INTEGER;
  v_student_id UUID;
  v_reg_id UUID;
  v_center_prefs UUID[] := ARRAY[
    'a0000000-0000-0000-0000-000000000011'::uuid,
    'a0000000-0000-0000-0000-000000000012'::uuid,
    'a0000000-0000-0000-0000-000000000013'::uuid
  ];
BEGIN
  FOR i IN 1..100 LOOP
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    v_reg_id     := ('e0000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid;

    INSERT INTO public.exam_registrations (id, student_id, exam_id, application_number, status, payment_status, payment_transaction_id, payment_amount_inr, payment_at, center_preference_1, center_preference_2, center_preference_3, registered_at)
    VALUES (
      v_reg_id, v_student_id,
      'f0000000-0000-0000-0000-000000000001',
      'NEET2026-' || lpad(i::text, 5, '0'),
      'REGISTERED', 'SUCCESS',
      'TXN-NEE-' || lpad(i::text, 6, '0'),
      1700.00, now() - ((i * 7) % 240 || ' hours')::interval,
      v_center_prefs[((i-1) % 3) + 1],
      v_center_prefs[(i % 3) + 1],
      v_center_prefs[((i+1) % 3) + 1],
      now() - ((i * 7) % 240 || ' hours')::interval
    );
  END LOOP;
END $$;

-- =============================================================================
-- 10. EXAM B (JEE MAIN): 20 Students — RESULT_DECLARED — Full lifecycle
-- =============================================================================

-- 10a. Question Paper (JEE) — seeded with storage path that matches bucket structure
INSERT INTO public.question_papers (id, exam_id, uploaded_by, encrypted_storage_path, key_share_1_vault_ref, key_share_2_hsm_ref, encryption_algorithm, paper_version, status, paper_type, uploaded_at)
VALUES
(
  'a9000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000002',
  'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  'question-papers/jee-main-2026/question_paper_v1_encrypted.pdf',
  'vault://nta-jee-2026/key-share-1/kek-A3F7',
  'hsm://safenet-luna/slot-3/kek-B8D2',
  'AES-256-GCM', 1, 'DECRYPTED_FOR_CBT', 'QUESTION_PAPER',
  now() - interval '15 days'
),
(
  'a9000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-000000000002',
  'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  'question-papers/jee-main-2026/answer_key_v1_encrypted.pdf',
  'vault://nta-jee-2026/key-share-1/kek-C5E9',
  'hsm://safenet-luna/slot-3/kek-D1A4',
  'AES-256-GCM', 1, 'ARCHIVED', 'ANSWER_KEY',
  now() - interval '3 days'
);

-- 10b. Paper Vault Access Log
INSERT INTO public.paper_vault_access_logs (id, paper_id, accessed_by, access_type, ip_address, device_fingerprint, accessed_at, notes)
VALUES
(gen_random_uuid(), 'a9000000-0000-0000-0000-000000000001', 'b0c0356e-57b1-4a41-b0db-ea3ee64c3922', 'UPLOAD',          '10.0.1.5',  'NTA-HQ-WORKSTATION-001', now() - interval '15 days', 'Initial secure upload of JEE Main 2026 question paper.'),
(gen_random_uuid(), 'a9000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'DECRYPT_FOR_CBT', '10.0.2.11', 'CBT-SERVER-DELL-JEE-01',  now() - interval '5 days',  'CBT session decryption for exam day.'),
(gen_random_uuid(), 'a9000000-0000-0000-0000-000000000002', 'b0c0356e-57b1-4a41-b0db-ea3ee64c3922', 'UPLOAD',          '10.0.1.5',  'NTA-HQ-WORKSTATION-001', now() - interval '3 days',  'Answer key upload post-examination.');

-- 10c. 20 Registrations for JEE (students 1–20) → status APPEARED
DO $$
DECLARE
  i INTEGER;
  v_student_id UUID;
  v_reg_id UUID;
BEGIN
  FOR i IN 1..20 LOOP
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    v_reg_id     := ('e0000000-0000-0000-0002-' || lpad(i::text, 12, '0'))::uuid;

    INSERT INTO public.exam_registrations (id, student_id, exam_id, application_number, status, payment_status, payment_transaction_id, payment_amount_inr, payment_at, center_preference_1, center_preference_2, center_preference_3, registered_at)
    VALUES (
      v_reg_id, v_student_id,
      'f0000000-0000-0000-0000-000000000002',
      'JEE2026-' || lpad(i::text, 5, '0'),
      'APPEARED', 'SUCCESS',
      'TXN-JEE-' || lpad(i::text, 6, '0'),
      1000.00, now() - interval '35 days',
      'a0000000-0000-0000-0000-000000000021',
      'a0000000-0000-0000-0000-000000000022',
      'a0000000-0000-0000-0000-000000000023',
      now() - interval '35 days'
    );

    -- Center allocation (all to Delhi JEE center)
    INSERT INTO public.center_allocations (id, registration_id, student_id, exam_id, allocated_center_id, preference_rank_matched, allocated_by)
    VALUES (
      gen_random_uuid(), v_reg_id, v_student_id,
      'f0000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000021', 1,
      'b0c0356e-57b1-4a41-b0db-ea3ee64c3922'
    );

    -- Admit card (JEE)
    INSERT INTO public.admit_cards (id, registration_id, student_id, exam_id, center_id, qr_payload_jwt, qr_biometric_hash, pdf_path, generated_at, is_valid)
    VALUES (
      gen_random_uuid(), v_reg_id, v_student_id,
      'f0000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000021',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdHVkZW50X2lkIjoiSk9ITiIsImV4YW1faWQiOiJKRUUiLCJjZW50ZXJfaWQiOiJERUwiLCJleHAiOjE3NTAwMDAwMDB9.demo',
      'bh_' || encode(sha256(('jee_student_' || i)::bytea), 'hex'),
      'admit-cards/jee-main-2026/student-' || i || '/admit_card.pdf',
      now() - interval '20 days',
      true
    );
  END LOOP;
END $$;

-- 10d. CBT Exam Sessions (JEE is ONLINE)
DO $$
DECLARE
  i INTEGER;
  v_student_id UUID;
  v_reg_id UUID;
  v_room_id UUID;
  v_status TEXT;
BEGIN
  FOR i IN 1..20 LOOP
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    v_reg_id     := ('e0000000-0000-0000-0002-' || lpad(i::text, 12, '0'))::uuid;
    
    SELECT id INTO v_room_id FROM public.exam_rooms 
    WHERE center_id = 'a0000000-0000-0000-0000-000000000021' LIMIT 1;

    IF i <= 18 THEN v_status := 'SUBMITTED'; ELSE v_status := 'TIMED_OUT'; END IF;

    INSERT INTO public.cbt_exam_sessions (id, registration_id, student_id, exam_id, center_id, session_token, status, decrypted_at, started_at, submitted_at, tab_switch_count, suspicious_typing_flags, responses_encrypted_path)
    VALUES (
      gen_random_uuid(), v_reg_id, v_student_id,
      'f0000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000021',
      encode(sha256(('session_jee_' || i || '_2026')::bytea), 'hex'),
      v_status,
      now() - interval '5 days',
      now() - interval '5 days' + interval '1 minute',
      CASE WHEN v_status = 'SUBMITTED' THEN now() - interval '5 days' + interval '181 minutes' ELSE NULL END,
      (i % 3),
      (i % 2),
      'cbt-responses/jee-main-2026/student-' || i || '/responses_encrypted.json'
    );
  END LOOP;
END $$;

-- 10e. Checkin Events (JEE)
DO $$
DECLARE
  i INTEGER;
  v_student_id UUID;
  v_reg_id UUID;
  v_checkin_id UUID;
  v_room_id UUID;
BEGIN
  FOR i IN 1..20 LOOP
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    v_reg_id     := ('e0000000-0000-0000-0002-' || lpad(i::text, 12, '0'))::uuid;
    v_checkin_id := ('ec000000-0000-0000-0002-' || lpad(i::text, 12, '0'))::uuid;

    SELECT id INTO v_room_id FROM public.exam_rooms
    WHERE center_id = 'a0000000-0000-0000-0000-000000000021' LIMIT 1;

    INSERT INTO public.checkin_events (id, registration_id, student_id, exam_id, center_id, qr_scan_result, biometric_match_score, biometric_match_result, checked_in_by, checked_in_at, failed_attempts, is_flagged)
    VALUES (
      v_checkin_id, v_reg_id, v_student_id,
      'f0000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000021',
      'VALID',
      CASE WHEN i <= 18 THEN 0.9500 + (i * 0.002) ELSE 0.7800 END,
      CASE WHEN i <= 18 THEN 'MATCHED' ELSE 'FAILED' END,
      'c0000000-0000-0000-0000-000000000018',
      now() - interval '5 days' - interval '30 minutes',
      CASE WHEN i > 18 THEN 1 ELSE 0 END,
      CASE WHEN i > 18 THEN true ELSE false END
    );

    -- Room Allocation
    INSERT INTO public.room_allocations (id, checkin_event_id, student_id, exam_id, center_id, room_id, seat_number, allocated_at)
    VALUES (
      gen_random_uuid(), v_checkin_id, v_student_id,
      'f0000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000021',
      v_room_id,
      'SEAT-' || lpad(i::text, 3, '0'),
      now() - interval '5 days' - interval '25 minutes'
    );
  END LOOP;
END $$;

-- 10f. JEE Results (20 students, declared)
DO $$
DECLARE
  i INTEGER;
  v_student_id UUID;
  v_reg_id UUID;
  v_marks NUMERIC(7,2);
  v_pct NUMERIC(5,2);
  v_status TEXT;
  v_breakdown JSONB;
BEGIN
  FOR i IN 1..20 LOOP
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    v_reg_id     := ('e0000000-0000-0000-0002-' || lpad(i::text, 12, '0'))::uuid;
    v_marks := 60.0 + (((i * 17) % 240));  -- 60–300
    IF v_marks > 300 THEN v_marks := 300.0; END IF;
    v_pct := round((v_marks / 300.0 * 100)::numeric, 2);
    v_status := CASE WHEN v_pct >= 35 THEN 'PASS' ELSE 'FAIL' END;
    v_breakdown := jsonb_build_object(
      'Mathematics', round((v_marks * 0.35)::numeric, 2),
      'Physics',     round((v_marks * 0.33)::numeric, 2),
      'Chemistry',   round((v_marks * 0.32)::numeric, 2)
    );

    INSERT INTO public.exam_results (id, exam_id, student_id, registration_id, final_marks, max_marks, percentage, rank, category_rank, result_status, subject_breakdown, result_pdf_path, published_at, published_by)
    VALUES (
      gen_random_uuid(), 'f0000000-0000-0000-0000-000000000002',
      v_student_id, v_reg_id,
      v_marks, 300.0, v_pct,
      i, i,
      v_status, v_breakdown,
      'results/jee-main-2026/student-' || i || '/scorecard.pdf',
      now() - interval '1 day',
      'b0c0356e-57b1-4a41-b0db-ea3ee64c3922'
    );
  END LOOP;
END $$;

-- =============================================================================
-- 11. EXAM C (UGC NET): OFFLINE, EVALUATION_IN_PROGRESS
--     10 Students — full chain: question paper, print job, transit trunk,
--     checkins, answer sheets, evaluator assignments, marks
-- =============================================================================

-- 11a. Question Paper (UGC NET)
INSERT INTO public.question_papers (id, exam_id, uploaded_by, encrypted_storage_path, key_share_1_vault_ref, key_share_2_hsm_ref, encryption_algorithm, paper_version, status, paper_type, uploaded_at)
VALUES
(
  'a9000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-000000000003',
  'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  'question-papers/ugc-net-dec-2026/question_paper_v1_encrypted.pdf',
  'vault://nta-ugcnet-2026/key-share-1/kek-F2B8',
  'hsm://safenet-luna/slot-5/kek-G7C3',
  'AES-256-GCM', 1, 'VAULTED', 'QUESTION_PAPER',
  now() - interval '25 days'
),
(
  'a9000000-0000-0000-0000-000000000004',
  'f0000000-0000-0000-0000-000000000003',
  'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  'question-papers/ugc-net-dec-2026/answer_key_v1_encrypted.pdf',
  'vault://nta-ugcnet-2026/key-share-2/kek-H4A1',
  'hsm://safenet-luna/slot-5/kek-I9D6',
  'AES-256-GCM', 1, 'VAULTED', 'ANSWER_KEY',
  now() - interval '8 days'
);

-- 11b. Print Job
INSERT INTO public.print_jobs (id, paper_id, exam_id, center_id, initiated_by, printer_id, copies_requested, copies_budget, copies_approved, status, print_started_at, print_completed_at)
VALUES (
  'a7000000-0000-0000-0000-000000000001',
  'a9000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000031',
  'c0000000-0000-0000-0000-000000000005',
  'XEROX-NTA-OKHLA-001',
  400, 400, 400, 'COMPLETED',
  now() - interval '11 days',
  now() - interval '11 days' + interval '2 hours'
);

-- 11c. Print Watermark Registry
INSERT INTO public.print_watermark_registry (id, print_job_id, center_code, printer_id, operator_id, page_number, copy_number, watermark_code, printed_at)
VALUES
(gen_random_uuid(), 'a7000000-0000-0000-0000-000000000001', 'UGC-DEL-01', 'XEROX-NTA-OKHLA-001', 'c0000000-0000-0000-0000-000000000005', 1, 1, 'WM-UGC-DEL-001-P1-C001', now() - interval '11 days'),
(gen_random_uuid(), 'a7000000-0000-0000-0000-000000000001', 'UGC-DEL-01', 'XEROX-NTA-OKHLA-001', 'c0000000-0000-0000-0000-000000000005', 1, 2, 'WM-UGC-DEL-001-P1-C002', now() - interval '11 days'),
(gen_random_uuid(), 'a7000000-0000-0000-0000-000000000001', 'UGC-DEL-01', 'XEROX-NTA-OKHLA-001', 'c0000000-0000-0000-0000-000000000005', 1, 3, 'WM-UGC-DEL-001-P1-C003', now() - interval '11 days');


-- 11d. Transit Trunk
INSERT INTO public.transit_trunks (id, trunk_code, print_job_id, center_id, assigned_transit_manager_id, device_imei, status, sealed_at, dispatched_at, delivered_at, unlocked_at, unlocked_by, unlock_gps_latitude, unlock_gps_longitude)
VALUES (
  'a6000000-0000-0000-0000-000000000001',
  'TRUNK-UGCNET-2026-DELHI-001',
  'a7000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000031',
  'c0000000-0000-0000-0000-000000000010',
  '352748090123456',
  'UNLOCKED',
  now() - interval '11 days',
  now() - interval '11 days' + interval '3 hours',
  now() - interval '10 days',
  now() - interval '10 days' + interval '30 minutes',
  'c0000000-0000-0000-0000-000000000021',
  28.7200, 77.1200
);

-- 11e. Transit Events
INSERT INTO public.transit_events (id, trunk_id, latitude, longitude, speed_kmh, is_on_route, recorded_at)
VALUES
(gen_random_uuid(), 'a6000000-0000-0000-0000-000000000001', 28.5355, 77.2500, 0.00,   true,  now() - interval '11 days'),
(gen_random_uuid(), 'a6000000-0000-0000-0000-000000000001', 28.5900, 77.2100, 48.30,  true,  now() - interval '11 days' + interval '3 hours'),
(gen_random_uuid(), 'a6000000-0000-0000-0000-000000000001', 28.6500, 77.1800, 42.10,  true,  now() - interval '10 days' - interval '4 hours'),
(gen_random_uuid(), 'a6000000-0000-0000-0000-000000000001', 28.7200, 77.1200, 0.00,   true,  now() - interval '10 days'),
(gen_random_uuid(), 'a6000000-0000-0000-0000-000000000001', 28.7200, 77.1200, 0.00,   true,  now() - interval '10 days' + interval '30 minutes');

-- 11f. 10 Registrations for UGC NET (students 51–60)
DO $$
DECLARE
  i INTEGER;
  v_student_id UUID;
  v_reg_id UUID;
  v_checkin_id UUID;
  v_upload_id UUID;
  v_room_id UUID;
  v_upload_ids UUID[];
BEGIN
  v_upload_ids := ARRAY[]::uuid[];
  
  FOR i IN 51..60 LOOP
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    v_reg_id     := ('e0000000-0000-0000-0003-' || lpad(i::text, 12, '0'))::uuid;
    v_checkin_id := ('ec000000-0000-0000-0003-' || lpad(i::text, 12, '0'))::uuid;
    v_upload_id  := ('a5000000-0000-0000-0003-' || lpad(i::text, 12, '0'))::uuid;

    -- Registration
    INSERT INTO public.exam_registrations (id, student_id, exam_id, application_number, status, payment_status, payment_transaction_id, payment_amount_inr, payment_at, center_preference_1, center_preference_2, center_preference_3, registered_at)
    VALUES (
      v_reg_id, v_student_id,
      'f0000000-0000-0000-0000-000000000003',
      'UGCNET2026-' || lpad(i::text, 5, '0'),
      'APPEARED', 'SUCCESS',
      'TXN-UGC-' || lpad(i::text, 6, '0'),
      1150.00, now() - interval '55 days',
      'a0000000-0000-0000-0000-000000000031',
      'a0000000-0000-0000-0000-000000000032',
      'a0000000-0000-0000-0000-000000000033',
      now() - interval '55 days'
    );

    -- Center allocation
    INSERT INTO public.center_allocations (id, registration_id, student_id, exam_id, allocated_center_id, preference_rank_matched, allocated_by)
    VALUES (gen_random_uuid(), v_reg_id, v_student_id, 'f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000031', 1, 'b0c0356e-57b1-4a41-b0db-ea3ee64c3922');

    -- Admit card
    INSERT INTO public.admit_cards (id, registration_id, student_id, exam_id, center_id, qr_payload_jwt, qr_biometric_hash, pdf_path, generated_at, is_valid)
    VALUES (
      gen_random_uuid(), v_reg_id, v_student_id,
      'f0000000-0000-0000-0000-000000000003',
      'a0000000-0000-0000-0000-000000000031',
      'eyJhbGciOiJIUzI1NiJ9.ugcnet.demo',
      'bh_ugc_' || encode(sha256(('ugc_student_' || i)::bytea), 'hex'),
      'admit-cards/ugc-net-dec-2026/student-' || i || '/admit_card.pdf',
      now() - interval '20 days',
      true
    );

    -- Checkin
    SELECT id INTO v_room_id FROM public.exam_rooms WHERE center_id = 'a0000000-0000-0000-0000-000000000031' LIMIT 1;

    INSERT INTO public.checkin_events (id, registration_id, student_id, exam_id, center_id, qr_scan_result, biometric_match_score, biometric_match_result, checked_in_by, checked_in_at, failed_attempts, is_flagged)
    VALUES (v_checkin_id, v_reg_id, v_student_id, 'f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000031', 'VALID', 0.9600, 'MATCHED', 'c0000000-0000-0000-0000-000000000021', now() - interval '10 days', 0, false);

    -- Room allocation
    INSERT INTO public.room_allocations (id, checkin_event_id, student_id, exam_id, center_id, room_id, seat_number, allocated_at)
    VALUES (gen_random_uuid(), v_checkin_id, v_student_id, 'f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000031', v_room_id, 'SEAT-' || lpad((i - 50)::text, 3, '0'), now() - interval '10 days');

    -- Answer sheet upload
    INSERT INTO public.answer_sheet_uploads (id, exam_id, center_id, student_id, registration_id, uploaded_by, encrypted_pdf_path, total_pages, upload_status, uploaded_at)
    VALUES (v_upload_id, 'f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000031', v_student_id, v_reg_id, 'c0000000-0000-0000-0000-000000000021', 'answer-sheets/ugc-net-dec-2026/' || v_student_id || '/answersheet_encrypted.pdf', 8, 'SEALED', now() - interval '10 days' + interval '3 hours');

    v_upload_ids := array_append(v_upload_ids, v_upload_id);
  END LOOP;

  -- Evaluator assignments
  INSERT INTO public.evaluator_assignments (id, exam_id, evaluator_id, role, batch_code, upload_ids, assigned_by, status, completed_at)
  VALUES
  ('ea000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000040', 'grading_teacher', 'BATCH-UGC-2026-A', v_upload_ids, 'b0c0356e-57b1-4a41-b0db-ea3ee64c3922', 'LOCKED', now() - interval '2 days'),
  ('ea000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000035', 'moderator',       'BATCH-UGC-2026-A', v_upload_ids, 'b0c0356e-57b1-4a41-b0db-ea3ee64c3922', 'LOCKED', now() - interval '1 day');

  -- Evaluation marks (tier 1 and tier 2)
  FOR i IN 51..60 LOOP
    DECLARE
      v_marks2 NUMERIC(7,2);
      v_breakdown2 JSONB;
      v_upload_id2 UUID;
    BEGIN
      v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
      v_upload_id2 := ('a5000000-0000-0000-0003-' || lpad(i::text, 12, '0'))::uuid;
      v_marks2 := 45.0 + (((i * 11) % 55));
      v_breakdown2 := jsonb_build_object('Paper 1', round((v_marks2 * 0.4)::numeric, 2), 'Paper 2', round((v_marks2 * 0.6)::numeric, 2));

      INSERT INTO public.evaluation_marks (id, exam_id, student_id, upload_id, center_uid, evaluator_id, assignment_id, evaluation_tier, marks_awarded, max_marks, subject_breakdown, remarks, evaluated_at)
      VALUES
      (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000003', v_student_id, v_upload_id2, 'a0000000-0000-0000-0000-000000000031', 'c0000000-0000-0000-0000-000000000040', 'ea000000-0000-0000-0000-000000000001', 1, v_marks2, 100.0, v_breakdown2, 'Answer sheets evaluated thoroughly.', now() - interval '2 days'),
      (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000003', v_student_id, v_upload_id2, 'a0000000-0000-0000-0000-000000000031', 'c0000000-0000-0000-0000-000000000035', 'ea000000-0000-0000-0000-000000000002', 2, v_marks2, 100.0, v_breakdown2, 'Moderator confirms primary evaluation.', now() - interval '1 day');
    END;
  END LOOP;
END $$;

-- =============================================================================
-- 12. LEAK REPORT (demo forensics data)
-- =============================================================================
INSERT INTO public.leak_reports (id, exam_id, reported_by, source_type, uploaded_image_path, watermark_extracted, extracted_center_code, extracted_printer_id, extracted_timestamp, probability_report, investigation_status, reported_at)
VALUES (
  gen_random_uuid(),
  'f0000000-0000-0000-0000-000000000003',
  'b0c0356e-57b1-4a41-b0db-ea3ee64c3922',
  'INTERNAL',
  'leak-reports/ugc-net-dec-2026/suspected_leak_img_001.jpg',
  'UGC-DEL-01|XEROX-NTA-OKHLA-001|2026-06-07T10:15:00',
  'UGC-DEL-01',
  'XEROX-NTA-OKHLA-001',
  now() - interval '10 days',
  '{"source_probability": 0.87, "center_match": true, "printer_match": true, "operator_traced": true}'::jsonb,
  'REPORT_GENERATED',
  now() - interval '10 days'
);

-- =============================================================================
-- 13. WHISTLEBLOWER REPORT
-- =============================================================================
INSERT INTO public.whistleblower_reports (id, exam_id, category, description, evidence_paths, location_text, ai_risk_score, routing_status, submitted_at)
VALUES (
  gen_random_uuid(),
  'f0000000-0000-0000-0000-000000000003',
  'PAPER_LEAK',
  'A staff member at the Delhi UGC NET center was seen photographing the question paper 30 minutes before exam start using a mobile device hidden inside a water bottle.',
  ARRAY['whistleblower/ugc-net-dec-2026/evidence_001.mp4'],
  'UGC NET Delhi Center, Rohini Sector 15',
  87,
  'ROUTED_TO_AUDIT',
  now() - interval '9 days'
);

-- =============================================================================
-- 14. SURVEILLANCE ALERTS
-- =============================================================================
INSERT INTO public.surveillance_alerts (id, exam_id, center_id, camera_id, alert_type, confidence_score, snapshot_path, detected_at, reviewed_by, reviewed_at, review_outcome)
VALUES
(
  gen_random_uuid(),
  'f0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000031',
  'CAM-UGC-DEL-002',
  'SUSPICIOUS_OBJECT',
  0.8900,
  'surveillance/ugc-del-01/cam-002/snapshot_20260607_101522.jpg',
  now() - interval '10 days',
  'c0000000-0000-0000-0000-000000000021',
  now() - interval '10 days' + interval '15 minutes',
  'ACTION_TAKEN'
),
(
  gen_random_uuid(),
  'f0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000021',
  'CAM-JEE-DEL-003',
  'MOBILE_PHONE_DETECTED',
  0.7600,
  'surveillance/jee-del-01/cam-003/snapshot_20260612_092145.jpg',
  now() - interval '5 days',
  'c0000000-0000-0000-0000-000000000018',
  now() - interval '5 days' + interval '5 minutes',
  'DISMISSED'
);

-- =============================================================================
-- 15. PRINT ROOM SURVEILLANCE ALERTS
-- =============================================================================
INSERT INTO public.print_room_surveillance_alerts (id, print_job_id, camera_id, alert_type, confidence_score, snapshot_path, detected_at, reviewed_by, reviewed_at, review_outcome)
VALUES (
  gen_random_uuid(),
  'a7000000-0000-0000-0000-000000000001',
  'CAM-PRINTROOM-NTA-001',
  'ANOMALOUS_BEHAVIOR',
  0.9200,
  'print-room/nta-okhla/cam-001/snapshot_20260606_143022.jpg',
  now() - interval '11 days' + interval '1 hour',
  'c0000000-0000-0000-0000-000000000001',
  now() - interval '11 days' + interval '2 hours',
  'ESCALATED'
);

-- =============================================================================
-- 16. EVALUATION DISCREPANCIES (UGC NET)
-- =============================================================================
DO $$
DECLARE
  v_tier1_id UUID;
  v_tier2_id UUID;
  v_upload_id UUID;
  v_student_id UUID;
BEGIN
  -- Pick student 55's two evaluation mark rows
  v_student_id := ('d0000000-0000-0000-0000-' || lpad('55'::text, 12, '0'))::uuid;
  v_upload_id  := ('a5000000-0000-0000-0003-' || lpad('55'::text, 12, '0'))::uuid;

  SELECT id INTO v_tier1_id FROM public.evaluation_marks
    WHERE student_id = v_student_id AND evaluation_tier = 1 LIMIT 1;
  SELECT id INTO v_tier2_id FROM public.evaluation_marks
    WHERE student_id = v_student_id AND evaluation_tier = 2 LIMIT 1;

  IF v_tier1_id IS NOT NULL AND v_tier2_id IS NOT NULL THEN
    INSERT INTO public.evaluation_discrepancies (id, exam_id, student_id, upload_id, tier1_marks_id, tier2_marks_id, marks_difference, status, resolved_by, final_marks_id, resolved_at)
    VALUES (
      gen_random_uuid(),
      'f0000000-0000-0000-0000-000000000003',
      v_student_id, v_upload_id,
      v_tier1_id, v_tier2_id,
      3.0,
      'RESOLVED',
      'c0000000-0000-0000-0000-000000000031',
      v_tier1_id,
      now() - interval '12 hours'
    );
  END IF;
END $$;

-- =============================================================================
-- 17. ANSWER SHEET VISIBILITY SCORES
-- =============================================================================
DO $$
DECLARE
  i INTEGER;
  v_upload_id UUID;
BEGIN
  FOR i IN 51..60 LOOP
    v_upload_id := ('a5000000-0000-0000-0003-' || lpad(i::text, 12, '0'))::uuid;
    INSERT INTO public.answer_sheet_visibility_scores (id, upload_id, page_number, visibility_score, issues_detected, model_version)
    VALUES (
      gen_random_uuid(), v_upload_id, 1,
      8.50 + ((i % 5) * 0.30),
      '{"blur": false, "smudge": false, "torn_edge": false}'::jsonb,
      'visibility-scorer-v2.1'
    );
  END LOOP;
END $$;

-- =============================================================================
-- 18. STUDENT GRIEVANCES (from JEE and NEET students)
-- =============================================================================
INSERT INTO public.student_grievances (id, student_id, exam_id, registration_id, category, description, priority, status, auto_cctv_attached, assigned_to, resolution_notes, submitted_at, resolved_at)
VALUES
(
  gen_random_uuid(),
  ('d0000000-0000-0000-0000-' || lpad('3'::text, 12, '0'))::uuid,
  'f0000000-0000-0000-0000-000000000002',
  ('e0000000-0000-0000-0002-' || lpad('3'::text, 12, '0'))::uuid,
  'CBT_TECHNICAL_ISSUE',
  'My JEE Main CBT session froze 45 minutes into the exam. The screen became unresponsive and I lost approximately 20 minutes. I request a re-examination opportunity.',
  'HIGH', 'RESOLVED', true,
  'c0000000-0000-0000-0000-000000000001',
  'Technical logs reviewed. Session was auto-resumed after 4 minutes. CCTV confirms candidate continued normally. Grievance closed.',
  now() - interval '4 days',
  now() - interval '2 days'
),
(
  gen_random_uuid(),
  ('d0000000-0000-0000-0000-' || lpad('7'::text, 12, '0'))::uuid,
  'f0000000-0000-0000-0000-000000000002',
  ('e0000000-0000-0000-0002-' || lpad('7'::text, 12, '0'))::uuid,
  'ANSWER_KEY_DISPUTE',
  'Question 42 in Mathematics section appears to have two correct answers (Option B and Option D). The official answer key marks only Option B as correct.',
  'MEDIUM', 'UNDER_REVIEW', false,
  'c0000000-0000-0000-0000-000000000031',
  NULL,
  now() - interval '1 day',
  NULL
);

-- =============================================================================
-- 19. GRIEVANCE CCTV ATTACHMENTS
-- =============================================================================
INSERT INTO public.grievance_cctv_attachments (id, grievance_id, room_id, camera_id, footage_start, footage_end, footage_path, pulled_at)
SELECT
  gen_random_uuid(),
  sg.id,
  (SELECT r.id FROM public.exam_rooms r WHERE r.center_id = 'a0000000-0000-0000-0000-000000000021' LIMIT 1),
  'CAM-JEE-DEL-003',
  now() - interval '4 days' - interval '3 hours',
  now() - interval '4 days' - interval '2 hours' - interval '35 minutes',
  'cctv/jee-del-01/camera-03/2026-06-12_09-15-to-09-40.mp4',
  now() - interval '4 days'
FROM public.student_grievances sg
WHERE sg.auto_cctv_attached = true
LIMIT 1;

-- =============================================================================
-- 20. AUDIT LOGS
-- =============================================================================
INSERT INTO public.audit_logs (id, agency_id, exam_id, actor_id, actor_role, event_type, event_description, metadata, occurred_at)
VALUES
(gen_random_uuid(), 'e0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000001', 'b0c0356e-57b1-4a41-b0db-ea3ee64c3922', 'agency_head',    'EXAM_CREATED',          'NEET UG 2026 exam created and set to REGISTRATION_OPEN status.',       '{"exam_id": "f0000000-0000-0000-0000-000000000001"}'::jsonb, now() - interval '10 days'),
(gen_random_uuid(), 'e0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000002', 'b0c0356e-57b1-4a41-b0db-ea3ee64c3922', 'agency_head',    'EXAM_CREATED',          'JEE Main 2026 exam created.',                                          '{"exam_id": "f0000000-0000-0000-0000-000000000002"}'::jsonb, now() - interval '42 days'),
(gen_random_uuid(), 'e0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000002', 'b0c0356e-57b1-4a41-b0db-ea3ee64c3922', 'agency_head',    'QUESTION_PAPER_UPLOAD', 'JEE Main 2026 question paper uploaded to secure vault.',               '{"paper_id": "q0000000-0000-0000-0000-000000000001"}'::jsonb, now() - interval '15 days'),
(gen_random_uuid(), 'e0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'operator',       'PRINT_JOB_INITIATED',   'UGC NET print job initiated for Delhi center. 400 copies.',            '{"print_job_id": "pj000000-0000-0000-0000-000000000001"}'::jsonb, now() - interval '11 days'),
(gen_random_uuid(), 'e0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000010', 'transit_manager', 'TRUNK_DISPATCHED',      'Transit trunk TRUNK-UGCNET-2026-DELHI-001 dispatched from HQ.',        '{"trunk_id": "tt000000-0000-0000-0000-000000000001"}'::jsonb, now() - interval '11 days' + interval '3 hours'),
(gen_random_uuid(), 'e0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000002', 'b0c0356e-57b1-4a41-b0db-ea3ee64c3922', 'agency_head',    'RESULT_DECLARED',       'JEE Main 2026 results declared for 20 candidates.',                    '{"exam_id": "f0000000-0000-0000-0000-000000000002"}'::jsonb, now() - interval '1 day'),
(gen_random_uuid(), 'e0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000040', 'grading_teacher', 'EVALUATION_SUBMITTED',  'Batch BATCH-UGC-2026-A evaluation submitted and locked.',              '{"assignment_id": "ea000000-0000-0000-0000-000000000001"}'::jsonb, now() - interval '2 days'),
(gen_random_uuid(), NULL,                                  NULL,                                  'a8c0356e-57b1-4a41-b0db-ea3ee64c3911', 'platform_admin',  'AGENCY_APPROVED',       'National-Testing-Agency approved and status set to ACTIVE.',           '{"agency_id": "e0000000-0000-0000-0000-000000000000"}'::jsonb, now() - interval '60 days');

-- =============================================================================
-- Done! Summary:
--   Platform Admin    : admin@parikshasetu.in / AdminPassword123
--   Agency Head (HOD) : hod@nta.in           / AdminPassword123
--   Staff             : staff1@nta.in … staff50@nta.in / AdminPassword123
--   Students          : student1@gmail.com … student100@gmail.com / AdminPassword123
--
--   EXAM A (NEET UG 2026)     : REGISTRATION_OPEN  — 100 registrations, generate admit cards yourself
--   EXAM B (JEE Main 2026)    : RESULT_DECLARED    — full lifecycle, CBT, results visible
--   EXAM C (UGC NET Dec 2026) : EVALUATION_IN_PROGRESS — offline, answer sheets, evaluators locked
-- =============================================================================
