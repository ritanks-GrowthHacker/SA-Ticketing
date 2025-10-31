'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/authStore';
import { 
  ArrowLeft, 
  Plus, 
  FileText, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Eye,
  User,
  Calendar,
  Globe,
  Lock
} from 'lucide-react';

interface ProjectDoc {
  id: string;
  title: string;
  content: string;
  visibility: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  updater?: {
    id: string;
    name: string;
    email: string;
  };
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
  };
}

interface Project {
  id: string;
  name: string;
}

interface NewDocForm {
  title: string;
  content: string;
  visibility: string;
  is_public: boolean;
}

interface EditDocForm extends NewDocForm {
  id: string;
}

interface Notification {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

const ProjectDocumentsPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const router = useRouter();
  const { token, user, isAuthenticated } = useAuthStore();
  const [projectId, setProjectId] = useState<string>('');
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<ProjectDoc[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Wait for auth store to hydrate and check authentication
  useEffect(() => {
    // Give some time for the auth store to hydrate from localStorage
    const checkAuth = setTimeout(() => {
      if (!isAuthenticated && !token) {
        console.log('🔧 Not authenticated, redirecting to login');
        router.push('/user-login');
        return;
      }
    }, 100);

    return () => clearTimeout(checkAuth);
  }, [isAuthenticated, token, router]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<EditDocForm | null>(null);
  const [viewingDoc, setViewingDoc] = useState<ProjectDoc | null>(null);
  const [notification, setNotification] = useState<Notification>({ 
    show: false, 
    message: '', 
    type: 'info' 
  });

  const [newDocForm, setNewDocForm] = useState<NewDocForm>({
    title: '',
    content: '',
    visibility: 'project',
    is_public: false
  });

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setProjectId(resolvedParams.id);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (projectId) {
      console.log('🔧 Debug: token from authStore:', token);
      console.log('🔧 Debug: user from authStore:', user);
      fetchProjectDocuments();
      fetchProjectInfo();
    }
  }, [projectId, token, user]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const getAuthToken = () => {
    return token || '';
  };

  const getCurrentUserId = () => {
    return user?.id || '';
  };

  const fetchProjectInfo = async () => {
    try {
      const authToken = getAuthToken();
      
      if (!authToken) {
        showNotification('Authentication required', 'error');
        return;
      }
      
      const response = await fetch(`/api/get-project-details/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProject({ id: data.project.id, name: data.project.name });
      }
    } catch (error) {
      console.error('Error fetching project info:', error);
      showNotification('Failed to load project information', 'error');
    }
  };

  const fetchProjectDocuments = async () => {
    try {
      const authToken = getAuthToken();
      
      if (!authToken) {
        showNotification('Authentication required', 'error');
        return;
      }
      
      const response = await fetch(`/api/get-project-docs?project_id=${projectId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
        setUserRole(data.userRole || 'Member');
      } else {
        showNotification('Failed to load documents', 'error');
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      showNotification('Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async () => {
    if (!newDocForm.title.trim() || !newDocForm.content.trim()) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    try {
      const authToken = getAuthToken();
      
      if (!authToken) {
        showNotification('Authentication required', 'error');
        return;
      }

      const response = await fetch('/api/create-project-doc', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_id: projectId,
          ...newDocForm
        })
      });

      if (response.ok) {
        showNotification('Document created successfully', 'success');
        setShowCreateForm(false);
        setNewDocForm({ title: '', content: '', visibility: 'project', is_public: false });
        fetchProjectDocuments();
      } else {
        const error = await response.json();
        showNotification(error.error || 'Failed to create document', 'error');
      }
    } catch (error) {
      console.error('Error creating document:', error);
      showNotification('Failed to create document', 'error');
    }
  };

  const handleUpdateDocument = async () => {
    if (!editingDoc || !editingDoc.title.trim() || !editingDoc.content.trim()) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    try {
      const authToken = getAuthToken();
      
      if (!authToken) {
        showNotification('Authentication required', 'error');
        return;
      }

      const response = await fetch('/api/update-project-doc', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          doc_id: editingDoc.id,
          title: editingDoc.title,
          content: editingDoc.content,
          visibility: editingDoc.visibility,
          is_public: editingDoc.is_public
        })
      });

      if (response.ok) {
        showNotification('Document updated successfully', 'success');
        setEditingDoc(null);
        fetchProjectDocuments();
      } else {
        const error = await response.json();
        showNotification(error.error || 'Failed to update document', 'error');
      }
    } catch (error) {
      console.error('Error updating document:', error);
      showNotification('Failed to update document', 'error');
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      const authToken = getAuthToken();
      
      if (!authToken) {
        showNotification('Authentication required', 'error');
        return;
      }

      const response = await fetch('/api/delete-project-doc', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          doc_id: docId
        })
      });

      if (response.ok) {
        showNotification('Document deleted successfully', 'success');
        fetchProjectDocuments();
      } else {
        const error = await response.json();
        showNotification(error.error || 'Failed to delete document', 'error');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      showNotification('Failed to delete document', 'error');
    }
  };

  const getVisibilityIcon = (visibility: string, isPublic: boolean) => {
    if (isPublic) return <Globe className="w-4 h-4 text-green-600" />;
    if (visibility === 'project') return <Lock className="w-4 h-4 text-blue-600" />;
    return <User className="w-4 h-4 text-gray-600" />;
  };

  const getVisibilityText = (visibility: string, isPublic: boolean) => {
    if (isPublic) return 'Public';
    if (visibility === 'project') return 'Project Team';
    return 'Private';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Project Documents</h1>
                <p className="text-gray-600">
                  {project ? `${project.name} - Manage project documentation` : 'Loading...'}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Document</span>
            </button>
          </div>
        </div>

        {/* Documents List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {documents.length > 0 ? (
            documents.map((doc) => (
              <div key={doc.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3">
                    <FileText className="w-6 h-6 text-blue-600 mt-1" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{doc.title}</h3>
                      <div className="flex items-center space-x-2">
                        {getVisibilityIcon(doc.visibility, doc.is_public)}
                        <span className="text-sm text-gray-600">
                          {getVisibilityText(doc.visibility, doc.is_public)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setViewingDoc(doc)}
                      className="p-2 text-gray-400 hover:text-blue-600"
                      title="View Document"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    
                    {doc.permissions.canEdit && (
                      <button
                        onClick={() => setEditingDoc({
                          id: doc.id,
                          title: doc.title,
                          content: doc.content,
                          visibility: doc.visibility,
                          is_public: doc.is_public
                        })}
                        className="p-2 text-gray-400 hover:text-blue-600"
                        title="Edit Document"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    
                    {doc.permissions.canDelete && (
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        title="Delete Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {doc.content.substring(0, 150)}...
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <User className="w-3 h-3" />
                    <span>{doc.author.name}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                
                {doc.updated_at !== doc.created_at && doc.updater && (
                  <div className="mt-2 text-xs text-gray-500">
                    Updated by {doc.updater.name} on {new Date(doc.updated_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
              <p className="text-gray-600 mb-6">Create your first project document to get started.</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Create Document
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Document Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 backdrop-blur-sm transition-opacity" 
            style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Create New Document</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={newDocForm.title}
                  onChange={(e) => setNewDocForm({ ...newDocForm, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter document title..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content *
                </label>
                <textarea
                  value={newDocForm.content}
                  onChange={(e) => setNewDocForm({ ...newDocForm, content: e.target.value })}
                  rows={10}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter document content..."
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visibility
                  </label>
                  <select
                    value={newDocForm.visibility}
                    onChange={(e) => setNewDocForm({ ...newDocForm, visibility: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="project">Project Team</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                
                <div className="flex items-center">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newDocForm.is_public}
                      onChange={(e) => setNewDocForm({ ...newDocForm, is_public: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Make Public</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDocument}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Document Modal */}
      {editingDoc && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 backdrop-blur-sm transition-opacity" 
            style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Edit Document</h2>
                <button
                  onClick={() => setEditingDoc(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={editingDoc.title}
                  onChange={(e) => setEditingDoc({ ...editingDoc, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter document title..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content *
                </label>
                <textarea
                  value={editingDoc.content}
                  onChange={(e) => setEditingDoc({ ...editingDoc, content: e.target.value })}
                  rows={10}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter document content..."
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visibility
                  </label>
                  <select
                    value={editingDoc.visibility}
                    onChange={(e) => setEditingDoc({ ...editingDoc, visibility: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="project">Project Team</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                
                <div className="flex items-center">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingDoc.is_public}
                      onChange={(e) => setEditingDoc({ ...editingDoc, is_public: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Make Public</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setEditingDoc(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateDocument}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Update Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Document Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 backdrop-blur-sm transition-opacity" 
            style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{viewingDoc.title}</h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mt-2">
                    <div className="flex items-center space-x-1">
                      <User className="w-4 h-4" />
                      <span>By {viewingDoc.author.name}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(viewingDoc.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {getVisibilityIcon(viewingDoc.visibility, viewingDoc.is_public)}
                      <span>{getVisibilityText(viewingDoc.visibility, viewingDoc.is_public)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-gray-900">{viewingDoc.content}</div>
              </div>
            </div>
          </div>
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
              : 'bg-blue-500 text-white'
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
};

export default ProjectDocumentsPage;