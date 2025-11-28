import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, organizations, departments, eq, inArray } from '@/lib/db-helper';

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

    // Get organization's associated departments
    const orgData = await db.select({ associatedDepartments: organizations.associatedDepartments })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    
    const org = orgData[0];
    const orgError = null;

    if (orgError) {
      console.error('Error fetching organization:', orgError);
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (!org.associatedDepartments || org.associatedDepartments.length === 0) {
      return NextResponse.json(
        { error: 'No departments found for this organization' },
        { status: 400 }
      );
    }

    // Get department details
    const deptsData = await db.select()
      .from(departments)
      .where(inArray(departments.id, org.associatedDepartments));

    return NextResponse.json({
      success: true,
      departments: deptsData || []
    });

  } catch (error) {
    console.error('Error in get-org-departments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}