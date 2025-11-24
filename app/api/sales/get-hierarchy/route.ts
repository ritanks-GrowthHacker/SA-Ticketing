import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdminSales } from '@/app/db/connections';

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

    console.log('🔍 Get hierarchy - User ID:', userId, 'Org ID:', organizationId);

    const { searchParams } = new URL(req.url);
    const viewType = searchParams.get('view'); // 'admin', 'manager', 'member'

    if (viewType === 'admin') {
      // Admin sees all managers and their members
      const { data: managers, error: managersError } = await supabaseAdminSales
        .from('sales_team_hierarchy')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('sales_role', 'sales_manager')
        .eq('is_active', true)
        .order('full_name');

      if (managersError) throw managersError;

      // Get members for each manager
      const hierarchyData = await Promise.all(
        (managers || []).map(async (manager) => {
          const { data: members } = await supabaseAdminSales
            .from('sales_team_hierarchy')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('manager_id', manager.user_id)
            .eq('is_active', true)
            .order('full_name');

          return {
            ...manager,
            members: members || []
          };
        })
      );

      // Also get unassigned members
      const { data: unassignedMembers } = await supabaseAdminSales
        .from('sales_team_hierarchy')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('sales_role', 'sales_member')
        .is('manager_id', null)
        .eq('is_active', true)
        .order('full_name');

      return NextResponse.json({ 
        managers: hierarchyData,
        unassignedMembers: unassignedMembers || []
      });

    } else if (viewType === 'manager') {
      // Manager sees their own members
      const { data: members, error } = await supabaseAdminSales
        .from('sales_team_hierarchy')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('manager_id', userId)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;

      return NextResponse.json({ members: members || [] });

    } else {
      // Member view - just return their own info
      const { data: memberInfo, error } = await supabaseAdminSales
        .from('sales_team_hierarchy')
        .select('*')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .single();

      if (error) throw error;

      return NextResponse.json({ member: memberInfo });
    }

  } catch (error: any) {
    console.error('Get hierarchy error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch hierarchy',
      details: error.message 
    }, { status: 500 });
  }
}
