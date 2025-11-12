import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

export async function POST(request: NextRequest) {
  try {
    const { orgId, selectedDepartments } = await request.json();

    // Validate required fields
    if (!orgId || !selectedDepartments || !Array.isArray(selectedDepartments)) {
      return NextResponse.json(
        { error: 'Organization ID and departments are required' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    // Validate departments exist
    const { data: validDepartments, error: deptError } = await supabase
      .from('departments')
      .select('id')
      .in('id', selectedDepartments)
      .eq('is_active', true);

    if (deptError) {
      console.error('Error validating departments:', deptError);
      return NextResponse.json(
        { error: 'Failed to validate departments' },
        { status: 500 }
      );
    }

    if (!validDepartments || validDepartments.length !== selectedDepartments.length) {
      return NextResponse.json(
        { error: `Invalid department selection. Found ${validDepartments?.length || 0} valid departments out of ${selectedDepartments.length} selected.` },
        { status: 400 }
      );
    }

    // Update organization with selected departments
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ 
        associated_departments: selectedDepartments,
        updated_at: new Date().toISOString()
      })
      .eq('id', orgId);

    if (updateError) {
      console.error('Error updating organization:', updateError);
      return NextResponse.json(
        { error: 'Failed to save departments' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Organization departments saved successfully'
    });

  } catch (error) {
    console.error('Error in save-org-departments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}