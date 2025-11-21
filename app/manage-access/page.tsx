'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Trash2, Shield, UserCheck, UserX, Filter, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { ProjectSelect } from '../../components/ui/ProjectSelect';
import { AssignmentModal } from '../../components/modals';
import { isRoleDisabled, getDisabledRoleMessage } from '@/lib/roleHierarchy';
import { useApiCall } from '../hooks/useApiCall';
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
  department?: string;
  department_id?: string;
  role?: string; // Org/dept role
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
  const { token, role, isAuthenticated, user, currentDepartment, currentProject, roles } = useAuthStore();
  const { apiCall } = useApiCall();
  
  // Get effective role - PRIORITY: project role > department role > global role (PROJECT ROLE IS DOMINANT)
  const effectiveRole = currentProject?.role || currentDepartment?.role || role || roles?.[0] || 'User';
  
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rolesData, setRolesData] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [perUserProject, setPerUserProject] = useState<Record<string, string>>({});
  const [perUserRole, setPerUserRole] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // IMPORTANT: Default to current project from JWT (project-based system)
  const [selectedProject, setSelectedProject] = useState(currentProject?.id || 'all');
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

  // Conflict detection modal states
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictData, setConflictData] = useState<{
    userId: string;
    userName: string;
    projectId: string;
    projectName: string;
    roleId: string;
    existingProjects: Array<{ project_name: string; role_name: string }>;
  } | null>(null);

  // Resource Request Modal states
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [departmentEmployees, setDepartmentEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [resourceRequests, setResourceRequests] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [requestMessage, setRequestMessage] = useState('');

  // Function to show notifications
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message, show: true });
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // Redirect if not admin or manager
  useEffect(() => {
    if (isAuthenticated && effectiveRole !== 'Admin' && effectiveRole !== 'Manager') {
      window.location.href = '/dashboard';
    }
  }, [isAuthenticated, effectiveRole]);

  // Fetch initial data
  useEffect(() => {
    console.log('🔍 MANAGE ACCESS: Check data fetch', { 
      hasToken: !!token, 
      effectiveRole, 
      isAuthenticated,
      currentProject: currentProject?.id,
      currentProjectRole: currentProject?.role,
      currentDepartment: currentDepartment?.id 
    });
    
    if (token && (effectiveRole === 'Admin' || effectiveRole === 'Manager')) {
      console.log('✅ MANAGE ACCESS: Fetching data...');
      fetchData();
    } else {
      console.log('⚠️ MANAGE ACCESS: Not fetching data', { hasToken: !!token, effectiveRole });
    }
  }, [token, effectiveRole, currentDepartment?.id]);

  // Sync selectedProject with dashboard's currentProject selection
  useEffect(() => {
    const newSelectedProject = currentProject?.id || 'all';
    if (selectedProject !== newSelectedProject) {
      console.log('🔄 MANAGE ACCESS: Syncing project filter with dashboard:', {
        old: selectedProject,
        new: newSelectedProject,
        projectName: currentProject?.name
      });
      setSelectedProject(newSelectedProject);
    }
  }, [currentProject?.id]);

  // Refresh assignments when project filter changes
  useEffect(() => {
    if (token && (effectiveRole === 'Admin' || effectiveRole === 'Manager')) {
      fetchAssignments();
      fetchResourceRequests();
    }
  }, [selectedProject, token, effectiveRole]);

  // Fetch departments when modal opens
  useEffect(() => {
    if (showResourceModal) {
      console.log('Modal opened, fetching departments...');
      fetchDepartments();
    }
  }, [showResourceModal]);

  // Fetch employees when department changes
  useEffect(() => {
    if (selectedDepartment) {
      fetchDepartmentEmployees(selectedDepartment);
    } else {
      setDepartmentEmployees([]);
    }
  }, [selectedDepartment]);

  // Clear selected users when switching to "All Projects" view (unless admin/manager working with unassigned users)
  useEffect(() => {
    if (selectedProject === 'all' && effectiveRole !== 'Admin' && effectiveRole !== 'Manager') {
      setSelectedUsers([]);
    }
  }, [selectedProject, effectiveRole]);

  const fetchData = async () => {
    try {
      console.log('📊 MANAGE ACCESS: Starting fetchData...');
      setLoading(true);
      await Promise.all([
        fetchUsers(),
        fetchProjects(),
        fetchAssignments()
      ]);
      console.log('✅ MANAGE ACCESS: fetchData complete');
    } catch (error) {
      console.error('❌ MANAGE ACCESS: Error in fetchData:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // PROJECT-BASED SYSTEM: Get eligible users (exclude Sales, HR, Administration)
      const url = new URL('/api/get-eligible-users', window.location.origin);
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ MANAGE ACCESS: Loaded ${data.users.length} eligible users (${data.totalUsers} total)`);
        setUsers(data.users || []);
      } else {
        const err = await response.json().catch(() => ({}));
        console.error('Failed to fetch eligible users:', err);
        showNotification('error', 'Failed to load users');
      }
      
      // Also fetch available roles for assignment
      await fetchRoles();
    } catch (error) {
      console.error('Error fetching users:', error);
      showNotification('error', 'Error loading users');
    }
  };

  const fetchProjects = async () => {
    try {
      const url = new URL('/api/get-all-projects', window.location.origin);
      
      // Filter by current department if available
      if (currentDepartment?.id) {
        url.searchParams.append('department_id', currentDepartment.id);
        console.log(`🔍 MANAGE ACCESS: Filtering projects by department ${currentDepartment.name} (${currentDepartment.id})`);
      }
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ MANAGE ACCESS: Loaded ${data.projects?.length || 0} projects`);
        setProjects(data.projects || []);
      } else {
        console.error('Failed to fetch projects');
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
        setRolesData(data.data?.roles || []);
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

  // Fetch departments for resource request modal
  const fetchDepartments = async () => {
    try {
      const authState = useAuthStore.getState();
      const orgId = authState.organization?.id;
      if (!orgId) {
        console.error('No organization ID found');
        return;
      }

      const response = await fetch(`/api/get-org-departments?orgId=${orgId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched departments:', data.departments);
        setDepartments(data.departments || []);
      } else {
        console.error('Failed to fetch departments:', await response.text());
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  // Fetch employees by department
  const fetchDepartmentEmployees = async (departmentId: string) => {
    try {
      const authState = useAuthStore.getState();
      const orgId = authState.organization?.id;
      if (!orgId) return;

      const response = await fetch(`/api/get-department-employees?departmentId=${departmentId}&orgId=${orgId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDepartmentEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Error fetching department employees:', error);
    }
  };

  // Fetch resource requests for current project
  const fetchResourceRequests = async () => {
    if (selectedProject === 'all') return;

    try {
      const response = await fetch(`/api/get-resource-requests?projectId=${selectedProject}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setResourceRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching resource requests:', error);
    }
  };

  // Add employee to pending requests
  const addToPendingRequests = () => {
    if (!selectedEmployee || !selectedDepartment) return;

    const employee = departmentEmployees.find(e => e.id === selectedEmployee);
    const department = departments.find(d => d.id === selectedDepartment);

    if (employee && department) {
      setPendingRequests([...pendingRequests, {
        user_id: employee.id,
        user_name: employee.name,
        user_email: employee.email,
        user_job_title: employee.job_title,
        department_id: department.id,
        department_name: department.name,
        message: requestMessage
      }]);
      
      // Reset selections
      setSelectedEmployee('');
      setRequestMessage('');
    }
  };

  // Submit all pending resource requests
  const submitResourceRequests = async () => {
    if (pendingRequests.length === 0 || selectedProject === 'all') return;

    try {
      const response = await fetch('/api/submit-resource-requests', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_id: selectedProject,
          requests: pendingRequests.map(req => ({
            user_id: req.user_id,
            department_id: req.department_id,
            message: req.message
          }))
        })
      });

      if (response.ok) {
        showNotification('success', `${pendingRequests.length} resource request(s) submitted successfully`);
        setPendingRequests([]);
        setShowResourceModal(false);
        setSelectedDepartment('');
        setSelectedEmployee('');
        setRequestMessage('');
        fetchResourceRequests();
      } else {
        showNotification('error', 'Failed to submit resource requests');
      }
    } catch (error) {
      console.error('Error submitting resource requests:', error);
      showNotification('error', 'An error occurred while submitting requests');
    }
  };

  // Remove from pending requests
  const removeFromPending = (index: number) => {
    setPendingRequests(pendingRequests.filter((_, i) => i !== index));
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

    // Check if user is already assigned to other projects
    const userAssignments = assignments.filter(a => a.user_id === userId);
    const user = users.find(u => u.id === userId);
    
    if (userAssignments.length > 0) {
      // Show conflict modal
      const selectedProject = projects.find(p => p.id === projectId);
      setConflictData({
        userId,
        userName: user?.name || 'User',
        projectId,
        projectName: selectedProject?.name || 'Project',
        roleId,
        existingProjects: userAssignments.map(a => ({
          project_name: a.project_name,
          role_name: a.role_name
        }))
      });
      setShowConflictModal(true);
      return;
    }

    // Proceed with assignment if no conflicts
    await performAssignment(userId, projectId, roleId);
  };

  const performAssignment = async (userId: string, projectId: string, roleId: string) => {
    try {
      setAssignmentLoading(true);
      const response = await apiCall('/api/create-project-user-relation', {
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
        // Clear the per-user selections
        setPerUserProject(prev => {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        });
        setPerUserRole(prev => {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        });
      } else {
        // Try to parse error response
        let errorMessage = 'Failed to assign user';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const err = await response.json();
            console.error('Assign error (JSON):', err);
            errorMessage = err?.error || errorMessage;
          } else {
            const textError = await response.text();
            console.error('Assign error (Text):', textError);
            errorMessage = textError || errorMessage;
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
        }
        showNotification('error', errorMessage);
      }
    } catch (error) {
      console.error('Network error assigning user:', error);
      showNotification('error', 'Network error assigning user');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleConfirmConflictAssignment = async () => {
    if (!conflictData) return;
    
    setShowConflictModal(false);
    await performAssignment(conflictData.userId, conflictData.projectId, conflictData.roleId);
    setConflictData(null);
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
    // Exclude current admin/manager user from the list
    if (user && userItem.id === user.id && (effectiveRole === 'Admin' || effectiveRole === 'Manager')) {
      return false;
    }

    const matchesSearch = userItem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userItem.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (userItem.department && userItem.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (userItem.role && userItem.role.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // If 'all' selected -> show ALL users in the organization regardless of project assignments
    if (selectedProject === 'all') {
      return true;
    }

    // When a specific project is selected -> show users assigned to that project
    return assignments.some(a => a.user_id === userItem.id && a.project_id === selectedProject);
  }).sort((a, b) => {
    // Sort by created_at: newest first (descending order)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Get selected user names for the modal
  const selectedUserNames = selectedUsers
    .map(userId => users.find(u => u.id === userId)?.name)
    .filter(Boolean) as string[];

  if (!isAuthenticated || (effectiveRole !== 'Admin' && effectiveRole !== 'Manager')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">Only administrators and managers can access this page.</p>
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
              ? 'Select a specific project to manage team assignments'
              : 'Assign eligible users to this project (Sales, HR, and Administration require resource requests)'
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
                placeholder="Search by name, email, department, or role..."
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
            <div className="flex items-center space-x-3">
              {selectedProject !== 'all' ? (
                <button
                  onClick={() => setShowResourceModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm"
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  Ask Resource
                </button>
              ) : (
                <div className="text-xs text-gray-500 italic">
                  Select a project to request resources
                </div>
              )}
              <span className="text-sm text-gray-500">
                {filteredUsers.length} {selectedProject === 'all' ? 'members' : 'users'}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-hide">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                {(selectedProject !== 'all' || (selectedProject === 'all' && (effectiveRole === 'Admin' || effectiveRole === 'Manager'))) && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {selectedProject !== 'all' && (
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
                    )}
                    {selectedProject === 'all' && (effectiveRole === 'Admin' || effectiveRole === 'Manager') && (
                      <span className="text-xs">Actions</span>
                    )}
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Org/Dept Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Projects
                </th>
                {(selectedProject !== 'all' || (selectedProject === 'all' && (effectiveRole === 'Admin' || effectiveRole === 'Manager'))) && (
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
                    {(selectedProject !== 'all' || (selectedProject === 'all' && (effectiveRole === 'Admin' || effectiveRole === 'Manager') && userAssignments.length === 0)) && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {selectedProject !== 'all' && (
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
                        )}
                        {selectedProject === 'all' && (effectiveRole === 'Admin' || effectiveRole === 'Manager') && userAssignments.length === 0 && (
                          <div className="w-4 h-4"></div>
                        )}
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
                      {user.department ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {user.department}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">No department</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.role ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'Admin' ? 'bg-red-100 text-red-800' : 
                          user.role === 'Manager' ? 'bg-blue-100 text-blue-800' : 
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">No role</span>
                      )}
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
                    
                    {/* Show assignment controls for unassigned users in "All Projects" view (Admin/Manager only) */}
                    {selectedProject === 'all' && (effectiveRole === 'Admin' || effectiveRole === 'Manager') && userAssignments.length === 0 && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center justify-between gap-4 w-full">
                          
                          {/* Project and Role Selection for unassigned users */}
                          <div className="flex items-center gap-3 flex-wrap max-w-[70%]">
                            <div className="min-w-[140px]">
                              <ProjectSelect
                                value={perUserProject[user.id] || ""}
                                onValueChange={(val) => handlePerUserProjectChange(user.id, val)}
                                includeAllOption={false}
                                placeholder="Select Project"
                                className="w-full"
                              />
                            </div>

                            <div className="min-w-[120px]">
                              <Select
                                value={perUserRole[user.id] || ""}
                                onValueChange={(val) => handlePerUserRoleChange(user.id, val)}
                              >
                                <SelectTrigger size="sm" className="w-full">
                                  <SelectValue placeholder="Select Role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectLabel>Roles</SelectLabel>
                                    {rolesData.map((r) => (
                                      <SelectItem key={r.id} value={r.id}>
                                        {r.name}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Assign Button for unassigned users */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handlePerUserAssignment(user.id)}
                              disabled={!perUserProject[user.id] || !perUserRole[user.id]}
                              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                perUserProject[user.id] && perUserRole[user.id]
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                              }`}
                              title="Assign this user to project"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Assign
                            </button>
                          </div>

                        </div>
                      </td>
                    )}
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
                                  {rolesData.map((r) => {
                                    const disabled = isRoleDisabled(effectiveRole, r.name);
                                    return (
                                      <SelectItem 
                                        key={r.id} 
                                        value={r.id}
                                        disabled={disabled}
                                        className={disabled ? "opacity-50 cursor-not-allowed" : ""}
                                        title={disabled ? getDisabledRoleMessage(r.name) : undefined}
                                      >
                                        {r.name}
                                      </SelectItem>
                                    );
                                  })}
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

      {/* Resource Requests Table - Only show when project is selected */}
      {selectedProject !== 'all' && resourceRequests.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Resource Requests
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Requests for resources from other departments
            </p>
          </div>

          <div className="overflow-x-auto scrollbar-hide">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requested On
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {resourceRequests.map((request: any) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{request.user.name}</div>
                        <div className="text-sm text-gray-500">{request.user.email}</div>
                        {request.user.job_title && (
                          <div className="text-xs text-gray-400">{request.user.job_title}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: request.department.color_code || '#3B82F6' }}
                        />
                        <span className="text-sm text-gray-900">{request.department.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        request.status === 'approved' ? 'bg-green-100 text-green-800' :
                        request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(request.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {request.message || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
      
      {/* Resource Request Modal */}
      {showResourceModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black opacity-30" onClick={() => setShowResourceModal(false)}></div>
            
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full z-50">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Request Resources</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Request team members from <strong>Sales, Human Resource, or Administration</strong> departments
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  💡 Other departments can be assigned directly from the user list above
                </p>
              </div>

              <div className="p-6 space-y-4">
                {/* Department Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Department *
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Choose a department...</option>
                    {departments.length === 0 && (
                      <option value="" disabled>Loading departments...</option>
                    )}
                    {departments
                      .filter(dept => {
                        const name = dept.name.toLowerCase();
                        return name.includes('sales') || name.includes('human resource') || name.includes('hr') || name.includes('administration');
                      })
                      .map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))
                    }
                  </select>
                  {departments.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      No departments found. Please make sure your organization has departments set up.
                    </p>
                  )}
                  {departments.length > 0 && departments.filter(dept => {
                    const name = dept.name.toLowerCase();
                    return name.includes('sales') || name.includes('human resource') || name.includes('hr') || name.includes('administration');
                  }).length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ No restricted departments (Sales, HR, Administration) found
                    </p>
                  )}
                </div>

                {/* Employee Selection */}
                {selectedDepartment && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Employee
                    </label>
                    <select
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={departmentEmployees.length === 0}
                    >
                      <option value="">Choose an employee...</option>
                      {departmentEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} - {emp.job_title || emp.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Optional Message */}
                {selectedEmployee && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message (Optional)
                    </label>
                    <textarea
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      placeholder="Reason for requesting this resource..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={3}
                    />
                  </div>
                )}

                {/* Add to List Button */}
                {selectedEmployee && (
                  <div className="flex justify-end">
                    <button
                      onClick={addToPendingRequests}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add to Request List
                    </button>
                  </div>
                )}

                {/* Pending Requests List */}
                {pendingRequests.length > 0 && (
                  <div className="mt-6 border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Pending Requests ({pendingRequests.length})
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {pendingRequests.map((req, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">{req.user_name}</div>
                            <div className="text-xs text-gray-500">{req.department_name} - {req.user_email}</div>
                          </div>
                          <button
                            onClick={() => removeFromPending(index)}
                            className="ml-2 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
                <button
                  onClick={() => {
                    setShowResourceModal(false);
                    setPendingRequests([]);
                    setSelectedDepartment('');
                    setSelectedEmployee('');
                    setRequestMessage('');
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitResourceRequests}
                  disabled={pendingRequests.length === 0}
                  className={`px-6 py-2 rounded-lg transition-colors ${
                    pendingRequests.length > 0
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Submit {pendingRequests.length > 0 && `(${pendingRequests.length})`} Request{pendingRequests.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Conflict Detection Modal */}
      {showConflictModal && conflictData && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 bg-black opacity-30 transition-opacity" 
              aria-hidden="true" 
              onClick={() => {
                setShowConflictModal(false);
                setConflictData(null);
                setAssignmentLoading(false);
              }}
            ></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full z-50">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertCircle className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Assignment Conflict Detected
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        <strong>{conflictData.userName}</strong> is already assigned to the following project(s):
                      </p>
                      <div className="mt-3 space-y-2">
                        {conflictData.existingProjects.map((proj, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm font-medium text-gray-900">{proj.project_name}</span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {proj.role_name}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-gray-500 mt-3">
                        Do you want to proceed with assigning them to <strong>{conflictData.projectName}</strong>?
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleConfirmConflictAssignment}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Yes, Assign Anyway
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConflictModal(false);
                    setConflictData(null);
                    setAssignmentLoading(false); // Reset loading state
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
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