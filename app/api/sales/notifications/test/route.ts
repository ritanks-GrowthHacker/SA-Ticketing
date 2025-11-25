import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdminSales } from '@/app/db/connections';

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
    const { data: allNotifications, error: allError } = await supabaseAdminSales
      .from('sales_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Get unread notifications
    const { data: unreadNotifications, error: unreadError } = await supabaseAdminSales
      .from('sales_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    // Get recent notifications (last 5 minutes)
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const { data: recentNotifications, error: recentError } = await supabaseAdminSales
      .from('sales_notifications')
      .select('*')
      .eq('user_id', userId)
      .gt('created_at', fiveMinutesAgo.toISOString())
      .order('created_at', { ascending: false });

    return NextResponse.json({
      userId,
      decodedToken: decoded,
      total: allNotifications?.length || 0,
      unread: unreadNotifications?.length || 0,
      recent: recentNotifications?.length || 0,
      allNotifications: allNotifications || [],
      unreadNotifications: unreadNotifications || [],
      recentNotifications: recentNotifications || [],
      errors: {
        all: allError?.message,
        unread: unreadError?.message,
        recent: recentError?.message
      }
    });
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
