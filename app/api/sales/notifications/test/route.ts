import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, salesNotifications, eq, and, gt, desc } from '@/lib/sales-db-helper';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.sub || decoded.userId || decoded.id || decoded.user_id;

    console.log('🧪 Testing notifications for user:', userId, 'Decoded token:', decoded);

    // Get all notifications for this user
    const allNotificationsList = await salesDb
      .select()
      .from(salesNotifications)
      .where(eq(salesNotifications.userId, userId))
      .orderBy(desc(salesNotifications.createdAt));

    // Get unread notifications
    const unreadNotificationsList = await salesDb
      .select()
      .from(salesNotifications)
      .where(
        and(
          eq(salesNotifications.userId, userId),
          eq(salesNotifications.isRead, false)
        )
      )
      .orderBy(desc(salesNotifications.createdAt));

    // Get recent notifications (last 5 minutes)
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const recentNotificationsList = await salesDb
      .select()
      .from(salesNotifications)
      .where(
        and(
          eq(salesNotifications.userId, userId),
          gt(salesNotifications.createdAt, fiveMinutesAgo)
        )
      )
      .orderBy(desc(salesNotifications.createdAt));

    return NextResponse.json({
      userId,
      decodedToken: decoded,
      total: allNotificationsList?.length || 0,
      unread: unreadNotificationsList?.length || 0,
      recent: recentNotificationsList?.length || 0,
      allNotifications: allNotificationsList || [],
      unreadNotifications: unreadNotificationsList || [],
      recentNotifications: recentNotificationsList || []
    });
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
