import { NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, userProject, projects, projectDepartment, userDepartmentRoles, globalRoles, eq, and, sql } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';

/**
 * ONE-TIME FIX API
 * 
 * For users who were added to projects via resource requests but are missing
 * department assignments in user_department_roles table.
 * 
 * This checks all user_project entries and ensures users are also in 
 * user_department_roles for the project's department.
 */
export async function POST(req: Request) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    console.log('🔧 FIX: Starting missing department assignments fix...');

    // Get all user_project assignments with project department info
    const userProjectsResult = await db.execute<{
      user_id: string;
      project_id: string;
      organization_id: string;
      department_id: string;
    }>(sql`
      SELECT 
        up.user_id, up.project_id,
        p.organization_id,
        pd.department_id
      FROM user_project up
      INNER JOIN projects p ON up.project_id = p.id
      INNER JOIN project_department pd ON p.id = pd.project_id
    `);

    const userProjects = userProjectsResult.rows;

    console.log(`🔧 FIX: Found ${userProjects?.length || 0} user-project assignments`);

    let addedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Get Member role ID
    const memberRoleResults = await db.select({
      id: globalRoles.id
    })
      .from(globalRoles)
      .where(eq(globalRoles.name, 'Member'))
      .limit(1);

    const memberRole = memberRoleResults[0];
    if (!memberRole) {
      return NextResponse.json({ error: 'Member role not found' }, { status: 500 });
    }

    // For each user-project assignment, ensure user is in department
    for (const up of userProjects || []) {
      const userId = up.user_id;
      const departmentId = up.department_id;
      const organizationId = up.organization_id;

      if (!departmentId) {
        console.log(`⚠️ FIX: Project ${up.project_id} has no department, skipping`);
        skippedCount++;
        continue;
      }

      // Check if user already has department assignment
      const existing = await db.select()
        .from(userDepartmentRoles)
        .where(and(
          eq(userDepartmentRoles.userId, userId),
          eq(userDepartmentRoles.departmentId, departmentId)
        ))
        .limit(1);

      if (existing.length > 0) {
        skippedCount++;
        continue;
      }

      // Add department assignment
      try {
        await db.insert(userDepartmentRoles).values({
          userId: userId,
          departmentId: departmentId,
          roleId: memberRole.id,
          organizationId: organizationId
        });
        console.log(`✅ FIX: Added user ${userId} to department ${departmentId}`);
        addedCount++;
      } catch (insertError: any) {
        if (insertError.code !== '23505') { // Ignore duplicate key errors
          console.error(`❌ FIX: Error adding user ${userId} to dept ${departmentId}:`, insertError);
          errors.push(`User ${userId}, Dept ${departmentId}: ${insertError.message}`);
        }
      }
    }

    console.log(`🎯 FIX COMPLETE: Added ${addedCount}, Skipped ${skippedCount}, Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      message: 'Department assignment fix completed',
      stats: {
        totalChecked: userProjects?.length || 0,
        added: addedCount,
        skipped: skippedCount,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Fix missing dept assignments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
