import { NextRequest, NextResponse } from 'next/server';
// Supabase (commented out - migrated to PostgreSQL)
// import { supabase } from '@/app/db/connections';

// PostgreSQL with Drizzle ORM
import { db, departments, eq } from '@/lib/db-helper';

export async function GET(request: NextRequest) {
  try {
    // Get all departments from the global departments table
    // Supabase (commented out)
    // const { data: departments, error } = await supabase.from('departments').select('...')

    // PostgreSQL with Drizzle
    const depts = await db
      .select({
        id: departments.id,
        name: departments.name,
        description: departments.description,
        isActive: departments.isActive
      })
      .from(departments)
      .where(eq(departments.isActive, true))
      .orderBy(departments.name);

    if (!depts) {
      console.error('Error fetching departments');
      return NextResponse.json(
        { error: 'Failed to fetch departments' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      departments: depts || []
    });

  } catch (error) {
    console.error('Error in get-departments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}