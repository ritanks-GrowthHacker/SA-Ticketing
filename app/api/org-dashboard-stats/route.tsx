import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    // Validate required fields
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

    // Get organization's departments count
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('associated_departments')
      .eq('id', orgId)
      .single();

    if (orgError || !orgData) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const departmentIds = orgData.associated_departments || [];
    const total_departments = departmentIds.length;

    // Get total employees count for this organization
    const { count: total_employees, error: employeeCountError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    if (employeeCountError) {
      console.error('Error counting employees:', employeeCountError);
      return NextResponse.json(
        { error: 'Failed to count employees' },
        { status: 500 }
      );
    }

    // Return stats
    return NextResponse.json({
      success: true,
      total_employees: total_employees || 0,
      total_departments
    }, { status: 200 });

  } catch (error) {
    console.error('Organization dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}