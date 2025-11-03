'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Trash2, Shield, UserCheck, UserX, Filter } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { ProjectSelect } from '../../components/ui/ProjectSelect';
import { AssignmentModal } from '../../components/modals';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  profile_picture_url?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
}

interface ProjectAssignment {
  user_id: string;
  project_id: string;
  role_id: string;
  user_name: string;
  user_email: string;
  project_name: string;
  project_description: string;
  role_name: string;
  role_description: string;
  created_at: string;
  updated_at: string;
}

const ManageAccessPage = () => {
  const { token, role, isAuthenticated, user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [perUserProject, setPerUserProject] = useState<Record<string, string>>({});
  const [perUserRole, setPerUserRole] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<User | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    show: boolean;
  }>({ type: 'info', message: '', show: false });

  // Function to show notifications
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message, show: true });
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // Redirect if not admin
  useEffect(() => {
    if (isAuthenticated && role !== 'Admin') {
      window.location.href = '/dashboard';
    }
  }, [isAuthenticated, role]);

  // Fetch initial data
  useEffect(() => {
    if (token && role === 'Admin') {
      fetchData();
    }
  }, [token, role]);

  // Refresh assignments when project filter changes
  useEffect(() => {
    if (token && role === 'Admin') {
      fetchAssignments();
    }
  }, [selectedProject, token, role]);

  // Clear selected users when switching to "All Projects" view (no actions available)
  useEffect(() => {
    if (selectedProject === 'all') {
      setSelectedUsers([]);
    }
  }, [selectedProject]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchUsers(),
        fetchProjects(),
        fetchAssignments()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const url = new URL('/api/manage-user-role', window.location.origin);
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Transform users to match expected interface (id, name, email, created_at, profile_picture_url)
        const transformedUsers = (data.users || []).map((u: any) => ({
          id: u.userId, // manage-user-role returns userId, we need id
          name: u.name,
          email: u.email,
          created_at: u.joinedAt, // manage-user-role returns joinedAt
          profile_picture_url: u.profile_picture_url,
        }));
        setUsers(transformedUsers);
        // manage-user-role returns availableRoles
        setRoles(data.availableRoles || []);
      } else {
        const err = await response.json().catch(() => ({}));
        console.error('Failed to fetch users:', err);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/get-all-projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/all-get-entities', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // all-get-entities nests results under `data`
        setRoles(data.data?.roles || []);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchAssignments = async () => {
    try {
      // Skip if no token available
      if (!token) {
        console.warn('No token available for fetching assignments');
        setAssignments([]);
        return;
      }

      const url = new URL('/api/get-project-assignments', window.location.origin);
      if (selectedProject && selectedProject !== 'all') {
        url.searchParams.append('project_id', selectedProject);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAssignments(data.assignments || []);
      } else {
        // Handle different error status codes
        if (response.status === 401) {
          console.warn('Authentication required for assignments');
        } else if (response.status === 403) {
          console.warn('Insufficient permissions for assignments');
        } else {
          console.warn(`Failed to fetch assignments: ${response.status}`);
        }
        setAssignments([]);
      }
    } catch (error) {
      console.warn('Network error fetching assignments:', error);
      setAssignments([]);
    }
  };

  const handleAssignUsers = async (projectId: string, roleId: string) => {
    if (selectedUsers.length === 0) return;

    try {
      setAssignmentLoading(true);
      const response = await fetch('/api/create-project-user-relation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_id: projectId,
          assignments: selectedUsers.map(userId => ({
            user_id: userId,
            role_id: roleId
          })),
          notify: true
        })
      });

      if (response.ok) {
        setSelectedUsers([]);
        setShowAssignModal(false);
        await fetchAssignments(); // Refresh assignments
        // Show success message
        showNotification('success', 'Users assigned successfully!');
      } else {
        const errorData = await response.json();
        showNotification('error', `Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error assigning users:', error);
      showNotification('error', 'Network error occurred');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleRemoveUsers = async (projectId: string, userIds: string[]) => {
    if (userIds.length === 0) return;

    try {
      const response = await fetch('/api/create-project-user-relation', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_id: projectId,
          user_ids: userIds
        })
      });

      if (response.ok) {
        await fetchAssignments(); // Refresh assignments
        alert('Users removed successfully!');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error removing users:', error);
      alert('Network error occurred');
    }
  };

  const handleRemoveAllUserAssignments = async (userId: string) => {
    const userAssignments = assignments.filter(a => a.user_id === userId);
    if (userAssignments.length === 0) return;

    const confirmRemove = window.confirm(
      `Are you sure you want to remove this user from all ${userAssignments.length} project(s)?`
    );

    if (!confirmRemove) return;

    try {
      // Group assignments by project and remove them
      const projectGroups = userAssignments.reduce((acc, assignment) => {
        if (!acc[assignment.project_id]) {
          acc[assignment.project_id] = [];
        }
        acc[assignment.project_id].push(assignment.user_id);
        return acc;
      }, {} as Record<string, string[]>);

      // Remove from each project
      const removePromises = Object.entries(projectGroups).map(([projectId, userIds]) =>
        handleRemoveUsers(projectId, userIds)
      );

      await Promise.all(removePromises);
    } catch (error) {
      console.error('Error removing all user assignments:', error);
      showNotification('error', 'Error occurred while removing assignments');
    }
  };

  const handleIndividualAssignment = (userId: string) => {
    setSelectedUsers([userId]);
    setShowAssignModal(true);
  };

  const handlePerUserProjectChange = (userId: string, projectId: string) => {
    setPerUserProject(prev => ({ ...prev, [userId]: projectId }));
  };

  const handlePerUserRoleChange = (userId: string, roleId: string) => {
    setPerUserRole(prev => ({ ...prev, [userId]: roleId }));
  };

  const handlePerUserAssignment = async (userId: string) => {
    const projectId = perUserProject[userId];
    const roleId = perUserRole[userId];

    if (!projectId || !roleId) {
      alert('Please select both project and role for this user');
      return;
    }

    try {
      setAssignmentLoading(true);
      const response = await fetch('/api/create-project-user-relation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_id: projectId,
          assignments: [{ user_id: userId, role_id: roleId }],
          notify: true
        })
      });

      if (response.ok) {
        await fetchAssignments();
        showNotification('success', 'User assigned successfully');
      } else {
        const err = await response.json().catch(() => ({}));
        console.error('Assign error:', err);
        showNotification('error', 'Failed to assign user');
      }
    } catch (error) {
      console.error('Network error assigning user:', error);
      showNotification('error', 'Network error assigning user');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedUsers.length === 0) return;

    const missing = selectedUsers.filter(u => !perUserProject[u] || !perUserRole[u]);
    if (missing.length > 0) {
      showNotification('error', 'Please select project and role for all selected users before assigning.');
      return;
    }

    try {
      setAssignmentLoading(true);
      const groups: Record<string, Array<{ user_id: string; role_id: string }>> = {};
      selectedUsers.forEach(userId => {
        const proj = perUserProject[userId];
        const roleId = perUserRole[userId];
        if (!groups[proj]) groups[proj] = [];
        groups[proj].push({ user_id: userId, role_id: roleId });
      });

      for (const [projectId, assignmentsPayload] of Object.entries(groups)) {
        const response = await fetch('/api/create-project-user-relation', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ project_id: projectId, assignments: assignmentsPayload, notify: true })
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to assign users');
        }
      }

      setSelectedUsers([]);
      setPerUserProject({});
      setPerUserRole({});
      await fetchAssignments();
      showNotification('success', 'Users assigned successfully');
    } catch (error) {
      console.error('Bulk assign error:', error);
      showNotification('error', 'Error assigning users. See console for details.');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleShowUserDetails = (user: User) => {
    setSelectedUserForDetails(user);
    setShowUserDetailsModal(true);
  };

  const handleRemoveSpecificAssignment = async (userId: string, projectId: string) => {
    const confirmRemove = window.confirm('Are you sure you want to remove this user from this project?');
    if (!confirmRemove) return;

    try {
      await handleRemoveUsers(projectId, [userId]);
      await fetchAssignments(); // Refresh assignments
    } catch (error) {
      console.error('Error removing specific assignment:', error);
    }
  };

  // Filter users based on search term and project selection
  const filteredUsers = users.filter(userItem => {
    // Exclude current admin user from the list
    if (user && userItem.id === user.id && role === 'Admin') {
      return false;
    }

    const matchesSearch = userItem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userItem.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // If 'all' selected -> show ALL users in the organization regardless of project assignments
    if (selectedProject === 'all') {
      return true;
    }

    // When a specific project is selected -> show users assigned to that project
    return assignments.some(a => a.user_id === userItem.id && a.project_id === selectedProject);
  });

  // Get selected user names for the modal
  const selectedUserNames = selectedUsers
    .map(userId => users.find(u => u.id === userId)?.name)
    .filter(Boolean) as string[];

  if (!isAuthenticated || role !== 'Admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">Only administrators can access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Access</h1>
          <p className="text-gray-600 mt-1">
            {selectedProject === 'all' 
              ? 'Viewing all organization members - select a specific project to manage assignments'
              : 'Assign users to projects and manage permissions'
            }
          </p>
        </div>
        
        {selectedProject !== 'all' && (
          <button
            onClick={handleBulkAssign}
            disabled={selectedUsers.length === 0 || assignmentLoading}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
              selectedUsers.length === 0 || assignmentLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Assign Selected ({selectedUsers.length})</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Users */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Project Filter */}
          <div className="md:w-64">
            <ProjectSelect
              value={selectedProject}
              onValueChange={setSelectedProject}
              placeholder="Filter by project"
              includeAllOption={true}
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedProject === 'all' ? 'All Organization Members' : 'Project Members'}
            </h2>
            <span className="text-sm text-gray-500">
              {filteredUsers.length} {selectedProject === 'all' ? 'members' : 'users'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                {selectedProject !== 'all' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers(filteredUsers.map(u => u.id));
                        } else {
                          setSelectedUsers([]);
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Projects
                </th>
                {selectedProject !== 'all' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[300px]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => {
                const isSelected = selectedUsers.includes(user.id);
                const userAssignments = assignments.filter(a => a.user_id === user.id);
                
                return (
                  <tr key={user.id} className={isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    {selectedProject !== 'all' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers([...selectedUsers, user.id]);
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
                          {user.profile_picture_url ? (
                            <img 
                              src={user.profile_picture_url} 
                              alt={user.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback to initials if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full bg-blue-100 rounded-full flex items-center justify-center ${user.profile_picture_url ? 'hidden' : ''}`}>
                            <span className="text-blue-600 font-medium">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {userAssignments.slice(0, 2).map((assignment) => (
                          <button
                            key={`${assignment.project_id}-${assignment.role_id}`}
                            onClick={() => handleShowUserDetails(user)}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 transition-colors cursor-pointer"
                          >
                            {assignment.project_name} ({assignment.role_name})
                          </button>
                        ))}
                        {userAssignments.length > 2 && (
                          <button
                            onClick={() => handleShowUserDetails(user)}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors cursor-pointer"
                          >
                            +{userAssignments.length - 2} more
                          </button>
                        )}
                        {userAssignments.length === 0 && (
                          <span className="text-xs text-gray-500">No assignments</span>
                        )}
                      </div>
                    </td>
                  {selectedProject !== 'all' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center justify-between gap-4 w-full">
                        
                        {/* Project and Role Selection */}
                        <div className="flex items-center gap-3 flex-wrap max-w-[70%]">
                          <div className="min-w-[140px]">
                            <ProjectSelect
                              value={perUserProject[user.id] || ""}
                              onValueChange={(val) => handlePerUserProjectChange(user.id, val)}
                              includeAllOption={false}
                              placeholder="Project"
                              className="w-full"
                            />
                          </div>

                          <div className="min-w-[120px]">
                            <Select
                              value={perUserRole[user.id] || ""}
                              onValueChange={(val) => handlePerUserRoleChange(user.id, val)}
                            >
                              <SelectTrigger size="sm" className="w-full">
                                <SelectValue placeholder="Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>Roles</SelectLabel>
                                  {roles.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>
                                      {r.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handlePerUserAssignment(user.id)}
                            disabled={!perUserProject[user.id] || !perUserRole[user.id]}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                              perUserProject[user.id] && perUserRole[user.id]
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                            }`}
                            title="Assign this user"
                          >
                            Assign
                          </button>

                          {userAssignments.length > 0 && (
                            <button
                              onClick={() => handleRemoveAllUserAssignments(user.id)}
                              className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                              title="Remove from all projects"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                      </div>
                    </td>
                  )}

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No users found matching your search.</p>
          </div>
        )}
        
        {/* Footer with bulk assign button */}
        {selectedUsers.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                {selectedUsers.length} users selected
              </span>
              <button
                onClick={handleBulkAssign}
                disabled={assignmentLoading}
                className={`px-6 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                  assignmentLoading 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Assign Access</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Assignment Modal - Temporarily Disabled */}
      {false && (
        <AssignmentModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          selectedUsers={selectedUsers}
          userNames={selectedUserNames}
          onAssign={handleAssignUsers}
          loading={assignmentLoading}
        />
      )}

      {/* User Details Modal */}
      {showUserDetailsModal && selectedUserForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium text-lg">
                      {selectedUserForDetails.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedUserForDetails.name}
                    </h3>
                    <p className="text-sm text-gray-600">{selectedUserForDetails.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUserDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-96">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Project Assignments</h4>
              
              {assignments.filter(a => a.user_id === selectedUserForDetails.id).length === 0 ? (
                <p className="text-gray-500 text-center py-8">No project assignments found.</p>
              ) : (
                <div className="space-y-3">
                  {assignments
                    .filter(a => a.user_id === selectedUserForDetails.id)
                    .map((assignment) => (
                      <div
                        key={`${assignment.project_id}-${assignment.role_id}`}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{assignment.project_name}</div>
                          <div className="text-sm text-gray-600">Role: {assignment.role_name}</div>
                          <div className="text-xs text-gray-500">
                            Assigned: {new Date(assignment.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            handleRemoveSpecificAssignment(selectedUserForDetails.id, assignment.project_id);
                            setShowUserDetailsModal(false);
                          }}
                          className="ml-3 text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded"
                          title="Remove from this project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between">
                <button
                  onClick={() => {
                    setShowUserDetailsModal(false);
                    handleIndividualAssignment(selectedUserForDetails.id);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Assign to Project</span>
                </button>
                <button
                  onClick={() => setShowUserDetailsModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
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

export default ManageAccessPage;