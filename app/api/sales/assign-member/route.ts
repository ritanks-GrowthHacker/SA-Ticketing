import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, salesTeamHierarchy, memberAssignmentAudit, eq, and } from '@/lib/sales-db-helper';
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

    // Only sales_admin can assign members
    const salesDept = decoded.departments?.find((d: any) => d.name?.toLowerCase() === 'sales');
    if (!salesDept || salesDept.role?.toUpperCase() !== 'ADMIN') {
      return NextResponse.json({ error: 'Only Sales Admin can assign members' }, { status: 403 });
    }

    const { member_user_id, manager_user_id } = await req.json();

    if (!member_user_id || !manager_user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify member exists and is unassigned or being reassigned
    const memberResult = await salesDb
      .select()
      .from(salesTeamHierarchy)
      .where(
        and(
          eq(salesTeamHierarchy.userId, member_user_id),
          eq(salesTeamHierarchy.organizationId, organizationId)
        )
      )
      .limit(1);

    const member = memberResult[0];
    if (!member) {
      console.error('Member not found for user_id:', member_user_id, 'org:', organizationId);
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verify manager exists
    const managerResult = await salesDb
      .select()
      .from(salesTeamHierarchy)
      .where(
        and(
          eq(salesTeamHierarchy.userId, manager_user_id),
          eq(salesTeamHierarchy.organizationId, organizationId),
          eq(salesTeamHierarchy.salesRole, 'sales_manager')
        )
      )
      .limit(1);

    const manager = managerResult[0];
    if (!manager) {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
    }

    const oldManagerId = member.managerId;

    // Update member's manager_id
    await salesDb
      .update(salesTeamHierarchy)
      .set({ 
        managerId: manager_user_id,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(salesTeamHierarchy.userId, member_user_id),
          eq(salesTeamHierarchy.organizationId, organizationId)
        )
      );

    // Log the assignment in audit table
    await salesDb
      .insert(memberAssignmentAudit)
      .values({
        organizationId,
        memberUserId: member_user_id,
        oldManagerId: oldManagerId,
        newManagerId: manager_user_id,
        assignedByAdminId: userId,
        reason: oldManagerId ? 'Reassignment' : 'Initial assignment'
      });

    return NextResponse.json({ 
      message: 'Member assigned successfully',
      member: {
        ...member,
        managerId: manager_user_id
      }
    });

  } catch (error: any) {
    console.error('Assign member error:', error);
    return NextResponse.json({ 
      error: 'Failed to assign member',
      details: error.message 
    }, { status: 500 });
  }
}

