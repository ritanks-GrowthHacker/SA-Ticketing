-- =====================================================
-- HR MODULE DATABASE SCHEMA
-- Human Resource Management System
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- HR PERSONNEL TABLE
-- Stores HR staff with their roles (Admin, Manager, HR)
-- =====================================================
CREATE TABLE public.hr_personnel (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Manager', 'HR')),
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hr_personnel_pkey PRIMARY KEY (id)
);

-- =====================================================
-- EMPLOYEES TABLE
-- Core employee information
-- =====================================================
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  employee_code VARCHAR(50) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  date_of_birth DATE,
  gender VARCHAR(20) CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  hire_date DATE NOT NULL,
  employment_type VARCHAR(50) CHECK (employment_type IN ('Full-Time', 'Part-Time', 'Contract', 'Intern')),
  job_title VARCHAR(100),
  department_id UUID,
  manager_id UUID,
  profile_image_url TEXT,
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relationship VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'On Leave', 'Suspended', 'Terminated')),
  termination_date DATE,
  termination_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  CONSTRAINT employees_pkey PRIMARY KEY (id)
);

-- =====================================================
-- ATTENDANCE TABLE
-- Daily attendance records
-- =====================================================
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Half-Day', 'Late', 'On Leave', 'Holiday', 'Weekend')),
  work_hours DECIMAL(5,2),
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  location_check_in VARCHAR(255),
  location_check_out VARCHAR(255),
  ip_address_check_in VARCHAR(45),
  ip_address_check_out VARCHAR(45),
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
  CONSTRAINT attendance_unique_employee_date UNIQUE (employee_id, date)
);

-- =====================================================
-- LEAVE TYPES TABLE
-- Different types of leaves (Sick, Casual, Annual, etc.)
-- =====================================================
CREATE TABLE public.leave_types (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  max_days_per_year INTEGER,
  is_paid BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  color_code VARCHAR(7) DEFAULT '#6b7280',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT leave_types_pkey PRIMARY KEY (id),
  CONSTRAINT leave_types_name_unique UNIQUE (name)
);

-- =====================================================
-- LEAVE REQUESTS TABLE
-- Employee leave applications
-- =====================================================
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  leave_type_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(5,2) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT leave_requests_pkey PRIMARY KEY (id),
  CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
  CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id),
  CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.hr_personnel(id)
);

-- =====================================================
-- LEAVE BALANCE TABLE
-- Track leave balance for each employee
-- =====================================================
CREATE TABLE public.leave_balance (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  leave_type_id UUID NOT NULL,
  year INTEGER NOT NULL,
  total_allocated DECIMAL(5,2) NOT NULL,
  total_used DECIMAL(5,2) DEFAULT 0,
  total_remaining DECIMAL(5,2) GENERATED ALWAYS AS (total_allocated - total_used) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT leave_balance_pkey PRIMARY KEY (id),
  CONSTRAINT leave_balance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
  CONSTRAINT leave_balance_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id),
  CONSTRAINT leave_balance_unique_employee_type_year UNIQUE (employee_id, leave_type_id, year)
);

-- =====================================================
-- SALARY STRUCTURE TABLE
-- Employee salary components
-- =====================================================
CREATE TABLE public.salary_structure (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  base_salary DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  pay_frequency VARCHAR(50) CHECK (pay_frequency IN ('Monthly', 'Bi-Weekly', 'Weekly', 'Hourly')),
  allowances JSONB DEFAULT '[]'::jsonb,
  deductions JSONB DEFAULT '[]'::jsonb,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  CONSTRAINT salary_structure_pkey PRIMARY KEY (id),
  CONSTRAINT salary_structure_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE
);

