import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db, users, eq } from '@/lib/db-helper';

interface DecodedToken {
  sub?: string;  // User ID in 'sub' field (JWT standard)
  userId?: string;  // Fallback for older tokens
  email: string;
  iat?: number;
  exp?: number;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    const userId = decoded.sub || decoded.userId;  // Support both 'sub' and 'userId'

    if (!userId) {
      console.error('❌ No userId in token:', decoded);
      return NextResponse.json({ error: 'Invalid token - no user ID' }, { status: 401 });
    }

    // Get the user's first login status
    const user = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        hasSeenDashboardWelcome: users.hasSeenDashboardWelcome
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!user) {
      console.error('❌ User not found for ID:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('✅ First login check:', { 
      userId: user.id, 
      hasSeenWelcome: user.hasSeenDashboardWelcome,
      shouldShow: user.hasSeenDashboardWelcome === false 
    });

    return NextResponse.json({
      shouldShowWelcome: user.hasSeenDashboardWelcome === false,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error: any) {
    console.error('Check first login error:', error);
    return NextResponse.json(
      { error: 'Failed to check first login status', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    const userId = decoded.sub || decoded.userId;  // Support both 'sub' and 'userId'

    if (!userId) {
      console.error('❌ No userId in token:', decoded);
      return NextResponse.json({ error: 'Invalid token - no user ID' }, { status: 401 });
    }

    // Update the user's dashboard welcome status to true
    await db
      .update(users)
      .set({
        hasSeenDashboardWelcome: true,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    return NextResponse.json({
      success: true,
      message: 'Dashboard welcome status updated successfully'
    });

  } catch (error: any) {
    console.error('Update first login error:', error);
    return NextResponse.json(
      { error: 'Failed to update first login status', details: error.message },
      { status: 500 }
    );
  }
}
