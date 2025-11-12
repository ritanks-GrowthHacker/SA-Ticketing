import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

export async function GET(request: NextRequest) {
  try {
    // Get all organizations (for debugging purposes)
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching organizations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch organizations', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organizations: organizations || [],
      count: organizations?.length || 0
    });

  } catch (error) {
    console.error('Error in debug-organizations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}