-- =====================================================
-- PAYROLL TABLE
-- Monthly payroll records
-- =====================================================
CREATE TABLE public.payroll (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  payment_date DATE,
  base_salary DECIMAL(12,2) NOT NULL,
  gross_salary DECIMAL(12,2) NOT NULL,
  total_allowances DECIMAL(12,2) DEFAULT 0,
  total_deductions DECIMAL(12,2) DEFAULT 0,
  overtime_pay DECIMAL(12,2) DEFAULT 0,
  bonus DECIMAL(12,2) DEFAULT 0,
  net_salary DECIMAL(12,2) NOT NULL,
  tax_deducted DECIMAL(12,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending', 'Approved', 'Paid', 'Cancelled')),
  payment_method VARCHAR(50) CHECK (payment_method IN ('Bank Transfer', 'Check', 'Cash', 'UPI', 'Other')),
  transaction_reference VARCHAR(255),
  allowances_breakdown JSONB DEFAULT '[]'::jsonb,
  deductions_breakdown JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  CONSTRAINT payroll_pkey PRIMARY KEY (id),
  CONSTRAINT payroll_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
  CONSTRAINT payroll_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.hr_personnel(id),
  CONSTRAINT payroll_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.hr_personnel(id),
  CONSTRAINT payroll_unique_employee_period UNIQUE (employee_id, pay_period_start, pay_period_end)
);

-- =====================================================
-- PAYROLL ALLOWANCES TABLE
-- Define payroll allowance types
-- =====================================================
CREATE TABLE public.payroll_allowances (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_taxable BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payroll_allowances_pkey PRIMARY KEY (id)
);

-- =====================================================
-- PAYROLL DEDUCTIONS TABLE
-- Define payroll deduction types
-- =====================================================
CREATE TABLE public.payroll_deductions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_statutory BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payroll_deductions_pkey PRIMARY KEY (id)
);

-- =====================================================
-- HOLIDAYS TABLE
-- Company holidays and non-working days
-- =====================================================
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  is_recurring BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  CONSTRAINT holidays_pkey PRIMARY KEY (id)
);

-- =====================================================
-- WORK SHIFTS TABLE
-- Define different work shifts
-- =====================================================
CREATE TABLE public.work_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  working_hours DECIMAL(5,2) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT work_shifts_pkey PRIMARY KEY (id)
);

-- =====================================================
-- EMPLOYEE SHIFTS TABLE
-- Assign shifts to employees
-- =====================================================
CREATE TABLE public.employee_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  shift_id UUID NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT employee_shifts_pkey PRIMARY KEY (id),
  CONSTRAINT employee_shifts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
  CONSTRAINT employee_shifts_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.work_shifts(id)
);

-- =====================================================
-- HR ACTIVITY LOGS TABLE
-- Track all HR operations
-- =====================================================
CREATE TABLE public.hr_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  hr_personnel_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hr_activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT hr_activity_logs_hr_personnel_id_fkey FOREIGN KEY (hr_personnel_id) REFERENCES public.hr_personnel(id)
);

