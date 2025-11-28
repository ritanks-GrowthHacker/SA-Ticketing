import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, salesTeamHierarchy, eq, and } from '@/lib/sales-db-helper';
import { db, userDepartmentRoles, departments, globalRoles, inArray } from '@/lib/db-helper';

interface DecodedToken {
  sub: string;
  user_id?: string;
  email: string;
  org_id: string;
  organization_id?: string;
  department_id?: string;
  department_name?: string;
  department_role?: string;
  role?: string;
  departments?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        isSalesUser: false,
        redirectTo: '/dashboard',
        message: 'No token provided' 
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;

    const userId = decoded.sub || decoded.user_id;
    const organizationId = decoded.org_id || decoded.organization_id;

    console.log('🔍 Auth-check: User ID:', userId, 'Org ID:', organizationId);
    console.log('🔍 JWT Departments:', decoded.departments);

    // Check if departments array exists in JWT (new format)
    if (decoded.departments && Array.isArray(decoded.departments)) {
      const salesDept = decoded.departments.find((d: any) => d.name?.toLowerCase() === 'sales');
      
      if (!salesDept) {
        console.log('ℹ️ User not in Sales (from JWT departments array)');
        return NextResponse.json({ 
          isSalesUser: false,
          redirectTo: '/dashboard',
          message: 'Not a Sales user'
        });
      }

      const salesRole = salesDept.role;
      console.log('✅ Sales role from JWT:', salesRole);

      let dashboardRoute = '/sales/member-dashboard';
      const roleUpperCase = salesRole?.toUpperCase();
      if (roleUpperCase === 'ADMIN') {
        dashboardRoute = '/sales/admin-dashboard';
      } else if (roleUpperCase === 'MANAGER') {
        dashboardRoute = '/sales/manager-dashboard';
      }

      console.log('✅ Redirecting to:', dashboardRoute);

      return NextResponse.json({
        isSalesUser: true,
        salesRole,
        userId: userId,
        organizationId: organizationId,
        departmentId: salesDept.id,
        email: decoded.email,
        redirectTo: dashboardRoute
      });
    }

    // Fallback to database query for old JWT format
    console.log('🔍 Using database query (old JWT format)');

    if (!userId || !organizationId) {
      return NextResponse.json({ 
        isSalesUser: false,
        redirectTo: '/dashboard',
        message: 'Invalid token data'
      });
    }

    // Get ALL departments for this user
    const userDepts = await db
      .select()
      .from(userDepartmentRoles)
      .where(
        and(
          eq(userDepartmentRoles.userId, userId),
          eq(userDepartmentRoles.organizationId, organizationId)
        )
      );

    console.log('📦 User departments:', JSON.stringify(userDepts));

    if (!userDepts || userDepts.length === 0) {
      console.log('ℹ️ No departments found');
      return NextResponse.json({ 
        isSalesUser: false,
        redirectTo: '/dashboard',
        message: 'No departments found'
      });
    }

    // Get department names separately
    const deptIds = userDepts.map((d: any) => d.departmentId);
    console.log('🔍 Fetching departments for IDs:', deptIds);
    
    const depts = await db
      .select()
      .from(departments)
      .where(inArray(departments.id, deptIds));

    console.log('📦 Departments:', depts);

    // Find Sales department
    const salesDept = depts?.find((d: any) => d.name?.toLowerCase() === 'sales');
    console.log('🔍 Sales department:', salesDept);
    
    if (!salesDept) {
      console.log('ℹ️ User not in Sales');
      return NextResponse.json({ 
        isSalesUser: false,
        redirectTo: '/dashboard',
        message: 'Not a Sales user'
      });
    }

    // Get role for Sales department
    const userDeptRole = userDepts.find((d: any) => d.departmentId === salesDept.id);
    
    // Fetch role name from global_roles
    if (!userDeptRole) {
      return NextResponse.json({ 
        isSalesUser: false,
        redirectTo: '/dashboard',
        message: 'No role found for Sales department'
      });
    }

    const roleResult = await db
      .select({ name: globalRoles.name })
      .from(globalRoles)
      .where(eq(globalRoles.id, userDeptRole.roleId))
      .limit(1);
    
    const salesRole = roleResult[0]?.name;
    console.log('✅ Sales role:', salesRole, 'Type:', typeof salesRole);

    let dashboardRoute = '/sales/member-dashboard';
    const roleUpperCase = salesRole?.toUpperCase();
    if (roleUpperCase === 'ADMIN') {
      dashboardRoute = '/sales/admin-dashboard';
    } else if (roleUpperCase === 'MANAGER') {
      dashboardRoute = '/sales/manager-dashboard';
    }

    console.log('✅ Redirecting to:', dashboardRoute);

    return NextResponse.json({
      isSalesUser: true,
      salesRole,
      userId: userId,
      organizationId: organizationId,
      departmentId: salesDept.id,
      email: decoded.email,
      redirectTo: dashboardRoute
    });

  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({ 
      isSalesUser: false,
      redirectTo: '/dashboard',
      message: 'Error checking access'
    });
  }
}

