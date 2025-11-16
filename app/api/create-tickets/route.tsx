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
      
      // Check if user exists in organization (either org-level or dept-level role)
      const { data: orgRole } = await supabase
        .from('user_organization_roles')
        .select(`
          user_id,
          organization_id,
          users!inner(id, name, email, department_id)
        `)
        .eq('user_id', assigned_to)
        .eq('organization_id', decoded.org_id)
        .maybeSingle();

      const { data: deptRole } = await supabase
        .from('user_department_roles')
        .select(`
          user_id,
          organization_id,
          department_id,
          users!inner(id, name, email, department_id)
        `)
        .eq('user_id', assigned_to)
        .eq('organization_id', decoded.org_id)
        .maybeSingle();

      const assignee = orgRole || deptRole;

      console.log('🔧 Assignee validation result:', { 
        hasOrgRole: !!orgRole, 
        hasDeptRole: !!deptRole, 
        assignee 
      });

      if (!assignee) {
        return NextResponse.json(
          { error: 'Assigned user not found in your organization' },
          { status: 400 }
        );
      }

      // Check if creator can assign to this user based on department and shared project access
      const canAssign = await checkAssignmentPermission(
        decoded.sub,
        assigned_to,
        project_id,
        decoded.org_id
      );

      if (!canAssign) {
        return NextResponse.json(
          { error: 'You cannot assign tickets to users outside your department or shared projects' },
          { status: 403 }
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
        .or(`organization_id.eq.${decoded.org_id},organization_id.is.null`)
        .eq('type', 'ticket')
        .eq('is_active', true)
        .maybeSingle();

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

      // First try the new `statuses` table where type='priority' (supports global NULL org_id)
      const { data: priorityStatus } = await supabase
        .from('statuses')
        .select('id, name, type')
        .eq('id', priority_id)
        .or(`organization_id.eq.${decoded.org_id},organization_id.is.null`)
        .eq('type', 'priority')
        .eq('is_active', true)
        .maybeSingle();

      if (priorityStatus) {
        console.log('🔧 Priority found in `statuses` table:', priorityStatus);
      } else {
        // Backwards-compatible: check legacy `priorities` table
        const { data: priorityRow } = await supabase
          .from('priorities')
          .select('id, name, description, color_code, sort_order, is_active')
          .eq('id', priority_id)
          .or(`organization_id.eq.${decoded.org_id},organization_id.is.null`)
          .eq('is_active', true)
          .maybeSingle();

        console.log('🔧 Priority lookup in `priorities` table result:', priorityRow);

        if (!priorityRow) {
          console.log('❌ Invalid priority_id: not found in statuses or priorities');
          return NextResponse.json(
            { error: 'Invalid priority_id' },
            { status: 400 }
          );
        }
      }
    }

    // Get default status if not provided
    let finalStatusId = status_id;
    if (!finalStatusId) {
      const { data: defaultStatus } = await supabase
        .from('statuses')
        .select('id')
        .or(`organization_id.eq.${decoded.org_id},organization_id.is.null`)
        .eq('type', 'ticket')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();

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
        priority:priorities!tickets_priority_id_fkey(id, name, description, color_code)
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

    // Send notifications (email + in-app) if ticket is assigned to someone other than creator
    if (assigned_to && assigned_to !== decoded.sub) {
      try {
        // Create in-app notification
        await supabase
          .from('notifications')
          .insert({
            user_id: assigned_to,
            entity_type: 'ticket',
            entity_id: newTicket.id,
            title: 'New Ticket Assigned',
            message: `You have been assigned to ticket "${title}" in project "${project.name}"`,
            type: 'info'
          });

        // Send email notification
        await sendTicketAssignmentNotification(assigned_to, newTicket, project.name, decoded.sub);
      } catch (emailError) {
        console.error('Failed to send assignment notifications:', emailError);
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
    .maybeSingle();

  const { data: creatorDeptRole } = await supabase
    .from('user_department_roles')
    .select(`
      role_id,
      global_roles!user_department_roles_role_id_fkey(name)
    `)
    .eq('user_id', creatorId)
    .eq('organization_id', orgId)
    .maybeSingle();

  const creatorRole = (creatorOrgRole?.global_roles as any)?.name || (creatorDeptRole?.global_roles as any)?.name || 'User';
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

// Helper function to check if user can create tickets in a project
async function checkUserProjectPermission(userId: string, projectId: string, userRole: string, orgId: string): Promise<boolean> {
  console.log('🔧 Checking user project permission:', { userId, projectId, userRole, orgId });

  // Get user's organization role and department
  const { data: userOrgRole } = await supabase
    .from('user_organization_roles')
    .select(`
      role_id,
      global_roles!user_organization_roles_role_id_fkey(name)
    `)
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .maybeSingle();

  const { data: userDeptRole } = await supabase
    .from('user_department_roles')
    .select(`
      role_id,
      global_roles!user_department_roles_role_id_fkey(name)
    `)
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .maybeSingle();

  let actualUserRole = userRole; // fallback to JWT role
  if (userOrgRole && userOrgRole.global_roles) {
    actualUserRole = (userOrgRole.global_roles as any).name;
  } else if (userDeptRole && userDeptRole.global_roles) {
    actualUserRole = (userDeptRole.global_roles as any).name;
  }

  console.log('🔧 Actual user role:', actualUserRole);

  // Org Admins can create tickets in any project within their organization
  if (actualUserRole === 'Admin') {
    console.log('✅ Org Admin - can create tickets in any project');
    return true;
  }

  // Get user's department
  const { data: userData } = await supabase
    .from('users')
    .select('department_id')
    .eq('id', userId)
    .single();

  console.log('🔧 User department:', userData?.department_id);

  // Check if project belongs to user's department
  if (userData?.department_id) {
    const { data: projectDept } = await supabase
      .from('project_department')
      .select('project_id, department_id')
      .eq('project_id', projectId)
      .eq('department_id', userData.department_id)
      .single();

    if (projectDept) {
      console.log('✅ Project belongs to user department - can create tickets');
      return true;
    }

    // Check if project is shared with user's department
    const { data: sharedProject } = await supabase
      .from('shared_projects')
      .select('project_id, department_id')
      .eq('project_id', projectId)
      .eq('department_id', userData.department_id)
      .single();

    if (sharedProject) {
      console.log('✅ Project shared with user department - can create tickets');
      return true;
    }
  }

  // For Managers and regular users, check if they are directly assigned to the project
  const { data: userProject, error } = await supabase
    .from('user_project')
    .select('user_id, project_id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .single();

  console.log('🔧 User project assignment:', { userProject, error });

  if (error || !userProject) {
    console.log('❌ User has no access to this project');
    return false;
  }

  // If user is assigned to project, they can create tickets
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
