-- Fix foreign key constraints to allow user deletion
-- This allows users to be deleted without violating foreign key constraints

-- Drop and recreate project_statuses.created_by constraint with ON DELETE SET NULL
ALTER TABLE public.project_statuses
DROP CONSTRAINT IF EXISTS project_statuses_created_by_fkey;

ALTER TABLE public.project_statuses
ADD CONSTRAINT project_statuses_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Fix other user-related foreign keys that might prevent deletion

-- activity_logs.user_id - SET NULL when user is deleted
ALTER TABLE public.activity_logs
DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;

ALTER TABLE public.activity_logs
ADD CONSTRAINT activity_logs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- attachments.uploaded_by - SET NULL when user is deleted
ALTER TABLE public.attachments
DROP CONSTRAINT IF EXISTS attachments_uploaded_by_fkey;

ALTER TABLE public.attachments
ADD CONSTRAINT attachments_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- meetings.created_by - SET NULL when user is deleted
ALTER TABLE public.meetings
DROP CONSTRAINT IF EXISTS meetings_created_by_fkey;

ALTER TABLE public.meetings
ADD CONSTRAINT meetings_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- meeting_participants.user_id - CASCADE delete (remove participant record when user deleted)
ALTER TABLE public.meeting_participants
DROP CONSTRAINT IF EXISTS meeting_participants_user_id_fkey;

ALTER TABLE public.meeting_participants
ADD CONSTRAINT meeting_participants_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- projects.created_by and updated_by - SET NULL when user is deleted
ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_created_by_fkey;

ALTER TABLE public.projects
ADD CONSTRAINT projects_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_updated_by_fkey;

ALTER TABLE public.projects
ADD CONSTRAINT projects_updated_by_fkey 
FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- tickets.assigned_to, created_by, updated_by - SET NULL when user is deleted
ALTER TABLE public.tickets
DROP CONSTRAINT IF EXISTS tickets_assigned_to_fkey;

ALTER TABLE public.tickets
ADD CONSTRAINT tickets_assigned_to_fkey 
FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.tickets
DROP CONSTRAINT IF EXISTS tickets_created_by_fkey;

ALTER TABLE public.tickets
ADD CONSTRAINT tickets_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.tickets
DROP CONSTRAINT IF EXISTS tickets_updated_by_fkey;

ALTER TABLE public.tickets
ADD CONSTRAINT tickets_updated_by_fkey 
FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- project_users.user_id - CASCADE delete (remove project membership when user deleted)
ALTER TABLE public.project_users
DROP CONSTRAINT IF EXISTS project_users_user_id_fkey;

ALTER TABLE public.project_users
ADD CONSTRAINT project_users_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- user_department_roles.user_id - CASCADE delete (remove department roles when user deleted)
ALTER TABLE public.user_department_roles
DROP CONSTRAINT IF EXISTS user_department_roles_user_id_fkey;

ALTER TABLE public.user_department_roles
ADD CONSTRAINT user_department_roles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- comments.created_by - SET NULL when user is deleted
ALTER TABLE public.comments
DROP CONSTRAINT IF EXISTS comments_created_by_fkey;

ALTER TABLE public.comments
ADD CONSTRAINT comments_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- notifications.user_id - CASCADE delete (remove notifications when user deleted)
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- project_documents.uploaded_by, updated_by - SET NULL when user is deleted
ALTER TABLE public.project_documents
DROP CONSTRAINT IF EXISTS project_documents_uploaded_by_fkey;

ALTER TABLE public.project_documents
ADD CONSTRAINT project_documents_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.project_documents
DROP CONSTRAINT IF EXISTS project_documents_updated_by_fkey;

ALTER TABLE public.project_documents
ADD CONSTRAINT project_documents_updated_by_fkey 
FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT project_statuses_created_by_fkey ON public.project_statuses IS 'SET NULL on user deletion';
COMMENT ON CONSTRAINT activity_logs_user_id_fkey ON public.activity_logs IS 'SET NULL on user deletion';
COMMENT ON CONSTRAINT attachments_uploaded_by_fkey ON public.attachments IS 'SET NULL on user deletion';
COMMENT ON CONSTRAINT meetings_created_by_fkey ON public.meetings IS 'SET NULL on user deletion';
COMMENT ON CONSTRAINT meeting_participants_user_id_fkey ON public.meeting_participants IS 'CASCADE on user deletion';
COMMENT ON CONSTRAINT projects_created_by_fkey ON public.projects IS 'SET NULL on user deletion';
COMMENT ON CONSTRAINT projects_updated_by_fkey ON public.projects IS 'SET NULL on user deletion';
COMMENT ON CONSTRAINT tickets_assigned_to_fkey ON public.tickets IS 'SET NULL on user deletion';
COMMENT ON CONSTRAINT tickets_created_by_fkey ON public.tickets IS 'SET NULL on user deletion';
COMMENT ON CONSTRAINT tickets_updated_by_fkey ON public.tickets IS 'SET NULL on user deletion';
COMMENT ON CONSTRAINT project_users_user_id_fkey ON public.project_users IS 'CASCADE on user deletion';
COMMENT ON CONSTRAINT user_department_roles_user_id_fkey ON public.user_department_roles IS 'CASCADE on user deletion';
COMMENT ON CONSTRAINT comments_created_by_fkey ON public.comments IS 'SET NULL on user deletion';
COMMENT ON CONSTRAINT notifications_user_id_fkey ON public.notifications IS 'CASCADE on user deletion';
COMMENT ON CONSTRAINT project_documents_uploaded_by_fkey ON public.project_documents IS 'SET NULL on user deletion';
COMMENT ON CONSTRAINT project_documents_updated_by_fkey ON public.project_documents IS 'SET NULL on user deletion';
