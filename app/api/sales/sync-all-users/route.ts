import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '@/app/db/connections';
import { supabaseAdminSales } from '@/app/db/connections';
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

    // Step 1: Get Sales department (departments are global, not org-specific)
    const { data: salesDept, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('id, name')
      .ilike('name', 'sales')
      .single();

    if (deptError || !salesDept) {
      return NextResponse.json({ 
        error: 'Sales department not found',
        details: deptError 
      }, { status: 404 });
    }

    console.log('📦 Sales department:', salesDept);

    // Step 2: Get all users in Sales department with their role_ids
    const { data: userDeptRoles, error: usersError } = await supabaseAdmin
      .from('user_department_roles')
      .select('user_id, role_id')
      .eq('organization_id', organizationId)
      .eq('department_id', salesDept.id);

    if (usersError) {
      console.error('Error fetching sales users:', usersError);
      return NextResponse.json({ 
        error: 'Failed to fetch sales users',
        details: usersError 
      }, { status: 500 });
    }

    console.log('👥 Found user department roles:', userDeptRoles?.length);

    if (!userDeptRoles || userDeptRoles.length === 0) {
      return NextResponse.json({ 
        message: 'No users found in Sales department',
        synced: 0
      });
    }

    // Step 3: Get role names from global_roles
    const roleIds = userDeptRoles.map(u => u.role_id);
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('global_roles')
      .select('id, name')
      .in('id', roleIds);

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      return NextResponse.json({ 
        error: 'Failed to fetch roles',
        details: rolesError 
      }, { status: 500 });
    }

    const roleMap = new Map(roles?.map(r => [r.id, r.name]) || []);

    // Step 4: Get user details from users table
    const userIds = userDeptRoles.map(u => u.user_id);
    const { data: userDetails, error: detailsError } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .in('id', userIds);

    if (detailsError) {
      console.error('Error fetching user details:', detailsError);
      return NextResponse.json({ 
        error: 'Failed to fetch user details',
        details: detailsError 
      }, { status: 500 });
    }

    // Create a map for quick lookup
    const userMap = new Map(userDetails?.map(u => [u.id, u]) || []);

    // Step 5: Sync each user to sales_team_hierarchy
    const syncResults = [];
    for (const userDeptRole of userDeptRoles) {
      try {
        const userInfo = userMap.get(userDeptRole.user_id);
        const roleName = roleMap.get(userDeptRole.role_id);
        
        if (!userInfo || !roleName) {
          console.log('⚠️ User info not found for:', userDeptRole.user_id);
          syncResults.push({ user_id: userDeptRole.user_id, status: 'user_not_found' });
          continue;
        }
        // Check if user already exists
        const { data: existing } = await supabaseAdminSales
          .from('sales_team_hierarchy')
          .select('user_id')
          .eq('user_id', userDeptRole.user_id)
          .eq('organization_id', organizationId)
          .single();

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
        const { error: insertError } = await supabaseAdminSales
          .from('sales_team_hierarchy')
          .insert({
            user_id: userDeptRole.user_id,
            organization_id: organizationId,
            email: userInfo.email,
            full_name: userInfo.name || userInfo.email.split('@')[0],
            phone: null,
            sales_role: salesRole,
            manager_id: null,
            is_active: true
          });

        if (insertError) {
          console.error('Failed to sync user:', userInfo.email, insertError);
          console.error('Attempted insert with salesRole:', salesRole, 'from roleName:', roleName);
          syncResults.push({ 
            email: userInfo.email, 
            status: 'failed', 
            error: insertError.message,
            details: { roleName, salesRole, insertError }
          });
        } else {
          console.log('✅ Synced user:', userInfo.email, 'as', salesRole);
          syncResults.push({ email: userInfo.email, status: 'synced', role: salesRole });
        }
      } catch (err: any) {
        console.error('Error processing user:', err);
        const userInfo = userMap.get(userDeptRole.user_id);
        syncResults.push({ email: userInfo?.email || userDeptRole.user_id, status: 'error', error: err.message });
      }
    }

    const syncedCount = syncResults.filter(r => r.status === 'synced').length;
    const existingCount = syncResults.filter(r => r.status === 'already_exists').length;

    return NextResponse.json({
      message: 'Bulk sync completed',
      total: userDeptRoles.length,
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
