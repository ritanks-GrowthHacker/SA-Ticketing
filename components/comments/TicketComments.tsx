'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, Reply, Edit, Trash2, Send, MoreHorizontal, Clock, User } from 'lucide-react';
import { useAuthStore } from '../../app/store/authStore';
import { NestedComment, CreateCommentRequest, UpdateCommentRequest } from '../../db/comment-types';

interface TicketCommentsProps {
  ticketId: string;
  onCommentAdded?: () => void;
}

interface CommentItemProps {
  comment: NestedComment;
  onReply: (parentId: string) => void;
  onEdit: (comment: NestedComment) => void;
  onDelete: (commentId: string) => void;
  currentUserId: string;
  level?: number;
}

const MAX_NESTED_LEVEL = 5; // Limit nesting depth for UX

const CommentItem: React.FC<CommentItemProps> = ({ 
  comment, 
  onReply, 
  onEdit, 
  onDelete, 
  currentUserId, 
  level = 0 
}) => {
  const [showReplies, setShowReplies] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  
  const canEdit = comment.user_id === currentUserId && !comment.is_deleted;
  const isDeleted = comment.is_deleted;
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`flex space-x-3 ${level > 0 ? 'ml-8 mt-3' : 'mb-4'}`}>
      {/* Avatar */}
      <div className="shrink-0">
        {comment.user_avatar ? (
          <img 
            src={comment.user_avatar} 
            alt={comment.user_name}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-gray-600" />
          </div>
        )}
      </div>

      {/* Comment Content */}
      <div className="flex-1 min-w-0">
        <div className={`bg-gray-50 rounded-lg p-3 ${isDeleted ? 'opacity-50' : ''}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-900">{comment.user_name}</span>
              <span className="text-sm text-gray-500 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {formatDate(comment.created_at)}
              </span>
            </div>
            
            {/* Actions Menu */}
            {canEdit && !isDeleted && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                
                {showMenu && (
                  <div className="absolute right-0 top-6 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
                    <button
                      onClick={() => {
                        onEdit(comment);
                        setShowMenu(false);
                      }}
                      className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                    >
                      <Edit className="w-3 h-3 mr-2" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        onDelete(comment.id);
                        setShowMenu(false);
                      }}
                      className="flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="text-gray-800 text-sm whitespace-pre-wrap">
            {isDeleted ? (
              <span className="italic text-gray-500">[This comment has been deleted]</span>
            ) : (
              comment.content
            )}
          </div>
        </div>

        {/* Actions */}
        {!isDeleted && (
          <div className="flex items-center space-x-4 mt-2">
            {level < MAX_NESTED_LEVEL && (
              <button
                onClick={() => onReply(comment.id)}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700"
              >
                <Reply className="w-3 h-3 mr-1" />
                Reply
              </button>
            )}
            
            {comment.replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700"
              >
                <MessageCircle className="w-3 h-3 mr-1" />
                {showReplies ? 'Hide' : 'Show'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
        )}

        {/* Nested Replies */}
        {showReplies && comment.replies.length > 0 && (
          <div className="mt-3">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                currentUserId={currentUserId}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TicketComments: React.FC<TicketCommentsProps> = ({ ticketId, onCommentAdded }) => {
  const { token, user } = useAuthStore();
  const [comments, setComments] = useState<NestedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingComment, setEditingComment] = useState<NestedComment | null>(null);
  const [editContent, setEditContent] = useState('');

  // Fetch comments
  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ticket-comments?ticket_id=${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setComments(data.comments);
        }
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && ticketId) {
      fetchComments();
    }
  }, [token, ticketId]);

  // Create new comment
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !token) return;

    try {
      setSubmitting(true);
      const requestBody: CreateCommentRequest = {
        ticket_id: ticketId,
        content: newComment.trim(),
        content_type: 'text'
      };

      const response = await fetch('/api/ticket-comments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNewComment('');
          await fetchComments(); // Refresh comments
          onCommentAdded?.();
        }
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle reply
  const handleReply = (parentId: string) => {
    setReplyingTo(parentId);
    setReplyContent('');
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !token || !replyingTo) return;

    try {
      setSubmitting(true);
      const requestBody: CreateCommentRequest = {
        ticket_id: ticketId,
        parent_comment_id: replyingTo,
        content: replyContent.trim(),
        content_type: 'text'
      };

      const response = await fetch('/api/ticket-comments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setReplyingTo(null);
          setReplyContent('');
          await fetchComments(); // Refresh comments
          onCommentAdded?.();
        }
      }
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = (comment: NestedComment) => {
    setEditingComment(comment);
    setEditContent(comment.content);
  };

  const handleSubmitEdit = async () => {
    if (!editContent.trim() || !token || !editingComment) return;

    try {
      setSubmitting(true);
      const requestBody: UpdateCommentRequest = {
        content: editContent.trim()
      };

      const response = await fetch(`/api/ticket-comments/${editingComment.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEditingComment(null);
          setEditContent('');
          await fetchComments(); // Refresh comments
        }
      }
    } catch (error) {
      console.error('Error editing comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (commentId: string) => {
    if (!token || !confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await fetch(`/api/ticket-comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchComments(); // Refresh comments
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comments List */}
      {comments.length > 0 ? (
        <div className="space-y-1">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              currentUserId={user?.id || ''}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No comments yet. Be the first to comment!</p>
        </div>
      )}

      {/* Edit Comment Modal */}
      {editingComment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Comment</h3>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={4}
              placeholder="Edit your comment..."
            />
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => setEditingComment(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitEdit}
                disabled={submitting || !editContent.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reply Form */}
      {replyingTo && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">Replying to comment</span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-blue-600 hover:text-blue-800"
            >
              ✕
            </button>
          </div>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
            placeholder="Write your reply..."
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSubmitReply}
              disabled={submitting || !replyContent.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Reply
            </button>
          </div>
        </div>
      )}

      {/* New Comment Form */}
      <div className="border-t pt-4">
        <div className="flex space-x-3">
          {/* User Avatar */}
          <div className="shrink-0">
            {user?.profile_picture_url ? (
              <img 
                src={user.profile_picture_url} 
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>

          {/* Comment Input */}
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              placeholder="Write a comment..."
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSubmitComment}
                disabled={submitting || !newComment.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Comment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketComments;