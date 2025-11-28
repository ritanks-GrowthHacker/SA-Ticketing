import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, salesTeamHierarchy, eq, and } from '@/lib/sales-db-helper';
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

    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'Invalid token: missing user or organization ID' }, { status: 401 });
    }

    const { full_name, phone } = await req.json();

    // Check if user already exists in sales_team_hierarchy
    const existingUser = await salesDb
      .select()
      .from(salesTeamHierarchy)
      .where(
        and(
          eq(salesTeamHierarchy.userId, userId),
          eq(salesTeamHierarchy.organizationId, organizationId)
        )
      )
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      return NextResponse.json({ 
        message: 'User already synced',
        user: existingUser[0]
      });
    }

    // Determine sales role from JWT departments array (new format) or department_role (old format)
    let salesRole = 'sales_member'; // default
    if (decoded.departments) {
      const salesDept = decoded.departments.find(d => d.name?.toLowerCase() === 'sales');
      if (salesDept) {
        const role = salesDept.role?.toUpperCase();
        if (role === 'ADMIN') salesRole = 'sales_admin';
        else if (role === 'MANAGER') salesRole = 'sales_manager';
      }
    } else if (decoded.department_role) {
      if (decoded.department_role === 'Admin') salesRole = 'sales_admin';
      else if (decoded.department_role === 'Manager') salesRole = 'sales_manager';
    }

    // Insert user into sales_team_hierarchy
    const newUser = await salesDb
      .insert(salesTeamHierarchy)
      .values({
        userId: userId,
        organizationId: organizationId,
        email: decoded.email || '',
        fullName: full_name || decoded.email?.split('@')[0] || 'Unknown',
        phone: phone || null,
        salesRole: salesRole,
        managerId: null, // Will be assigned by admin later
        isActive: true
      })
      .returning();

    return NextResponse.json({ 
      message: 'User synced successfully',
      user: newUser[0]
    });

  } catch (error: any) {
    console.error('Sales user sync error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync user',
      details: error.message 
    }, { status: 500 });
  }
}
