import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../db/connections';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  userId: string;
  org_id: string;
  role: string;
  sub: string;
}

export async function GET(request: NextRequest) {
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

    // Get ticket ID from URL parameters
    const url = new URL(request.url);
    const ticketId = url.searchParams.get('id');

    if (!ticketId) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      );
    }

    // Fetch ticket information with all related data
    const { data: ticket, error: fetchError } = await supabase
      .from('tickets')
      .select(`
        id,
        project_id,
        created_by,
        assigned_to,
        title,
        description,
        status_id,
        priority_id,
        expected_closing_date,
        actual_closing_date,
        created_at,
        updated_at,
        updated_by
      `)
      .eq('id', ticketId)
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

    // Fetch related data separately for better control
    const [projectResult, creatorResult, assigneeResult, updaterResult, statusResult, priorityResult] = await Promise.all([
      // Project
      supabase
        .from('projects')
        .select('id, name, description, organization_id')
        .eq('id', ticket.project_id)
        .single(),
      
      // Creator
      supabase
        .from('users')
        .select('id, name, email')
        .eq('id', ticket.created_by)
        .single(),
      
      // Assignee (if exists)
      ticket.assigned_to ? supabase
        .from('users')
        .select('id, name, email')
        .eq('id', ticket.assigned_to)
        .single() : Promise.resolve({ data: null, error: null }),
      
      // Updater (if exists)
      ticket.updated_by ? supabase
        .from('users')
        .select('id, name, email')
        .eq('id', ticket.updated_by)
        .single() : Promise.resolve({ data: null, error: null }),
      
      // Status (if exists)
      ticket.status_id ? supabase
        .from('statuses')
        .select('id, name, type, color_code, sort_order')
        .eq('id', ticket.status_id)
        .single() : Promise.resolve({ data: null, error: null }),
      
      // Priority (if exists) - check priorities table
      ticket.priority_id ? supabase
        .from('priorities')
        .select('id, name, description, color_code, sort_order')
        .eq('id', ticket.priority_id)
        .maybeSingle() : Promise.resolve({ data: null, error: null })
    ]);

    const project = projectResult.data;
    const creator = creatorResult.data;
    const assignee = assigneeResult.data;
    const updater = updaterResult.data;
    const status = statusResult.data;
    const priority = priorityResult.data;

    // Check for errors in any of the related data queries
    if (projectResult.error || creatorResult.error) {
      console.error('Database error:', projectResult.error || creatorResult.error);
      return NextResponse.json(
        { error: 'Failed to fetch ticket details' },
        { status: 500 }
      );
    }

    // Check if project exists and belongs to user's organization
    if (!project || project.organization_id !== decoded.org_id) {
      return NextResponse.json(
        { error: 'Access denied - Ticket not found in your organization' },
        { status: 403 }
      );
    }

    // Role-based access control
    const userRole = decoded.role;
    // Try both sub and userId fields for creator comparison
    const isCreator = ticket.created_by === decoded.sub || ticket.created_by === decoded.userId;
    const isAssignee = ticket.assigned_to === decoded.sub || ticket.assigned_to === decoded.userId;

    // Check if user has Manager role in the same project
    let isProjectManager = false;
    if (userRole === 'Manager') {
      const { data: userProjectRole, error: roleError } = await supabase
        .from('user_project')
        .select(`
          project_id, role_id,
          global_roles!user_project_role_id_fkey(name)
        `)
        .eq('user_id', decoded.sub || decoded.userId)
        .eq('project_id', ticket.project_id)
        .single();
      
      console.log('🔧 PROJECT MANAGER CHECK:', {
        userProjectRole,
        roleError,
        userId: decoded.sub || decoded.userId,
        projectId: ticket.project_id,
        globalRoleName: (userProjectRole as any)?.global_roles?.name
      });
      
      if (!roleError && userProjectRole && (userProjectRole as any).global_roles?.name === 'Manager') {
        isProjectManager = true;
      }
    }

    // Debug logging to help identify the issue
    console.log(`[GET-TICKET-${Date.now()}] Access Control Debug:`, {
      requestMethod: 'GET',
      ticketId: ticketId,
      userRole,
      ticketCreatedBy: ticket.created_by,
      decodedSub: decoded.sub,
      decodedUserId: decoded.userId,
      ticketAssignedTo: ticket.assigned_to,
      isCreator,
      isAssignee,
      isProjectManager,
      projectId: ticket.project_id
    });

    // Check permissions based on role - Admin, Creator, Assignee, or Project Manager
    const hasAccess = userRole === 'Admin' || isCreator || isAssignee || isProjectManager;
    
    console.log('Permission Check:', {
      hasAccess,
      userRole,
      isAdmin: userRole === 'Admin',
      isCreator,
      isAssignee,
      isProjectManager,
      condition: `${userRole} === 'Admin': ${userRole === 'Admin'} || isCreator: ${isCreator} || isAssignee: ${isAssignee} || isProjectManager: ${isProjectManager}`
    });

    if (!hasAccess) {
      console.log('ACCESS DENIED - Debug info:', {
        userRole,
        isAdmin: userRole === 'Admin',
        isCreator,
        isAssignee,
        isProjectManager,
        ticketCreatedBy: ticket.created_by,
        userSubId: decoded.sub,
        userUserId: decoded.userId,
        projectId: ticket.project_id,
        hasAccess
      });
      
      return NextResponse.json(
        { error: 'Access denied - You can only view tickets you created, are assigned to, or manage within your projects' },
        { status: 403 }
      );
    }

    console.log('ACCESS GRANTED - Proceeding with response');

    // Format the response
    const response = {
      message: 'Ticket retrieved successfully',
      ticket: {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        expected_closing_date: ticket.expected_closing_date,
        actual_closing_date: ticket.actual_closing_date,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
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
          can_edit: userRole === 'Admin' || isProjectManager || isCreator || isAssignee,
          can_delete: userRole === 'Admin' || isProjectManager || isCreator,
          can_assign: userRole === 'Admin' || isProjectManager,
          is_creator: isCreator,
          is_assignee: isAssignee,
          is_project_manager: isProjectManager
        }
      }
    };

    console.log(`[GET-TICKET-SUCCESS-${Date.now()}] Returning successful response:`, {
      ticketId: response.ticket.id,
      message: response.message
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error(`[GET-TICKET-ERROR-${Date.now()}] Get ticket error:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Optional: Also support POST method for ticket ID in body
export async function POST(request: NextRequest) {
  console.log(`[POST-${Date.now()}] Starting POST request to get-ticket`);
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

    // Parse request body for ticket ID
    let body: { ticket_id?: string; id?: string };
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Accept both ticket_id and id field names for flexibility
    const ticketId = body.ticket_id || body.id;

    if (!ticketId) {
      return NextResponse.json(
        { error: 'Ticket ID is required (use "ticket_id" or "id" field)' },
        { status: 400 }
      );
    }

    // Create a new URL with ticket ID as query parameter and use GET logic
    const newUrl = new URL(request.url);
    newUrl.searchParams.set('id', ticketId);
    
    const newRequest = new NextRequest(newUrl, {
      method: 'GET',
      headers: request.headers
    });

    return GET(newRequest);

  } catch (error) {
    console.error(`[POST-ERROR-${Date.now()}] Get ticket (POST) error:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
