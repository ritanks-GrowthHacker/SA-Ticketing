import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, departments, organizations, eq, inArray } from '@/lib/db-helper';

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

    // Validate departments exist
    const validDepartments = await db.select({ id: departments.id })
      .from(departments)
      .where(inArray(departments.id, selectedDepartments));

    if (!validDepartments || validDepartments.length !== selectedDepartments.length) {
      return NextResponse.json(
        { error: `Invalid department selection. Found ${validDepartments?.length || 0} valid departments out of ${selectedDepartments.length} selected.` },
        { status: 400 }
      );
    }

    // Update organization with selected departments
    const currentTime = new Date();
    try {
      await db.update(organizations)
        .set({ 
          associatedDepartments: selectedDepartments,
          updatedAt: currentTime
        })
        .where(eq(organizations.id, orgId));
    } catch (updateError) {
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