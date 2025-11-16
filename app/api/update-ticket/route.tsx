import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../db/connections';
import jwt from 'jsonwebtoken';
import { emailService } from '../../../lib/emailService';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  userId: string;
  org_id: string;
  role: string;
  sub: string;
}

interface UpdateTicketRequest {
  ticket_id: string;
  description?: string;
  status_id?: string;
  priority_id?: string;
  assigned_to?: string;
}

export async function PUT(request: NextRequest) {
  try {
    // Extract JWT token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    let decoded: DecodedToken;

    try {
      decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: UpdateTicketRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { ticket_id, description, status_id, priority_id, assigned_to } = body;

    if (!ticket_id) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      );
    }

    // First, fetch the existing ticket to check permissions
    const { data: existingTicket, error: fetchError } = await supabase
      .from('tickets')
      .select(`
        id,
        project_id,
        created_by,
        assigned_to,
        title,
        description,
        status_id,
        priority_id
      `)
      .eq('id', ticket_id)
      .single();

    if (fetchError) {
      console.error('Database error:', fetchError);
      
      if ((fetchError as any)?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch ticket' },
        { status: 500 }
      );
    }

    // Fetch the project to check organization
    const { data: ticketProject, error: projectError } = await supabase
      .from('projects')
      .select('id, organization_id')
      .eq('id', existingTicket.project_id)
      .single();

    if (projectError || !ticketProject) {
      console.error('Project fetch error:', projectError);
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Debug logging
    console.log('Debug - Organization Check:', {
      ticketId: ticket_id,
      projectId: existingTicket.project_id,
      projectOrgId: ticketProject.organization_id,
      userOrgId: decoded.org_id,
      matches: ticketProject.organization_id === decoded.org_id
    });

    // Check if ticket belongs to user's organization
    if (ticketProject.organization_id !== decoded.org_id) {
      return NextResponse.json(
        { error: 'Access denied - Ticket not found in your organization' },
        { status: 403 }
      );
    }

    // Role-based access control for editing
    const userRole = decoded.role;
    const isCreator = existingTicket.created_by === decoded.sub || existingTicket.created_by === decoded.userId;
    const isAssignee = existingTicket.assigned_to === decoded.sub || existingTicket.assigned_to === decoded.userId;

    // Get user's actual organization role
    const { data: userOrgRole } = await supabase
      .from('user_organization_roles')
      .select(`
        role_id,
        global_roles!user_organization_roles_role_id_fkey(name)
      `)
      .eq('user_id', decoded.sub)
      .eq('organization_id', decoded.org_id)
      .single();

    const actualUserRole = (userOrgRole?.global_roles as any)?.name || userRole;

    // Check if user has Manager role in the same project
    let isProjectManager = false;
    const { data: userProjectRole, error: roleError } = await supabase
      .from('user_project')
      .select(`
        project_id, role_id,
        global_roles!user_project_role_id_fkey(name)
      `)
      .eq('user_id', decoded.sub || decoded.userId)
      .eq('project_id', existingTicket.project_id)
      .single();
    
    if (!roleError && userProjectRole && (userProjectRole as any).global_roles?.name === 'Manager') {
      isProjectManager = true;
    }

    // Check edit permissions: Admin, Project Manager, Creator, or Assignee
    const canEdit = actualUserRole === 'Admin' || isProjectManager || isCreator || isAssignee;

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Access denied - You can only edit tickets you created, are assigned to, or manage within your projects' },
        { status: 403 }
      );
    }

    // Validate status_id if provided
    if (status_id) {
      const { data: validStatus, error: statusError } = await supabase
        .from('statuses')
        .select('id')
        .eq('id', status_id)
        .or(`organization_id.eq.${decoded.org_id},organization_id.is.null`)
        .eq('type', 'ticket')
        .eq('is_active', true)
        .maybeSingle();

      if (statusError || !validStatus) {
        return NextResponse.json(
          { error: 'Invalid status ID' },
          { status: 400 }
        );
      }
    }

    // Validate priority_id if provided
    if (priority_id) {
      // Check both statuses table (type=priority) and priorities table
      const { data: priorityStatus } = await supabase
        .from('statuses')
        .select('id')
        .eq('id', priority_id)
        .or(`organization_id.eq.${decoded.org_id},organization_id.is.null`)
        .eq('type', 'priority')
        .eq('is_active', true)
        .maybeSingle();

      if (!priorityStatus) {
        // Check legacy priorities table
        const { data: priorityRow } = await supabase
          .from('priorities')
          .select('id')
          .eq('id', priority_id)
          .or(`organization_id.eq.${decoded.org_id},organization_id.is.null`)
          .eq('is_active', true)
          .maybeSingle();

        if (!priorityRow) {
          return NextResponse.json(
            { error: 'Invalid priority ID' },
            { status: 400 }
          );
        }
      }
    }

    // Validate assigned_to if provided
    if (assigned_to) {
      console.log('🔍 Validating assignee:', assigned_to, 'for project:', existingTicket.project_id);
      
      // First, check if user exists in the organization using user_organization_roles junction table
      const { data: userInOrg, error: orgError } = await supabase
        .from('user_organization_roles')
        .select(`
          user_id,
          organization_id,
          users!inner(id, name, email, department_id)
        `)
        .eq('user_id', assigned_to)
        .eq('organization_id', decoded.org_id)
        .single();

      if (orgError || !userInOrg) {
        console.error('User not in organization:', orgError);
        console.log('Organization validation params:', {
          user_id: assigned_to,
          organization_id: decoded.org_id
        });
        return NextResponse.json(
          { error: 'Invalid assignee - User not found in organization' },
          { status: 400 }
        );
      }

      // Check if current user can assign to this user (department + shared project access)
      const canAssign = await checkAssignmentPermission(
        decoded.sub,
        assigned_to,
        existingTicket.project_id,
        decoded.org_id
      );

      if (!canAssign) {
        return NextResponse.json(
          { error: 'You cannot assign tickets to users outside your department or shared projects' },
          { status: 403 }
        );
      }

      console.log('✅ Assignee validation passed');
    }

    // Prepare update data (only include fields that are provided)
    const updateData: any = {
      updated_by: decoded.sub,
      updated_at: new Date().toISOString()
    };

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (status_id !== undefined) {
      updateData.status_id = status_id;
    }

    if (priority_id !== undefined) {
      updateData.priority_id = priority_id;
    }

    if (assigned_to !== undefined) {
      updateData.assigned_to = assigned_to || null;
    }

    // Update the ticket
    const { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', ticket_id)
      .select(`
        id,
        project_id,
        created_by,
        assigned_to,
        title,
        description,
        status_id,
        priority_id,
        created_at,
        updated_at,
        updated_by
      `)
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update ticket' },
        { status: 500 }
      );
    }

    // Log the ticket update activity
    try {
      const changedFields = [];
      if (description !== undefined && description !== existingTicket.description) {
        changedFields.push('description');
      }
      if (status_id && status_id !== existingTicket.status_id) {
        changedFields.push('status');
      }
      if (priority_id && priority_id !== existingTicket.priority_id) {
        changedFields.push('priority');
      }
      if (assigned_to !== undefined && assigned_to !== existingTicket.assigned_to) {
        changedFields.push('assignee');
      }

      if (changedFields.length > 0) {
        await supabase
          .from('ticket_activities')
          .insert({
            ticket_id: ticket_id,
            user_id: decoded.sub,
            action: 'updated',
            description: `Updated ticket fields: ${changedFields.join(', ')}`,
            created_at: new Date().toISOString()
          });
      }
    } catch (activityError) {
      // Don't fail the request if activity logging fails
      console.error('Activity logging error:', activityError);
    }

    // Fetch related data for complete response
    const [projectResult, creatorResult, assigneeResult, updaterResult, statusResult, priorityResult] = await Promise.all([
      // Project
      supabase
        .from('projects')
        .select('id, name, description')
        .eq('id', updatedTicket.project_id)
        .single(),
      
      // Creator
      supabase
        .from('users')
        .select('id, name, email')
        .eq('id', updatedTicket.created_by)
        .single(),
      
      // Assignee (if exists)
      updatedTicket.assigned_to ? supabase
        .from('users')
        .select('id, name, email')
        .eq('id', updatedTicket.assigned_to)
        .single() : Promise.resolve({ data: null, error: null }),
      
      // Updater
      supabase
        .from('users')
        .select('id, name, email')
        .eq('id', updatedTicket.updated_by)
        .single(),
      
      // Status (if exists)
      updatedTicket.status_id ? supabase
        .from('statuses')
        .select('id, name, type, color_code, sort_order')
        .eq('id', updatedTicket.status_id)
        .single() : Promise.resolve({ data: null, error: null }),
      
      // Priority (if exists) - check priorities table
      updatedTicket.priority_id ? supabase
        .from('priorities')
        .select('id, name, description, color_code, sort_order')
        .eq('id', updatedTicket.priority_id)
        .maybeSingle() : Promise.resolve({ data: null, error: null })
    ]);

    const project = projectResult.data;
    const creator = creatorResult.data;
    const assignee = assigneeResult.data;
    const updater = updaterResult.data;
    const status = statusResult.data;
    const priority = priorityResult.data;

    // Format the response
    const response = {
      message: 'Ticket updated successfully',
      ticket: {
        id: updatedTicket.id,
        title: updatedTicket.title, // Title is not editable, just returned
        description: updatedTicket.description,
        created_at: updatedTicket.created_at,
        updated_at: updatedTicket.updated_at,
        project: project ? {
          id: project.id,
          name: project.name,
          description: project.description
        } : null,
        creator: creator ? {
          id: creator.id,
          name: creator.name,
          email: creator.email
        } : null,
        assignee: assignee ? {
          id: assignee.id,
          name: assignee.name,
          email: assignee.email
        } : null,
        updater: updater ? {
          id: updater.id,
          name: updater.name,
          email: updater.email
        } : null,
        status: status ? {
          id: status.id,
          name: status.name,
          type: status.type,
          color_code: status.color_code,
          sort_order: status.sort_order
        } : null,
        priority: priority ? {
          id: priority.id,
          name: priority.name,
          type: 'priority', // Priorities don't have type field, hardcode it
          color_code: priority.color_code,
          sort_order: priority.sort_order
        } : null,
        permissions: {
          can_edit: canEdit,
          can_delete: actualUserRole === 'Admin' || isProjectManager || isCreator,
          can_assign: actualUserRole === 'Admin' || isProjectManager,
          is_creator: isCreator,
          is_assignee: isAssignee,
          is_project_manager: isProjectManager
        }
      }
    };

    // Send email notifications about the update
    try {
      await sendTicketUpdateNotifications(
        existingTicket, 
        updateData, 
        updatedTicket, 
        project?.name || 'Unknown Project',
        decoded.sub
      );
    } catch (emailError) {
      console.error('Failed to send update notifications:', emailError);
      // Don't fail the ticket update if email fails
    }

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Update ticket error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Also support PATCH method for partial updates
export async function PATCH(request: NextRequest) {
  return PUT(request);
}

