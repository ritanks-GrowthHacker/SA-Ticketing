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

    // Get ALL users who have either:
    // 1. organization_id matching (user_organization_roles)
    // 2. department roles in this org (user_department_roles)
    
    // First get users with org roles
    const { data: usersWithOrgRoles, error: orgUsersError } = await supabase
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
        created_at
      `)
      .eq('organization_id', orgId);

    // Then get users with department roles (might not have org role)
    const departmentIds = allDepartments?.map(d => d.id) || [];
    let usersWithDeptRoles: any[] = [];
    
    if (departmentIds.length > 0) {
      const { data: deptRoleUsers } = await supabase
        .from('user_department_roles')
        .select(`
          user_id,
          department_id,
          role_id,
          users!inner(
            id,
            name,
            email,
            job_title,
            phone,
            location,
            department,
            department_id,
            organization_id,
            created_at
          ),
          global_roles(id, name)
        `)
        .in('department_id', departmentIds)
        .eq('organization_id', orgId);
      
      usersWithDeptRoles = deptRoleUsers || [];
    }

    // Merge and deduplicate users
    const userMap = new Map();
    
    // Add users with org roles
    (usersWithOrgRoles || []).forEach((user: any) => {
      userMap.set(user.id, { ...user, departmentRoles: [] });
    });
    
    // Add/update users with dept roles
    usersWithDeptRoles.forEach((deptRole: any) => {
      const user = deptRole.users;
      if (!userMap.has(user.id)) {
        userMap.set(user.id, { ...user, departmentRoles: [] });
      }
      userMap.get(user.id).departmentRoles.push({
        department_id: deptRole.department_id,
        role_id: deptRole.role_id,
        role_name: deptRole.global_roles?.name
      });
    });

    const allUsers = Array.from(userMap.values());

    // Now get org and dept role details for all users
    const userIds = allUsers.map((u: any) => u.id);
    
    const { data: orgRoles } = userIds.length > 0 ? await supabase
      .from('user_organization_roles')
      .select(`
        user_id,
        role_id,
        organization_id,
        global_roles(id, name)
      `)
      .in('user_id', userIds)
      .eq('organization_id', orgId)
      : { data: [] };

    // Create org role map
    const orgRoleMap = new Map();
    (orgRoles || []).forEach((role: any) => {
      orgRoleMap.set(role.user_id, role);
    });

    // Filter employees based on department admin permissions
    let filteredUsers = allUsers;
    if (!isOrgAdmin && userDepartments.length > 0) {
      filteredUsers = allUsers.filter((user: any) => {
        // Include if user's primary department matches
        if (user.department_id && userDepartments.includes(user.department_id)) {
          return true;
        }
        // Include if user has any role in admin's departments
        if (user.departmentRoles?.some((dr: any) => userDepartments.includes(dr.department_id))) {
          return true;
        }
        return false;
      });
    }

    // Map employees with their role information and ALL their departments
    const employeesWithDepartments = filteredUsers.map((employee: any) => {
      // Extract role information - prioritize org role, fallback to department role
      let roleInfo = null;
      let roleType = null;
      
      const orgRole = orgRoleMap.get(employee.id);
      if (orgRole?.global_roles) {
        roleInfo = orgRole.global_roles;
        roleType = 'organization';
      }
      
      if (!roleInfo && employee.departmentRoles && employee.departmentRoles.length > 0) {
        // Use first department role
        roleInfo = {
          id: employee.departmentRoles[0].role_id,
          name: employee.departmentRoles[0].role_name
        };
        roleType = 'department';
      }
      
      // Get all departments user belongs to
      const userDepts = new Set<string>();
      
      // Add primary department
      if (employee.department_id) {
        userDepts.add(employee.department_id);
      }
      
      // Add all departments from department roles
      employee.departmentRoles?.forEach((dr: any) => {
        userDepts.add(dr.department_id);
      });
      
      // Find primary department info
      const primaryDeptId = employee.department_id || (employee.departmentRoles?.[0]?.department_id);
      const matchingDept = allDepartments?.find(d => d.id === primaryDeptId);
      
      // Create department-specific role map
      const departmentRoleMap: Record<string, { role_id: string; role_name: string }> = {};
      employee.departmentRoles?.forEach((dr: any) => {
        departmentRoleMap[dr.department_id] = {
          role_id: dr.role_id,
          role_name: dr.role_name
        };
      });
      
      return {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        job_title: employee.job_title,
        phone: employee.phone,
        location: employee.location,
        department: employee.department,
        department_id: primaryDeptId,
        department_name: matchingDept?.name || employee.department || 'Unassigned',
        all_departments: Array.from(userDepts), // All department IDs user belongs to
        organization_id: employee.organization_id,
        created_at: employee.created_at,
        current_role: roleInfo?.name || null,
        current_role_id: roleInfo?.id || null,
        role_type: roleType,
        department_roles: departmentRoleMap // Map of department_id -> role info
      };
    });

    // Create department list with employee counts (count users in ANY department role)
    const departmentsWithCounts = (allDepartments || []).map(dept => {
      const employeeCount = employeesWithDepartments.filter(
        emp => emp.all_departments?.includes(dept.id) || emp.department_id === dept.id || emp.department === dept.name
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