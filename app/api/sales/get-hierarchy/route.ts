import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, salesTeamHierarchy, eq, and, isNull, desc } from '@/lib/sales-db-helper';

interface DecodedToken {
  sub: string;
  user_id?: string;
  org_id: string;
  organization_id?: string;
  department_role?: string;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;

    const userId = decoded.sub || decoded.user_id;
    const organizationId = decoded.org_id || decoded.organization_id;

    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'Invalid token: missing user or organization ID' }, { status: 401 });
    }

    console.log('🔍 Get hierarchy - User ID:', userId, 'Org ID:', organizationId);

    const { searchParams } = new URL(req.url);
    const viewType = searchParams.get('view'); // 'admin', 'manager', 'member'

    if (viewType === 'admin') {
      // Admin sees all managers and their members
      const managers = await salesDb
        .select()
        .from(salesTeamHierarchy)
        .where(
          and(
            eq(salesTeamHierarchy.organizationId, organizationId),
            eq(salesTeamHierarchy.salesRole, 'sales_manager'),
            eq(salesTeamHierarchy.isActive, true)
          )
        )
        .orderBy(salesTeamHierarchy.fullName);

      // Get members for each manager
      const hierarchyData = await Promise.all(
        (managers || []).map(async (manager) => {
          const members = await salesDb
            .select()
            .from(salesTeamHierarchy)
            .where(
              and(
                eq(salesTeamHierarchy.organizationId, organizationId),
                eq(salesTeamHierarchy.managerId, manager.userId),
                eq(salesTeamHierarchy.isActive, true)
              )
            )
            .orderBy(salesTeamHierarchy.fullName);

          return {
            ...manager,
            members: members || []
          };
        })
      );

      // Also get unassigned members
      const unassignedMembers = await salesDb
        .select()
        .from(salesTeamHierarchy)
        .where(
          and(
            eq(salesTeamHierarchy.organizationId, organizationId),
            eq(salesTeamHierarchy.salesRole, 'sales_member'),
            isNull(salesTeamHierarchy.managerId),
            eq(salesTeamHierarchy.isActive, true)
          )
        )
        .orderBy(salesTeamHierarchy.fullName);

      return NextResponse.json({ 
        managers: hierarchyData,
        unassignedMembers: unassignedMembers || []
      });

    } else if (viewType === 'manager') {
      // Manager sees their own members
      const members = await salesDb
        .select()
        .from(salesTeamHierarchy)
        .where(
          and(
            eq(salesTeamHierarchy.organizationId, organizationId),
            eq(salesTeamHierarchy.managerId, userId),
            eq(salesTeamHierarchy.isActive, true)
          )
        )
        .orderBy(salesTeamHierarchy.fullName);

      return NextResponse.json({ members: members || [] });

    } else {
      // Member view - just return their own info
      const memberInfo = await salesDb
        .select()
        .from(salesTeamHierarchy)
        .where(
          and(
            eq(salesTeamHierarchy.userId, userId),
            eq(salesTeamHierarchy.organizationId, organizationId)
          )
        )
        .limit(1);

      return NextResponse.json({ member: memberInfo[0] || null });
    }

  } catch (error: any) {
    console.error('Get hierarchy error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch hierarchy',
      details: error.message 
    }, { status: 500 });
  }
}
