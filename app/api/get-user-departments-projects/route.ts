import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from '@/app/db/connections';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const userId = decoded.sub;
    const organizationId = decoded.org_id;

    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get user's departments from user_department_roles
    const { data: departmentRoles, error: deptError } = await supabase
      .from('user_department_roles')
      .select(`
        department_id,
        departments!inner(id, name, color_code)
      `)
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (deptError) {
      console.error('Error fetching user departments:', deptError);
      return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }

    // Extract unique departments
    const departments = Array.from(
      new Map(
        (departmentRoles || []).map((dr: any) => [
          dr.departments.id,
          {
            id: dr.departments.id,
            name: dr.departments.name,
            color_code: dr.departments.color_code
          }
        ])
      ).values()
    );

    // Fetch all projects for the organization with their department links
    const { data: allProjects, error: allProjectsError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        organization_id,
        created_at,
        project_department(department_id, departments(id, name))
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (allProjectsError) {
      console.error('Error fetching projects for organization:', allProjectsError);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    // Fetch user_project entries to determine user's role on specific projects (if any)
    const { data: userProjectsMap } = await supabase
      .from('user_project')
      .select('project_id, global_roles!user_project_role_id_fkey(id, name)')
      .eq('user_id', userId);

    const roleByProject: { [key: string]: any } = {};
    (userProjectsMap || []).forEach((up: any) => {
      roleByProject[up.project_id] = up.global_roles || null;
    });

    // Filter projects that are linked to any of the user's departments
    const departmentIds = departments.map((d: any) => d.id);

    const projects = (allProjects || [])
      .map((p: any) => {
        const projDept = p.project_department?.[0];
        return {
          id: p.id,
          name: p.name,
          department_id: projDept?.department_id,
          department_name: projDept?.departments?.name,
          created_at: p.created_at,
          role: roleByProject[p.id]?.name || null,
          role_id: roleByProject[p.id]?.id || null
        };
      })
  .filter((p: any) => p.department_id && departmentIds.includes(p.department_id) && roleByProject[p.id]);

    // Group projects by department
    const projectsByDepartment: { [key: string]: any[] } = {};
    projects.forEach((project: any) => {
      const deptId = project.department_id || 'unassigned';
      if (!projectsByDepartment[deptId]) {
        projectsByDepartment[deptId] = [];
      }
      projectsByDepartment[deptId].push(project);
    });

    // Default project: first project in DB for the user (if any)
    const defaultProject = projects.length > 0 ? projects[0] : null;

    return NextResponse.json({
      success: true,
      departments,
      projects,
      projectsByDepartment,
      defaultProject,
      hasMultipleDepartments: departments.length > 1
    });

  } catch (error) {
    console.error('Error in get-user-departments-projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
