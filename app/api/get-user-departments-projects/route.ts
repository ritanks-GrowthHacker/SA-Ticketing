import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
// Supabase (commented out - migrated to PostgreSQL)
// import { supabase } from '@/app/db/connections';

// PostgreSQL with Drizzle ORM
import { db, userDepartmentRoles, departments, userProject, projects, projectDepartment, globalRoles, eq, and, inArray, asc } from '@/lib/db-helper';

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
    // Supabase (commented out)
    // const { data: departmentRoles, error: deptError } = await supabase.from('user_department_roles').select(`...`)

    // PostgreSQL with Drizzle
    const departmentRoles = await db
      .select({
        departmentId: userDepartmentRoles.departmentId,
        deptId: departments.id,
        deptName: departments.name,
        deptColorCode: departments.colorCode
      })
      .from(userDepartmentRoles)
      .innerJoin(departments, eq(userDepartmentRoles.departmentId, departments.id))
      .where(
        and(
          eq(userDepartmentRoles.userId, userId),
          eq(userDepartmentRoles.organizationId, organizationId)
        )
      );

    if (!departmentRoles) {
      console.error('Error fetching user departments');
      return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }

    // Extract unique departments
    const deptList = Array.from(
      new Map(
        (departmentRoles || []).map((dr: any) => [
          dr.deptId,
          {
            id: dr.deptId,
            name: dr.deptName,
            color_code: dr.deptColorCode
          }
        ])
      ).values()
    );

    // Get projects based on department role
    let userProjects;
    
    if (departmentRole === 'Admin' && currentDepartmentId) {
      // Department Admin: Get ALL projects in the current department
      // Supabase (commented out)
      // const { data: allDeptProjects, error: projectsError } = await supabase.from('projects').select(`...`)

      // PostgreSQL with Drizzle
      const allDeptProjects = await db
        .select({
          id: projects.id,
          name: projects.name,
          organizationId: projects.organizationId,
          createdAt: projects.createdAt,
          departmentId: projectDepartment.departmentId,
          deptId: departments.id,
          deptName: departments.name
        })
        .from(projects)
        .innerJoin(projectDepartment, eq(projects.id, projectDepartment.projectId))
        .innerJoin(departments, eq(projectDepartment.departmentId, departments.id))
        .where(
          and(
            eq(projects.organizationId, organizationId),
            eq(projectDepartment.departmentId, currentDepartmentId)
          )
        )
        .orderBy(asc(projects.createdAt));

      if (!allDeptProjects) {
        console.error('Error fetching department projects');
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
      }

      // Format as admin with full access
      userProjects = (allDeptProjects || []).map((project: any) => ({
        projects: {
          id: project.id,
          name: project.name,
          organization_id: project.organizationId,
          created_at: project.createdAt,
          project_department: [{
            department_id: project.departmentId,
            departments: { id: project.deptId, name: project.deptName }
          }]
        },
        global_roles: { name: 'Admin', id: null }
      }));

    } else {
      // Department Manager or Regular User: Get only projects they're assigned to
      // DON'T filter by currentDepartmentId - user can be in multiple departments via user_department_roles
      // Supabase (commented out)
      // const { data: assignedProjects, error: projectsError } = await supabase.from('user_project').select(`...`)

      // PostgreSQL with Drizzle
      const assignedProjects = await db
        .select({
          projectId: userProject.projectId,
          projId: projects.id,
          projName: projects.name,
          projOrgId: projects.organizationId,
          projCreatedAt: projects.createdAt,
          deptId: projectDepartment.departmentId,
          deptIdMain: departments.id,
          deptName: departments.name,
          roleId: globalRoles.id,
          roleName: globalRoles.name
        })
        .from(userProject)
        .innerJoin(projects, eq(userProject.projectId, projects.id))
        .innerJoin(projectDepartment, eq(projects.id, projectDepartment.projectId))
        .innerJoin(departments, eq(projectDepartment.departmentId, departments.id))
        .innerJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
        .where(
          and(
            eq(userProject.userId, userId),
            eq(projects.organizationId, organizationId)
          )
        )
        .orderBy(asc(projects.createdAt));

      if (!assignedProjects) {
        console.error('Error fetching user projects');
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
      }

      // Format to match Supabase structure
      userProjects = (assignedProjects || []).map((ap: any) => ({
        projects: {
          id: ap.projId,
          name: ap.projName,
          organization_id: ap.projOrgId,
          created_at: ap.projCreatedAt,
          project_department: [{
            department_id: ap.deptId,
            departments: { id: ap.deptIdMain, name: ap.deptName }
          }]
        },
        global_roles: { id: ap.roleId, name: ap.roleName }
      }));
    }

    // Format projects with department information
    const formattedProjects = (userProjects || []).map((up: any) => {
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
    formattedProjects.forEach((project: any) => {
      const deptId = project.department_id || 'unassigned';
      if (!projectsByDepartment[deptId]) {
        projectsByDepartment[deptId] = [];
      }
      projectsByDepartment[deptId].push(project);
    });

    // Get the first project (default)
    const defaultProject = formattedProjects.length > 0 ? formattedProjects[0] : null;

    return NextResponse.json({
      success: true,
      departments: deptList,
      projects: formattedProjects,
      projectsByDepartment,
      defaultProject,
      hasMultipleDepartments: Array.from(deptList).length > 1
    });

  } catch (error) {
    console.error('Error in get-user-departments-projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
