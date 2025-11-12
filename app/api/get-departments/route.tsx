import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

export async function GET(request: NextRequest) {
  try {
    // Get all departments from the global departments table
    const { data: departments, error } = await supabase
      .from('departments')
      .select('id, name, description, is_active')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching departments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch departments' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      departments: departments || []
    });

  } catch (error) {
    console.error('Error in get-departments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}