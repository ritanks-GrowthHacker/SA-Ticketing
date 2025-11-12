import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

export async function GET(request: NextRequest) {
  try {
    // Get all organizations (you might want to add pagination later)
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching organizations:', error);
      return NextResponse.json(
        { error: 'Failed to load organizations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organizations: organizations || []
    });

  } catch (error) {
    console.error('Error in get-all-organizations:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}