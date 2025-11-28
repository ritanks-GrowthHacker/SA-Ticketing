import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, users, departments, organizations, userDepartmentRoles, userOrganizationRoles, globalRoles, eq, inArray, and, sql } from '@/lib/db-helper';
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
          const deptRoles = await db.select({
            departmentId: userDepartmentRoles.departmentId,
            roleName: globalRoles.name
          })
            .from(userDepartmentRoles)
            .innerJoin(globalRoles, eq(userDepartmentRoles.roleId, globalRoles.id))
            .where(and(
              eq(userDepartmentRoles.userId, decoded.sub),
              eq(userDepartmentRoles.organizationId, orgId)
            ));
          
          // Filter departments where user is Admin
          if (deptRoles) {
            userDepartments = deptRoles
              .filter((dr: any) => dr.roleName === 'Admin')
              .map((dr: any) => dr.departmentId);
          }
        }
      } catch (error) {
        console.error('Token verification error:', error);
      }
    }

    // First, get the organization to find its associated departments
    const orgResults = await db.select({
      associatedDepartments: organizations.associatedDepartments
    })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const organization = orgResults[0];
    if (!organization) {
      console.error('Error fetching organization');
      return NextResponse.json(
        { error: 'Failed to fetch organization' },
        { status: 500 }
      );
    }

    // Get all departments for this organization
    let allDepartments;
    if (!isOrgAdmin && userDepartments.length > 0) {
      // Department admin - only their departments
      allDepartments = await db.select({
        id: departments.id,
        name: departments.name,
        colorCode: departments.colorCode,
        description: departments.description
      })
        .from(departments)
        .where(and(
          inArray(departments.id, organization.associatedDepartments || []),
          inArray(departments.id, userDepartments)
        ))
        .orderBy(departments.name);
    } else {
      // Org admin - all departments
      allDepartments = await db.select({
        id: departments.id,
        name: departments.name,
        colorCode: departments.colorCode,
        description: departments.description
      })
        .from(departments)
        .where(inArray(departments.id, organization.associatedDepartments || []))
        .orderBy(departments.name);
    }

    // Get ALL users who have either:
    // 1. Active in user_organisation_role for this org
    // 2. Have department roles in user_department_roles for this org
    
    const departmentIds = allDepartments?.map(d => d.id) || [];
    
    // First get users with department roles (this is the primary source)
    let usersWithDeptRoles: any[] = [];
    
    if (departmentIds.length > 0) {
      // FIX: Use Drizzle ORM instead of raw SQL with ANY
      const deptRoleResults = await db.select({
        userId: userDepartmentRoles.userId,
        departmentId: userDepartmentRoles.departmentId,
        roleId: userDepartmentRoles.roleId,
        userName: users.name,
        userEmail: users.email,
        userJobTitle: users.jobTitle,
        userPhone: users.phone,
        userLocation: users.location,
        userDepartment: users.department,
        userDepartmentId: users.departmentId,
        userOrganizationId: users.organizationId,
        userCreatedAt: users.createdAt,
        roleName: globalRoles.name
      })
        .from(userDepartmentRoles)
        .innerJoin(users, eq(userDepartmentRoles.userId, users.id))
        .leftJoin(globalRoles, eq(userDepartmentRoles.roleId, globalRoles.id))
        .where(and(
          inArray(userDepartmentRoles.departmentId, departmentIds),
          eq(userDepartmentRoles.organizationId, orgId)
        ));
      
      // Map to match the old structure
      usersWithDeptRoles = deptRoleResults.map(row => ({
        user_id: row.userId,
        department_id: row.departmentId,
        role_id: row.roleId,
        user_name: row.userName,
        user_email: row.userEmail,
        user_job_title: row.userJobTitle,
        user_phone: row.userPhone,
        user_location: row.userLocation,
        user_department: row.userDepartment,
        user_department_id: row.userDepartmentId,
        user_organization_id: row.userOrganizationId,
        user_created_at: row.userCreatedAt,
        role_name: row.roleName
      }));
    }

    // Get user IDs who are active in this organization (from user_organisation_role)
    const activeOrgUsersResult = await db.select({
      userId: userOrganizationRoles.userId
    })
      .from(userOrganizationRoles)
      .where(eq(userOrganizationRoles.organizationId, orgId));
    
    const activeOrgUserIds = activeOrgUsersResult.map(u => u.userId);
    
    // Get users who have org roles
    let usersWithOrgRoles: any[] = [];
    if (activeOrgUserIds.length > 0) {
      usersWithOrgRoles = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        jobTitle: users.jobTitle,
        phone: users.phone,
        location: users.location,
        department: users.department,
        departmentId: users.departmentId,
        organizationId: users.organizationId,
        createdAt: users.createdAt
      })
        .from(users)
        .where(inArray(users.id, activeOrgUserIds));
    }

    // Merge and deduplicate users
    const userMap = new Map();
    
    // Add users with org roles
    usersWithOrgRoles.forEach((user: any) => {
      userMap.set(user.id, { ...user, departmentRoles: [] });
    });
    
    // Add/update users with dept roles
    usersWithDeptRoles.forEach((deptRole: any) => {
      const userId = deptRole.user_id;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          id: userId,
          name: deptRole.user_name,
          email: deptRole.user_email,
          jobTitle: deptRole.user_job_title,
          phone: deptRole.user_phone,
          location: deptRole.user_location,
          department: deptRole.user_department,
          departmentId: deptRole.user_department_id,
          organizationId: deptRole.user_organization_id,
          createdAt: deptRole.user_created_at,
          departmentRoles: []
        });
      }
      userMap.get(userId).departmentRoles.push({
        department_id: deptRole.department_id,
        role_id: deptRole.role_id,
        role_name: deptRole.role_name
      });
    });

    const allUsers = Array.from(userMap.values());

    // Now get org and dept role details for all users
    const userIds = allUsers.map((u: any) => u.id);
    
    const orgRoles = userIds.length > 0 ? await db.select({
      userId: userOrganizationRoles.userId,
      roleId: userOrganizationRoles.roleId,
      organizationId: userOrganizationRoles.organizationId,
      roleGlobalId: globalRoles.id,
      roleName: globalRoles.name
    })
      .from(userOrganizationRoles)
      .leftJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
      .where(and(
        inArray(userOrganizationRoles.userId, userIds),
        eq(userOrganizationRoles.organizationId, orgId)
      ))
      : [];

    // Create org role map
    const orgRoleMap = new Map();
    (orgRoles || []).forEach((role: any) => {
      orgRoleMap.set(role.userId, {
        userId: role.userId,
        global_roles: {
          id: role.roleGlobalId,
          name: role.roleName
        }
      });
    });

    // Filter employees based on department admin permissions
    let filteredUsers = allUsers;
    if (!isOrgAdmin && userDepartments.length > 0) {
      filteredUsers = allUsers.filter((user: any) => {
        // Include if user's primary department matches
        if (user.departmentId && userDepartments.includes(user.departmentId)) {
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
      // Get org-level role (if exists)
      let orgRoleInfo = null;
      let orgRoleType = null;
      
      const orgRole = orgRoleMap.get(employee.id);
      if (orgRole?.global_roles) {
        orgRoleInfo = orgRole.global_roles;
        orgRoleType = 'organization';
      }
      
      // Get all departments user belongs to
      const userDepts = new Set<string>();
      
      // Add primary department
      if (employee.departmentId) {
        userDepts.add(employee.departmentId);
      }
      
      // Add all departments from department roles
      employee.departmentRoles?.forEach((dr: any) => {
        userDepts.add(dr.department_id);
      });
      
      // Find primary department info
      const primaryDeptId = employee.departmentId || (employee.departmentRoles?.[0]?.department_id);
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
        job_title: employee.jobTitle,
        phone: employee.phone,
        location: employee.location,
        department: employee.department,
        department_id: primaryDeptId,
        department_name: matchingDept?.name || employee.department || 'Unassigned',
        all_departments: Array.from(userDepts), // All department IDs user belongs to
        organization_id: employee.organizationId,
        created_at: employee.createdAt,
        current_role: orgRoleInfo?.name || null, // Org-level role only
        current_role_id: orgRoleInfo?.id || null, // Org-level role ID only
        role_type: orgRoleType, // 'organization' or null
        department_roles: departmentRoleMap // Map of department_id -> role info
      };
    });

    // Create department list with employee counts (count users in ANY department role)
    const departmentsWithCounts = (allDepartments || []).map((dept: any) => {
      const employeeCount = employeesWithDepartments.filter(
        emp => emp.all_departments?.includes(dept.id) || emp.department_id === dept.id || emp.department === dept.name
      ).length;
      
      return {
        id: dept.id, // Use actual department UUID as ID
        name: dept.name,
        employee_count: employeeCount,
        color_code: dept.colorCode || '#3B82F6',
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