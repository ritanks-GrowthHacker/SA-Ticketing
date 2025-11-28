import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, organizations, users, eq, sql } from '@/lib/db-helper';

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

    // Get organization's departments count
    const orgResults = await db.select({
      associatedDepartments: organizations.associatedDepartments
    })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    
    const orgData = orgResults[0];

    if (!orgData) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const departmentIds = orgData.associatedDepartments || [];
    const total_departments = departmentIds.length;

    // Get total employees count for this organization
    const employeeCountResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.organizationId, orgId));
    
    const total_employees = employeeCountResult[0]?.count || 0;

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