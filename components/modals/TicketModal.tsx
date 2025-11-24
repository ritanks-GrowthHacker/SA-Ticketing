'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Ticket, 
  User, 
  Flag, 
  CheckCircle, 
  Edit3,
  MessageCircle
} from 'lucide-react';
import { useAuthStore } from '../../app/store/authStore';
import TicketComments from '../comments/TicketComments';

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Status {
  id: string;
  name: string;
  type: string;
  color_code?: string;
  sort_order?: number;
  is_active?: boolean;
}

interface TicketFormData {
  project_id: string;
  title: string;
  description: string;
  assigned_to: string;
  status_id: string;
  priority_id: string;
  expected_closing_date: string; // ISO date string
}

interface TicketData {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  expected_closing_date?: string;
  actual_closing_date?: string;
  project: {
    id: string;
    name: string;
    description?: string;
  } | null;
  creator: {
    id: string;
    name: string;
    email: string;
  } | null;
  assignee: {
    id: string;
    name: string;
    email: string;
  } | null;
  updater: {
    id: string;
    name: string;
    email: string;
  } | null;
  status: {
    id: string;
    name: string;
    type: string;
    color_code?: string;
    sort_order?: number;
  } | null;
  priority: {
    id: string;
    name: string;
    type: string;
    color_code?: string;
    sort_order?: number;
  } | null;
  permissions: {
    can_edit: boolean;
    can_delete: boolean;
    can_assign: boolean;
    is_creator: boolean;
    is_assignee: boolean;
  };
}

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId?: string;
  onSuccess?: () => void;
  departmentId?: string; // Filter projects by department
}

