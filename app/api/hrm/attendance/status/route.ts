import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { hrDb, eq, and } from '@/lib/hrm-db-helper';
import * as hrSchema from '@/db/hrm-schema';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  sub: string;
  user_id?: string;
  org_id: string;
  organization_id?: string;
  [key: string]: any;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    const userId = decoded.sub || decoded.user_id;
    const organizationId = decoded.org_id || decoded.organization_id;

    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Use userId directly as employee ID - NO MAPPING NEEDED!
    const employeeId = userId;

    // Check attendance for the date
    const [attendanceRecord] = await hrDb
      .select()
      .from(hrSchema.attendance)
      .where(
        and(
          eq(hrSchema.attendance.employeeId, employeeId),
          eq(hrSchema.attendance.date, date)
        )
      )
      .limit(1);

    if (!attendanceRecord) {
      return NextResponse.json({
        hasCheckedIn: false,
        hasCheckedOut: false
      });
    }

    return NextResponse.json({
      hasCheckedIn: !!attendanceRecord.checkInTime,
      hasCheckedOut: !!attendanceRecord.checkOutTime,
      checkInTime: attendanceRecord.checkInTime,
      checkOutTime: attendanceRecord.checkOutTime,
      workHours: attendanceRecord.workHours,
      status: attendanceRecord.status
    });
  } catch (error) {
    console.error('Attendance status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance status' },
      { status: 500 }
    );
  }
}
