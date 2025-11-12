import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    // Get organization's associated departments
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('associated_departments')
      .eq('id', orgId)
      .single();

    if (orgError) {
      console.error('Error fetching organization:', orgError);
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (!org.associated_departments || org.associated_departments.length === 0) {
      return NextResponse.json(
        { error: 'No departments found for this organization' },
        { status: 400 }
      );
    }

    // Get department details
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .in('id', org.associated_departments)
      .eq('is_active', true)
      .order('name');

    if (deptError) {
      console.error('Error fetching departments:', deptError);
      return NextResponse.json(
        { error: 'Failed to load departments' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      departments: departments || []
    });

  } catch (error) {
    console.error('Error in get-org-departments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}