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

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { action } = body;

    if (!action || !['check-in', 'check-out'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "check-in" or "check-out"' },
        { status: 400 }
      );
    }

    // Use userId directly as employee ID - NO MAPPING NEEDED!
    const employeeId = userId;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const currentDateTime = new Date();
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    console.log('📍 Attendance Mark Request:', {
      action,
      employeeId,
      organizationId,
      date: today,
      time: currentDateTime.toISOString()
    });

    // Check if attendance record exists for today
    const [existingAttendance] = await hrDb
      .select()
      .from(hrSchema.attendance)
      .where(
        and(
          eq(hrSchema.attendance.employeeId, employeeId),
          eq(hrSchema.attendance.date, today)
        )
      )
      .limit(1);

    if (action === 'check-in') {
      if (existingAttendance) {
        return NextResponse.json(
          { error: 'You have already checked in for today' },
          { status: 400 }
        );
      }

      // Create new attendance record with check-in time
      const [newAttendance] = await hrDb
        .insert(hrSchema.attendance)
        .values({
          employeeId,
          date: today,
          checkInTime: currentDateTime,
          status: 'Present',
          locationCheckIn: 'Web Dashboard',
          ipAddressCheckIn: ipAddress,
        })
        .returning();

      console.log('✅ Check-in successful:', newAttendance);

      return NextResponse.json({
        success: true,
        message: 'Checked in successfully',
        attendance: {
          id: newAttendance.id,
          checkInTime: newAttendance.checkInTime,
          date: newAttendance.date
        }
      });
    } 
    
    if (action === 'check-out') {
      if (!existingAttendance) {
        return NextResponse.json(
          { error: 'No check-in record found for today. Please check in first.' },
          { status: 400 }
        );
      }

      if (existingAttendance.checkOutTime) {
        return NextResponse.json(
          { error: 'You have already checked out for today' },
          { status: 400 }
        );
      }

      // Calculate work hours
      const checkInTime = new Date(existingAttendance.checkInTime!);
      const checkOutTime = currentDateTime;
      const workHours = ((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(2);

      // Update attendance record with check-out time
      const [updatedAttendance] = await hrDb
        .update(hrSchema.attendance)
        .set({
          checkOutTime: checkOutTime,
          workHours: workHours, // String format for DECIMAL
          locationCheckOut: 'Web Dashboard',
          ipAddressCheckOut: ipAddress,
          status: 'Present'
        })
        .where(eq(hrSchema.attendance.id, existingAttendance.id))
        .returning();

      console.log('✅ Check-out successful:', {
        checkInTime: checkInTime.toISOString(),
        checkOutTime: checkOutTime.toISOString(),
        workHours
      });

      return NextResponse.json({
        success: true,
        message: 'Checked out successfully',
        attendance: {
          id: updatedAttendance.id,
          checkInTime: updatedAttendance.checkInTime,
          checkOutTime: updatedAttendance.checkOutTime,
          workHours: updatedAttendance.workHours,
          date: updatedAttendance.date
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Mark attendance error:', error);
    return NextResponse.json(
      { error: 'Failed to mark attendance', details: error.message },
      { status: 500 }
    );
  }
}