-- =====================================================
-- USER EMPLOYEE MAPPING TABLE
-- Links ticketing system users to HRM employee records
-- =====================================================
CREATE TABLE public.user_employee_mapping (
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

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_hr_personnel_user_id ON public.hr_personnel(user_id);
CREATE INDEX idx_hr_personnel_role ON public.hr_personnel(role);
CREATE INDEX idx_employees_employee_code ON public.employees(employee_code);
CREATE INDEX idx_employees_email ON public.employees(email);
CREATE INDEX idx_employees_department_id ON public.employees(department_id);
CREATE INDEX idx_employees_status ON public.employees(status);
CREATE INDEX idx_attendance_employee_id ON public.attendance(employee_id);
CREATE INDEX idx_attendance_date ON public.attendance(date);
CREATE INDEX idx_attendance_status ON public.attendance(status);
CREATE INDEX idx_user_employee_mapping_user_id ON public.user_employee_mapping(user_id);
CREATE INDEX idx_user_employee_mapping_employee_id ON public.user_employee_mapping(employee_id);
CREATE INDEX idx_user_employee_mapping_organization_id ON public.user_employee_mapping(organization_id);
CREATE INDEX idx_leave_requests_employee_id ON public.leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX idx_payroll_employee_id ON public.payroll(employee_id);
CREATE INDEX idx_payroll_status ON public.payroll(status);
CREATE INDEX idx_payroll_pay_period ON public.payroll(pay_period_start, pay_period_end);

-- =====================================================
-- INSERT DEFAULT DATA
-- =====================================================

-- Insert default leave types
INSERT INTO public.leave_types (name, description, max_days_per_year, is_paid, color_code) VALUES
('Annual Leave', 'Paid annual vacation leave', 21, true, '#22c55e'),
('Sick Leave', 'Medical leave for illness', 15, true, '#ef4444'),
('Casual Leave', 'Short-term personal leave', 12, true, '#3b82f6'),
('Maternity Leave', 'Maternity leave for mothers', 180, true, '#ec4899'),
('Paternity Leave', 'Paternity leave for fathers', 15, true, '#8b5cf6'),
('Unpaid Leave', 'Leave without pay', NULL, false, '#6b7280'),
('Compensatory Off', 'Leave for overtime work', NULL, true, '#f59e0b'),
('Bereavement Leave', 'Leave for family emergencies', 7, true, '#000000');

-- Insert default payroll allowances
INSERT INTO public.payroll_allowances (name, description, is_taxable) VALUES
('House Rent Allowance (HRA)', 'Housing allowance', false),
('Transport Allowance', 'Travel and commute allowance', false),
('Medical Allowance', 'Medical expenses allowance', false),
('Food Allowance', 'Meal allowance', true),
('Performance Bonus', 'Performance-based bonus', true),
('Special Allowance', 'Other special allowances', true);

-- Insert default payroll deductions
INSERT INTO public.payroll_deductions (name, description, is_statutory) VALUES
('Income Tax (TDS)', 'Tax deducted at source', true),
('Professional Tax', 'State professional tax', true),
('Provident Fund (PF)', 'Employee provident fund contribution', true),
('Employee State Insurance (ESI)', 'Health insurance contribution', true),
('Loan Repayment', 'Loan deduction', false),
('Advance Salary', 'Advance salary adjustment', false),
('Other Deductions', 'Miscellaneous deductions', false);

-- Insert default work shifts
INSERT INTO public.work_shifts (name, start_time, end_time, working_hours) VALUES
('General Shift', '09:00:00', '18:00:00', 8.0),
('Morning Shift', '06:00:00', '14:00:00', 8.0),
('Evening Shift', '14:00:00', '22:00:00', 8.0),
('Night Shift', '22:00:00', '06:00:00', 8.0);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_hr_personnel_updated_at BEFORE UPDATE ON public.hr_personnel FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_employee_mapping_updated_at BEFORE UPDATE ON public.user_employee_mapping FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_balance_updated_at BEFORE UPDATE ON public.leave_balance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_salary_structure_updated_at BEFORE UPDATE ON public.salary_structure FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON public.payroll FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.hr_personnel IS 'HR staff members with access to HR module';
COMMENT ON TABLE public.employees IS 'Core employee information and profiles';
COMMENT ON TABLE public.attendance IS 'Daily attendance tracking with check-in/out times';
COMMENT ON TABLE public.user_employee_mapping IS 'Maps ticketing system users to HRM employee records';
COMMENT ON TABLE public.leave_types IS 'Types of leaves available';
COMMENT ON TABLE public.leave_requests IS 'Employee leave applications';
COMMENT ON TABLE public.leave_balance IS 'Leave balance tracking per employee';
COMMENT ON TABLE public.salary_structure IS 'Employee salary components and structure';
COMMENT ON TABLE public.payroll IS 'Monthly payroll processing records';
COMMENT ON TABLE public.payroll_allowances IS 'Payroll allowance type definitions';
COMMENT ON TABLE public.payroll_deductions IS 'Payroll deduction type definitions';
COMMENT ON TABLE public.holidays IS 'Company holidays and non-working days';
COMMENT ON TABLE public.work_shifts IS 'Work shift definitions';
COMMENT ON TABLE public.employee_shifts IS 'Employee shift assignments';
COMMENT ON TABLE public.hr_activity_logs IS 'Audit trail for HR operations';
