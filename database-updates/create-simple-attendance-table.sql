-- =====================================================
-- SIMPLE ATTENDANCE TABLE SETUP
-- Run this on human_resource_module database (port 5433)
-- =====================================================

-- Create attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  work_hours VARCHAR(10),
  status VARCHAR(50) DEFAULT 'Present',
  location_check_in VARCHAR(255),
  location_check_out VARCHAR(255),
  ip_address_check_in VARCHAR(45),
  ip_address_check_out VARCHAR(45),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_unique_employee_date UNIQUE (employee_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON public.attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);

-- Comment
COMMENT ON TABLE public.attendance IS 'Daily attendance records - employee_id is user_id from ticketing system';

-- Test query to view today's attendance
SELECT 
  employee_id as user_id,
  date,
  check_in_time,
  check_out_time,
  work_hours,
  status
FROM public.attendance
WHERE date = CURRENT_DATE
ORDER BY check_in_time;
