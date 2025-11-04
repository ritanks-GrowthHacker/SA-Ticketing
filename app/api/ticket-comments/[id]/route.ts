import { NextResponse } from 'next/server';
import { supabase } from "@/app/db/connections";
import jwt from 'jsonwebtoken';
import { UpdateCommentRequest, CommentResponse, TicketCommentWithUser } from '../../../../db/comment-types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper function to check if user has access to a ticket
async function checkTicketAccess(ticketId: string, userId: string, organizationId: string): Promise<boolean> {
  try {
    // Get the ticket with project information
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        id,
        project_id,
        assigned_to,
        created_by,
        projects!inner(organization_id)
      `)
      .eq('id', ticketId)
      .eq('projects.organization_id', organizationId)
      .single();

    if (ticketError || !ticket) {
      console.log('❌ Ticket not found or not in user organization:', ticketId);
      return false;
    }

    // Get user's role in the organization
    const { data: userOrg } = await supabase
      .from('user_organization')
      .select(`
        role_id,
        global_roles!user_organization_role_id_fkey(name)
      `)
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    const userRole = (userOrg?.global_roles as any)?.name || 'Member';

    // Admin can access any ticket in the organization
    if (userRole === 'Admin') {
      return true;
    }

    // Get user's project assignments and roles
    const { data: userProjects } = await supabase
      .from('user_project')
      .select(`
        project_id,
        role_id,
        global_roles!user_project_role_id_fkey(name)
      `)
      .eq('user_id', userId)
      .eq('project_id', ticket.project_id);

    if (!userProjects || userProjects.length === 0) {
      // User is not assigned to this project
      return false;
    }

    const projectRole = (userProjects[0].global_roles as any)?.name || 'Member';

    // Manager can access any ticket in projects they manage
    if (projectRole === 'Manager') {
      return true;
    }

    // User/Member can only access tickets assigned to them or created by them
    if (projectRole === 'Member' || projectRole === 'User') {
      return ticket.assigned_to === userId || ticket.created_by === userId;
    }

    return false;
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
    const { data: comment, error } = await supabase
      .from('ticket_comments')
      .select(`
        id,
        ticket_id,
        parent_comment_id,
        user_id,
        comment,
        content,
        is_deleted,
        created_at,
        updated_at,
        users!ticket_comments_user_id_fkey (
          id,
          name,
          email,
          profile_picture_url
        )
      `)
      .eq('id', commentId)
      .single();

    if (error || !comment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found' 
      }, { status: 404 });
    }

    // Check if user has access to the ticket this comment belongs to
    const hasAccess = await checkTicketAccess(comment.ticket_id, userId, organizationId);
    if (!hasAccess) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found' 
      }, { status: 404 });
    }

    // Transform comment to match expected format
    const transformedComment: TicketCommentWithUser = {
      id: comment.id,
      ticket_id: comment.ticket_id,
      parent_comment_id: comment.parent_comment_id,
      user_id: comment.user_id,
      organization_id: organizationId,
      content: comment.content || comment.comment, // Support both old and new fields
      is_deleted: comment.is_deleted || false,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      user_name: (comment.users as any)?.name || 'Unknown User',
      user_email: (comment.users as any)?.email || '',
      user_avatar: (comment.users as any)?.profile_picture_url || null
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
    const { data: existingComment, error: fetchError } = await supabase
      .from('ticket_comments')
      .select('id, user_id, organization_id, is_deleted, ticket_id')
      .eq('id', commentId)
      .eq('user_id', userId) // Only owner can edit
      .single();

    if (fetchError || !existingComment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found or you do not have permission to edit it' 
      }, { status: 403 });
    }

    // Check if user has access to the ticket this comment belongs to
    const hasTicketAccess = await checkTicketAccess(existingComment.ticket_id, userId, organizationId);
    if (!hasTicketAccess) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found or you do not have permission to edit it' 
      }, { status: 403 });
    }

    if (existingComment.is_deleted) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot edit deleted comment' 
      }, { status: 400 });
    }

    // Update the comment (triggers will handle edit history)
    const { data: updatedComment, error: updateError } = await supabase
      .from('ticket_comments')
      .update({ 
        content: content.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating comment:', updateError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update comment' 
      }, { status: 500 });
    }

    // Optionally add edit reason to history
    if (edit_reason) {
      await supabase
        .from('ticket_comment_edits')
        .update({ edit_reason })
        .eq('comment_id', commentId)
        .order('edited_at', { ascending: false })
        .limit(1);
    }

    // Get updated comment with user information
    const { data: commentWithUser, error: fetchUpdatedError } = await supabase
      .from('ticket_comments')
      .select(`
        id,
        ticket_id,
        parent_comment_id,
        user_id,
        comment,
        content,
        is_deleted,
        created_at,
        updated_at,
        users!ticket_comments_user_id_fkey (
          id,
          name,
          email,
          profile_picture_url
        )
      `)
      .eq('id', commentId)
      .single();

    if (fetchUpdatedError) {
      console.error('❌ Error fetching updated comment:', fetchUpdatedError);
      return NextResponse.json({ 
        success: false, 
        error: 'Comment updated but failed to fetch details' 
      }, { status: 500 });
    }

    console.log('✅ Comment updated successfully:', commentId);

    // Transform comment to match expected format
    const transformedComment: TicketCommentWithUser = {
      id: commentWithUser.id,
      ticket_id: commentWithUser.ticket_id,
      parent_comment_id: commentWithUser.parent_comment_id,
      user_id: commentWithUser.user_id,
      organization_id: organizationId,
      content: commentWithUser.content || commentWithUser.comment, // Support both old and new fields
      is_deleted: commentWithUser.is_deleted || false,
      created_at: commentWithUser.created_at,
      updated_at: commentWithUser.updated_at,
      user_name: (commentWithUser.users as any)?.name || 'Unknown User',
      user_email: (commentWithUser.users as any)?.email || '',
      user_avatar: (commentWithUser.users as any)?.profile_picture_url || null
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
    const { data: existingComment, error: fetchError } = await supabase
      .from('ticket_comments')
      .select('id, user_id, organization_id, is_deleted, ticket_id')
      .eq('id', commentId)
      .eq('user_id', userId) // Only owner can delete
      .single();

    if (fetchError || !existingComment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found or you do not have permission to delete it' 
      }, { status: 403 });
    }

    // Check if user has access to the ticket this comment belongs to
    const hasTicketAccess = await checkTicketAccess(existingComment.ticket_id, userId, organizationId);
    if (!hasTicketAccess) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment not found or you do not have permission to delete it' 
      }, { status: 403 });
    }

    if (existingComment.is_deleted) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment is already deleted' 
      }, { status: 400 });
    }

    // Soft delete the comment
    const { error: deleteError } = await supabase
      .from('ticket_comments')
      .update({ 
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId);

    if (deleteError) {
      console.error('❌ Error deleting comment:', deleteError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to delete comment' 
      }, { status: 500 });
    }

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