// Also support POST method for compatibility
export async function POST(request: NextRequest) {
  return PUT(request);
}

// Helper function to send ticket update notifications
async function sendTicketUpdateNotifications(
  oldTicket: any, 
  updateData: any, 
  updatedTicket: any,
  projectName: string,
  updatedById: string
): Promise<void> {
  try {
    // Get updater details
    const { data: updater, error: updaterError } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', updatedById)
      .single();

    if (updaterError || !updater) {
      console.error('Failed to fetch updater details:', updaterError);
      return;
    }

    // Collect all changes
    const changes: Array<{ field: string; oldValue?: string; newValue?: string }> = [];

    // Check for description changes
    if (updateData.description !== undefined && updateData.description !== oldTicket.description) {
      changes.push({
        field: 'description',
        oldValue: oldTicket.description || 'Empty',
        newValue: updateData.description || 'Empty'
      });
    }

    // Check for status changes
    if (updateData.status_id && updateData.status_id !== oldTicket.status_id) {
      const [oldStatus, newStatus] = await Promise.all([
        oldTicket.status_id ? supabase.from('statuses').select('name').eq('id', oldTicket.status_id).single() : Promise.resolve({ data: null }),
        supabase.from('statuses').select('name').eq('id', updateData.status_id).single()
      ]);
      
      changes.push({
        field: 'status',
        oldValue: oldStatus.data?.name || 'Not Set',
        newValue: newStatus.data?.name || 'Unknown'
      });
    }

    // Check for priority changes
    if (updateData.priority_id && updateData.priority_id !== oldTicket.priority_id) {
      const [oldPriority, newPriority] = await Promise.all([
        oldTicket.priority_id ? supabase.from('priorities').select('name').eq('id', oldTicket.priority_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('priorities').select('name').eq('id', updateData.priority_id).maybeSingle()
      ]);
      
      changes.push({
        field: 'priority',
        oldValue: oldPriority.data?.name || 'Not Set',
        newValue: newPriority.data?.name || 'Unknown'
      });
    }

    // Check for assignee changes
    if (updateData.assigned_to !== undefined && updateData.assigned_to !== oldTicket.assigned_to) {
      const [oldAssignee, newAssignee] = await Promise.all([
        oldTicket.assigned_to ? supabase.from('users').select('name').eq('id', oldTicket.assigned_to).single() : Promise.resolve({ data: null }),
        updateData.assigned_to ? supabase.from('users').select('name').eq('id', updateData.assigned_to).single() : Promise.resolve({ data: null })
      ]);
      
      changes.push({
        field: 'assignee',
        oldValue: oldAssignee.data?.name || 'Unassigned',
        newValue: newAssignee.data?.name || 'Unassigned'
      });
    }

    // Only send emails if there are actual changes
    if (changes.length === 0) {
      console.log('No changes detected, skipping email notifications');
      return;
    }

    // Collect unique recipients (creator and assignee, excluding the updater to avoid self-notification)
    const recipients = new Set<string>();

    // Add creator (if different from updater)
    if (oldTicket.created_by && oldTicket.created_by !== updatedById) {
      recipients.add(oldTicket.created_by);
    }

    // Add current assignee (if different from updater)
    if (updatedTicket.assigned_to && updatedTicket.assigned_to !== updatedById) {
      recipients.add(updatedTicket.assigned_to);
    }

    // Add previous assignee if it changed (and different from updater)
    if (updateData.assigned_to !== oldTicket.assigned_to && 
        oldTicket.assigned_to && 
        oldTicket.assigned_to !== updatedById) {
      recipients.add(oldTicket.assigned_to);
    }

    console.log(`📧 Sending update notifications to ${recipients.size} recipients for ticket ${updatedTicket.id}`);

    // Send emails and create in-app notifications for all recipients
    const emailPromises = Array.from(recipients).map(async (recipientId) => {
      try {
        const { data: recipient, error: recipientError } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', recipientId)
          .single();

        if (recipientError || !recipient) {
          console.error(`Failed to fetch recipient details for ${recipientId}:`, recipientError);
          return;
        }

        // Create in-app notification
        const changesText = changes.map(c => c.field).join(', ');
        await supabase
          .from('notifications')
          .insert({
            user_id: recipientId,
            entity_type: 'ticket',
            entity_id: updatedTicket.id,
            title: 'Ticket Updated',
            message: `Ticket "${updatedTicket.title}" was updated. Changes: ${changesText}`,
            type: 'info'
          });

        // Send email notification
        const emailResult = await emailService.sendTicketUpdateEmail(
          recipient.email,
          updatedTicket.id,
          updatedTicket.title,
          projectName,
          recipient.name,
          updater.name,
          changes
        );

        if (emailResult.success) {
          console.log(`✅ Update notification sent to ${recipient.email} for ticket ${updatedTicket.id}`);
        } else {
          console.error(`❌ Failed to send update notification to ${recipient.email}: ${emailResult.error}`);
        }

      } catch (error) {
        console.error(`Error sending notification to recipient ${recipientId}:`, error);
      }
    });

    await Promise.allSettled(emailPromises);

  } catch (error) {
    console.error('Error in sendTicketUpdateNotifications:', error);
  }
}

// Helper function to check if user can assign tickets to another user
async function checkAssignmentPermission(
  creatorId: string,
  assigneeId: string,
  projectId: string,
  orgId: string
): Promise<boolean> {
  console.log('🔧 Checking assignment permission:', { creatorId, assigneeId, projectId, orgId });

  // Get creator's role and department
  const { data: creatorData } = await supabase
    .from('users')
    .select('department_id')
    .eq('id', creatorId)
    .single();

  const { data: creatorOrgRole } = await supabase
    .from('user_organization_roles')
    .select(`
      role_id,
      global_roles!user_organization_roles_role_id_fkey(name)
    `)
    .eq('user_id', creatorId)
    .eq('organization_id', orgId)
    .single();

  const creatorRole = (creatorOrgRole?.global_roles as any)?.name || 'User';
  console.log('🔧 Creator role:', creatorRole, 'department:', creatorData?.department_id);

  // Org Admins can assign to anyone in the organization
  if (creatorRole === 'Admin') {
    console.log('✅ Org Admin - can assign to anyone');
    return true;
  }

  // Get assignee's department
  const { data: assigneeData } = await supabase
    .from('users')
    .select('department_id')
    .eq('id', assigneeId)
    .single();

  console.log('🔧 Assignee department:', assigneeData?.department_id);

  // Check if users are in the same department
  if (creatorData?.department_id && assigneeData?.department_id) {
    if (creatorData.department_id === assigneeData.department_id) {
      console.log('✅ Same department - can assign');
      return true;
    }
  }

  // Check if the project is shared with assignee's department
  if (assigneeData?.department_id) {
    const { data: sharedProject } = await supabase
      .from('shared_projects')
      .select('project_id, department_id')
      .eq('project_id', projectId)
      .eq('department_id', assigneeData.department_id)
      .single();

    if (sharedProject) {
      console.log('✅ Project shared with assignee department - can assign');
      return true;
    }
  }

  // Check if assignee has direct access to the project via user_project
  const { data: assigneeProjectAccess } = await supabase
    .from('user_project')
    .select('user_id')
    .eq('user_id', assigneeId)
    .eq('project_id', projectId)
    .single();

  if (assigneeProjectAccess) {
    console.log('✅ Assignee has direct project access - can assign');
    return true;
  }

  console.log('❌ Cannot assign - no shared access');
  return false;
}
