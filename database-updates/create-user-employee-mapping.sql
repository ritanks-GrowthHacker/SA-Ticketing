-- =====================================================
-- CREATE USER EMPLOYEE MAPPING TABLE
-- Run this on the human_resource_module database (port 5433)
-- =====================================================

-- Create the user_employee_mapping table
CREATE TABLE IF NOT EXISTS public.user_employee_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_employee_mapping_pkey PRIMARY KEY (id),
  CONSTRAINT user_employee_mapping_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
  CONSTRAINT user_employee_mapping_unique_user UNIQUE (user_id, organization_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_employee_mapping_user_id ON public.user_employee_mapping(user_id);
CREATE INDEX IF NOT EXISTS idx_user_employee_mapping_employee_id ON public.user_employee_mapping(employee_id);
CREATE INDEX IF NOT EXISTS idx_user_employee_mapping_organization_id ON public.user_employee_mapping(organization_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_employee_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_employee_mapping_updated_at 
BEFORE UPDATE ON public.user_employee_mapping 
FOR EACH ROW EXECUTE FUNCTION update_user_employee_mapping_updated_at();

-- Comment
COMMENT ON TABLE public.user_employee_mapping IS 'Maps ticketing system users to HRM employee records';

-- =====================================================
-- INSERT SAMPLE DATA FOR EXISTING USERS
-- Replace the UUIDs with actual employee IDs from your employees table
-- =====================================================

-- Step 1: First, create employee records if they don't exist
-- Example:
-- INSERT INTO public.employees (employee_code, first_name, last_name, email, hire_date, employment_type, job_title)
-- VALUES 
--   ('EMP001', 'ritank', 's', 'ritank1998@gmail.com', CURRENT_DATE, 'Full-Time', 'Developer'),
--   ('EMP002', 'ritank', '', 'fashion.rupali72@gmail.com', CURRENT_DATE, 'Full-Time', 'Developer'),
--   ('EMP003', 'Prajwal', '', 'prajwalhemanth5@gmail.com', CURRENT_DATE, 'Full-Time', 'Developer');

-- Step 2: Create user-employee mappings
-- You need to get the actual employee IDs from the employees table first
-- Example mapping (REPLACE THESE UUIDs WITH ACTUAL EMPLOYEE IDs):

/*
INSERT INTO public.user_employee_mapping (user_id, employee_id, organization_id)
SELECT 
  'a2c7b541-5397-477e-8c74-033f4d308dd7'::uuid, -- ritank s user_id
  e.id, -- employee_id from employees table
  '8ce7d8ae-c60f-41e4-a567-0722ab86bf39'::uuid -- organization_id
FROM public.employees e
WHERE e.email = 'ritank1998@gmail.com'
UNION ALL
SELECT 
  '836b1b5b-72ec-446c-8173-23f4e83fe462'::uuid, -- ritank user_id
  e.id,
  '8ce7d8ae-c60f-41e4-a567-0722ab86bf39'::uuid
FROM public.employees e
WHERE e.email = 'fashion.rupali72@gmail.com'
UNION ALL
SELECT 
  '250b4a4d-a959-4f01-8480-015261c1e5ce'::uuid, -- Prajwal user_id
  e.id,
  '8ce7d8ae-c60f-41e4-a567-0722ab86bf39'::uuid
FROM public.employees e
WHERE e.email = 'prajwalhemanth5@gmail.com'
ON CONFLICT (user_id, organization_id) DO NOTHING;
*/

-- =====================================================
-- HELPER QUERY TO CHECK IF EMPLOYEES EXIST
-- =====================================================
SELECT id, employee_code, first_name, last_name, email, job_title
FROM public.employees
WHERE email IN ('ritank1998@gmail.com', 'fashion.rupali72@gmail.com', 'prajwalhemanth5@gmail.com');

-- =====================================================
-- HELPER QUERY TO VIEW MAPPINGS
-- =====================================================
SELECT 
  m.id,
  m.user_id,
  m.employee_id,
  m.organization_id,
  e.employee_code,
  e.first_name || ' ' || e.last_name as employee_name,
  e.email,
  m.is_active,
  m.created_at
FROM public.user_employee_mapping m
JOIN public.employees e ON m.employee_id = e.id
ORDER BY m.created_at DESC;
