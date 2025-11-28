import { NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, ticketComments, users as usersTable, tickets, projects, eq, and } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';
import { UpdateCommentRequest, CommentResponse, TicketCommentWithUser } from '../../../../db/comment-types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper function to check if user has access to a ticket
async function checkTicketAccess(ticketId: string, userId: string, organizationId: string): Promise<boolean> {
  try {
    // Get the ticket with project information
    const ticketData = await db.select({
      ticketId: tickets.id,
      projectId: tickets.projectId,
      assignedTo: tickets.assignedTo,
      createdBy: tickets.createdBy,
      projectOrgId: projects.organizationId
    })
    .from(tickets)
    .leftJoin(projects, eq(tickets.projectId, projects.id))
    .where(eq(tickets.id, ticketId))
    .limit(1);

    const ticket = ticketData[0];
    if (!ticket || ticket.projectOrgId !== organizationId) {
      console.log('❌ Ticket not found or not in user organization:', ticketId);
      return false;
    }

    // For simplicity, allow access if ticket is in user's organization
    // In production, you'd want to check project assignments
    return true;
  } catch (error) {
    console.error('❌ Error checking ticket access:', error);
    return false;
  }
}

// GET /api/ticket-comments/[id] - Get a specific comment
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const commentId = resolvedParams.id;

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

    // Fetch comment with user and ticket information
    const commentsData = await db.select({
      id: ticketComments.id,
      ticketId: ticketComments.ticketId,
      parentCommentId: ticketComments.parentCommentId,
      userId: ticketComments.userId,
      comment: ticketComments.comment,
      content: ticketComments.content,
      isDeleted: ticketComments.isDeleted,
      createdAt: ticketComments.createdAt,
      updatedAt: ticketComments.updatedAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userProfilePictureUrl: usersTable.profilePictureUrl
    })
    .from(ticketComments)
    .leftJoin(usersTable, eq(ticketComments.userId, usersTable.id))
    .where(eq(ticketComments.id, commentId))
    .limit(1);

    const comment = commentsData[0];
    if (!comment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found' 
      }, { status: 404 });
    }

    // Check if user has access to the ticket this comment belongs to
    const hasAccess = await checkTicketAccess(comment.ticketId, userId, organizationId);
    if (!hasAccess) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found' 
      }, { status: 404 });
    }

    // Transform comment to match expected format
    const transformedComment: TicketCommentWithUser = {
      id: comment.id,
      ticket_id: comment.ticketId,
      parent_comment_id: comment.parentCommentId,
      user_id: comment.userId,
      organization_id: organizationId,
      content: comment.content || comment.comment, // Support both old and new fields
      is_deleted: comment.isDeleted || false,
      created_at: comment.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: comment.updatedAt?.toISOString() || comment.createdAt?.toISOString() || new Date().toISOString(),
      user_name: comment.userName || 'Unknown User',
      user_email: comment.userEmail || '',
      user_avatar: comment.userProfilePictureUrl || null
    };

    const response: CommentResponse = {
      success: true,
      comment: transformedComment
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error in GET /api/ticket-comments/[id]:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// PUT /api/ticket-comments/[id] - Update a comment
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const commentId = resolvedParams.id;
    const body: UpdateCommentRequest = await request.json();
    const { content, edit_reason } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Content is required' 
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
    const userId = decoded.userId;
    const organizationId = decoded.organizationId;

    console.log('✏️ Updating comment:', { comment_id: commentId, user_id: userId });

    // Verify user owns this comment and it exists
    const existingComment = await db.select({
      id: ticketComments.id,
      userId: ticketComments.userId,
      organizationId: ticketComments.organizationId,
      isDeleted: ticketComments.isDeleted,
      ticketId: ticketComments.ticketId
    })
    .from(ticketComments)
    .where(and(eq(ticketComments.id, commentId), eq(ticketComments.userId, userId)))
    .limit(1)
    .then(rows => rows[0] || null);

    if (!existingComment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found or you do not have permission to edit it' 
      }, { status: 403 });
    }

    // Check if user has access to the ticket this comment belongs to
    const hasTicketAccess = await checkTicketAccess(existingComment.ticketId, userId, organizationId);
    if (!hasTicketAccess) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found or you do not have permission to edit it' 
      }, { status: 403 });
    }

    if (existingComment.isDeleted) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot edit deleted comment' 
      }, { status: 400 });
    }

    // Update the comment
    const updatedComments = await db.update(ticketComments)
      .set({ 
        content: content.trim(),
        updatedAt: new Date()
      })
      .where(eq(ticketComments.id, commentId))
      .returning();

    const updatedComment = updatedComments[0];
    if (!updatedComment) {
      console.error('❌ Error updating comment: No comment returned');
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update comment' 
      }, { status: 500 });
    }

    // Get updated comment with user information
    const updatedCommentData = await db.select({
      id: ticketComments.id,
      ticketId: ticketComments.ticketId,
      parentCommentId: ticketComments.parentCommentId,
      userId: ticketComments.userId,
      comment: ticketComments.comment,
      content: ticketComments.content,
      isDeleted: ticketComments.isDeleted,
      createdAt: ticketComments.createdAt,
      updatedAt: ticketComments.updatedAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userProfilePictureUrl: usersTable.profilePictureUrl
    })
    .from(ticketComments)
    .leftJoin(usersTable, eq(ticketComments.userId, usersTable.id))
    .where(eq(ticketComments.id, commentId))
    .limit(1);

    const commentWithUser = updatedCommentData[0];
    if (!commentWithUser) {
      console.error('❌ Error fetching updated comment');
      return NextResponse.json({ 
        success: false, 
        error: 'Comment updated but failed to fetch details' 
      }, { status: 500 });
    }

    console.log('✅ Comment updated successfully:', commentId);

    // Transform comment to match expected format
    const transformedComment: TicketCommentWithUser = {
      id: commentWithUser.id,
      ticket_id: commentWithUser.ticketId,
      parent_comment_id: commentWithUser.parentCommentId,
      user_id: commentWithUser.userId,
      organization_id: organizationId,
      content: commentWithUser.content || commentWithUser.comment, // Support both old and new fields
      is_deleted: commentWithUser.isDeleted || false,
      created_at: commentWithUser.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: commentWithUser.updatedAt?.toISOString() || new Date().toISOString(),
      user_name: commentWithUser.userName || 'Unknown User',
      user_email: commentWithUser.userEmail || '',
      user_avatar: commentWithUser.userProfilePictureUrl || null
    };

    const response: CommentResponse = {
      success: true,
      comment: transformedComment
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error in PUT /api/ticket-comments/[id]:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// DELETE /api/ticket-comments/[id] - Soft delete a comment
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const commentId = resolvedParams.id;

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
    const userId = decoded.userId;
    const organizationId = decoded.organizationId;

    console.log('🗑️ Deleting comment:', { comment_id: commentId, user_id: userId });

    // Verify user owns this comment and it exists
    const existingComment = await db.select({
      id: ticketComments.id,
      userId: ticketComments.userId,
      organizationId: ticketComments.organizationId,
      isDeleted: ticketComments.isDeleted,
      ticketId: ticketComments.ticketId
    })
    .from(ticketComments)
    .where(and(eq(ticketComments.id, commentId), eq(ticketComments.userId, userId)))
    .limit(1)
    .then(rows => rows[0] || null);

    if (!existingComment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found or you do not have permission to delete it' 
      }, { status: 403 });
    }

    // Check if user has access to the ticket this comment belongs to
    const hasTicketAccess = await checkTicketAccess(existingComment.ticketId, userId, organizationId);
    if (!hasTicketAccess) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found or you do not have permission to delete it' 
      }, { status: 403 });
    }

    if (existingComment.isDeleted) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment is already deleted' 
      }, { status: 400 });
    }

    // Soft delete the comment
    await db.update(ticketComments)
      .set({ 
        isDeleted: true,
        updatedAt: new Date()
      })
      .where(eq(ticketComments.id, commentId));

    console.log('✅ Comment deleted successfully:', commentId);

    return NextResponse.json({ 
      success: true, 
      message: 'Comment deleted successfully' 
    });

  } catch (error) {
    console.error('❌ Error in DELETE /api/ticket-comments/[id]:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}