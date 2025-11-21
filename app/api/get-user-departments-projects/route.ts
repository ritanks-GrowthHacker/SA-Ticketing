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
    const currentDepartmentId = decoded.department_id;
    const departmentRole = decoded.department_role; // Admin, Manager, or Member

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

    // Get projects based on department role
    let userProjects;
    
    if (departmentRole === 'Admin' && currentDepartmentId) {
      // Department Admin: Get ALL projects in the current department
      const { data: allDeptProjects, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          organization_id,
          created_at,
          project_department!inner(
            department_id,
            departments(id, name)
          )
        `)
        .eq('organization_id', organizationId)
        .eq('project_department.department_id', currentDepartmentId)
        .order('created_at', { ascending: true });

      if (projectsError) {
        console.error('Error fetching department projects:', projectsError);
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
      }

      // Format as admin with full access
      userProjects = (allDeptProjects || []).map((project: any) => {
        const projectDept = project.project_department?.[0];
        return {
          projects: {
            id: project.id,
            name: project.name,
            organization_id: project.organization_id,
            created_at: project.created_at,
            project_department: project.project_department
          },
          global_roles: { name: 'Admin', id: null }
        };
      });

    } else {
      // Department Manager or Regular User: Get only projects they're assigned to
      const { data: assignedProjects, error: projectsError } = await supabase
        .from('user_project')
        .select(`
          project_id,
          projects!inner(
            id,
            name,
            organization_id,
            created_at,
            project_department(
              department_id,
              departments(id, name)
            )
          ),
          global_roles!user_project_role_id_fkey(id, name)
        `)
        .eq('user_id', userId)
        .eq('projects.organization_id', organizationId)
        .order('projects(created_at)', { ascending: true });

      if (projectsError) {
        console.error('Error fetching user projects:', projectsError);
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
      }

      userProjects = assignedProjects || [];
    }

    // Format projects with department information
    const projects = (userProjects || []).map((up: any) => {
      // project_department is an array, get the first one
      const projectDept = up.projects.project_department?.[0];
      
      return {
        id: up.projects.id,
        name: up.projects.name,
        role: up.global_roles?.name || 'Member',
        role_id: up.global_roles?.id,
        department_id: projectDept?.department_id,
        department_name: projectDept?.departments?.name,
        created_at: up.projects.created_at
      };
    });

    // Group projects by department
    const projectsByDepartment: { [key: string]: any[] } = {};
    projects.forEach((project: any) => {
      const deptId = project.department_id || 'unassigned';
      if (!projectsByDepartment[deptId]) {
        projectsByDepartment[deptId] = [];
      }
      projectsByDepartment[deptId].push(project);
    });

    // Get the first project (default)
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
