// Ticket Comments TypeScript Types
// File: db/comment-types.ts

export interface TicketComment {
  id: string;
  ticket_id: string;
  parent_comment_id?: string | null;
  user_id: string;
  organization_id?: string;
  content: string;
  comment?: string; // For backward compatibility
  is_deleted: boolean;
  created_at: string;
  updated_at?: string;
}

export interface TicketCommentWithUser extends TicketComment {
  user_name: string;
  user_email: string;
  user_avatar?: string | null;
}

export interface TicketCommentEdit {
  id: string;
  comment_id: string;
  previous_content: string;
  edited_by: string;
  edited_at: string;
  edit_reason?: string | null;
}

export interface NestedComment extends TicketCommentWithUser {
  replies: NestedComment[];
  depth: number;
}

// API Request/Response Types
export interface CreateCommentRequest {
  ticket_id: string;
  parent_comment_id?: string | null;
  content: string;
  content_type?: 'text' | 'markdown' | 'html';
  mention_user_ids?: string[];
  attachment_urls?: string[];
}

export interface UpdateCommentRequest {
  content: string;
  edit_reason?: string;
}

export interface CommentResponse {
  success: boolean;
  comment?: TicketCommentWithUser;
  error?: string;
}

export interface CommentsListResponse {
  success: boolean;
  comments: NestedComment[];
  total_count: number;
  error?: string;
}

// Helper function to build nested comment tree
export function buildCommentTree(flatComments: TicketCommentWithUser[]): NestedComment[] {
  const commentMap = new Map<string, NestedComment>();
  const rootComments: NestedComment[] = [];

  // First pass: create all comment objects
  flatComments.forEach(comment => {
    commentMap.set(comment.id, {
      ...comment,
      replies: [],
      depth: 0
    });
  });

  // Second pass: build the tree structure
  flatComments.forEach(comment => {
    const nestedComment = commentMap.get(comment.id)!;
    
    if (comment.parent_comment_id) {
      // This is a reply
      const parent = commentMap.get(comment.parent_comment_id);
      if (parent) {
        nestedComment.depth = parent.depth + 1;
        parent.replies.push(nestedComment);
      }
    } else {
      // This is a root comment
      rootComments.push(nestedComment);
    }
  });

  // Sort by creation date
  const sortComments = (comments: NestedComment[]) => {
    comments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    comments.forEach(comment => sortComments(comment.replies));
  };

  sortComments(rootComments);
  return rootComments;
}

// Helper function to flatten nested comments (for search, etc.)
export function flattenComments(nestedComments: NestedComment[]): NestedComment[] {
  const result: NestedComment[] = [];
  
  const flatten = (comments: NestedComment[]) => {
    comments.forEach(comment => {
      result.push(comment);
      if (comment.replies.length > 0) {
        flatten(comment.replies);
      }
    });
  };
  
  flatten(nestedComments);
  return result;
}