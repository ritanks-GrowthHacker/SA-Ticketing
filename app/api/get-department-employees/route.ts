import { NextRequest, NextResponse } from 'next/server';
// Supabase (commented out - migrated to PostgreSQL)
// import { supabase } from '@/app/db/connections';

// PostgreSQL with Drizzle ORM
import { db, users, userOrganizationRoles, userDepartmentRoles, globalRoles, eq, and } from '@/lib/db-helper';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const orgId = searchParams.get('orgId');

    if (!departmentId || !orgId) {
      return NextResponse.json(
        { error: 'Department ID and Organization ID are required' },
        { status: 400 }
      );
    }

    // Get employees in this department
    // Supabase (commented out)
    // const { data: employees, error } = await supabase.from('users').select(`...`)

    // PostgreSQL with Drizzle
    const employees = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        jobTitle: users.jobTitle,
        department: users.department,
        departmentId: users.departmentId,
        organizationId: users.organizationId
      })
      .from(users)
      .where(
        and(
          eq(users.departmentId, departmentId),
          eq(users.organizationId, orgId)
        )
      )
      .orderBy(users.name);

    if (!employees) {
      console.error('Error fetching department employees');
      return NextResponse.json(
        { error: 'Failed to fetch employees' },
        { status: 500 }
      );
    }

    // Get org roles for these employees
    const employeeIds = employees.map(e => e.id);
    const orgRoles = await db
      .select({
        userId: userOrganizationRoles.userId,
        organizationId: userOrganizationRoles.organizationId,
        roleName: globalRoles.name
      })
      .from(userOrganizationRoles)
      .innerJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
      .where(eq(userOrganizationRoles.organizationId, orgId));

    // Get dept roles for these employees
    const deptRoles = await db
      .select({
        userId: userDepartmentRoles.userId,
        organizationId: userDepartmentRoles.organizationId,
        departmentId: userDepartmentRoles.departmentId,
        roleName: globalRoles.name
      })
      .from(userDepartmentRoles)
      .innerJoin(globalRoles, eq(userDepartmentRoles.roleId, globalRoles.id))
      .where(
        and(
          eq(userDepartmentRoles.organizationId, orgId),
          eq(userDepartmentRoles.departmentId, departmentId)
        )
      );

    // Format the response - prioritize org role, fallback to dept role
    const formattedEmployees = (employees || []).map((emp: any) => {
      let role = 'Member';
      
      // Check org role first
      const orgRole = orgRoles.find((r: any) => r.userId === emp.id && r.organizationId === orgId);
      if (orgRole?.roleName) {
        role = orgRole.roleName;
      }
      
      // Fallback to department role
      if (role === 'Member') {
        const deptRole = deptRoles.find((r: any) => 
          r.userId === emp.id && r.organizationId === orgId && r.departmentId === departmentId
        );
        if (deptRole?.roleName) {
          role = deptRole.roleName;
        }
      }
      
      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        job_title: emp.jobTitle,
        department: emp.department,
        role: role
      };
    });

    return NextResponse.json({
      success: true,
      employees: formattedEmployees
    });

  } catch (error) {
    console.error('Get department employees error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
