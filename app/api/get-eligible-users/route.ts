import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db, users, departments, userOrganizationRoles, userDepartmentRoles, globalRoles, resourceRequests, eq, inArray, and, notInArray, sql } from '@/lib/db-helper';

/**
 * GET ELIGIBLE USERS FOR PROJECT ASSIGNMENT
 * 
 * Returns all users from departments EXCEPT:
 * - Sales
 * - Human Resource (or HR)
 * - Administration
 * 
 * These restricted departments require resource requests instead of direct assignment.
 */

// Restricted department names (normalized)
const RESTRICTED_DEPARTMENTS = ['sales', 'human resource', 'hr', 'administration', 'admin'];

// Function to check if a department name matches any restricted department
function isDepartmentRestricted(deptName: string | null | undefined): boolean {
  if (!deptName) return false;
  
  const normalized = deptName.toLowerCase().trim();
  
  // Direct match or contains match
  return RESTRICTED_DEPARTMENTS.some(restricted => {
    return normalized === restricted || 
           normalized.includes(restricted) || 
           restricted.includes(normalized);
  });
}

export async function GET(request: NextRequest) {
  try {
    // Verify JWT token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded: any;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const organizationId = decoded.org_id;

    // Get all user IDs who are active members of this organization
    const [orgMembers, deptMembers] = await Promise.all([
      db.select({ user_id: userOrganizationRoles.userId })
        .from(userOrganizationRoles)
        .where(eq(userOrganizationRoles.organizationId, organizationId)),
      db.select({ user_id: userDepartmentRoles.userId })
        .from(userDepartmentRoles)
        .where(eq(userDepartmentRoles.organizationId, organizationId))
    ]);

    // Combine and deduplicate user IDs from both sources
    const allUserIds = new Set<string>();
    (orgMembers || []).forEach((m: any) => allUserIds.add(m.user_id));
    (deptMembers || []).forEach((m: any) => allUserIds.add(m.user_id));
    
    const activeUserIds = Array.from(allUserIds);
    
    if (activeUserIds.length === 0) {
      console.log('⚠️ No active users found in organization');
      return NextResponse.json({
        success: true,
        users: [],
        allUsers: [],
        totalUsers: 0,
        eligibleUsers: 0,
        restrictedDepartments: RESTRICTED_DEPARTMENTS
      });
    }

    // First, get all restricted department IDs
    const restrictedDepts = await db
      .select({ id: departments.id, name: departments.name })
      .from(departments);

    const restrictedDeptIds = (restrictedDepts || [])
      .filter(dept => isDepartmentRestricted(dept.name))
      .map(dept => dept.id);

    console.log('🚫 Restricted departments:', restrictedDepts
      .filter(dept => isDepartmentRestricted(dept.name))
      .map(d => d.name));
    console.log('🚫 Restricted department IDs:', restrictedDeptIds);

    // Get all users in the organization with their department information
    const fetchedUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        jobTitle: users.jobTitle,
        department: users.department,
        departmentId: users.departmentId,
        profilePictureUrl: users.profilePictureUrl,
        createdAt: users.createdAt,
        organizationId: users.organizationId,
        deptName: departments.name
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(
        and(
          eq(users.organizationId, organizationId),
          inArray(users.id, activeUserIds)
        )
      );

    if (!fetchedUsers) {
      console.error('Error fetching users');
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    console.log(`📊 Total users fetched: ${fetchedUsers.length}`);

    // Get users who are in Engineering department (or any non-restricted department)
    // These users should be eligible regardless of their primary department
    const userDeptAssignments = await db.execute(sql`
      SELECT DISTINCT user_id, department_id
      FROM user_department_roles
    `);
    
    const usersInNonRestrictedDepts = new Set<string>();
    userDeptAssignments.rows.forEach((row: any) => {
      // Check if this department assignment is to a non-restricted department
      if (!restrictedDeptIds.includes(row.department_id)) {
        usersInNonRestrictedDepts.add(row.user_id);
      }
    });
    console.log(`📋 Found ${usersInNonRestrictedDepts.size} users assigned to non-restricted departments`);

    // Filter out users from restricted departments
    // EXCEPTION: Include users who have assignments in non-restricted departments
    const eligibleUsers = (fetchedUsers || []).filter((user: any) => {
      // If user is assigned to any non-restricted department, they're eligible
      if (usersInNonRestrictedDepts.has(user.id)) {
        console.log(`✅ Including user ${user.name} (${user.id}) - has assignment in non-restricted dept`);
        return true;
      }

      // Check if user's departmentId is in restricted list
      if (user.departmentId && restrictedDeptIds.includes(user.departmentId)) {
        console.log(`🚫 Filtering out user ${user.name} - restricted dept ID: ${user.departmentId}`);
        return false;
      }
      
      // Also check the department name string fields
      const deptNameFromJoin = user.deptName || '';
      const deptNameFromUser = user.department || '';
      
      if (isDepartmentRestricted(deptNameFromJoin)) {
        console.log(`🚫 Filtering out user ${user.name} - restricted dept (join): ${deptNameFromJoin}`);
        return false;
      }
      
      if (isDepartmentRestricted(deptNameFromUser)) {
        console.log(`🚫 Filtering out user ${user.name} - restricted dept (field): ${deptNameFromUser}`);
        return false;
      }
      
      console.log(`✅ Including user ${user.name} - dept: ${deptNameFromJoin || deptNameFromUser || 'None'}`);
      return true;
    });

    console.log(`✅ Eligible users after filtering: ${eligibleUsers.length}`);

    // Get user roles (both org and department roles)
    const eligibleUserIds = eligibleUsers.map((u: any) => u.id);
    const allUserIds2 = fetchedUsers.map((u: any) => u.id);
    
    let userRolesData: any[] = [];
    let userDeptRolesData: any[] = [];

    if (eligibleUserIds.length > 0) {
      [userRolesData, userDeptRolesData] = await Promise.all([
        db.select({
          userId: userOrganizationRoles.userId,
          roleName: globalRoles.name,
          roleId: globalRoles.id
        })
        .from(userOrganizationRoles)
        .innerJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
        .where(
          and(
            inArray(userOrganizationRoles.userId, eligibleUserIds),
            eq(userOrganizationRoles.organizationId, organizationId)
          )
        ),
        db.select({
          userId: userDepartmentRoles.userId,
          roleName: globalRoles.name,
          roleId: globalRoles.id
        })
        .from(userDepartmentRoles)
        .innerJoin(globalRoles, eq(userDepartmentRoles.roleId, globalRoles.id))
        .where(
          and(
            inArray(userDepartmentRoles.userId, eligibleUserIds),
            eq(userDepartmentRoles.organizationId, organizationId)
          )
        )
      ]);
    }

    // Get roles for ALL users (for allUsers response)
    let allUserRolesData: any[] = [];
    let allUserDeptRolesData: any[] = [];

    if (allUserIds2.length > 0) {
      [allUserRolesData, allUserDeptRolesData] = await Promise.all([
        db.select({
          userId: userOrganizationRoles.userId,
          roleName: globalRoles.name,
          roleId: globalRoles.id
        })
        .from(userOrganizationRoles)
        .innerJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
        .where(
          and(
            inArray(userOrganizationRoles.userId, allUserIds2),
            eq(userOrganizationRoles.organizationId, organizationId)
          )
        ),
        db.select({
          userId: userDepartmentRoles.userId,
          roleName: globalRoles.name,
          roleId: globalRoles.id
        })
        .from(userDepartmentRoles)
        .innerJoin(globalRoles, eq(userDepartmentRoles.roleId, globalRoles.id))
        .where(
          and(
            inArray(userDepartmentRoles.userId, allUserIds2),
            eq(userDepartmentRoles.organizationId, organizationId)
          )
        )
      ]);
    }

    // Map roles to eligible users
    // PRIORITY: Department role > Organization role (for department-based assignments)
    const roleMap: Record<string, string> = {};
    (userDeptRolesData || []).forEach((ur: any) => {
      if (ur.roleName) {
        roleMap[ur.userId] = ur.roleName; // Department role (priority 1)
      }
    });
    (userRolesData || []).forEach((ur: any) => {
      if (!roleMap[ur.userId] && ur.roleName) {
        roleMap[ur.userId] = ur.roleName; // Organization role (fallback)
      }
    });

    // Map roles to ALL users
    // PRIORITY: Department role > Organization role
    const allRoleMap: Record<string, string> = {};
    (allUserDeptRolesData || []).forEach((ur: any) => {
      if (ur.roleName) {
        allRoleMap[ur.userId] = ur.roleName; // Department role (priority 1)
      }
    });
    (allUserRolesData || []).forEach((ur: any) => {
      if (!allRoleMap[ur.userId] && ur.roleName) {
        allRoleMap[ur.userId] = ur.roleName; // Organization role (fallback)
      }
    });

    // Format eligible users response
    const formattedUsers = eligibleUsers.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      job_title: user.jobTitle,
      department: user.deptName || user.department,
      department_id: user.departmentId,
      profile_picture_url: user.profilePictureUrl,
      created_at: user.createdAt,
      role: roleMap[user.id] || 'Member'
    }));

    // Format ALL users (including restricted departments)
    const allFormattedUsers = (fetchedUsers || []).map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      job_title: user.jobTitle,
      department: user.deptName || user.department,
      department_id: user.departmentId,
      profile_picture_url: user.profilePictureUrl,
      created_at: user.createdAt,
      role: allRoleMap[user.id] || 'Member'
    }));

    console.log(`✅ GET ELIGIBLE USERS: Found ${formattedUsers.length} eligible users (${fetchedUsers?.length || 0} total users)`);

    return NextResponse.json({
      success: true,
      users: formattedUsers, // Only eligible users (excludes HR/Sales/Admin)
      allUsers: allFormattedUsers, // ALL users including HR/Sales/Admin
      totalUsers: fetchedUsers?.length || 0,
      eligibleUsers: formattedUsers.length,
      restrictedDepartments: RESTRICTED_DEPARTMENTS
    });

  } catch (error) {
    console.error('Get eligible users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}