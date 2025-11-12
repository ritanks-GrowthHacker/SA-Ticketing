import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    // Validate required fields
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    // First, get the organization to find its associated departments
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('associated_departments')
      .eq('id', orgId)
      .single();

    if (orgError) {
      console.error('Error fetching organization:', orgError);
      return NextResponse.json(
        { error: 'Failed to fetch organization' },
        { status: 500 }
      );
    }

    // Get all departments for this organization
    const { data: allDepartments, error: deptError } = await supabase
      .from('departments')
      .select('id, name, color_code, description')
      .in('id', organization.associated_departments || [])
      .order('name');

    if (deptError) {
      console.error('Error fetching departments:', deptError);
    }

    // Get employees for this organization with their role information
    const { data: employees, error: employeeError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        job_title,
        phone,
        location,
        department,
        created_at,
        user_organization_roles!inner(
          role_id,
          global_roles(
            id,
            name
          )
        )
      `)
      .eq('user_organization_roles.organization_id', orgId)
      .order('name');

    if (employeeError) {
      console.error('Error fetching employees:', employeeError);
      return NextResponse.json(
        { error: 'Failed to fetch employees' },
        { status: 500 }
      );
    }

    // Map employees with their role information
    const employeesWithDepartments = (employees || []).map((employee: any) => {
      // Extract role information
      const roleInfo = employee.user_organization_roles?.[0]?.global_roles;
      
      return {
        ...employee,
        department_id: employee.department, // Use department name
        department_name: employee.department || 'Unassigned',
        current_role: roleInfo?.name || null,
        current_role_id: roleInfo?.id || null,
        user_organization_roles: undefined // Remove nested data from response
      };
    });

    // Create department list with employee counts
    const departmentsWithCounts = (allDepartments || []).map(dept => {
      const employeeCount = employeesWithDepartments.filter(
        emp => emp.department === dept.name
      ).length;
      
      return {
        id: dept.name, // Use department name as ID for filtering
        name: dept.name,
        employee_count: employeeCount,
        color_code: dept.color_code || '#3B82F6',
        description: dept.description
      };
    });

    return NextResponse.json({
      success: true,
      employees: employeesWithDepartments,
      departments: departmentsWithCounts
    }, { status: 200 });

  } catch (error) {
    console.error('Organization employees error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}