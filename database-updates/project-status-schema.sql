-- SQL Script to add Project Status functionality
-- Run this in your Supabase SQL editor

-- 1. Create project_statuses table
CREATE TABLE IF NOT EXISTS public.project_statuses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color_code VARCHAR(7) DEFAULT '#6b7280', -- Hex color for UI
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.users(id),
    
    -- Ensure unique status names per organization
    UNIQUE(organization_id, name)
);

-- 2. Add status_id column to existing projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES public.project_statuses(id);

-- 3. Create default project statuses for existing organizations
INSERT INTO public.project_statuses (name, description, color_code, sort_order, organization_id)
SELECT 
    status_name,
    status_description,
    color_code,
    sort_order,
    org.id as organization_id
FROM (
    VALUES 
        ('Planning', 'Project is in planning phase', '#f59e0b', 1),
        ('Active', 'Project is actively being worked on', '#10b981', 2),
        ('On Hold', 'Project is temporarily paused', '#f97316', 3),
        ('Review', 'Project is under review', '#3b82f6', 4),
        ('Completed', 'Project has been completed', '#6b7280', 5),
        ('Cancelled', 'Project has been cancelled', '#ef4444', 6)
) AS default_statuses(status_name, status_description, color_code, sort_order)
CROSS JOIN public.organizations org
WHERE NOT EXISTS (
    SELECT 1 FROM public.project_statuses ps 
    WHERE ps.organization_id = org.id
);

-- 4. Update existing projects to have default status (Active)
UPDATE public.projects 
SET status_id = (
    SELECT ps.id 
    FROM public.project_statuses ps 
    WHERE ps.name = 'Active' 
    AND ps.organization_id = projects.organization_id
    LIMIT 1
)
WHERE status_id IS NULL;

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_statuses_org_id ON public.project_statuses(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status_id ON public.projects(status_id);
CREATE INDEX IF NOT EXISTS idx_project_statuses_sort_order ON public.project_statuses(organization_id, sort_order);

-- 6. Enable RLS (Row Level Security)
ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for project_statuses
CREATE POLICY "Users can view project statuses in their organization" ON public.project_statuses
    FOR SELECT USING (organization_id = auth.jwt() ->> 'org_id'::uuid);

CREATE POLICY "Admins can manage project statuses" ON public.project_statuses
    FOR ALL USING (
        organization_id = auth.jwt() ->> 'org_id'::uuid 
        AND auth.jwt() ->> 'roles' LIKE '%Admin%'
    );

-- 8. Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_project_statuses_updated_at
    BEFORE UPDATE ON public.project_statuses
    FOR EACH ROW
    EXECUTE FUNCTION update_project_statuses_updated_at();

-- 9. Add helpful comments
COMMENT ON TABLE public.project_statuses IS 'Stores project status definitions per organization';
COMMENT ON COLUMN public.project_statuses.color_code IS 'Hex color code for UI display';
COMMENT ON COLUMN public.project_statuses.sort_order IS 'Display order in Kanban board';
COMMENT ON COLUMN public.projects.status_id IS 'Current status of the project';