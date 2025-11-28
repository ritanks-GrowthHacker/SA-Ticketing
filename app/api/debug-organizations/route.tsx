import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, organizations, desc } from '@/lib/db-helper';

export async function GET(request: NextRequest) {
  try {
    // Get all organizations (for debugging purposes)
    const orgsData = await db.select().from(organizations)
      .orderBy(desc(organizations.createdAt))
      .limit(10);

    return NextResponse.json({
      success: true,
      organizations: orgsData || [],
      count: orgsData?.length || 0
    });

  } catch (error) {
    console.error('Error in debug-organizations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}