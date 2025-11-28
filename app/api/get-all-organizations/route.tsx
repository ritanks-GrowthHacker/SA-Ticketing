import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, organizations, desc } from '@/lib/db-helper';

export async function GET(request: NextRequest) {
  try {
    // Get all organizations (you might want to add pagination later)
    const orgsData = await db.select().from(organizations)
      .orderBy(desc(organizations.createdAt));
    const error = null;

    if (error) {
      console.error('Error fetching organizations:', error);
      return NextResponse.json(
        { error: 'Failed to load organizations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organizations: orgsData || []
    });

  } catch (error) {
    console.error('Error in get-all-organizations:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}