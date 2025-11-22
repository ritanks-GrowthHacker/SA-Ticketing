
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  file_url text NOT NULL,
  uploaded_by uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attachments_pkey PRIMARY KEY (id),
  CONSTRAINT attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  description text,
  color_code character varying DEFAULT '#6b7280'::character varying,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.entity_tags (
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  CONSTRAINT entity_tags_pkey PRIMARY KEY (entity_type, entity_id, tag_id),
  CONSTRAINT entity_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
CREATE TABLE public.global_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT global_roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  department_id uuid NOT NULL,
  email character varying NOT NULL,
  name character varying,
  job_title character varying,
  phone character varying,
  invitation_token character varying NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64'::text) UNIQUE,
  status character varying NOT NULL DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'completed'::character varying, 'expired'::character varying, 'cancelled'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '7 days'::interval),
  completed_at timestamp with time zone,
  CONSTRAINT invitations_pkey PRIMARY KEY (id),
  CONSTRAINT invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT invitations_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.meeting_moms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  generated_by_ai boolean DEFAULT true,
  content text NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT meeting_moms_pkey PRIMARY KEY (id),
  CONSTRAINT meeting_moms_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id)
);
CREATE TABLE public.meeting_participants (
  meeting_id uuid NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT meeting_participants_pkey PRIMARY KEY (meeting_id, user_id),
  CONSTRAINT meeting_participants_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id),
  CONSTRAINT meeting_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  scheduled_at timestamp without time zone NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  meeting_link text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT meetings_pkey PRIMARY KEY (id),
  CONSTRAINT meetings_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT meetings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  entity_type text,
  entity_id uuid,
  message text,
  is_read boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  title text,
  type character varying DEFAULT 'info'::character varying CHECK (type::text = ANY (ARRAY['info'::character varying, 'success'::character varying, 'warning'::character varying, 'error'::character varying, 'resource_request'::character varying]::text[])),
  read_at timestamp without time zone,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text UNIQUE,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  username character varying UNIQUE,
  password_hash text,
  org_email character varying UNIQUE,
  is_active boolean DEFAULT false,
  onboarded_at timestamp with time zone,
  mobile_number character varying CHECK (mobile_number IS NULL OR mobile_number::text ~ '^[\+]?[1-9][\d\-\(\)\s]{7,18}$'::text),
  otp character varying,
  otp_expires_at timestamp with time zone,
  otp_verified boolean DEFAULT false,
  mobile_verified boolean DEFAULT false,
  associated_departments ARRAY,
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.priorities (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  description text,
  color_code character varying DEFAULT '#6b7280'::character varying,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  organization_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT priorities_pkey PRIMARY KEY (id),
  CONSTRAINT priorities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.project_department (
  project_id uuid NOT NULL,
  department_id uuid NOT NULL,
  CONSTRAINT project_department_pkey PRIMARY KEY (project_id, department_id),
  CONSTRAINT project_department_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_department_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.project_docs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  author_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  visibility text DEFAULT 'project'::text,
  is_public boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_by uuid,
  file_url text,
  file_name text,
  file_type text CHECK (file_type IS NULL OR (file_type = ANY (ARRAY['application/pdf'::text, 'application/msword'::text, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::text, 'image/jpeg'::text, 'image/jpg'::text, 'image/png'::text, 'image/gif'::text, 'image/webp'::text]))),
  file_size bigint,
  has_file boolean DEFAULT false,
  CONSTRAINT project_docs_pkey PRIMARY KEY (id),
  CONSTRAINT project_docs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_docs_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id),
  CONSTRAINT project_docs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);
CREATE TABLE public.project_statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  description text,
  color_code character varying DEFAULT '#6b7280'::character varying,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  organization_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by uuid,
  CONSTRAINT project_statuses_pkey PRIMARY KEY (id),
  CONSTRAINT project_statuses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT project_statuses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_by uuid,
  updated_by uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  status_id uuid,
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT projects_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id),
  CONSTRAINT projects_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.project_statuses(id)
);
CREATE TABLE public.resource_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  requested_user_id uuid NOT NULL,
  user_department_id uuid NOT NULL,
  status character varying NOT NULL DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying::text, 'approved'::character varying::text, 'rejected'::character varying::text, 'cancelled'::character varying::text])),
  message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_notes text,
  CONSTRAINT resource_requests_pkey PRIMARY KEY (id),
  CONSTRAINT resource_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT resource_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id),
  CONSTRAINT resource_requests_requested_user_id_fkey FOREIGN KEY (requested_user_id) REFERENCES public.users(id),
  CONSTRAINT resource_requests_user_department_id_fkey FOREIGN KEY (user_department_id) REFERENCES public.departments(id),
  CONSTRAINT resource_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);
CREATE TABLE public.shared_projects (
  project_id uuid NOT NULL,
  department_id uuid NOT NULL,
  shared_by uuid,
  shared_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shared_projects_pkey PRIMARY KEY (project_id, department_id),
  CONSTRAINT shared_projects_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT shared_projects_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT shared_projects_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES public.users(id)
);
CREATE TABLE public.statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  type text NOT NULL,
  color_code character varying,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT statuses_pkey PRIMARY KEY (id),
  CONSTRAINT statuses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color_code character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ticket_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  user_id uuid NOT NULL,
  parent_comment_id uuid,
  comment text NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  organization_id uuid,
  content text,
  is_deleted boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ticket_comments_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id),
  CONSTRAINT ticket_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT ticket_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.ticket_comments(id),
  CONSTRAINT ticket_comments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  created_by uuid NOT NULL,
  assigned_to uuid,
  title text NOT NULL,
  description text,
  status_id uuid,
  priority_id uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_by uuid,
  CONSTRAINT tickets_pkey PRIMARY KEY (id),
  CONSTRAINT tickets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id),
  CONSTRAINT tickets_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.statuses(id),
  CONSTRAINT tickets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id),
  CONSTRAINT tickets_priority_id_fkey FOREIGN KEY (priority_id) REFERENCES public.priorities(id)
);
CREATE TABLE public.user_department (
  user_id uuid NOT NULL,
  department_id uuid NOT NULL,
  CONSTRAINT user_department_pkey PRIMARY KEY (user_id, department_id),
  CONSTRAINT user_department_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_department_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.user_department_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  department_id uuid NOT NULL,
  role_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_department_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_department_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_department_roles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT user_department_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.global_roles(id),
  CONSTRAINT user_department_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.user_organization_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  role_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_organization_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_organization_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_organization_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT user_organization_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.global_roles(id)
);
CREATE TABLE public.user_project (
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  role_id uuid NOT NULL,
  CONSTRAINT user_project_pkey PRIMARY KEY (user_id, project_id),
  CONSTRAINT user_project_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_project_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT user_project_global_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.global_roles(id),
  CONSTRAINT user_project_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.global_roles(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  profile_image text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  otp character varying,
  otp_expires_at timestamp without time zone,
  otp_verified boolean DEFAULT false,
  profile_picture_url text,
  about text,
  phone character varying,
  location character varying,
  job_title character varying,
  department character varying,
  date_of_birth date,
  profile_updated_at timestamp with time zone DEFAULT now(),
  email_notifications_enabled boolean DEFAULT true,
  dark_mode_enabled boolean DEFAULT false,
  organization_id uuid,
  department_id uuid,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);