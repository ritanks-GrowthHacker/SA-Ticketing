import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '@/app/db/connections';

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

    // Get ALL departments for this user
    const { data: userDepts, error: userDeptsError } = await supabaseAdmin
      .from('user_department_roles')
      .select('role, department_id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    console.log('📦 User departments:', JSON.stringify(userDepts));
    console.log('❌ User departments error:', JSON.stringify(userDeptsError));

    if (userDeptsError) {
      console.error('❌ Error fetching user departments:', userDeptsError);
      return NextResponse.json({ 
        isSalesUser: false,
        redirectTo: '/dashboard',
        message: `Error: ${userDeptsError.message || 'Database error'}`
      });
    }

    if (!userDepts || userDepts.length === 0) {
      console.log('ℹ️ No departments found');
      return NextResponse.json({ 
        isSalesUser: false,
        redirectTo: '/dashboard',
        message: 'No departments found'
      });
    }

    // Get department names separately
    const deptIds = userDepts.map((d: any) => d.department_id);
    console.log('🔍 Fetching departments for IDs:', deptIds);
    
    const { data: depts, error: deptsError } = await supabaseAdmin
      .from('departments')
      .select('department_id, name')
      .in('department_id', deptIds);

    console.log('📦 Departments:', depts, 'Error:', deptsError);

    if (deptsError) {
      console.error('❌ Error fetching departments:', deptsError);
      return NextResponse.json({ 
        isSalesUser: false,
        redirectTo: '/dashboard',
        message: 'Error fetching departments'
      });
    }

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
    const salesRole = userDepts.find((d: any) => d.department_id === salesDept.department_id)?.role;
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
      departmentId: salesDept.department_id,
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
