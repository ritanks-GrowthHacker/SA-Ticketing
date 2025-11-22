'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/app/store/authStore';
import { Check, X, Clock, Loader2, Mail, User as UserIcon } from 'lucide-react';

interface ResourceRequest {
  id: string;
  project: {
    id: string;
    name: string;
  };
  requested_user: {
    id: string;
    name: string;
    email: string;
    job_title: string;
  };
  department: {
    id: string;
    name: string;
    color_code: string;
  };
  requester: {
    id: string;
    name: string;
    email: string;
  };
  status: string;
  message: string;
  created_at: string;
  updated_at: string;
}

export default function RequestsPage() {
  const { token } = useAuthStore();
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'warning';
  }>({ show: false, message: '', type: 'success' });

  const showNotification = (message: string, type: 'success' | 'error' | 'warning') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  useEffect(() => {
    fetchPendingRequests();
  }, [token]);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching pending requests...');
      
      const response = await fetch('/api/get-pending-requests', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API Error:', errorData);
        throw new Error('Failed to fetch pending requests');
      }

      const data = await response.json();
      console.log('✅ Received data:', data);
      setRequests(data.requests || []);
    } catch (error) {
      console.error('💥 Error fetching pending requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (requestId: string, action: 'approved' | 'rejected') => {
    try {
      setProcessingId(requestId);

      const response = await fetch('/api/handle-resource-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId,
          action,
          reviewNotes: reviewNotes[requestId] || ''
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's a duplicate error
        if (response.status === 409 && data.isDuplicate) {
          showNotification(data.error, 'warning');
          // Refresh the list to remove the duplicate
          await fetchPendingRequests();
          return;
        }
        throw new Error(data.error || `Failed to ${action} request`);
      }
      
      // Show success message
      showNotification(`Request ${action} successfully!`, 'success');
      
      // Refresh the list
      await fetchPendingRequests();
      
      // Trigger event to refresh manage-access page if it's open
      window.dispatchEvent(new CustomEvent('resource-request-handled'));
      
      // Clear review notes
      setReviewNotes(prev => {
        const updated = { ...prev };
        delete updated[requestId];
        return updated;
      });

    } catch (error) {
      console.error(`Error handling request:`, error);
      showNotification(
        error instanceof Error ? error.message : `Failed to ${action} request. Please try again.`,
        'error'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Resource Requests
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Review and manage pending resource access requests for your department
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Pending Requests
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            All resource requests have been processed
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left Column - Request Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {request.project.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span>{formatDate(request.created_at)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <UserIcon className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {request.requested_user.name}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {request.requested_user.job_title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {request.requested_user.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          Requested by: <span className="font-medium">{request.requester.name}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {request.requester.email}
                        </p>
                      </div>
                    </div>

                    <div 
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
                      style={{ 
                        backgroundColor: `${request.department.color_code}20`,
                        color: request.department.color_code
                      }}
                    >
                      {request.department.name}
                    </div>
                  </div>

                  {request.message && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium">Message:</span> {request.message}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right Column - Actions */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Review Notes (Optional)
                    </label>
                    <textarea
                      value={reviewNotes[request.id] || ''}
                      onChange={(e) => setReviewNotes(prev => ({
                        ...prev,
                        [request.id]: e.target.value
                      }))}
                      placeholder="Add notes for the employee..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent
                               resize-none"
                      rows={3}
                      disabled={processingId === request.id}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRequest(request.id, 'approved')}
                      disabled={processingId !== null}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 
                               bg-green-600 hover:bg-green-700 text-white rounded-md
                               font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === request.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Approve
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleRequest(request.id, 'rejected')}
                      disabled={processingId !== null}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 
                               bg-red-600 hover:bg-red-700 text-white rounded-md
                               font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === request.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <X className="w-5 h-5" />
                          Reject
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Approving will share the project with {request.requested_user.name} and send them an email notification
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast Notification */}
      {notification.show && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg transition-all duration-300 ${
            notification.type === 'success'
              ? 'bg-green-500 text-white'
              : notification.type === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-yellow-500 text-white'
          }`}
        >
          <div className="flex items-center space-x-3">
            <span className="font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(prev => ({ ...prev, show: false }))}
              className="ml-2 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
