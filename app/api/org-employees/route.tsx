import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
import jwt from 'jsonwebtoken';

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

    // Get user from token to check department-level permissions
    const authHeader = request.headers.get('authorization');
    let userDepartments: string[] = [];
    let isOrgAdmin = false;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
        
        // Check if user is org-level admin
        const userRole = decoded.role || decoded.roles?.[0];
        isOrgAdmin = ['Admin', 'Super Admin'].includes(userRole);
        
        // Get user's department roles
        if (!isOrgAdmin && decoded.sub) {
          const { data: deptRoles } = await supabase
            .from('user_department_roles')
            .select('department_id, global_roles!inner(name)')
            .eq('user_id', decoded.sub)
            .eq('organization_id', orgId);
          
          // Filter departments where user is Admin
          if (deptRoles) {
            userDepartments = deptRoles
              .filter((dr: any) => dr.global_roles?.name === 'Admin')
              .map((dr: any) => dr.department_id);
          }
        }
      } catch (error) {
        console.error('Token verification error:', error);
      }
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
    let departmentsQuery = supabase
      .from('departments')
      .select('id, name, color_code, description')
      .in('id', organization.associated_departments || [])
      .order('name');
    
    // If user is department admin (not org admin), filter to only their departments
    if (!isOrgAdmin && userDepartments.length > 0) {
      departmentsQuery = departmentsQuery.in('id', userDepartments);
    }

    const { data: allDepartments, error: deptError } = await departmentsQuery;

    if (deptError) {
      console.error('Error fetching departments:', deptError);
    }

    // Get employees for this organization with their role information
    // Use left join to include employees with only department roles
    let employeesQuery = supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        job_title,
        phone,
        location,
        department,
        department_id,
        organization_id,
        created_at,
        user_organization_roles(
          role_id,
          organization_id,
          global_roles(
            id,
            name
          )
        ),
        user_department_roles(
          role_id,
          department_id,
          global_roles(
            id,
            name
          )
        )
      `)
      .eq('organization_id', orgId);
    
    // If user is department admin, filter employees to only their departments
    if (!isOrgAdmin && userDepartments.length > 0) {
      employeesQuery = employeesQuery.in('department_id', userDepartments);
    }

    const { data: employees, error: employeeError } = await employeesQuery.order('name');

    if (employeeError) {
      console.error('Error fetching employees:', employeeError);
      return NextResponse.json(
        { error: 'Failed to fetch employees' },
        { status: 500 }
      );
    }

    // Map employees with their role information
    const employeesWithDepartments = (employees || []).map((employee: any) => {
      // Extract role information - prioritize org role, fallback to department role
      let roleInfo = null;
      let roleType = null;
      
      if (employee.user_organization_roles && employee.user_organization_roles.length > 0) {
        const orgRole = employee.user_organization_roles.find((r: any) => r.organization_id === orgId);
        if (orgRole?.global_roles) {
          roleInfo = orgRole.global_roles;
          roleType = 'organization';
        }
      }
      
      if (!roleInfo && employee.user_department_roles && employee.user_department_roles.length > 0) {
        const deptRole = employee.user_department_roles.find((r: any) => r.department_id === employee.department_id);
        if (deptRole?.global_roles) {
          roleInfo = deptRole.global_roles;
          roleType = 'department';
        }
      }
      
      // Find matching department by ID or name
      const deptId = employee.department_id;
      const matchingDept = allDepartments?.find(d => d.id === deptId);
      
      return {
        ...employee,
        department_id: deptId || employee.department,
        department_name: matchingDept?.name || employee.department || 'Unassigned',
        current_role: roleInfo?.name || null,
        current_role_id: roleInfo?.id || null,
        role_type: roleType,
        user_organization_roles: undefined, // Remove nested data from response
        user_department_roles: undefined
      };
    });

    // Create department list with employee counts
    const departmentsWithCounts = (allDepartments || []).map(dept => {
      const employeeCount = employeesWithDepartments.filter(
        emp => emp.department_id === dept.id || emp.department === dept.name
      ).length;
      
      return {
        id: dept.id, // Use actual department UUID as ID
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