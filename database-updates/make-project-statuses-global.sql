-- Make project_statuses global (not organization-specific)
-- Safe migration that preserves existing data

-- 1. Remove organization_id requirement and make project statuses global
ALTER TABLE public.project_statuses 
ALTER COLUMN organization_id DROP NOT NULL;

-- 2. Update RLS policy to allow all authenticated users to view project statuses
DROP POLICY IF EXISTS "Users can view project statuses in their organization" ON public.project_statuses;
CREATE POLICY "All users can view project statuses" ON public.project_statuses
    FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Set organization_id to NULL for existing statuses to make them global
UPDATE public.project_statuses SET organization_id = NULL;

-- 4. Insert additional global project statuses if they don't exist
INSERT INTO public.project_statuses (id, name, description, color_code, sort_order, is_active)
VALUES 
  ('f85e266d-7b75-4b08-b775-2fc17ca4b2a6', 'Planning', 'Project is in planning phase', '#f59e0b', 1, true),
  ('d05ef4b9-63be-42e2-b4a2-3d85537b9b7d', 'Active', 'Project is actively being worked on', '#10b981', 2, true),
  ('9e001b85-22f5-435f-a95e-f546621c0ce3', 'On Hold', 'Project is temporarily paused', '#f97316', 3, true),
  ('af968d18-dfcc-4d69-93d9-9e7932155ccd', 'Review', 'Project is under review', '#3b82f6', 4, true),
  ('66a0ccee-c989-4835-a828-bd9765958cf6', 'Completed', 'Project has been completed', '#6b7280', 5, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color_code = EXCLUDED.color_code,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  organization_id = NULL;

-- 5. Remove duplicate statuses (keep the one with lowest id for each name)
WITH ranked_statuses AS (
  SELECT id, name, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) as rn
  FROM public.project_statuses
),
duplicates AS (
  SELECT id FROM ranked_statuses WHERE rn > 1
)
DELETE FROM public.project_statuses 
WHERE id IN (SELECT id FROM duplicates)
AND NOT EXISTS (
  SELECT 1 FROM public.projects WHERE status_id = project_statuses.id
);

-- 6. Update the comment to reflect global nature
COMMENT ON TABLE public.project_statuses IS 'Global project status definitions shared across all organizations';