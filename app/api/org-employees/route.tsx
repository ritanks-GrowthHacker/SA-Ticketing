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

    // Get organization's departments
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('associated_departments')
      .eq('id', orgId)
      .single();

    if (orgError) {
      console.error('Error fetching organization:', orgError);
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get department details
    let departments = [];
    if (org.associated_departments && org.associated_departments.length > 0) {
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .in('id', org.associated_departments)
        .eq('is_active', true)
        .order('name');

      if (!deptError && deptData) {
        departments = deptData;
      }
    }

    // Get employees for this organization with their role information
    const { data: employees, error: employeeError } = await supabase
      .from('users')
      .select(`
        *,
        user_organization_roles!inner(
          organization_id,
          role_id,
          global_roles(
            id,
            name,
            description
          )
        )
      `)
      .eq('user_organization_roles.organization_id', orgId);

    if (employeeError) {
      console.error('Error fetching employees:', employeeError);
      return NextResponse.json(
        { error: 'Failed to fetch employees' },
        { status: 500 }
      );
    }

    // Process employees and add department information
    const employeesWithDepartments = (employees || []).map((employee: any) => {
      // Extract role information
      const roleInfo = employee.user_organization_roles?.[0]?.global_roles;
      
      // Find department by name or ID
      const dept = departments.find(d => 
        d.name === employee.department || d.id === employee.department
      );
      
      return {
        ...employee,
        department_id: dept?.id || null,
        department_name: dept?.name || employee.department || 'Unassigned',
        current_role: roleInfo?.name || null,
        current_role_id: roleInfo?.id || null,
        user_organization_roles: undefined // Remove nested data from response
      };
    });

    // Count employees per department
    const departmentsWithCounts = departments.map(dept => ({
      ...dept,
      employee_count: employeesWithDepartments.filter(emp => emp.department_id === dept.id).length
    }));

    // Add unassigned department if there are employees without departments
    const unassignedCount = employeesWithDepartments.filter(emp => !emp.department_id).length;
    if (unassignedCount > 0) {
      departmentsWithCounts.push({
        id: 'unassigned',
        name: 'Unassigned',
        color_code: '#6B7280',
        employee_count: unassignedCount,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

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