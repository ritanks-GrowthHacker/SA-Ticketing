import { NextResponse } from 'next/server';
// Supabase (commented out - migrated to PostgreSQL)
// import { supabase } from "@/app/db/connections";

// PostgreSQL with Drizzle ORM
import { db, tickets, projects, users, userOrganizationRoles, userDepartmentRoles, globalRoles, userProject, projectDepartment, sharedProjects, ticketComments, notifications, eq, and, sql } from '@/lib/db-helper';

import jwt from 'jsonwebtoken';
import { CreateCommentRequest, CommentsListResponse, CommentResponse, TicketCommentWithUser, buildCommentTree } from '../../../db/comment-types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper function to check if user has access to a ticket
async function checkTicketAccess(ticketId: string, userId: string, organizationId: string): Promise<boolean> {
  try {
    // Get the ticket with project information
    // Supabase (commented out)
    // const { data: ticket, error: ticketError } = await supabase.from('tickets').select(`...`)

    // PostgreSQL with Drizzle
    const ticketData = await db
      .select({
        id: tickets.id,
        projectId: tickets.projectId,
        assignedTo: tickets.assignedTo,
        createdBy: tickets.createdBy,
        orgId: projects.organizationId
      })
      .from(tickets)
      .innerJoin(projects, eq(tickets.projectId, projects.id))
      .where(
        and(
          eq(tickets.id, ticketId),
          eq(projects.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!ticketData || ticketData.length === 0) {
      console.log('❌ Ticket not found or not in user organization:', ticketId);
      return false;
    }

    const ticket = ticketData[0];

    // Get user's role in the organization (check both org-level and dept-level)
    // Supabase (commented out)
    // const { data: userOrgRole } = await supabase.from('user_organization_roles').select(`...`)
    // const { data: userDeptRole } = await supabase.from('user_department_roles').select(`...`)

    // PostgreSQL with Drizzle
    const userOrgRoleData = await db
      .select({
        roleId: userOrganizationRoles.roleId,
        roleName: globalRoles.name
      })
      .from(userOrganizationRoles)
      .innerJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
      .where(
        and(
          eq(userOrganizationRoles.userId, userId),
          eq(userOrganizationRoles.organizationId, organizationId)
        )
      )
      .limit(1);

    const userDeptRoleData = await db
      .select({
        roleId: userDepartmentRoles.roleId,
        roleName: globalRoles.name
      })
      .from(userDepartmentRoles)
      .innerJoin(globalRoles, eq(userDepartmentRoles.roleId, globalRoles.id))
      .where(
        and(
          eq(userDepartmentRoles.userId, userId),
          eq(userDepartmentRoles.organizationId, organizationId)
        )
      )
      .limit(1);

    const userRole = userOrgRoleData[0]?.roleName || userDeptRoleData[0]?.roleName || 'Member';

    // Admin can access any ticket in the organization
    if (userRole === 'Admin') {
      return true;
    }

    // Check if user has access to this ticket through:
    // 1. Direct project assignment (user_project)
    // 2. Department ownership (project_department matching user's department)
    // 3. Shared project access (shared_projects)
    // 4. Being creator or assignee

    // First check if user is creator or assignee
    if (ticket.assignedTo === userId || ticket.createdBy === userId) {
      return true;
    }

    // Get user's department
    // Supabase (commented out)
    // const { data: userData } = await supabase.from('users').select('department_id').eq('id', userId).single();

    // PostgreSQL with Drizzle
    const userData = await db
      .select({ departmentId: users.departmentId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Check if project belongs to user's department
    if (userData[0]?.departmentId) {
      // Supabase (commented out)
      // const { data: projectDept } = await supabase.from('project_department').select('project_id')...

      // PostgreSQL with Drizzle
      const projectDept = await db
        .select({ projectId: projectDepartment.projectId })
        .from(projectDepartment)
        .where(
          and(
            eq(projectDepartment.projectId, ticket.projectId),
            eq(projectDepartment.departmentId, userData[0].departmentId)
          )
        )
        .limit(1);

      if (projectDept.length > 0) {
        return true;
      }

      // Check if project is shared with user's department
      // Supabase (commented out)
      // const { data: sharedProject } = await supabase.from('shared_projects').select('project_id')...

      // PostgreSQL with Drizzle
      const sharedProject = await db
        .select({ projectId: sharedProjects.projectId })
        .from(sharedProjects)
        .where(
          and(
            eq(sharedProjects.projectId, ticket.projectId),
            eq(sharedProjects.departmentId, userData[0].departmentId)
          )
        )
        .limit(1);

      if (sharedProject.length > 0) {
        return true;
      }
    }

    // Get user's project assignments and roles
    // Supabase (commented out)
    // const { data: userProjects } = await supabase.from('user_project').select(`...`)

    // PostgreSQL with Drizzle
    const userProjects = await db
      .select({
        projectId: userProject.projectId,
        roleId: userProject.roleId,
        roleName: globalRoles.name
      })
      .from(userProject)
      .innerJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
      .where(
        and(
          eq(userProject.userId, userId),
          eq(userProject.projectId, ticket.projectId)
        )
      );

    if (userProjects && userProjects.length > 0) {
      const projectRole = userProjects[0].roleName || 'Member';

      // Manager can access any ticket in projects they manage
      if (projectRole === 'Manager') {
        return true;
      }

      // User/Member can access tickets in projects they're assigned to
      if (projectRole === 'Member' || projectRole === 'User') {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('❌ Error checking ticket access:', error);
    return false;
  }
}

// GET /api/ticket-comments?ticket_id=xxx - Get all comments for a ticket
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticket_id = searchParams.get('ticket_id');
    
    if (!ticket_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'ticket_id parameter is required' 
      }, { status: 400 });
    }

    // Get auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authorization token required' 
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.sub || decoded.userId;
    const organizationId = decoded.org_id || decoded.organizationId;

    console.log('🔍 Fetching comments for ticket:', ticket_id);

    // First, check if user has access to this ticket based on RBAC
    const hasAccess = await checkTicketAccess(ticket_id, userId, organizationId);
    if (!hasAccess) {
      console.log('❌ User does not have access to ticket:', ticket_id);
      return NextResponse.json({ 
        success: false, 
        error: 'Ticket not found or access denied' 
      }, { status: 403 });
    }

    // Fetch comments with user information - handle both old and new schema
    // Supabase (commented out)
    // const { data: comments, error } = await supabase.from('ticket_comments').select(`...`)

    // PostgreSQL with Drizzle
    const commentsData = await db
      .select({
        id: ticketComments.id,
        ticketId: ticketComments.ticketId,
        parentCommentId: ticketComments.parentCommentId,
        userId: ticketComments.userId,
        comment: ticketComments.comment,
        content: ticketComments.content,
        isDeleted: ticketComments.isDeleted,
        createdAt: ticketComments.createdAt,
        updatedAt: ticketComments.updatedAt,
        userName: users.name,
        userEmail: users.email,
        userProfilePictureUrl: users.profilePictureUrl
      })
      .from(ticketComments)
      .innerJoin(users, eq(ticketComments.userId, users.id))
      .where(
        and(
          eq(ticketComments.ticketId, ticket_id),
          eq(ticketComments.isDeleted, false)
        )
      )
      .orderBy(ticketComments.createdAt);

    if (!commentsData) {
      console.error('❌ Error fetching comments');
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch comments' 
      }, { status: 500 });
    }

    // Transform data to match expected format
    const transformedComments = commentsData.map((comment: any) => ({
      id: comment.id,
      ticket_id: comment.ticketId,
      parent_comment_id: comment.parentCommentId,
      user_id: comment.userId,
      organization_id: organizationId,
      content: comment.content || comment.comment, // Support both old and new fields
      is_deleted: comment.isDeleted || false,
      created_at: comment.createdAt,
      updated_at: comment.updatedAt,
      user_name: comment.userName || 'Unknown User',
      user_email: comment.userEmail || '',
      user_avatar: comment.userProfilePictureUrl || null
    }));

    // Build nested comment tree
    const nestedComments = buildCommentTree(transformedComments as TicketCommentWithUser[]);
    
    console.log('✅ Comments fetched successfully:', {
      ticket_id,
      total_comments: transformedComments.length,
      root_comments: nestedComments.length
    });

    const response: CommentsListResponse = {
      success: true,
      comments: nestedComments,
      total_count: transformedComments.length
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error in GET /api/ticket-comments:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST /api/ticket-comments - Create a new comment
export async function POST(request: Request) {
  try {
    const body: CreateCommentRequest = await request.json();
    const { ticket_id, parent_comment_id, content } = body;

    if (!ticket_id || !content || content.trim().length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'ticket_id and content are required' 
      }, { status: 400 });
    }

    // Get auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authorization token required' 
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.sub || decoded.userId;
    const organizationId = decoded.org_id || decoded.organizationId;

    console.log('📝 Creating comment:', { ticket_id, parent_comment_id, user_id: userId });
    console.log('🕐 Current server time:', new Date().toISOString());
    console.log('🕐 JWT issued at:', new Date(decoded.iat * 1000).toISOString());

    // Check if user has access to this ticket based on RBAC
    const hasAccess = await checkTicketAccess(ticket_id, userId, organizationId);
    if (!hasAccess) {
      console.log('❌ User does not have access to comment on ticket:', ticket_id);
      return NextResponse.json({ 
        success: false, 
        error: 'Ticket not found or access denied' 
      }, { status: 403 });
    }

    // If this is a reply, verify parent comment exists and belongs to same ticket
    if (parent_comment_id) {
      // Supabase (commented out)
      // const { data: parentComment, error: parentError } = await supabase.from('ticket_comments').select('id, ticket_id')...

      // PostgreSQL with Drizzle
      const parentComment = await db
        .select({
          id: ticketComments.id,
          ticketId: ticketComments.ticketId
        })
        .from(ticketComments)
        .where(
          and(
            eq(ticketComments.id, parent_comment_id),
            eq(ticketComments.ticketId, ticket_id)
          )
        )
        .limit(1);

      if (!parentComment || parentComment.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Parent comment not found or invalid' 
        }, { status: 400 });
      }
    }

    // Create the comment
    // Supabase (commented out)
    // const { data: newComment, error: createError } = await supabase.from('ticket_comments').insert(commentData).select().single();

    // PostgreSQL with Drizzle
    const newCommentData = await db
      .insert(ticketComments)
      .values({
        ticketId: ticket_id,
        parentCommentId: parent_comment_id || null,
        userId: userId,
        comment: content.trim(),
        content: content.trim(),
        organizationId: organizationId
      })
      .returning();

    if (!newCommentData || newCommentData.length === 0) {
      console.error('❌ Error creating comment');
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create comment' 
      }, { status: 500 });
    }

    const newComment = newCommentData[0];

    console.log('🕐 Comment created with timestamp:', newComment.createdAt);
    console.log('🕐 Current time for comparison:', new Date().toISOString());

    // Get the comment with user information
    // Supabase (commented out)
    // const { data: commentWithUserData, error: fetchError } = await supabase.from('ticket_comments').select(`...`)

    // PostgreSQL with Drizzle
    const commentWithUserDataResult = await db
      .select({
        id: ticketComments.id,
        ticketId: ticketComments.ticketId,
        parentCommentId: ticketComments.parentCommentId,
        userId: ticketComments.userId,
        comment: ticketComments.comment,
        content: ticketComments.content,
        isDeleted: ticketComments.isDeleted,
        createdAt: ticketComments.createdAt,
        updatedAt: ticketComments.updatedAt,
        userName: users.name,
        userEmail: users.email,
        userProfilePictureUrl: users.profilePictureUrl
      })
      .from(ticketComments)
      .innerJoin(users, eq(ticketComments.userId, users.id))
      .where(eq(ticketComments.id, newComment.id))
      .limit(1);

    if (!commentWithUserDataResult || commentWithUserDataResult.length === 0) {
      console.error('❌ Error fetching created comment');
      return NextResponse.json({ 
        success: false, 
        error: 'Comment created but failed to fetch details' 
      }, { status: 500 });
    }

    const commentWithUserData = commentWithUserDataResult[0];

    // Transform the data
    const commentWithUser = {
      id: commentWithUserData.id,
      ticket_id: commentWithUserData.ticketId,
      parent_comment_id: commentWithUserData.parentCommentId,
      user_id: commentWithUserData.userId,
      organization_id: organizationId,
      content: commentWithUserData.content || commentWithUserData.comment,
      is_deleted: commentWithUserData.isDeleted || false,
      created_at: commentWithUserData.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: commentWithUserData.updatedAt?.toISOString() || new Date().toISOString(),
      user_name: commentWithUserData.userName || 'Unknown User',
      user_email: commentWithUserData.userEmail || '',
      user_avatar: commentWithUserData.userProfilePictureUrl || null
    };

    console.log('✅ Comment created successfully:', newComment.id);

    // Send notifications to ticket creator and assignee (excluding the commenter)
    try {
      // Supabase (commented out)
      // const { data: ticket } = await supabase.from('tickets').select(`...`)

      // PostgreSQL with Drizzle
      const ticketData = await db
        .select({
          id: tickets.id,
          title: tickets.title,
          createdBy: tickets.createdBy,
          assignedTo: tickets.assignedTo,
          projectName: projects.name
        })
        .from(tickets)
        .innerJoin(projects, eq(tickets.projectId, projects.id))
        .where(eq(tickets.id, ticket_id))
        .limit(1);

      if (ticketData && ticketData.length > 0) {
        const ticket = ticketData[0];
        const { emailService } = await import('@/lib/emailService');
        const recipients = new Set<string>();

        // Add creator (if not the commenter)
        if (ticket.createdBy && ticket.createdBy !== userId) {
          recipients.add(ticket.createdBy);
        }

        // Add assignee (if not the commenter and different from creator)
        if (ticket.assignedTo && ticket.assignedTo !== userId) {
          recipients.add(ticket.assignedTo);
        }

        const projectName = ticket.projectName || 'Unknown Project';
        const commenterName = commentWithUser.user_name;
        const commentText = content.trim().substring(0, 200); // Limit to 200 chars for email

        // Send emails and in-app notifications to all recipients
        for (const recipientId of recipients) {
          // Supabase (commented out)
          // const { data: recipient } = await supabase.from('users').select('name, email').eq('id', recipientId).single();

          // PostgreSQL with Drizzle
          const recipientData = await db
            .select({
              name: users.name,
              email: users.email
            })
            .from(users)
            .where(eq(users.id, recipientId))
            .limit(1);

          if (recipientData && recipientData.length > 0) {
            const recipient = recipientData[0];
            
            // Create in-app notification
            // Supabase (commented out)
            // await supabase.from('notifications').insert({...})

            // PostgreSQL with Drizzle
            await db.insert(notifications).values({
              userId: recipientId,
              entityType: 'ticket',
              entityId: ticket_id,
              title: parent_comment_id ? 'New Reply on Ticket' : 'New Comment on Ticket',
              message: `${commenterName} ${parent_comment_id ? 'replied to a comment' : 'commented'} on "${ticket.title}": "${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}"`,
              type: 'info'
            });

            // Send email notification
            await emailService.sendTicketCommentEmail(
              recipient.email,
              ticket_id,
              ticket.title,
              projectName,
              recipient.name,
              commenterName,
              commentText,
              !!parent_comment_id
            );
            console.log(`📧 Comment notification sent to ${recipient.email}`);
          }
        }
      }
    } catch (emailError) {
      console.error('Failed to send comment notifications:', emailError);
      // Don't fail the comment creation if email fails
    }

    const response: CommentResponse = {
      success: true,
      comment: commentWithUser as TicketCommentWithUser
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('❌ Error in POST /api/ticket-comments:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}