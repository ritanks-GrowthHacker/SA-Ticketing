import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db, departments, userDepartmentRoles, users, globalRoles, eq, and, inArray, ilike } from '@/lib/db-helper';
import { salesDb, salesTeamHierarchy } from '@/lib/sales-db-helper';
import { DecodedToken, extractUserAndOrgId } from '../helpers';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    const { userId, organizationId } = extractUserAndOrgId(decoded);

    console.log('🔄 Starting bulk sync for org:', organizationId);

    // Step 1: Get Sales department
    const salesDeptResult = await db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(ilike(departments.name, 'sales'))
      .limit(1);

    const salesDept = salesDeptResult[0];
    if (!salesDept) {
      return NextResponse.json({ 
        error: 'Sales department not found'
      }, { status: 404 });
    }

    console.log('📦 Sales department:', salesDept);

    // Step 2: Get all users in Sales department with their role_ids
    const userDeptRolesResult = await db
      .select({ userId: userDepartmentRoles.userId, roleId: userDepartmentRoles.roleId })
      .from(userDepartmentRoles)
      .where(
        and(
          eq(userDepartmentRoles.organizationId, organizationId),
          eq(userDepartmentRoles.departmentId, salesDept.id)
        )
      );

    console.log('👥 Found user department roles:', userDeptRolesResult?.length);

    if (!userDeptRolesResult || userDeptRolesResult.length === 0) {
      return NextResponse.json({ 
        message: 'No users found in Sales department',
        synced: 0
      });
    }

    // Step 3: Get role names from global_roles
    const roleIds = userDeptRolesResult.map(u => u.roleId);
    const rolesResult = await db
      .select({ id: globalRoles.id, name: globalRoles.name })
      .from(globalRoles)
      .where(inArray(globalRoles.id, roleIds));

    const roleMap = new Map(rolesResult?.map(r => [r.id, r.name]) || []);

    // Step 4: Get user details from users table
    const userIds = userDeptRolesResult.map(u => u.userId);
    const userDetailsResult = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(inArray(users.id, userIds));

    const userMap = new Map(userDetailsResult?.map(u => [u.id, u]) || []);

    // Step 5: Sync each user to sales_team_hierarchy
    const syncResults = [];
    for (const userDeptRole of userDeptRolesResult) {
      try {
        const userInfo = userMap.get(userDeptRole.userId);
        const roleName = roleMap.get(userDeptRole.roleId);
        
        if (!userInfo || !roleName) {
          console.log('⚠️ User info not found for:', userDeptRole.userId);
          syncResults.push({ user_id: userDeptRole.userId, status: 'user_not_found' });
          continue;
        }
        // Check if user already exists
        const existingResult = await salesDb
          .select({ userId: salesTeamHierarchy.userId })
          .from(salesTeamHierarchy)
          .where(
            and(
              eq(salesTeamHierarchy.userId, userDeptRole.userId),
              eq(salesTeamHierarchy.organizationId, organizationId)
            )
          )
          .limit(1);

        const existing = existingResult[0];
        if (existing) {
          console.log('⏭️ User already synced:', userInfo.email);
          syncResults.push({ email: userInfo.email, status: 'already_exists' });
          continue;
        }

        // Map role to sales_role
        let salesRole = 'sales_member';
        const roleUpper = roleName.toUpperCase();
        console.log('🔍 Mapping role:', roleName, '→', roleUpper);
        if (roleUpper === 'ADMIN' || roleUpper.includes('ADMIN')) salesRole = 'sales_admin';
        else if (roleUpper === 'MANAGER' || roleUpper.includes('MANAGER')) salesRole = 'sales_manager';
        else if (roleUpper === 'MEMBER' || roleUpper.includes('MEMBER')) salesRole = 'sales_member';
        console.log('✅ Final sales_role:', salesRole);

        // Insert user
        await salesDb
          .insert(salesTeamHierarchy)
          .values({
            userId: userDeptRole.userId,
            organizationId,
            email: userInfo.email,
            fullName: userInfo.name || userInfo.email.split('@')[0],
            phone: null,
            salesRole,
            managerId: null,
            isActive: true
          });

        console.log('✅ Synced user:', userInfo.email, 'as', salesRole);
        syncResults.push({ email: userInfo.email, status: 'synced', role: salesRole });
      } catch (err: any) {
        console.error('Error processing user:', err);
        const userInfo = userMap.get(userDeptRole.userId);
        syncResults.push({ email: userInfo?.email || userDeptRole.userId, status: 'error', error: err.message });
      }
    }

    const syncedCount = syncResults.filter(r => r.status === 'synced').length;
    const existingCount = syncResults.filter(r => r.status === 'already_exists').length;

    return NextResponse.json({
      message: 'Bulk sync completed',
      total: userDeptRolesResult.length,
      synced: syncedCount,
      alreadyExists: existingCount,
      results: syncResults
    });

  } catch (error: any) {
    console.error('Bulk sync error:', error);
    return NextResponse.json({ 
      error: 'Bulk sync failed',
      details: error.message 
    }, { status: 500 });
  }
}
