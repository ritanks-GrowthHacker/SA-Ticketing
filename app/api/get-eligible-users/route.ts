import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from '@/app/db/connections';

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

// Restricted department names (case-insensitive)
const RESTRICTED_DEPARTMENTS = [
  'sales',
  'human resource',
  'hr',
  'administration',
  'admin department' // Just in case
];

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

    // First, get all user IDs who are active members of this organization
    const { data: orgMembers, error: orgMembersError } = await supabase
      .from('user_organisation_role')
      .select('user_id')
      .eq('organization_id', organizationId);

    if (orgMembersError) {
      console.error('Error fetching organization members:', orgMembersError);
      return NextResponse.json(
        { error: 'Failed to fetch organization members' },
        { status: 500 }
      );
    }

    const activeUserIds = (orgMembers || []).map((m: any) => m.user_id);
    
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

    // Get all users in the organization with their department information
    // Only include users who are active members (exist in user_organisation_role)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        job_title,
        department,
        department_id,
        profile_picture_url,
        created_at,
        departments!users_department_id_fkey(
          id,
          name
        )
      `)
      .eq('organization_id', organizationId)
      .in('id', activeUserIds)
      .order('name');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Filter out users from restricted departments
    const eligibleUsers = (users || []).filter((user: any) => {
      const deptName = user.departments?.name || user.department || '';
      const deptNameLower = deptName.toLowerCase().trim();
      
      // Check if user's department is in restricted list
      const isRestricted = RESTRICTED_DEPARTMENTS.some(restricted => 
        deptNameLower.includes(restricted) || restricted.includes(deptNameLower)
      );
      
      return !isRestricted;
    });

    // Get user roles (both org and department roles)
    const eligibleUserIds = eligibleUsers.map((u: any) => u.id);
    
    const { data: userRoles } = await supabase
      .from('user_organization_roles')
      .select(`
        user_id,
        global_roles!user_organization_roles_role_id_fkey(id, name)
      `)
      .in('user_id', eligibleUserIds)
      .eq('organization_id', organizationId);

    const { data: userDeptRoles } = await supabase
      .from('user_department_roles')
      .select(`
        user_id,
        global_roles(id, name)
      `)
      .in('user_id', eligibleUserIds)
      .eq('organization_id', organizationId);

    // Map roles to users
    const roleMap: Record<string, string> = {};
    
    (userRoles || []).forEach((ur: any) => {
      if (ur.global_roles?.name) {
        roleMap[ur.user_id] = ur.global_roles.name;
      }
    });
    
    (userDeptRoles || []).forEach((ur: any) => {
      if (!roleMap[ur.user_id] && ur.global_roles?.name) {
        roleMap[ur.user_id] = ur.global_roles.name;
      }
    });

    // Format response
    const formattedUsers = eligibleUsers.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      job_title: user.job_title,
      department: user.departments?.name || user.department,
      department_id: user.department_id,
      profile_picture_url: user.profile_picture_url,
      created_at: user.created_at,
      role: roleMap[user.id] || 'Member'
    }));

    // Also format ALL users (including restricted departments)
    const allFormattedUsers = (users || []).map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      job_title: user.job_title,
      department: user.departments?.name || user.department,
      department_id: user.department_id,
      profile_picture_url: user.profile_picture_url,
      created_at: user.created_at,
      role: roleMap[user.id] || 'Member'
    }));

    console.log(`✅ GET ELIGIBLE USERS: Found ${formattedUsers.length} eligible users (${users?.length || 0} total users)`);

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      allUsers: allFormattedUsers, // ALL users including HR/Sales/Admin
      totalUsers: users?.length || 0,
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
