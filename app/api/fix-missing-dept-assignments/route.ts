import { NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
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

    // Get all user_project assignments
    const { data: userProjects, error: upError } = await supabase
      .from('user_project')
      .select(`
        user_id,
        project_id,
        projects!inner(
          id,
          organization_id,
          project_department!inner(department_id)
        )
      `);

    if (upError) {
      console.error('Error fetching user projects:', upError);
      return NextResponse.json({ error: 'Failed to fetch user projects' }, { status: 500 });
    }

    console.log(`🔧 FIX: Found ${userProjects?.length || 0} user-project assignments`);

    let addedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Get Member role ID
    const { data: memberRole } = await supabase
      .from('global_roles')
      .select('id')
      .eq('name', 'Member')
      .single();

    if (!memberRole) {
      return NextResponse.json({ error: 'Member role not found' }, { status: 500 });
    }

    // For each user-project assignment, ensure user is in department
    for (const up of userProjects || []) {
      const userId = up.user_id;
      const projectData = up.projects;
      
      // projects is an object, not array
      const departmentId = (projectData as any).project_department?.[0]?.department_id;
      const organizationId = (projectData as any).organization_id;

      if (!departmentId) {
        console.log(`⚠️ FIX: Project ${up.project_id} has no department, skipping`);
        skippedCount++;
        continue;
      }

      // Check if user already has department assignment
      const { data: existing } = await supabase
        .from('user_department_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('department_id', departmentId)
        .single();

      if (existing) {
        skippedCount++;
        continue;
      }

      // Add department assignment
      const { error: insertError } = await supabase
        .from('user_department_roles')
        .insert({
          user_id: userId,
          department_id: departmentId,
          role_id: memberRole.id,
          organization_id: organizationId
        });

      if (insertError && insertError.code !== '23505') {
        console.error(`❌ FIX: Error adding user ${userId} to dept ${departmentId}:`, insertError);
        errors.push(`User ${userId}, Dept ${departmentId}: ${insertError.message}`);
      } else {
        console.log(`✅ FIX: Added user ${userId} to department ${departmentId}`);
        addedCount++;
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