const TicketModal: React.FC<TicketModalProps> = ({ isOpen, onClose, ticketId, onSuccess, departmentId }) => {
  const { token, role, isAuthenticated, user } = useAuthStore();
  const isEditMode = !!ticketId;
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [ticketStatuses, setTicketStatuses] = useState<Status[]>([]);
  const [priorities, setPriorities] = useState<Status[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  
  const [formData, setFormData] = useState<TicketFormData>({
    project_id: '',
    title: '',
    description: '',
    assigned_to: '',
    status_id: '',
    priority_id: '',
    expected_closing_date: ''
  });
  
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    show: boolean;
  }>({ type: 'info', message: '', show: false });
  
  const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message, show: true });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Custom close handler to ensure proper cleanup
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Reset form to initial state
  const resetForm = () => {
    console.log('🔄 TicketModal: Resetting form state', { isEditMode, ticketId });
    setFormData({
      project_id: '',
      title: '',
      description: '',
      assigned_to: '',
      status_id: '',
      priority_id: '',
      expected_closing_date: ''
    });
    setSelectedProject(null);
    setTicketData(null);
    setUsers([]);
    setTicketStatuses([]);
    setPriorities([]);
    setProjects([]);
    setLoading(false);
    setLoadingTicket(false);
    setNotification({ type: 'info', message: '', show: false });
  };

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    if (isOpen) {
      if (!isEditMode) {
        // Reset form for create mode
        resetForm();
        if (token) {
          fetchProjects();
        }
      }
    } else {
      // Reset when modal closes
      resetForm();
    }
  }, [isOpen, isEditMode, ticketId, token]);

  // Fetch ticket data in edit mode
  useEffect(() => {
    if (isOpen && isEditMode && ticketId && token) {
      // Reset form before fetching new ticket data
      resetForm();
      fetchTicketData();
    }
  }, [isOpen, isEditMode, ticketId, token]);

  // Fetch additional data when project is selected
  useEffect(() => {
    if (selectedProject && token) {
      fetchProjectUsers();
      fetchStatuses();
    }
  }, [selectedProject, token]);

  // In edit mode, populate form data after project users and statuses are loaded
  useEffect(() => {
    if (isEditMode && ticketData && selectedProject && users.length > 0 && ticketStatuses.length > 0 && priorities.length > 0) {
      console.log('🔄 Populating form with ticket data after all lists loaded');
      setFormData({
        project_id: ticketData.project?.id || '',
        title: ticketData.title || '',
        description: ticketData.description || '',
        assigned_to: ticketData.assignee?.id || '',
        status_id: ticketData.status?.id || '',
        priority_id: ticketData.priority?.id || '',
        expected_closing_date: ticketData.expected_closing_date ? ticketData.expected_closing_date.split('T')[0] : ''
      });
    }
  }, [isEditMode, ticketData, selectedProject, users, ticketStatuses, priorities]);

  const fetchProjects = async () => {
    try {
      // Build URL with department filter if provided
      const url = departmentId 
        ? `/api/get-all-projects?department_id=${departmentId}`
        : '/api/get-all-projects';
      
      console.log('🎫 TicketModal: Fetching projects with department filter:', departmentId);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
        console.log('✅ TicketModal: Projects loaded:', data.projects?.length);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchTicketData = async () => {
    if (!ticketId) return;
    
    try {
      setLoadingTicket(true);
      const response = await fetch(`/api/get-ticket?id=${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const ticket = data.ticket;
        
        console.log('🎫 Ticket data received:', ticket);
        setTicketData(ticket);
        
        // Set selected project first - this will trigger fetching of users and statuses
        // Form data will be populated by the separate useEffect once all data is loaded
        if (ticket.project) {
          const project = {
            id: ticket.project.id,
            name: ticket.project.name,
            description: ticket.project.description || ''
          };
          setSelectedProject(project);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        showNotification('error', `Failed to load ticket: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error fetching ticket:', error);
      showNotification('error', 'Network error while loading ticket');
    } finally {
      setLoadingTicket(false);
    }
  };

  const fetchProjectUsers = async () => {
    if (!selectedProject?.id) {
      console.log('No selected project, clearing users');
      setUsers([]);
      return;
    }

    try {
      console.log(`🔄 Fetching users for project: ${selectedProject.id}`);
      const response = await fetch(`/api/get-project-assignments?project_id=${selectedProject.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const transformedUsers = (data.assignments || []).map((assignment: any) => ({
          id: assignment.user_id,
          name: assignment.user_name,
          email: assignment.user_email
        }));
        console.log(`✅ Found ${transformedUsers.length} users for project ${selectedProject.id}:`, transformedUsers);
        setUsers(transformedUsers);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch project users:', errorData);
        showNotification('error', 'Failed to load project members');
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching project users:', error);
      showNotification('error', 'Network error while loading project members');
      setUsers([]);
    }
  };

  const fetchStatuses = async () => {
    try {
      const response = await fetch('/api/all-get-entities', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const statusesData = data.data?.statuses || {};
        
        const ticketStats = statusesData.ticket || [];
        const priorityStats = statusesData.priority || [];
        
        if (!Array.isArray(ticketStats) || !Array.isArray(priorityStats)) {
          console.error('Statuses data structure is invalid:', statusesData);
          showNotification('error', 'Failed to load statuses - invalid data structure');
          return;
        }
        
        setTicketStatuses(ticketStats);
        setPriorities(priorityStats);
        
        // Set default values only in create mode
        if (!isEditMode && !formData.status_id) {
          if (ticketStats.length > 0) {
            setFormData(prev => ({ ...prev, status_id: ticketStats[0].id }));
          }
          if (priorityStats.length > 0) {
            setFormData(prev => ({ ...prev, priority_id: priorityStats[0].id }));
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch statuses:', errorData);
        showNotification('error', 'Failed to load ticket statuses');
      }
    } catch (error) {
      console.error('Error fetching statuses:', error);
      showNotification('error', 'Network error while loading statuses');
    }
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setFormData(prev => ({ ...prev, project_id: project.id }));
  };

  const handleInputChange = (field: keyof TicketFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      showNotification('error', 'Please enter a ticket title');
      return;
    }

    try {
      setLoading(true);
      
      const apiEndpoint = isEditMode ? '/api/update-ticket' : '/api/create-tickets';
      const method = isEditMode ? 'PUT' : 'POST';
      
      const requestBody = {
        ...(isEditMode && { ticket_id: ticketId }),
        project_id: formData.project_id,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        assigned_to: formData.assigned_to || undefined,
        status_id: formData.status_id || undefined,
        ...(formData.priority_id && formData.priority_id.trim() !== '' && { priority_id: formData.priority_id }),
        ...(formData.expected_closing_date && { expected_closing_date: new Date(formData.expected_closing_date).toISOString() })
      };

      const response = await fetch(apiEndpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        showNotification('success', `Ticket ${isEditMode ? 'updated' : 'created'} successfully!`);
        
        if (!isEditMode) {
          // Reset form only in create mode
          setFormData({
            project_id: selectedProject?.id || '',
            title: '',
            description: '',
            assigned_to: '',
            status_id: ticketStatuses[0]?.id || '',
            priority_id: priorities[0]?.id || '',
            expected_closing_date: ''
          });
        }
        
        // Close modal and call success callback
        setTimeout(() => {
          handleClose();
          if (onSuccess) {
            onSuccess();
          }
        }, 1500);
      } else {
        const error = await response.json();
        showNotification('error', `Error: ${error.error}`);
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} ticket:`, error);
      showNotification('error', 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 ${isEditMode ? 'bg-orange-100 dark:bg-orange-900/50' : 'bg-blue-100 dark:bg-blue-900/50'} rounded flex items-center justify-center`}>
                {isEditMode ? (
                  <Edit3 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                ) : (
                  <Ticket className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {isEditMode ? 'Edit Ticket' : 'Create New Ticket'}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedProject?.name || 'Select a project'}
                  {isEditMode && ticketData && (
                    <span className="ml-2 font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">
                      #{ticketData.id.slice(-8).toUpperCase()}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Tab Navigation - Only show in edit mode */}
          {isEditMode && !loadingTicket && (
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'details'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Edit3 className="w-4 h-4" />
                    <span>Ticket Details</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'comments'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <MessageCircle className="w-4 h-4" />
                    <span>Comments</span>
                  </div>
                </button>
              </nav>
            </div>
          )}

          {/* Modal Content */}
          {loadingTicket ? (
            <div className="px-6 py-8 text-center">
              <div className="inline-flex items-center space-x-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-600">Loading ticket data...</span>
              </div>
            </div>
          ) : !selectedProject && !isEditMode ? (
            /* Project Selection */
            <div className="px-6 py-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select Project</h3>
                <p className="text-sm text-gray-600">Choose a project to create your ticket</p>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleProjectSelect(project)}
                    className="w-full text-left p-3 rounded-md border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 group-hover:text-blue-700">
                          {project.name}
                        </h3>
                        {project.description && (
                          <p className="text-xs text-gray-500 mt-1">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {projects.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500">No projects found</p>
                </div>
              )}
            </div>
          ) : isEditMode && activeTab === 'comments' ? (
            /* Comments Section */
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <TicketComments 
                ticketId={ticketId!} 
                projectId={formData.project_id}
                onCommentAdded={() => {
                  // Optional: refresh ticket data or show notification
                }} 
              />
            </div>
          ) : (
            /* Ticket Form */
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Title Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Add a description..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors"
                />
              </div>

              {/* Expected Closing Date Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Closing Date
                  {isEditMode && ticketData?.creator?.id !== user?.id && (
                    <span className="ml-2 text-xs text-gray-500">(Only creator can edit)</span>
                  )}
                </label>
                <input
                  type="date"
                  value={formData.expected_closing_date}
                  onChange={(e) => handleInputChange('expected_closing_date', e.target.value)}
                  disabled={isEditMode && ticketData?.creator?.id !== user?.id}
                  min={new Date().toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    isEditMode && ticketData?.creator?.id !== user?.id ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
                {isEditMode && ticketData?.actual_closing_date && (
                  <p className="mt-1 text-xs text-green-600">
                    ✓ Resolved on {new Date(ticketData.actual_closing_date).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Three-column layout for dropdowns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Assignee */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assignee
                  </label>
                  <div className="relative">
                    <select
                      value={formData.assigned_to}
                      onChange={(e) => handleInputChange('assigned_to', e.target.value)}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <div className="relative">
                    <select
                      value={formData.status_id}
                      onChange={(e) => handleInputChange('status_id', e.target.value)}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                    >
                      {ticketStatuses.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.name}
                        </option>
                      ))}
                    </select>
                    {formData.status_id && (
                      <div
                        className="absolute right-8 top-1/2 transform -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none"
                        style={{ 
                          backgroundColor: ticketStatuses.find(s => s.id === formData.status_id)?.color_code || '#6B7280' 
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <div className="relative">
                    <select
                      value={formData.priority_id}
                      onChange={(e) => handleInputChange('priority_id', e.target.value)}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                    >
                      {priorities.map((priority) => (
                        <option key={priority.id} value={priority.id}>
                          {priority.name}
                        </option>
                      ))}
                    </select>
                    {formData.priority_id && (
                      <div
                        className="absolute right-8 top-1/2 transform -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none"
                        style={{ 
                          backgroundColor: priorities.find(p => p.id === formData.priority_id)?.color_code || '#6B7280' 
                        }}
                      />
                    )}
                    <Flag className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Modal Footer */}
          {(selectedProject || isEditMode) && !loadingTicket && (!isEditMode || activeTab === 'details') && (
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !formData.title.trim()}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  loading || !formData.title.trim() 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : isEditMode 
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {loading 
                  ? (isEditMode ? 'Updating...' : 'Creating...') 
                  : (isEditMode ? 'Update' : 'Create')
                }
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {notification.show && (
        <div
          className={`fixed bottom-4 right-4 z-60 px-6 py-4 rounded-lg shadow-lg transition-all duration-300 ${
            notification.type === 'success'
              ? 'bg-green-500 text-white'
              : notification.type === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-blue-500 text-white'
          }`}
        >
          <div className="flex items-center space-x-3">
            {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {notification.type === 'error' && <X className="w-5 h-5" />}
            {notification.type === 'info' && <Ticket className="w-5 h-5" />}
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
    </>
  );
};

export default TicketModal;