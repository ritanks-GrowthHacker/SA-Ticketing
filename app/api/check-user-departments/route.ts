import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from '@/app/db/connections';

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
    const { data: departmentRoles, error } = await supabase
      .from('user_department_roles')
      .select(`
        department_id,
        departments!inner(name)
      `)
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error fetching user departments:', error);
      return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }

    // Check if user only has Sales department role
    const departmentNames = (departmentRoles || []).map((dr: any) => 
      dr.departments?.name?.toLowerCase()
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
