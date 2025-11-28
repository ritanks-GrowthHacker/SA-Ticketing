import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, projectStatuses } from '@/lib/db-helper';

export async function GET(request: NextRequest) {
  try {
    console.log('🔧 DIRECT DB CHECK: Fetching project statuses...');

    // Get all project statuses
    const allStatuses = await db.select().from(projectStatuses);
    
    console.log('🔧 All project statuses:', allStatuses);

    return NextResponse.json({
      message: 'Direct database check',
      statuses: allStatuses,
      count: allStatuses.length
    });

  } catch (error) {
    console.error('🔥 Direct DB check error:', error);
    return NextResponse.json(
      { error: 'Database check failed', details: error },
      { status: 500 }
    );
  }
}