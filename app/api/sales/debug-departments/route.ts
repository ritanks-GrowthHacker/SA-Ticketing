import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '@/app/db/connections';

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
    const { data: userDepts, error: userDeptsError } = await supabaseAdmin
      .from('user_department_roles')
      .select('*')
      .eq('user_id', decoded.user_id)
      .eq('organization_id', decoded.organization_id);

    console.log('📦 User departments:', userDepts);

    // Get ALL departments in organization
    const { data: allDepts, error: allDeptsError } = await supabaseAdmin
      .from('departments')
      .select('*')
      .eq('organization_id', decoded.organization_id);

    console.log('📦 All departments in org:', allDepts);

    return NextResponse.json({
      userId: decoded.user_id,
      orgId: decoded.organization_id,
      userDepartments: userDepts,
      allDepartments: allDepts,
      userDeptsError,
      allDeptsError
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message });
  }
}
