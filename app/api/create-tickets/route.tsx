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

interface CreateTicketRequest {
  project_id: string;
  title: string;
  description?: string;
  status_id?: string;
  priority_id?: string;
  assigned_to?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎫 CREATE TICKET API - Request received');
    
    // Extract JWT token from Authorization header
    const authHeader = request.headers.get('authorization');
    console.log('🔧 Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid auth header');
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    let decoded: DecodedToken;

    try {
      decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
      console.log('✅ Token decoded:', { userId: decoded.sub, orgId: decoded.org_id, role: decoded.role });
    } catch (error) {
      console.log('❌ Token verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: CreateTicketRequest;
    try {
      body = await request.json();
      console.log('📝 Request body:', body);
    } catch (error) {
      console.log('❌ JSON parsing failed:', error);
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { project_id, title, description, status_id, priority_id, assigned_to } = body;

    // Validate required fields
    if (!project_id || !title) {
      return NextResponse.json(
        { error: 'project_id and title are required' },
        { status: 400 }
      );
    }

    // Verify project exists and belongs to user's organization
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, organization_id')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if project belongs to user's organization
    if (project.organization_id !== decoded.org_id) {
      return NextResponse.json(
        { error: 'Project does not belong to your organization' },
        { status: 403 }
      );
    }

    // Check user's permission to create tickets in this project
    const canCreateTicket = await checkUserProjectPermission(decoded.sub, project_id, decoded.role, decoded.org_id);
    if (!canCreateTicket) {
      return NextResponse.json(
        { error: 'You do not have permission to create tickets in this project' },
        { status: 403 }
      );
    }

    // Validate assigned_to user if provided
    if (assigned_to) {
      console.log('🔧 Validating assignee:', assigned_to, 'in organization:', decoded.org_id);
      
      const { data: assignee, error: assigneeError } = await supabase
        .from('user_organization_roles')
        .select(`
          user_id,
          organization_id,
          users!inner(id, name, email)
        `)
        .eq('user_id', assigned_to)
        .eq('organization_id', decoded.org_id)
        .single();

      console.log('🔧 Assignee validation result:', { assignee, assigneeError });

      if (assigneeError || !assignee) {
        return NextResponse.json(
          { error: 'Assigned user not found in your organization' },
          { status: 400 }
        );
      }
    }

    // Validate status_id if provided
    if (status_id) {
      console.log('🔧 Validating status_id:', status_id);
      const { data: status, error: statusError } = await supabase
        .from('statuses')
        .select('id, name, type')
        .eq('id', status_id)
        .eq('organization_id', decoded.org_id)
        .eq('type', 'ticket')
        .eq('is_active', true)
        .single();

      console.log('🔧 Status validation result:', { status, statusError });

      if (statusError || !status) {
        console.log('❌ Invalid status_id:', statusError?.message || 'Status not found');
        return NextResponse.json(
          { error: 'Invalid status_id for ticket' },
          { status: 400 }
        );
      }
    }

    // Validate priority_id if provided
    if (priority_id) {
      console.log('🔧 Validating priority_id:', priority_id);
      const { data: priority, error: priorityError } = await supabase
        .from('statuses')
        .select('id, name, type')
        .eq('id', priority_id)
        .eq('organization_id', decoded.org_id)
        .eq('type', 'priority')
        .eq('is_active', true)
        .single();

      console.log('🔧 Priority validation result:', { priority, priorityError });

      if (priorityError || !priority) {
        console.log('❌ Invalid priority_id:', priorityError?.message || 'Priority not found');
        return NextResponse.json(
          { error: 'Invalid priority_id' },
          { status: 400 }
        );
      }
    }

    // Get default status if not provided
    let finalStatusId = status_id;
    if (!finalStatusId) {
      const { data: defaultStatus } = await supabase
        .from('statuses')
        .select('id')
        .eq('organization_id', decoded.org_id)
        .eq('type', 'ticket')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(1)
        .single();

      finalStatusId = defaultStatus?.id;
    }

    // Create the ticket
    const { data: newTicket, error: createError } = await supabase
      .from('tickets')
      .insert({
        project_id,
        created_by: decoded.sub,
        assigned_to: assigned_to || null,
        title: title.trim(),
        description: description?.trim() || null,
        status_id: finalStatusId,
        priority_id: priority_id || null,
        updated_by: decoded.sub
      })
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
        projects!inner(id, name),
        creator:users!tickets_created_by_fkey(id, name, email),
        assignee:users!tickets_assigned_to_fkey(id, name, email),
        status:statuses!tickets_status_id_fkey(id, name, type, color_code),
        priority:statuses!tickets_priority_id_fkey(id, name, type, color_code)
      `)
      .single();

    if (createError) {
      console.error('Error creating ticket:', createError);
      return NextResponse.json(
        { error: 'Failed to create ticket' },
        { status: 500 }
      );
    }

    // Log activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: decoded.sub,
        entity_type: 'ticket',
        entity_id: newTicket.id,
        action: 'created',
        details: {
          ticket_title: title,
          project_name: project.name,
          assigned_to: assigned_to || null
        }
      });

    // Send email notification if ticket is assigned to someone other than creator
    if (assigned_to && assigned_to !== decoded.sub) {
      try {
        await sendTicketAssignmentNotification(assigned_to, newTicket, project.name, decoded.sub);
      } catch (emailError) {
        console.error('Failed to send assignment email:', emailError);
        // Don't fail the ticket creation if email fails
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Ticket created successfully',
        ticket: newTicket
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error in create-tickets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to check if user can create tickets in a project
async function checkUserProjectPermission(userId: string, projectId: string, userRole: string, orgId: string): Promise<boolean> {
  console.log('🔧 Checking user project permission:', { userId, projectId, userRole, orgId });

  // First check user's organization role using global roles system
  const { data: userOrgRole, error: orgRoleError } = await supabase
    .from('user_organization_roles')
    .select(`
      role_id,
      global_roles!user_organization_roles_role_id_fkey(name)
    `)
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .single();

  let actualUserRole = userRole; // fallback to JWT role
  if (userOrgRole && userOrgRole.global_roles) {
    actualUserRole = (userOrgRole.global_roles as any).name;
  }

  console.log('🔧 Actual user role:', actualUserRole);

  // Admins can create tickets in any project within their organization
  if (actualUserRole === 'Admin') {
    console.log('✅ Admin user - can create tickets in any project');
    return true;
  }

  // For Managers and regular users, check if they are assigned to the project
  const { data: userProject, error } = await supabase
    .from('user_project')
    .select('user_id, project_id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .single();

  console.log('🔧 User project assignment:', { userProject, error });

  if (error || !userProject) {
    // If not assigned to project, managers cannot create tickets
    // Only users assigned to specific projects can create tickets (except Admins)
    console.log('❌ User not assigned to project');
    return false;
  }

  // If user is assigned to project, check their project-level role
  // For Managers, they must have Manager role in this specific project
  if (actualUserRole === 'Manager') {
    const { data: projectRole, error: projectRoleError } = await supabase
      .from('user_project')
      .select(`
        role_id,
        global_roles!user_project_role_id_fkey(name)
      `)
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .single();

    console.log('🔧 Manager project role check:', { projectRole, projectRoleError });

    if (projectRoleError || !projectRole) {
      console.log('❌ Manager not found in project assignments');
      return false;
    }

    const projectRoleName = (projectRole.global_roles as any)?.name;
    console.log('🔧 Manager project role:', projectRoleName);

    if (projectRoleName !== 'Manager') {
      console.log('❌ Manager does not have Manager role in this project');
      return false;
    }

    console.log('✅ Manager has Manager role in project - can create tickets');
    return true;
  }

  // For regular users (Members), just being assigned to project is enough
  console.log('✅ User assigned to project - can create tickets');
  return true;
}

// Helper function to send ticket assignment notification
async function sendTicketAssignmentNotification(assignedUserId: string, ticket: any, projectName: string, createdById: string): Promise<void> {
  try {
    // Get assignee user details
    const { data: assignee, error: assigneeError } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', assignedUserId)
      .single();

    if (assigneeError || !assignee) {
      console.error('Failed to fetch assignee details:', assigneeError);
      return;
    }

    // Get creator user details
    const { data: creator, error: creatorError } = await supabase
      .from('users')
      .select('name')
      .eq('id', createdById)
      .single();

    if (creatorError || !creator) {
      console.error('Failed to fetch creator details:', creatorError);
      return;
    }

    // Get status and priority names if they exist
    let statusName = '';
    let priorityName = '';

    if (ticket.status_id) {
      const { data: status } = await supabase
        .from('statuses')
        .select('name')
        .eq('id', ticket.status_id)
        .single();
      statusName = status?.name || '';
    }

    if (ticket.priority_id) {
      const { data: priority } = await supabase
        .from('statuses')
        .select('name')
        .eq('id', ticket.priority_id)
        .single();
      priorityName = priority?.name || '';
    }

    // Send the assignment email
    const emailResult = await emailService.sendTicketAssignmentEmail(
      assignee.email,
      ticket.id,
      ticket.title,
      ticket.description || '',
      projectName,
      assignee.name,
      creator.name,
      priorityName,
      statusName
    );

    if (emailResult.success) {
      console.log(`✅ Assignment email sent to ${assignee.email} for ticket ${ticket.id}`);
    } else {
      console.error(`❌ Failed to send assignment email: ${emailResult.error}`);
    }

  } catch (error) {
    console.error('Error in sendTicketAssignmentNotification:', error);
  }
}
