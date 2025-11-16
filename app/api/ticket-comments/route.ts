import { NextResponse } from 'next/server';
import { supabase } from "@/app/db/connections";
import jwt from 'jsonwebtoken';
import { CreateCommentRequest, CommentsListResponse, CommentResponse, TicketCommentWithUser, buildCommentTree } from '../../../db/comment-types';

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

    // Get user's role in the organization (check both org-level and dept-level)
    const { data: userOrgRole } = await supabase
      .from('user_organization_roles')
      .select(`
        role_id,
        global_roles!user_organization_roles_role_id_fkey(name)
      `)
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    const { data: userDeptRole } = await supabase
      .from('user_department_roles')
      .select(`
        role_id,
        global_roles!user_department_roles_role_id_fkey(name)
      `)
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    const userRole = (userOrgRole?.global_roles as any)?.name || (userDeptRole?.global_roles as any)?.name || 'Member';

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
    if (ticket.assigned_to === userId || ticket.created_by === userId) {
      return true;
    }

    // Get user's department
    const { data: userData } = await supabase
      .from('users')
      .select('department_id')
      .eq('id', userId)
      .single();

    // Check if project belongs to user's department
    if (userData?.department_id) {
      const { data: projectDept } = await supabase
        .from('project_department')
        .select('project_id')
        .eq('project_id', ticket.project_id)
        .eq('department_id', userData.department_id)
        .maybeSingle();

      if (projectDept) {
        return true;
      }

      // Check if project is shared with user's department
      const { data: sharedProject } = await supabase
        .from('shared_projects')
        .select('project_id')
        .eq('project_id', ticket.project_id)
        .eq('department_id', userData.department_id)
        .maybeSingle();

      if (sharedProject) {
        return true;
      }
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

    if (userProjects && userProjects.length > 0) {
      const projectRole = (userProjects[0].global_roles as any)?.name || 'Member';

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
    const { data: comments, error } = await supabase
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
      .eq('ticket_id', ticket_id)
      .eq('is_deleted', false) // Only get non-deleted comments
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching comments:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch comments' 
      }, { status: 500 });
    }

    // Transform data to match expected format
    const transformedComments = comments.map((comment: any) => ({
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
      const { data: parentComment, error: parentError } = await supabase
        .from('ticket_comments')
        .select('id, ticket_id')
        .eq('id', parent_comment_id)
        .eq('ticket_id', ticket_id)
        .single();

      if (parentError || !parentComment) {
        return NextResponse.json({ 
          success: false, 
          error: 'Parent comment not found or invalid' 
        }, { status: 400 });
      }
    }

    // Create the comment (support both old and new schema)
    const commentData: any = {
      ticket_id,
      parent_comment_id,
      user_id: userId,
      comment: content.trim(), // Use old field for compatibility
    };

    // Add new fields if they exist (after migration)
    try {
      const { data: schemaCheck } = await supabase
        .from('ticket_comments')
        .select('organization_id, content')
        .limit(1);
      
      // If new fields exist, use them
      if (schemaCheck) {
        commentData.organization_id = organizationId;
        commentData.content = content.trim();
      }
    } catch (e) {
      // New fields don't exist yet, continue with old schema
    }

    const { data: newComment, error: createError } = await supabase
      .from('ticket_comments')
      .insert(commentData)
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating comment:', createError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create comment' 
      }, { status: 500 });
    }

    console.log('🕐 Comment created with timestamp:', newComment.created_at);
    console.log('🕐 Current time for comparison:', new Date().toISOString());

    // Get the comment with user information
    const { data: commentWithUserData, error: fetchError } = await supabase
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
        users:user_id (
          id,
          name,
          email,
          profile_picture_url
        )
      `)
      .eq('id', newComment.id)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching created comment:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: 'Comment created but failed to fetch details' 
      }, { status: 500 });
    }

    // Transform the data
    const commentWithUser = {
      id: commentWithUserData.id,
      ticket_id: commentWithUserData.ticket_id,
      parent_comment_id: commentWithUserData.parent_comment_id,
      user_id: commentWithUserData.user_id,
      organization_id: organizationId,
      content: commentWithUserData.content || commentWithUserData.comment,
      is_deleted: commentWithUserData.is_deleted || false,
      created_at: commentWithUserData.created_at,
      updated_at: commentWithUserData.updated_at,
      user_name: (commentWithUserData.users as any)?.[0]?.name || 'Unknown User',
      user_email: (commentWithUserData.users as any)?.[0]?.email || '',
      user_avatar: (commentWithUserData.users as any)?.[0]?.profile_picture_url || null
    };

    console.log('✅ Comment created successfully:', newComment.id);

    // Send notifications to ticket creator and assignee (excluding the commenter)
    try {
      const { data: ticket } = await supabase
        .from('tickets')
        .select(`
          id,
          title,
          created_by,
          assigned_to,
          projects!inner(name)
        `)
        .eq('id', ticket_id)
        .single();

      if (ticket) {
        const { emailService } = await import('@/lib/emailService');
        const recipients = new Set<string>();

        // Add creator (if not the commenter)
        if (ticket.created_by && ticket.created_by !== userId) {
          recipients.add(ticket.created_by);
        }

        // Add assignee (if not the commenter and different from creator)
        if (ticket.assigned_to && ticket.assigned_to !== userId) {
          recipients.add(ticket.assigned_to);
        }

        const projectName = (ticket.projects as any)?.name || 'Unknown Project';
        const commenterName = commentWithUser.user_name;
        const commentText = content.trim().substring(0, 200); // Limit to 200 chars for email

        // Send emails and in-app notifications to all recipients
        for (const recipientId of recipients) {
          const { data: recipient } = await supabase
            .from('users')
            .select('name, email')
            .eq('id', recipientId)
            .single();

          if (recipient) {
            // Create in-app notification
            await supabase
              .from('notifications')
              .insert({
                user_id: recipientId,
                entity_type: 'ticket',
                entity_id: ticket_id,
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