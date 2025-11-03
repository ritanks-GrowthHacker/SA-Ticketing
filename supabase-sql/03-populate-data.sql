-- =============================================
-- STEP 3: POPULATE ORGANIZATION_ID AND CONTENT
-- =============================================
-- Copy existing comment data to content field and populate organization_id

-- Copy existing comment data to new content field
UPDATE public.ticket_comments 
SET content = comment 
WHERE content IS NULL AND comment IS NOT NULL;

-- Populate organization_id from ticket's project
UPDATE public.ticket_comments tc
SET organization_id = p.organization_id
FROM public.tickets t
JOIN public.projects p ON t.project_id = p.id
WHERE tc.ticket_id = t.id 
AND tc.organization_id IS NULL;