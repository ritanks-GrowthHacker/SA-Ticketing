import { NextResponse } from 'next/server';
// Supabase (commented out - migrated to PostgreSQL)
// import { supabase } from '@/app/db/connections';

// PostgreSQL with Drizzle ORM
import { db, resourceRequests, projects, users, departments, globalRoles, userProject, userDepartmentRoles, sharedProjects, notifications, projectDepartment, eq, and, sql } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';
import { emailService } from '@/lib/emailService';

interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  org_id: string;
  role: string;
}

export async function POST(req: Request) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

    const { requestId, action, reviewNotes } = await req.json();

    if (!requestId || !action || !['approved', 'rejected'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request. Provide requestId and action (approved/rejected)' },
        { status: 400 }
      );
    }

    // Get the resource request
    // Supabase (commented out)
    // const { data: request, error: requestError } = await supabase.from('resource_requests').select(`...`)

    // PostgreSQL with Drizzle
    const requestData = await db
      .select({
        id: resourceRequests.id,
        projectId: resourceRequests.projectId,
        requestedUserId: resourceRequests.requestedUserId,
        requestedBy: resourceRequests.requestedBy,
        userDepartmentId: resourceRequests.userDepartmentId,
        requestedRoleId: resourceRequests.requestedRoleId,
        status: resourceRequests.status,
        message: resourceRequests.message,
        createdAt: resourceRequests.createdAt,
        projectName: projects.name,
        requestedUserName: users.name,
        requestedUserEmail: users.email,
        deptName: departments.name,
        roleName: globalRoles.name
      })
      .from(resourceRequests)
      .leftJoin(projects, eq(resourceRequests.projectId, projects.id))
      .leftJoin(users, eq(resourceRequests.requestedUserId, users.id))
      .leftJoin(departments, eq(resourceRequests.userDepartmentId, departments.id))
      .leftJoin(globalRoles, eq(resourceRequests.requestedRoleId, globalRoles.id))
      .where(eq(resourceRequests.id, requestId))
      .limit(1);

    if (!requestData || requestData.length === 0) {
      return NextResponse.json({ error: 'Resource request not found' }, { status: 404 });
    }

    const request = requestData[0];

    if (request.status !== 'pending') {
      return NextResponse.json(
        { error: `Request already ${request.status}` },
        { status: 400 }
      );
    }

    // If approving, check if user is already in project
    if (action === 'approved') {
      // Supabase (commented out)
      // const { data: existingAssignment } = await supabase.from('user_project').select('id')...

      // PostgreSQL with Drizzle
      const existingAssignment = await db
        .select({ userId: userProject.userId, projectId: userProject.projectId })
        .from(userProject)
        .where(
          and(
            eq(userProject.userId, request.requestedUserId),
            eq(userProject.projectId, request.projectId)
          )
        )
        .limit(1);

      if (existingAssignment && existingAssignment.length > 0) {
        // User already in project - delete this request and notify
        // Supabase (commented out)
        // await supabase.from('resource_requests').delete().eq('id', requestId);

        // PostgreSQL with Drizzle
        await db
          .delete(resourceRequests)
          .where(eq(resourceRequests.id, requestId));

        return NextResponse.json(
          { 
            error: 'User is already assigned to this project. Request has been removed.',
            isDuplicate: true
          },
          { status: 409 }
        );
      }
    }

    // Update the request status
    // Supabase (commented out)
    // const { error: updateError } = await supabase.from('resource_requests').update({...})

    // PostgreSQL with Drizzle
    try {
      await db
        .update(resourceRequests)
        .set({
          status: action,
          reviewedBy: decoded.sub,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || null,
          updatedAt: new Date()
        })
        .where(eq(resourceRequests.id, requestId));
    } catch (updateError: any) {
      console.error('Error updating resource request:', updateError);
      
      // Handle duplicate status constraint error
      if (updateError.code === '23505') {
        // Delete the duplicate request
        await db
          .delete(resourceRequests)
          .where(eq(resourceRequests.id, requestId));

        return NextResponse.json(
          { 
            error: 'This request has already been processed. Duplicate request has been removed.',
            isDuplicate: true
          },
          { status: 409 }
        );
      }
      
      return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
    }

    // If approved, add project sharing and notifications
    if (action === 'approved') {
      const projectId = request.projectId;
      const requestedUserId = request.requestedUserId;
      const requestedUserEmail = request.requestedUserEmail;
      const requestedUserName = request.requestedUserName;
      const projectName = request.projectName;

      // CRITICAL FIX: Get department ID from PROJECT, not from resource_request table
      // Supabase (commented out)
      // const { data: projectData, error: projectError } = await supabase.from('projects').select(`...`)

      // PostgreSQL with Drizzle
      const projectData = await db
        .select({
          id: projects.id,
          departmentId: projectDepartment.departmentId
        })
        .from(projects)
        .innerJoin(projectDepartment, eq(projects.id, projectDepartment.projectId))
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!projectData || projectData.length === 0) {
        console.error('Error fetching project department');
        return NextResponse.json({ error: 'Failed to fetch project details' }, { status: 500 });
      }

      const projectDepartmentId = projectData[0]?.departmentId;
      
      if (!projectDepartmentId) {
        console.error('Project has no department:', projectId);
        return NextResponse.json({ error: 'Project has no department assigned' }, { status: 500 });
      }

      console.log('✅ Using project department ID:', projectDepartmentId);

      // 1. Share project with the project's department (not user's dept)
      // Supabase (commented out)
      // const { error: shareError } = await supabase.from('shared_projects').insert({...})

      // PostgreSQL with Drizzle
      try {
        await db
          .insert(sharedProjects)
          .values({
            projectId: projectId,
            departmentId: projectDepartmentId,
            sharedBy: decoded.sub
          });
      } catch (shareError: any) {
        if (shareError.code !== '23505') { // Ignore duplicate error
          console.error('Error sharing project:', shareError);
        }
      }

      // 2. Assign user to PROJECT'S department (not their original department)
      // Supabase (commented out)
      // const { data: existingDeptAssignment } = await supabase.from('user_department_roles').select('id')...

      // PostgreSQL with Drizzle
      const existingDeptAssignment = await db
        .select({ id: userDepartmentRoles.id })
        .from(userDepartmentRoles)
        .where(
          and(
            eq(userDepartmentRoles.userId, requestedUserId),
            eq(userDepartmentRoles.departmentId, projectDepartmentId)
          )
        )
        .limit(1);

      if (!existingDeptAssignment || existingDeptAssignment.length === 0) {
        // Get Member role ID for department assignment
        // Supabase (commented out)
        // const { data: memberRole } = await supabase.from('global_roles').select('id').eq('name', 'Member').single();

        // PostgreSQL with Drizzle
        const memberRole = await db
          .select({ id: globalRoles.id })
          .from(globalRoles)
          .where(eq(globalRoles.name, 'Member'))
          .limit(1);

        if (memberRole && memberRole.length > 0) {
          try {
            await db
              .insert(userDepartmentRoles)
              .values({
                userId: requestedUserId,
                departmentId: projectDepartmentId,
                roleId: memberRole[0].id,
                organizationId: decoded.org_id
              });

            console.log('✅ User assigned to PROJECT department:', {
              userId: requestedUserId,
              departmentId: projectDepartmentId,
              roleName: 'Member',
              organizationId: decoded.org_id
            });
          } catch (deptAssignError: any) {
            if (deptAssignError.code !== '23505') {
              console.error('Error assigning user to department:', deptAssignError);
            }
          }
        }
      } else {
        console.log('ℹ️ User already in project department');
      }

      // 3. DO NOT auto-assign user to project
      // Resource request approval only grants ACCESS (department sharing)
      // Actual project assignment with role must be done via Manage Access
      console.log('ℹ️ Resource request approved - user can now be assigned via Manage Access');
      console.log('📝 Next step: Manually assign user to project with appropriate role');

      // 4. Create notification for the requested user
      // Supabase (commented out)
      // const { error: notifError } = await supabase.from('notifications').insert({...});

      // PostgreSQL with Drizzle
      try {
        await db
          .insert(notifications)
          .values({
            userId: requestedUserId,
            entityType: 'project',
            entityId: projectId,
            title: 'Project Access Approved',
            message: `You have been granted access to project "${projectName}"`,
            type: 'success'
          });
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
      }

      // 5. Send email to the requested user
      try {
        if (requestedUserEmail) {
          await emailService.sendEmail({
            to: requestedUserEmail,
          subject: `Project Access Approved - ${projectName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #10b981;">Project Access Approved!</h2>
              <p>Hi ${requestedUserName},</p>
              <p>Great news! Your request to access the project <strong>"${projectName}"</strong> has been approved.</p>
              <p>You can now view and collaborate on this project in your dashboard.</p>
              <div style="margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/projects" 
                   style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Project
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">
                ${reviewNotes ? `Note from reviewer: ${reviewNotes}` : ''}
              </p>
            </div>
          `
        });
        }
      } catch (emailError) {
        console.error('Error sending approval email:', emailError);
        // Continue even if email fails
      }

      console.log('✅ Resource request approved:', {
        requestId,
        projectId,
        userId: requestedUserId,
        departmentId: projectDepartmentId
      });
    } else {
      // If rejected, notify the requested user
      const requestedUserId = request.requestedUserId;
      const requestedUserEmail = request.requestedUserEmail;
      const requestedUserName = request.requestedUserName;
      const projectName = request.projectName;

      // Create rejection notification
      // Supabase (commented out)
      // const { error: notifError } = await supabase.from('notifications').insert({...});

      // PostgreSQL with Drizzle
      try {
        await db
          .insert(notifications)
          .values({
            userId: requestedUserId,
            entityType: 'project',
            entityId: request.projectId,
            title: 'Project Access Rejected',
            message: `Your request to access project "${projectName}" was not approved`,
            type: 'error'
          });
      } catch (notifError) {
        console.error('Error creating rejection notification:', notifError);
      }

      // Send rejection email
      try {
        if (requestedUserEmail) {
          await emailService.sendEmail({
            to: requestedUserEmail,
          subject: `Project Access Request Update - ${projectName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ef4444;">Project Access Request Not Approved</h2>
              <p>Hi ${requestedUserName},</p>
              <p>We regret to inform you that your request to access the project <strong>"${projectName}"</strong> was not approved at this time.</p>
              <p style="color: #6b7280; font-size: 14px;">
                ${reviewNotes ? `Reason: ${reviewNotes}` : ''}
              </p>
              <p>If you have any questions, please contact your department admin.</p>
            </div>
          `
        });
        }
      } catch (emailError) {
        console.error('Error sending rejection email:', emailError);
      }
    }

    // Delete the processed request from database (both approved and rejected)
    console.log('🗑️ Deleting processed request:', requestId);
    // Supabase (commented out)
    // const { error: deleteError } = await supabase.from('resource_requests').delete().eq('id', requestId);

    // PostgreSQL with Drizzle
    try {
      await db
        .delete(resourceRequests)
        .where(eq(resourceRequests.id, requestId));
      console.log('✅ Processed request deleted successfully');
    } catch (deleteError) {
      console.error('❌ Error deleting processed request:', deleteError);
      // Don't fail the request if delete fails - just log it
    }

    return NextResponse.json({
      success: true,
      message: `Resource request ${action} successfully`,
      action
    });

  } catch (error) {
    console.error('Error handling resource request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
