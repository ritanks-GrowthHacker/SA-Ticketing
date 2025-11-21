import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from '@/app/db/connections';

interface JWTPayload {
  sub: string;        // user ID
  org_id: string;     // organization ID
  org_name: string;   // organization name
  org_domain: string; // organization domain
  role: string;       // user role
  roles: string[];    // all user roles
  iat?: number;
  exp?: number;
}

export async function PUT(req: NextRequest) {
  try {
    // Get JWT token from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization token is required" }, 
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    let decodedToken: JWTPayload;

    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return NextResponse.json(
        { error: "Invalid or expired token" }, 
        { status: 401 }
      );
    }

    // Parse request body
    const { project_id, status_id } = await req.json();

    if (!project_id || !status_id) {
      return NextResponse.json(
        { error: "Project ID and Status ID are required" }, 
        { status: 400 }
      );
    }

    // Verify the project belongs to the user's organization
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, organization_id, created_by')
      .eq('id', project_id)
      .eq('organization_id', decodedToken.org_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found or access denied" }, 
        { status: 404 }
      );
    }

    // Verify the status exists (using known valid status IDs as fallback)
    const validStatusIds = [
      "d05ef4b9-63be-42e2-b4a2-3d85537b9b7d", // Active
      "f85e266d-7b75-4b08-b775-2fc17ca4b2a6", // Planning
      "9e001b85-22f5-435f-a95e-f546621c0ce3", // On Hold
      "af968d18-dfcc-4d69-93d9-9e7932155ccd", // Review
      "66a0ccee-c989-4835-a828-bd9765958cf6", // Completed
      "df41226f-a012-4f83-95e0-c91b0f25f70a"  // Cancelled
    ];

    const { data: status, error: statusError } = await supabase
      .from('project_statuses')
      .select('id, name')
      .eq('id', status_id)
      .single();

    // If database query fails, check if it's a valid status ID from our known list
    if (statusError || !status) {
      if (!validStatusIds.includes(status_id)) {
        console.error('Status validation failed:', { status_id, statusError, status });
        return NextResponse.json(
          { error: "Invalid status or status not found" }, 
          { status: 400 }
        );
      }
      // If it's a valid status ID, continue (fallback for database query issues)
      console.log('⚠️ Using fallback status validation for:', status_id);
    }

    // Permission check: Allow Admins OR check if JWT user is the Manager of this project
    console.log('🔧 Project status update - User:', decodedToken.sub, 'Project:', project_id, 'JWT Role:', decodedToken.role);
    
    // Check if user is Admin (can update any project)
    if (decodedToken.role === 'Admin') {
      console.log('✅ Global Admin access granted - can update any project');
    } else {
      // For non-Admins: Check if user has Manager role for this specific project
      console.log('🔍 Checking if user is Manager of this project...');
      
      const { data: userProjectRole, error: roleCheckError } = await supabase
        .from('user_project')
        .select(`
          user_id,
          global_roles!user_project_role_id_fkey(name)
        `)
        .eq('project_id', project_id)
        .eq('user_id', decodedToken.sub)
        .single();

      if (roleCheckError || !userProjectRole) {
        console.log('❌ User not assigned to this project:', { roleCheckError, userId: decodedToken.sub, project_id });
        return NextResponse.json(
          { error: "Access denied. You are not assigned to this project." }, 
          { status: 403 }
        );
      }

      const userRole = (userProjectRole.global_roles as any)?.name;
      console.log('🔍 User role in this project:', userRole);

      if (userRole !== 'Manager') {
        console.log('❌ User does not have Manager role in this project:', { 
          userRole, 
          userId: decodedToken.sub,
          project_id 
        });
        return NextResponse.json(
          { error: `Access denied. Only project managers can update project status. Your role: ${userRole}` }, 
          { status: 403 }
        );
      }
      
      console.log('✅ User confirmed as project manager - access granted');
    }

    // Update the project status
    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update({ 
        status_id: status_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', project_id)
      .select(`
        id,
        name,
        description,
        status_id,
        updated_at,
        project_statuses!projects_status_id_fkey(
          id,
          name,
          description,
          color_code,
          sort_order
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating project status:', updateError);
      return NextResponse.json(
        { error: "Failed to update project status" }, 
        { status: 500 }
      );
    }

    const statusName = status?.name || 'new status';
    
    // Send notifications to all project members about status change
    try {
      const { data: projectMembers } = await supabase
        .from('user_project')
        .select('user_id')
        .eq('project_id', project_id)
        .neq('user_id', decodedToken.sub); // Exclude the user who made the change

      if (projectMembers && projectMembers.length > 0) {
        const notifications = projectMembers.map(member => ({
          user_id: member.user_id,
          entity_type: 'project',
          entity_id: project_id,
          type: 'info',
          title: 'Project Status Updated',
          message: `Project "${updatedProject.name}" status changed to ${statusName}`,
          is_read: false
        }));

        await supabase.from('notifications').insert(notifications);
        console.log(`✅ Sent ${notifications.length} project status change notifications`);
      }
    } catch (notifError) {
      console.error('Failed to send project status notifications:', notifError);
      // Don't fail the status update if notifications fail
    }
    
    return NextResponse.json({
      success: true,
      message: `Project status updated to ${statusName}`,
      project: updatedProject,
      status_id: status_id
    });

  } catch (error) {
    console.error('Error in update-project-status API:', error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}