import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '../../db/connections';
import { db, tickets, projects, userOrganizationRoles, userProject, globalRoles, ticketComments, notifications, activityLogs, eq, and } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  userId: string;
  org_id: string;
  role: string;
  sub: string;
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ DELETE TICKET API - Request received');
    
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

    // Get ticket_id from query params
    const { searchParams } = new URL(request.url);
    const ticket_id = searchParams.get('ticket_id');

    if (!ticket_id) {
      return NextResponse.json(
        { error: 'ticket_id is required' },
        { status: 400 }
      );
    }

    console.log('🔧 Deleting ticket:', ticket_id);

    // Fetch the existing ticket to check permissions
    const existingTicketData = await db.select({
      id: tickets.id,
      projectId: tickets.projectId,
      createdBy: tickets.createdBy,
      title: tickets.title,
      projectName: projects.name,
      projectOrgId: projects.organizationId
    })
      .from(tickets)
      .innerJoin(projects, eq(tickets.projectId, projects.id))
      .where(eq(tickets.id, ticket_id))
      .limit(1)
      .then(rows => rows[0]);

    if (!existingTicketData) {
      console.log('❌ Ticket not found');
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Check if ticket belongs to user's organization
    if (existingTicketData.projectOrgId !== decoded.org_id) {
      return NextResponse.json(
        { error: 'Access denied - Ticket not found in your organization' },
        { status: 403 }
      );
    }

    // Get user's organization role
    const userOrgRole = await db.select({
      roleId: userOrganizationRoles.roleId,
      roleName: globalRoles.name
    })
      .from(userOrganizationRoles)
      .innerJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
      .where(and(
        eq(userOrganizationRoles.userId, decoded.sub),
        eq(userOrganizationRoles.organizationId, decoded.org_id)
      ))
      .limit(1)
      .then(rows => rows[0]);

    const actualUserRole = userOrgRole?.roleName || decoded.role;
    console.log('🔧 User role:', actualUserRole);

    // Check delete permissions
    let canDelete = false;

    // Org Admins can delete any ticket
    if (actualUserRole === 'Admin') {
      console.log('✅ Org Admin - can delete any ticket');
      canDelete = true;
    } else {
      // Check if user is the creator
      const isCreator = existingTicketData.createdBy === decoded.sub;
      
      if (isCreator) {
        console.log('✅ User is ticket creator - can delete');
        canDelete = true;
      } else {
        // Check if user is a Manager in this project
        const userProjectRole = await db.select({
          projectId: userProject.projectId,
          roleId: userProject.roleId,
          roleName: globalRoles.name
        })
          .from(userProject)
          .innerJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
          .where(and(
            eq(userProject.userId, decoded.sub),
            eq(userProject.projectId, existingTicketData.projectId)
          ))
          .limit(1)
          .then(rows => rows[0]);

        if (userProjectRole && userProjectRole.roleName === 'Manager') {
          console.log('✅ User is project Manager - can delete');
          canDelete = true;
        }
      }
    }

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Access denied - You can only delete tickets you created or manage' },
        { status: 403 }
      );
    }

    // Delete related data first (due to foreign key constraints)
    // Delete ticket comments if any
    await db.delete(ticketComments)
      .where(eq(ticketComments.ticketId, ticket_id))
      .catch(err => console.log('No comments to delete:', err));

    // Delete notifications related to this ticket
    await db.delete(notifications)
      .where(and(
        eq(notifications.entityType, 'ticket'),
        eq(notifications.entityId, ticket_id)
      ))
      .catch(err => console.log('No notifications to delete:', err));

    // Delete the ticket
    const deletedTicket = await db.delete(tickets)
      .where(eq(tickets.id, ticket_id))
      .returning()
      .then(rows => rows[0]);

    if (!deletedTicket) {
      console.error('Error deleting ticket');
      return NextResponse.json(
        { error: 'Failed to delete ticket' },
        { status: 500 }
      );
    }

    // Log activity
    await db.insert(activityLogs)
      .values({
        userId: decoded.sub,
        entityType: 'ticket',
        entityId: ticket_id,
        action: 'deleted',
        details: {
          ticket_title: existingTicketData.title,
          project_name: existingTicketData.projectName
        }
      })
      .catch(err => console.error('Activity log error:', err));

    console.log('✅ Ticket deleted successfully:', ticket_id);

    return NextResponse.json(
      {
        success: true,
        message: 'Ticket deleted successfully'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in delete-ticket:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
