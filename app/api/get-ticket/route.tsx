import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '../../db/connections';
import { db, tickets, projects, users, statuses, priorities, userProject, globalRoles, eq, and } from '@/lib/db-helper';
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
    const ticket = await db.select({
      id: tickets.id,
      projectId: tickets.projectId,
      createdBy: tickets.createdBy,
      assignedTo: tickets.assignedTo,
      title: tickets.title,
      description: tickets.description,
      statusId: tickets.statusId,
      priorityId: tickets.priorityId,
      expectedClosingDate: tickets.expectedClosingDate,
      actualClosingDate: tickets.actualClosingDate,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      updatedBy: tickets.updatedBy
    })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1)
      .then(rows => rows[0]);

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Fetch related data separately for better control
    const [project, creator, assignee, updater, status, priority] = await Promise.all([
      // Project
      db.select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        organizationId: projects.organizationId
      })
        .from(projects)
        .where(eq(projects.id, ticket.projectId))
        .limit(1)
        .then(rows => rows[0]),
      
      // Creator
      db.select({
        id: users.id,
        name: users.name,
        email: users.email
      })
        .from(users)
        .where(eq(users.id, ticket.createdBy))
        .limit(1)
        .then(rows => rows[0]),
      
      // Assignee (if exists)
      ticket.assignedTo ? db.select({
        id: users.id,
        name: users.name,
        email: users.email
      })
        .from(users)
        .where(eq(users.id, ticket.assignedTo))
        .limit(1)
        .then(rows => rows[0]) : Promise.resolve(null),
      
      // Updater (if exists)
      ticket.updatedBy ? db.select({
        id: users.id,
        name: users.name,
        email: users.email
      })
        .from(users)
        .where(eq(users.id, ticket.updatedBy))
        .limit(1)
        .then(rows => rows[0]) : Promise.resolve(null),
      
      // Status (if exists)
      ticket.statusId ? db.select({
        id: statuses.id,
        name: statuses.name,
        type: statuses.type,
        colorCode: statuses.colorCode,
        sortOrder: statuses.sortOrder
      })
        .from(statuses)
        .where(eq(statuses.id, ticket.statusId))
        .limit(1)
        .then(rows => rows[0]) : Promise.resolve(null),
      
      // Priority (if exists) - check priorities table
      ticket.priorityId ? db.select({
        id: priorities.id,
        name: priorities.name,
        description: priorities.description,
        colorCode: priorities.colorCode,
        sortOrder: priorities.sortOrder
      })
        .from(priorities)
        .where(eq(priorities.id, ticket.priorityId))
        .limit(1)
        .then(rows => rows[0]) : Promise.resolve(null)
    ]);

    // Check if project exists and belongs to user's organization
    if (!project || project.organizationId !== decoded.org_id) {
      return NextResponse.json(
        { error: 'Access denied - Ticket not found in your organization' },
        { status: 403 }
      );
    }

    // Role-based access control
    const userRole = decoded.role;
    // Try both sub and userId fields for creator comparison
    const isCreator = ticket.createdBy === decoded.sub || ticket.createdBy === decoded.userId;
    const isAssignee = ticket.assignedTo === decoded.sub || ticket.assignedTo === decoded.userId;

    // Check if user has Manager role in the same project
    let isProjectManager = false;
    if (userRole === 'Manager') {
      const userProjectRole = await db.select({
        projectId: userProject.projectId,
        roleId: userProject.roleId,
        roleName: globalRoles.name
      })
        .from(userProject)
        .innerJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
        .where(and(
          eq(userProject.userId, decoded.sub || decoded.userId),
          eq(userProject.projectId, ticket.projectId)
        ))
        .limit(1)
        .then((rows: any[]) => rows[0]);
      
      console.log('🔧 PROJECT MANAGER CHECK:', {
        userProjectRole,
        userId: decoded.sub || decoded.userId,
        projectId: ticket.projectId,
        globalRoleName: userProjectRole?.roleName
      });
      
      if (userProjectRole && userProjectRole.roleName === 'Manager') {
        isProjectManager = true;
      }
    }

    // Debug logging to help identify the issue
    console.log(`[GET-TICKET-${Date.now()}] Access Control Debug:`, {
      requestMethod: 'GET',
      ticketId: ticketId,
      userRole,
      ticketCreatedBy: ticket.createdBy,
      decodedSub: decoded.sub,
      decodedUserId: decoded.userId,
      ticketAssignedTo: ticket.assignedTo,
      isCreator,
      isAssignee,
      isProjectManager,
      projectId: ticket.projectId
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
        ticketCreatedBy: ticket.createdBy,
        userSubId: decoded.sub,
        userUserId: decoded.userId,
        projectId: ticket.projectId,
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
        expected_closing_date: ticket.expectedClosingDate?.toISOString(),
        actual_closing_date: ticket.actualClosingDate?.toISOString(),
        created_at: ticket.createdAt?.toISOString(),
        updated_at: ticket.updatedAt?.toISOString(),
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
          color_code: status.colorCode,
          sort_order: status.sortOrder
        } : null,
        priority: priority ? {
          id: priority.id,
          name: priority.name,
          type: 'priority', // Priorities don't have type field, hardcode it
          color_code: priority.colorCode,
          sort_order: priority.sortOrder
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
