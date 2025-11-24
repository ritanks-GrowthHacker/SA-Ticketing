import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
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
    const { data: member, error: memberError } = await supabaseAdminSales
      .from('sales_team_hierarchy')
      .select('*')
      .eq('user_id', member_user_id)
      .eq('organization_id', organizationId)
      .single();

    if (memberError || !member) {
      console.error('Member lookup error:', memberError, 'for user_id:', member_user_id, 'org:', organizationId);
      return NextResponse.json({ error: 'Member not found', details: memberError }, { status: 404 });
    }

    // Verify manager exists
    const { data: manager, error: managerError } = await supabaseAdminSales
      .from('sales_team_hierarchy')
      .select('*')
      .eq('user_id', manager_user_id)
      .eq('organization_id', organizationId)
      .eq('sales_role', 'sales_manager')
      .single();

    if (managerError || !manager) {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
    }

    const oldManagerId = member.manager_id;

    // Update member's manager_id
    const { error: updateError } = await supabaseAdminSales
      .from('sales_team_hierarchy')
      .update({ 
        manager_id: manager_user_id,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', member_user_id)
      .eq('organization_id', organizationId);

    if (updateError) {
      console.error('Error updating member assignment:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log the assignment in audit table
    await supabaseAdminSales
      .from('member_assignment_audit')
      .insert({
        organization_id: organizationId,
        member_user_id,
        old_manager_id: oldManagerId,
        new_manager_id: manager_user_id,
        assigned_by_admin_id: userId,
        reason: oldManagerId ? 'Reassignment' : 'Initial assignment'
      });

    return NextResponse.json({ 
      message: 'Member assigned successfully',
      member: {
        ...member,
        manager_id: manager_user_id
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
