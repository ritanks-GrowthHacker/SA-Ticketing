import { NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
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
    const { data: request, error: requestError } = await supabase
      .from('resource_requests')
      .select(`
        *,
        projects(id, name),
        requested_user:users!resource_requests_requested_user_id_fkey(id, name, email, department_id),
        requester:users!resource_requests_requested_by_fkey(id, name, email, department_id),
        user_department:departments!resource_requests_user_department_id_fkey(id, name),
        requested_role:global_roles!resource_requests_requested_role_id_fkey(id, name)
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return NextResponse.json({ error: 'Resource request not found' }, { status: 404 });
    }

    if (request.status !== 'pending') {
      return NextResponse.json(
        { error: `Request already ${request.status}` },
        { status: 400 }
      );
    }

    // If approving, check if user is already in project
    if (action === 'approved') {
      const { data: existingAssignment } = await supabase
        .from('user_project')
        .select('id')
        .eq('user_id', request.requested_user_id)
        .eq('project_id', request.project_id)
        .single();

      if (existingAssignment) {
        // User already in project - delete this request and notify
        await supabase
          .from('resource_requests')
          .delete()
          .eq('id', requestId);

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
    const { error: updateError } = await supabase
      .from('resource_requests')
      .update({
        status: action,
        reviewed_by: decoded.sub,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error updating resource request:', updateError);
      
      // Handle duplicate status constraint error
      if (updateError.code === '23505') {
        // Delete the duplicate request
        await supabase
          .from('resource_requests')
          .delete()
          .eq('id', requestId);

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
      const projectId = request.project_id;
      const requestedUserId = request.requested_user_id;
      const requestedUserEmail = (request.requested_user as any).email;
      const requestedUserName = (request.requested_user as any).name;
      const projectName = (request.projects as any).name;

      // CRITICAL FIX: Get department ID from PROJECT, not from resource_request table
      // Resource request might have wrong dept ID (employee's dept instead of project's dept)
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(`
          id,
          project_department!inner(department_id)
        `)
        .eq('id', projectId)
        .single();

      if (projectError || !projectData) {
        console.error('Error fetching project department:', projectError);
        return NextResponse.json({ error: 'Failed to fetch project details' }, { status: 500 });
      }

      const projectDepartmentId = projectData.project_department[0]?.department_id;
      
      if (!projectDepartmentId) {
        console.error('Project has no department:', projectId);
        return NextResponse.json({ error: 'Project has no department assigned' }, { status: 500 });
      }

      console.log('✅ Using project department ID:', projectDepartmentId);

      // 1. Share project with the project's department (not user's dept)
      const { error: shareError } = await supabase
        .from('shared_projects')
        .insert({
          project_id: projectId,
          department_id: projectDepartmentId,
          shared_by: decoded.sub
        })
        .select()
        .single();

      if (shareError && shareError.code !== '23505') { // Ignore duplicate error
        console.error('Error sharing project:', shareError);
      }

      // 2. Assign user to PROJECT'S department (not their original department)
      const { data: existingDeptAssignment } = await supabase
        .from('user_department_roles')
        .select('id')
        .eq('user_id', requestedUserId)
        .eq('department_id', projectDepartmentId)
        .single();

      if (!existingDeptAssignment) {
        // Get Member role ID for department assignment
        const { data: memberRole } = await supabase
          .from('global_roles')
          .select('id')
          .eq('name', 'Member')
          .single();

        if (memberRole) {
          const { error: deptAssignError } = await supabase
            .from('user_department_roles')
            .insert({
              user_id: requestedUserId,
              department_id: projectDepartmentId,
              role_id: memberRole.id,
              organization_id: decoded.org_id
            });

          if (deptAssignError && deptAssignError.code !== '23505') {
            console.error('Error assigning user to department:', deptAssignError);
          } else {
            console.log('✅ User assigned to PROJECT department:', {
              userId: requestedUserId,
              departmentId: projectDepartmentId,
              roleName: 'Member',
              organizationId: decoded.org_id
            });
          }
        }
      } else {
        console.log('ℹ️ User already in project department');
      }

      // 3. Assign user to project (add to user_project table)
      // Use the requested role if specified, otherwise default to Member
      let roleId = request.requested_role_id;
      
      if (!roleId) {
        const { data: memberRole } = await supabase
          .from('global_roles')
          .select('id')
          .eq('name', 'Member')
          .single();
        roleId = memberRole?.id;
      }

      if (roleId) {
        const { error: assignError } = await supabase
          .from('user_project')
          .insert({
            user_id: requestedUserId,
            project_id: projectId,
            role_id: roleId
          })
          .select()
          .single();

        if (assignError && assignError.code !== '23505') { // Ignore duplicate error
          console.error('Error assigning user to project:', assignError);
        } else {
          console.log('✅ User assigned to project:', { 
            userId: requestedUserId, 
            projectId, 
            roleId,
            roleName: request.requested_role ? (request.requested_role as any).name : 'Member'
          });
        }
      }

      // 4. Create notification for the requested user
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: requestedUserId,
          entity_type: 'project',
          entity_id: projectId,
          title: 'Project Access Approved',
          message: `You have been granted access to project "${projectName}"`,
          type: 'success'
        });

      if (notifError) {
        console.error('Error creating notification:', notifError);
      }

      // 5. Send email to the requested user
      try {
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
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/projects" 
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
      const requestedUserId = request.requested_user_id;
      const requestedUserEmail = (request.requested_user as any).email;
      const requestedUserName = (request.requested_user as any).name;
      const projectName = (request.projects as any).name;

      // Create rejection notification
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: requestedUserId,
          entity_type: 'project',
          entity_id: request.project_id,
          title: 'Project Access Rejected',
          message: `Your request to access project "${projectName}" was not approved`,
          type: 'error'
        });

      if (notifError) {
        console.error('Error creating rejection notification:', notifError);
      }

      // Send rejection email
      try {
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
      } catch (emailError) {
        console.error('Error sending rejection email:', emailError);
      }
    }

    // Delete the processed request from database (both approved and rejected)
    console.log('🗑️ Deleting processed request:', requestId);
    const { error: deleteError } = await supabase
      .from('resource_requests')
      .delete()
      .eq('id', requestId);

    if (deleteError) {
      console.error('❌ Error deleting processed request:', deleteError);
      // Don't fail the request if delete fails - just log it
    } else {
      console.log('✅ Processed request deleted successfully');
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
