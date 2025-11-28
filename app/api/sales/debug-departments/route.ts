import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db, userDepartmentRoles, departments, eq, and } from '@/lib/db-helper';

interface DecodedToken {
  user_id: string;
  email: string;
  organization_id: string;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;

    console.log('🔍 Debug: User ID:', decoded.user_id, 'Org ID:', decoded.organization_id);

    // Get user's departments
    const userDepts = await db
      .select()
      .from(userDepartmentRoles)
      .where(
        and(
          eq(userDepartmentRoles.userId, decoded.user_id),
          eq(userDepartmentRoles.organizationId, decoded.organization_id)
        )
      );

    console.log('📦 User departments:', userDepts);

    // Get ALL departments (departments are global, not org-specific)
    const allDepts = await db
      .select()
      .from(departments);

    console.log('📦 All departments:', allDepts);

    return NextResponse.json({
      userId: decoded.user_id,
      orgId: decoded.organization_id,
      userDepartments: userDepts,
      allDepartments: allDepts
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message });
  }
}
