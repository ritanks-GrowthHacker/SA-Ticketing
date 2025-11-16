import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

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

    // Get employees in this department - support both org and department roles
    const { data: employees, error } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        job_title,
        department,
        department_id,
        organization_id,
        user_organization_roles(
          organization_id,
          global_roles(name)
        ),
        user_department_roles(
          organization_id,
          department_id,
          global_roles(name)
        )
      `)
      .eq('department_id', departmentId)
      .eq('organization_id', orgId)
      .order('name');

    if (error) {
      console.error('Error fetching department employees:', error);
      return NextResponse.json(
        { error: 'Failed to fetch employees' },
        { status: 500 }
      );
    }

    // Format the response - prioritize org role, fallback to dept role
    const formattedEmployees = (employees || []).map((emp: any) => {
      let role = 'Member';
      
      // Check org role first
      if (emp.user_organization_roles && emp.user_organization_roles.length > 0) {
        const orgRole = emp.user_organization_roles.find((r: any) => r.organization_id === orgId);
        if (orgRole?.global_roles?.name) {
          role = orgRole.global_roles.name;
        }
      }
      
      // Fallback to department role
      if (role === 'Member' && emp.user_department_roles && emp.user_department_roles.length > 0) {
        const deptRole = emp.user_department_roles.find((r: any) => 
          r.organization_id === orgId && r.department_id === departmentId
        );
        if (deptRole?.global_roles?.name) {
          role = deptRole.global_roles.name;
        }
      }
      
      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        job_title: emp.job_title,
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
