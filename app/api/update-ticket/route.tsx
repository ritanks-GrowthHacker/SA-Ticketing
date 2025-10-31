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

    // Check edit permissions: Admin, Manager, Creator, or Assignee
    const canEdit = userRole === 'Admin' || userRole === 'Manager' || isCreator || isAssignee;

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Access denied - You can only edit tickets you created or are assigned to, or if you are an Admin/Manager' },
        { status: 403 }
      );
    }

    // Validate status_id if provided
    if (status_id) {
      const { data: validStatus, error: statusError } = await supabase
        .from('statuses')
        .select('id')
        .eq('id', status_id)
        .eq('organization_id', decoded.org_id)
        .eq('type', 'ticket')
        .eq('is_active', true)
        .single();

      if (statusError || !validStatus) {
        return NextResponse.json(
          { error: 'Invalid status ID' },
          { status: 400 }
        );
      }
    }

    // Validate priority_id if provided
    if (priority_id) {
      const { data: validPriority, error: priorityError } = await supabase
        .from('statuses')
        .select('id')
        .eq('id', priority_id)
        .eq('organization_id', decoded.org_id)
        .eq('type', 'priority')
        .eq('is_active', true)
        .single();

      if (priorityError || !validPriority) {
        return NextResponse.json(
          { error: 'Invalid priority ID' },
          { status: 400 }
        );
      }
    }

    // Validate assigned_to if provided
    if (assigned_to) {
      console.log('🔍 Validating assignee:', assigned_to, 'for project:', existingTicket.project_id);
      
      // First, check if user exists in the organization using user_organization junction table
      const { data: userInOrg, error: orgError } = await supabase
        .from('user_organization')
        .select(`
          user_id,
          organization_id,
          users(id, name, email)
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

      // Then check if user is assigned to the project
      const { data: userInProject, error: projectError } = await supabase
        .from('user_project')
        .select('user_id, project_id')
        .eq('user_id', assigned_to)
        .eq('project_id', existingTicket.project_id)
        .single();

      if (projectError || !userInProject) {
        console.error('User not in project:', projectError);
        console.log('Project validation params:', {
          user_id: assigned_to,
          project_id: existingTicket.project_id
        });
        
        // Debug: Show what projects this user is assigned to
        const { data: userProjects } = await supabase
          .from('user_project')
          .select('project_id, projects(name)')
          .eq('user_id', assigned_to);
        
        console.log('Available projects for user:', userProjects);
        
        return NextResponse.json(
          { error: 'Invalid assignee - User not assigned to this project' },
          { status: 400 }
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
      
      // Priority (if exists)
      updatedTicket.priority_id ? supabase
        .from('statuses')
        .select('id, name, type, color_code, sort_order')
        .eq('id', updatedTicket.priority_id)
        .single() : Promise.resolve({ data: null, error: null })
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
          type: priority.type,
          color_code: priority.color_code,
          sort_order: priority.sort_order
        } : null,
        permissions: {
          can_edit: canEdit,
          can_delete: userRole === 'Admin' || userRole === 'Manager' || isCreator,
          can_assign: userRole === 'Admin' || userRole === 'Manager',
          is_creator: isCreator,
          is_assignee: isAssignee
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
        oldTicket.priority_id ? supabase.from('statuses').select('name').eq('id', oldTicket.priority_id).single() : Promise.resolve({ data: null }),
        supabase.from('statuses').select('name').eq('id', updateData.priority_id).single()
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

    // Send emails to all recipients
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
        console.error(`Error sending email to recipient ${recipientId}:`, error);
      }
    });

    await Promise.allSettled(emailPromises);

  } catch (error) {
    console.error('Error in sendTicketUpdateNotifications:', error);
  }
}
