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

    // Get employees in this department
    const { data: employees, error } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        job_title,
        department,
        department_id,
        user_organization_roles!inner(
          organization_id,
          global_roles(name)
        )
      `)
      .eq('department_id', departmentId)
      .eq('user_organization_roles.organization_id', orgId)
      .order('name');

    if (error) {
      console.error('Error fetching department employees:', error);
      return NextResponse.json(
        { error: 'Failed to fetch employees' },
        { status: 500 }
      );
    }

    // Format the response
    const formattedEmployees = (employees || []).map((emp: any) => ({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      job_title: emp.job_title,
      department: emp.department,
      role: emp.user_organization_roles?.[0]?.global_roles?.name || 'Member'
    }));

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
