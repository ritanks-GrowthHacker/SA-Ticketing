import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
// Supabase (commented out - migrated to PostgreSQL)
// import { supabase } from '@/app/db/connections';

// PostgreSQL with Drizzle ORM
import { db, userDepartmentRoles, departments, eq, and } from '@/lib/db-helper';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.sub;
    const organizationId = decoded.org_id;

    // Get all department roles for this user in this organization
    // Supabase (commented out)
    // const { data: departmentRoles, error } = await supabase.from('user_department_roles').select(`...`)

    // PostgreSQL with Drizzle
    const departmentRoles = await db
      .select({
        departmentId: userDepartmentRoles.departmentId,
        deptName: departments.name
      })
      .from(userDepartmentRoles)
      .innerJoin(departments, eq(userDepartmentRoles.departmentId, departments.id))
      .where(
        and(
          eq(userDepartmentRoles.userId, userId),
          eq(userDepartmentRoles.organizationId, organizationId)
        )
      );

    if (!departmentRoles) {
      console.error('Error fetching user departments');
      return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }

    // Check if user only has Sales department role
    const departmentNames = (departmentRoles || []).map((dr: any) => 
      dr.deptName?.toLowerCase()
    );

    const isSalesOnly = departmentNames.length === 1 && 
                        departmentNames[0] === 'sales';

    console.log('📊 User Department Check:', {
      userId,
      departments: departmentNames,
      isSalesOnly
    });

    return NextResponse.json({
      success: true,
      isSalesOnly,
      departments: departmentNames,
      totalDepartments: departmentNames.length
    });

  } catch (error) {
    console.error('Error checking user departments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
