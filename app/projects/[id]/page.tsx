'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Edit2, 
  Save, 
  X, 
  Users, 
  Calendar, 
  User, 
  Mail, 
  Shield,
  Plus,
  Trash2,
  AlertCircle,
  UserCheck,
  UserX
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface ProjectDetails {
  id: string;
  name: string;
  description: string;
  status_id: string;
  status?: {
    id: string;
    name: string;
    color_code: string;
  };
  created_at: string;
  updated_at: string;
  created_by: {
    id: string;
    name: string;
    email: string;
  };
  organization: {
    id: string;
    name: string;
    domain: string;
  };
  stats?: {
    totalTickets: number;
    openTickets: number;
    completedTickets: number;
    teamMembers: number;
    completionRate: number;
    statusBreakdown?: { [statusName: string]: number };
  };
}

interface ProjectMember {
  id: string;
  user_id: string;
  project_id: string;
  role_id: string;
  assigned_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    profile_image?: string;
    profile_picture_url?: string;
  };
  role: {
    id: string;
    name: string;
    description: string;
  };
}

interface ProjectStatus {
  id: string;
  name: string;
  description: string;
  color_code: string;
  sort_order: number;
}

const ProjectDetailsPage = () => {
  const params = useParams();
  const router = useRouter();
  const { token, roles } = useAuthStore();
  
  const [projectId, setProjectId] = useState<string>('');
  const userRole = roles?.[0] || 'User';
  const isAdmin = userRole === 'Admin';
  const isManager = userRole === 'Manager';
  
  // States
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatus[]>([]);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingMemberRole, setEditingMemberRole] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    show: boolean;
  }>({ type: 'info', message: '', show: false });
  
  // Edit form states
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    status_id: ''
  });
  
  // User management states
  const [showAddUser, setShowAddUser] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);

  // Function to show notifications
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message, show: true });
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 3000);
  };
  
  // Permissions
  const canEditProject = isAdmin;
  const canManageUsers = isAdmin || (isManager && projectMembers.some(
    member => member.user.id === token && member.role.name === 'Manager'
  ));

  // Extract projectId from params (Next.js 16 Promise-based params)
  useEffect(() => {
    const extractProjectId = async () => {
      const resolvedParams = await params;
      console.log('🔧 Resolved params:', resolvedParams);
      console.log('🔧 Setting projectId to:', resolvedParams.id);
      setProjectId(resolvedParams.id as string);
    };
    
    extractProjectId();
  }, [params]);

  useEffect(() => {
    console.log('🔧 Main useEffect triggered. projectId:', projectId, 'token length:', token ? token.length : 'null', 'token exists:', !!token);
    if (projectId && token) {
      console.log('🔧 Both projectId and token available - calling fetch functions...');
      fetchProjectDetails();
      fetchProjectMembers();
      fetchProjectStatuses();
      fetchAvailableRoles();
      
      // Temporary debug: Add a test member to see if UI works
      // Remove this after debugging
      // setProjectMembers([{
      //   id: 'test-1',
      //   user_id: 'test-user-1',
      //   project_id: projectId,
      //   role_id: 'test-role-1',
      //   assigned_at: new Date().toISOString(),
      //   user: {
      //     id: 'test-user-1',
      //     name: 'Test User',
      //     email: 'test@example.com',
      //     profile_picture_url: null,
      //     profile_image: null
      //   },
      //   role: {
      //     id: 'test-role-1',
      //     name: 'Developer',
      //     description: 'Software Developer'
      //   }
      // }]);
    } else {
      console.log('🔧 Missing dependencies - projectId:', !!projectId, 'token:', !!token);
    }
  }, [projectId, token]);

  const fetchProjectDetails = async () => {
    try {
      console.log('🔧 fetchProjectDetails called for projectId:', projectId);
      console.log('🔧 Making request to:', `/api/get-project-details/${projectId}`);
      
      const response = await fetch(`/api/get-project-details/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔧 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔧 Project details received:', data);
        setProject(data.project);
        setEditForm({
          name: data.project.name,
          description: data.project.description || '',
          status_id: data.project.status_id || ''
        });
      } else {
        console.error('🔧 Failed to fetch project details - status:', response.status);
        const errorText = await response.text();
        console.error('🔧 Error response:', errorText);
      }
    } catch (error) {
      console.error('🔧 Error fetching project details:', error);
    }
  };

  const fetchProjectMembers = async () => {
    try {
      console.log('🔧 fetchProjectMembers called for projectId:', projectId);
      console.log('🔧 Making request to:', `/api/get-project-members/${projectId}`);
      
      const response = await fetch(`/api/get-project-members/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔧 Project members response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔧 Project members data received:', data);
        console.log('🔧 Members array:', data.members);
        console.log('🔧 Members count:', data.members?.length || 0);
        setProjectMembers(data.members || []);
      } else {
        console.error('🔧 Failed to fetch project members - status:', response.status);
        const errorText = await response.text();
        console.error('🔧 Error response:', errorText);
      }
    } catch (error) {
      console.error('🔧 Error fetching project members:', error);
    }
  };

  const fetchProjectStatuses = async () => {
    try {
      console.log('🔧 FRONTEND: Fetching project statuses...');
      const response = await fetch('/api/get-all-projects?format=statuses', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔧 FRONTEND: Status response:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('🔧 FRONTEND: Status data received:', data);
        console.log('🔧 FRONTEND: Statuses array:', data.statuses);
        console.log('🔧 FRONTEND: Statuses count:', data.statuses?.length || 0);
        setProjectStatuses(data.statuses || []);
      } else {
        console.error('🔧 FRONTEND: Failed to fetch statuses, status:', response.status);
        const errorText = await response.text();
        console.error('🔧 FRONTEND: Error response:', errorText);
      }
    } catch (error) {
      console.error('🔧 FRONTEND: Error fetching project statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableRoles = async () => {
    console.log('🔧 fetchAvailableRoles function called!');
    try {
      console.log('🔧 Making API call to /api/all-get-entities');
      const response = await fetch('/api/all-get-entities', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔧 API response status:', response.status);
      if (response.ok) {
        const result = await response.json();
        console.log('🔧 Full API response:', result);
        console.log('🔧 Available roles fetched:', result.data?.roles);
        setAvailableRoles(result.data?.roles || []);
      } else {
        console.error('Failed to fetch roles:', response.status);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const updateMemberRole = async (memberId: string, newRoleId: string) => {
    if (!newRoleId) {
      console.log('🔧 No role selected, skipping update');
      return;
    }

    console.log('🔧 Updating member role:', { memberId, newRoleId, projectId });
    console.log('🔧 All project members:', projectMembers);
    
    // Find the actual user_id from the projectMembers array
    const member = projectMembers.find(m => m.id === memberId);
    if (!member) {
      console.error('🔧 Member not found:', memberId);
      console.error('🔧 Available member IDs:', projectMembers.map(m => m.id));
      return;
    }

    console.log('🔧 Found member:', member);
    console.log('🔧 Member user_id:', member.user_id);
    
    try {
      const requestBody = {
        user_id: member.user_id, // Use the actual user_id from the member object
        project_id: projectId,
        role_id: newRoleId
      };

      console.log('🔧 Request body:', requestBody);

      const response = await fetch(`/api/manage-project-user-role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('🔧 Response status:', response.status);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('🔧 Role update successful:', responseData);
        
        // Refresh the project members list
        await fetchProjectMembers();
        // Also refresh project details to update stats
        await fetchProjectDetails();
        setEditingMemberRole(null);
        
        // Show success notification
        showNotification('success', 'Role updated successfully!');
      } else {
        const errorData = await response.text();
        console.error('🔧 Role update failed. Status:', response.status, 'Response:', errorData);
        showNotification('error', 'Failed to update role. Please try again.');
      }
    } catch (error) {
      console.error('🔧 Error updating member role:', error);
      showNotification('error', 'Network error occurred. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!canEditProject) return;
    
    setSaving(true);
    try {
      // First update the project status if it changed
      if (editForm.status_id && editForm.status_id !== project?.status_id) {
        const statusResponse = await fetch('/api/update-project-status', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            project_id: projectId,
            status_id: editForm.status_id
          })
        });

        if (!statusResponse.ok) {
          const errorData = await statusResponse.json();
          console.error('Failed to update project status:', errorData);
          alert('Failed to update project status: ' + (errorData.error || 'Unknown error'));
          setSaving(false);
          return;
        }
      }

      // Then update other project details
      const response = await fetch(`/api/update-project/${projectId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description
          // Don't include status_id here since we handle it separately
        })
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        setEditing(false);
      } else {
        alert('Failed to update project');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Error updating project');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      name: project?.name || '',
      description: project?.description || '',
      status_id: project?.status_id || ''
    });
    setEditing(false);
  };

  const getStatusBadgeColor = (colorCode: string) => {
    const colorMap: { [key: string]: string } = {
      '#ef4444': 'bg-red-100 text-red-800 border-red-200',
      '#f59e0b': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      '#3b82f6': 'bg-blue-100 text-blue-800 border-blue-200',
      '#10b981': 'bg-green-100 text-green-800 border-green-200',
      '#6b7280': 'bg-gray-100 text-gray-800 border-gray-200',
      '#8b5cf6': 'bg-purple-100 text-purple-800 border-purple-200',
      '#f97316': 'bg-orange-100 text-orange-800 border-orange-200'
    };
    
    return colorMap[colorCode] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="mt-4 text-gray-600">Project not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {editing && canEditProject ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="text-3xl font-bold bg-transparent border-b-2 border-blue-600 focus:outline-none"
                    />
                  ) : (
                    project.name
                  )}
                </h1>
                <p className="text-gray-600">Project Details</p>
              </div>
            </div>
            
            {canEditProject && (
              <div className="flex items-center space-x-2">
                {editing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? 'Saving...' : 'Save'}</span>
                    </button>
                    <button
                      onClick={handleCancel}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit Project</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Project Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-6">Project Information</h2>
              
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  {editing && canEditProject ? (
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter project description..."
                    />
                  ) : (
                    <p className="text-gray-900">
                      {project.description || 'No description provided'}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  {editing && canEditProject ? (
                    <select
                      value={editForm.status_id}
                      onChange={(e) => setEditForm({ ...editForm, status_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Status</option>
                      {projectStatuses.map(status => (
                        <option key={status.id} value={status.id}>
                          {status.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div>
                      {project.status ? (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                          getStatusBadgeColor(project.status.color_code)
                        }`}>
                          {project.status.name}
                        </span>
                      ) : (
                        <span className="text-gray-500">No status assigned</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Created By */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Created By
                  </label>
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-gray-900">{project.created_by.name}</p>
                      <p className="text-gray-500 text-sm">{project.created_by.email}</p>
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Created At
                    </label>
                    <div className="flex items-center space-x-2 text-gray-900">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>{new Date(project.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Updated
                    </label>
                    <div className="flex items-center space-x-2 text-gray-900">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Project Stats */}
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-6">Project Stats</h2>
              
              {project.stats ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total Tickets</span>
                    <span className="font-semibold">{project.stats.totalTickets}</span>
                  </div>
                  
                  {/* Show all actual ticket statuses from kanban */}
                  {project.stats.statusBreakdown && Object.keys(project.stats.statusBreakdown).length > 0 ? (
                    Object.entries(project.stats.statusBreakdown).map(([statusName, count]: [string, number]) => (
                      <div key={statusName} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${
                            statusName.toLowerCase().includes('open') ? 'bg-blue-500' :
                            statusName.toLowerCase().includes('progress') ? 'bg-yellow-500' :
                            statusName.toLowerCase().includes('review') ? 'bg-purple-500' :
                            statusName.toLowerCase().includes('closed') ? 'bg-green-500' :
                            statusName.toLowerCase().includes('done') ? 'bg-green-500' :
                            'bg-gray-400'
                          }`}></div>
                          <span className="text-gray-600">{statusName}</span>
                        </div>
                        <span className={`font-semibold ${
                          statusName.toLowerCase().includes('open') ? 'text-blue-600' :
                          statusName.toLowerCase().includes('progress') ? 'text-yellow-600' :
                          statusName.toLowerCase().includes('review') ? 'text-purple-600' :
                          statusName.toLowerCase().includes('closed') ? 'text-green-600' :
                          statusName.toLowerCase().includes('done') ? 'text-green-600' :
                          'text-gray-600'
                        }`}>{count}</span>
                      </div>
                    ))
                  ) : (
                    // Fallback to old display if statusBreakdown not available
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Open Tickets</span>
                        <span className="font-semibold text-yellow-600">{project.stats.openTickets}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Completed</span>
                        <span className="font-semibold text-green-600">{project.stats.completedTickets}</span>
                      </div>
                    </>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Team Members</span>
                    <span className="font-semibold">{project.stats.teamMembers}</span>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-600">Completion Rate</span>
                      <span className="font-semibold">{project.stats.completionRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${project.stats.completionRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No statistics available</p>
              )}
            </div>
          </div>
        </div>

        {/* Project Documents Navigation */}
        <div className="mt-8 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Project Documents</h3>
                  <p className="text-sm text-gray-600">Manage project documentation and files</p>
                </div>
              </div>
              <button
                onClick={() => {
                  // Navigate to project documents page
                  window.location.href = `/projects/${projectId}/documents`;
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>View Documents</span>
              </button>
            </div>
          </div>
        </div>

        {/* Team Management */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Users className="w-6 h-6 text-gray-400" />
                  <h2 className="text-xl font-semibold">Project Team</h2>
                </div>
                
                <div className="flex items-center space-x-3">
                  {canManageUsers && (
                    <button
                      onClick={() => setShowAddUser(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Member</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {projectMembers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projectMembers.map((member) => (
                    <div 
                      key={member.id} 
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      {/* Profile Header */}
                      <div className="flex items-center space-x-3 mb-3">
                        {/* Profile Picture or Initial */}
                        <div className="relative">
                          {member.user.profile_picture_url || member.user.profile_image ? (
                            <img
                              src={member.user.profile_picture_url || member.user.profile_image}
                              alt={`${member.user.name}'s profile`}
                              className="w-12 h-12 rounded-full object-cover border-2 border-gray-100"
                              onError={(e) => {
                                // Fallback to initials if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.nextElementSibling!.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-lg font-semibold ${
                            member.user.profile_picture_url || member.user.profile_image ? 'hidden' : ''
                          }`}>
                            {member.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                        </div>
                        
                        {/* Name and Role */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {member.user.name}
                          </h3>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {member.role.name}
                          </span>
                        </div>
                      </div>
                      
                      {/* Contact Info */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="truncate">{member.user.email}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>Joined {new Date(member.assigned_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      {/* Role Description (if available) */}
                      {member.role.description && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500">
                            {member.role.description}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No team members assigned</h3>
                  <p className="text-gray-500">This project doesn't have any team members yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
            {notification.type === 'success' && <UserCheck className="w-5 h-5" />}
            {notification.type === 'error' && <UserX className="w-5 h-5" />}
            {notification.type === 'info' && <Users className="w-5 h-5" />}
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

export default ProjectDetailsPage;