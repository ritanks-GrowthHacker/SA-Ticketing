import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    return NextResponse.json({
      decoded: decoded,
      user_id: decoded.user_id,
      email: decoded.email,
      organization_id: decoded.organization_id,
      department_id: decoded.department_id,
      department_name: decoded.department_name,
      role: decoded.role,
      department_role: decoded.department_role
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
