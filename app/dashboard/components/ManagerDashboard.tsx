'use client';

/**
 * Manager Dashboard Component
 * 
 * Fixed Issues:
 * - Ensures API calls always include project_id parameter to prevent showing aggregated data from all managed projects
 * - Validates selectedProject state before making API calls to avoid race conditions
 * - Auto-selects first project when none is selected to ensure proper initialization
 * - Prevents cross-tab sync from triggering API calls without valid project context
 */

import React, { useState, useEffect } from 'react';
import { BarChart3, Users, FolderOpen, Ticket, TrendingUp, Clock, User, Target, Filter, LayoutGrid, List } from 'lucide-react';
import { UserRoleModal, TicketModal, CreateProjectModal } from '../../../components/modals';
import DragDropTicketBoard from '../../../components/ui/DragDropTicketBoard';
import { DepartmentProjectFilter } from './DepartmentProjectFilter';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore, DashboardMetrics, MetricValue } from '../../store/dashboardStore';

interface ManagerDashboardProps {
  projectId?: string | null;
}

const ManagerDashboard = ({ projectId }: ManagerDashboardProps) => {
  // Add Create Project Modal state
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);
  
  // Handle project creation success
  const handleProjectCreated = async () => {
    setIsCreateProjectModalOpen(false);
    setProjectRefreshKey(prev => prev + 1); // Trigger refresh
    // Refresh projects and dashboard metrics after creation
    await fetchProjects();
    await fetchDashboardMetrics(true);
  };
  const { token, organization, roles, currentProject, switchProject } = useAuthStore();
  
  // Get project role from JWT
  const projectRole = currentProject?.role || 'Manager';
  
  const { 
    getCachedData, 
    setCachedData, 
    isCacheValid, 
    isLoading: dashboardLoading,
    setLoading: setDashboardLoading,
    invalidateCache,
    broadcastUpdate,
    setupCrossTabSync,
    lastUpdateTimestamp
  } = useDashboardStore();
  
  const [selectedProject, setSelectedProject] = useState(projectId || '');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>(undefined);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDragDropView, setShowDragDropView] = useState(false);
  const [statuses, setStatuses] = useState<Array<{ id: string; name: string; color_code?: string; type: string }>>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Pending access state
  const [pendingAccess, setPendingAccess] = useState(false);
  
  // Handle project change from the filter component
  const handleProjectChange = async (projectId: string, departmentId?: string) => {
    try {
      setSelectedProject(projectId);
      
      // Call the switch project API to rebuild JWT
      const response = await fetch('/api/switch-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ projectId })
      });

      if (response.ok) {
        const data = await response.json();
        // Update the auth store with the new token and project data
        switchProject({
          token: data.token,
          project: {
            id: data.project.id,
            name: data.project.name,
            role: data.role
          }
        });
        
        // Refresh dashboard metrics
        await fetchDashboardMetrics();
      } else {
        throw new Error('Failed to switch project');
      }
    } catch (error) {
      console.error('Failed to switch project:', error);
    }
  };
  
  // Fetch dashboard metrics with caching - allow fetching even without selectedProject for managers
  useEffect(() => {
    if (token && organization?.id) {
      // Managers can fetch metrics even without a specific project selected
      fetchDashboardMetrics();
    }
  }, [selectedProject, token, currentPage]);

  // Setup cross-tab synchronization
  useEffect(() => {
    const cleanup = setupCrossTabSync();
    return cleanup;
  }, [setupCrossTabSync]);

  // Refresh when cross-tab updates detected
  useEffect(() => {
    if (lastUpdateTimestamp > 0 && selectedProject && selectedProject.trim() !== '') {
      fetchDashboardMetrics();
    }
  }, [lastUpdateTimestamp, selectedProject]);

  // Update selected project when projectId prop changes
  useEffect(() => {
    if (projectId && projectId !== selectedProject) {
      setSelectedProject(projectId);
    }
  }, [projectId]);

  // Effect to handle cache loading on component mount  
  useEffect(() => {
    if (organization?.id && token && selectedProject && selectedProject.trim() !== '') {
      const projectIdForCache = selectedProject;
      const cachedMetrics = getCachedData(projectIdForCache, organization.id);
      
      if (cachedMetrics) {
        setMetrics(cachedMetrics);
        setLoading(false);
      } else {
        fetchDashboardMetrics();
      }
    }
  }, [organization?.id, token, selectedProject, currentProject?.role || null]);

  // Fetch statuses on component mount
  useEffect(() => {
    if (token) {
      fetchStatuses();
    }
  }, [token]);

  // Auto-refresh dashboard metrics for managers to see immediate updates
  useEffect(() => {
    if (!currentProject?.role || currentProject.role !== 'Manager') return;
    if (!selectedProject || !token || !organization?.id) return;
    
    console.log('🔄 Setting up auto-refresh for Manager Dashboard...');
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing dashboard metrics for Manager...');
      fetchDashboardMetrics(true); // Force refresh to bypass cache
    }, 15000); // Refresh every 15 seconds for managers
    
    return () => {
      console.log('🛑 Clearing dashboard auto-refresh interval');
      clearInterval(interval);
    };
  }, [currentProject?.role || null, selectedProject || null, token || null, organization?.id || null]);

  // Fetch ticket statuses for drag-and-drop board
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
        
        if (data.data?.statuses?.ticket) {
          const formattedStatuses = data.data.statuses.ticket.map((status: any) => ({
            id: status.id,
            name: status.name,
            color: status.color_code || '#6b7280'
          }));
          setStatuses(formattedStatuses);
        }
      }
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  };

  // Add fetchProjects function for refreshing project list after creation
  const fetchProjects = async () => {
    if (!token || !organization?.id) return;
    try {
      // Fetch projects for current department only
      const response = await fetch('/api/get-all-projects?includeStats=true', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        // Optionally update local state or cache if needed
        // You can add setProjects here if you use projects state
        // const data = await response.json();
        // setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchDashboardMetrics = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setDashboardLoading(true);
      
      if (!token || !organization?.id) {
        setLoading(false);
        setDashboardLoading(false);
        return;
      }

      // For managers, selectedProject is optional - they can view all their projects
      const projectIdForApi = selectedProject && selectedProject.trim() !== '' ? selectedProject : null;
      
      // Check cache first (unless force refresh is requested)
      if (!forceRefresh && projectIdForApi) {
        const cachedMetrics = getCachedData(projectIdForApi, organization.id);
        if (cachedMetrics) {
          setMetrics(cachedMetrics);
          setLoading(false);
          setDashboardLoading(false);
          console.log('✅ Loaded from cache for project:', projectIdForApi);
          return;
        }
      }

      // Build URL with project filter and pagination
      const params = new URLSearchParams();
      if (projectIdForApi) {
        params.set('project_id', projectIdForApi);
      }
      params.set('page', currentPage.toString());
      params.set('limit', itemsPerPage.toString());
      // Add cache busting parameter for fresh data
      params.set('_t', Date.now().toString());
      
      const url = `/api/get-dashboard-metrics?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Check for pending access state
        if (data.pending_access) {
          console.log('⏳ MANAGER: User has pending access');
          setPendingAccess(true);
          setLoading(false);
          setDashboardLoading(false);
          return;
        }
        
        const dashboardMetrics = data.data;
        
        // Set metrics in component state
        setMetrics(dashboardMetrics);
        setPendingAccess(false);
        
        // Cache the metrics
        const userRole = roles?.join(',') || 'manager';
        setCachedData(dashboardMetrics, projectIdForApi, userRole, organization.id);
      }
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
    } finally {
      setLoading(false);
      setDashboardLoading(false);
    }
  };

  // Handle ticket status update via drag and drop
  const handleTicketStatusUpdate = async (ticketId: string, newStatusId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/update-ticket', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticket_id: ticketId,
          status_id: newStatusId
        })
      });

      if (response.ok) {

        
        // Broadcast update to other tabs
        broadcastUpdate('ticket_updated', { ticketId, newStatusId });
        
        // Refresh the dashboard data to reflect the changes
        await fetchDashboardMetrics(true);
        return true;
      } else {
        const errorData = await response.text();
        console.error('❌ Error updating ticket status:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          ticketId,
          newStatusId
        });
        return false;
      }
    } catch (error) {
      console.error('❌ Error updating ticket status:', error);
      return false;
    }
  };

  // Handle ticket click for editing
  const handleTicketClick = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setIsTicketModalOpen(true);
  };

  const handleTicketModalClose = () => {
    setIsTicketModalOpen(false);
    setSelectedTicketId(undefined);
    // Refresh dashboard data after ticket modal closes (in case ticket was updated)
    fetchDashboardMetrics(true);
  };

  // Prepare stats from API data
  const projectStats = metrics ? [
    {
      title: 'Project Tickets',
      value: metrics.overview.projectTickets?.value || 0,
      change: metrics.overview.projectTickets?.change || '0%',
      changeType: metrics.overview.projectTickets?.changeType || 'neutral',
      icon: Ticket
    },
    {
      title: 'Team Members',
      value: metrics.overview.teamMembers?.value || 0,
      change: metrics.overview.teamMembers?.change || '0',
      changeType: metrics.overview.teamMembers?.changeType || 'neutral',
      icon: Users
    },
    {
      title: 'Completion Rate',
      value: metrics.overview.completionRate?.value || '0%',
      change: metrics.overview.completionRate?.change || '0%',
      changeType: metrics.overview.completionRate?.changeType || 'neutral',
      icon: Target
    },
    {
      title: 'Avg Resolution Time',
      value: metrics.overview.avgResolutionTime?.value || '0h',
      change: metrics.overview.avgResolutionTime?.change || '0h',
      changeType: metrics.overview.avgResolutionTime?.changeType || 'neutral',
      icon: Clock
    }
  ] : [];

  const projectTickets = metrics?.recentActivity || [];

  // Get actual team members from API data
  const teamMembers = (metrics as any)?.teamMembers || [];
  console.log('🔍 MANAGER DASHBOARD: Team Members Debug:', {
    'metrics exists': !!metrics,
    'teamMembers': teamMembers,
    'teamMembers length': teamMembers.length,
    'full metrics': metrics
  });

  // Pending access state UI
  if (pendingAccess) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage your assigned projects and team</p>
        </div>

        {/* Pending Access Message */}
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Account Pending Setup
            </h3>
            <p className="text-gray-600 mb-6">
              Your manager account has been created successfully! An administrator will assign you to a project soon.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>What happens next?</strong><br/>
                Once assigned, you'll be able to manage your team, oversee tickets, and track project progress.
              </p>
            </div>
            <p className="text-sm text-gray-500">
              You can still navigate to other pages using the sidebar. Contact your administrator if you have questions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Project Selection */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage your assigned projects and team</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Department and Project Filters */}
          <DepartmentProjectFilter
            token={token || ''}
            onProjectChange={handleProjectChange}
            initialProjectId={selectedProject}
            refreshKey={projectRefreshKey}
          />
          
          {currentProject && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 bg-blue-50 px-3 py-1.5 rounded-full font-medium border border-blue-200">
                <span className="text-blue-900">{projectRole}</span>
              </span>
              {currentProject?.name && (
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                  {currentProject.name}
                </span>
              )}
            </div>
          )}
          
          <button
            onClick={() => setIsCreateProjectModalOpen(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create Project
          </button>
          
          <button 
            onClick={() => setIsTicketModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Ticket
          </button>
        </div>
      </div>

      {/* Modals */}
      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />

      {/* Project Stats */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{currentProject?.name || 'Project'} Overview</h3>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Project Active</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {projectStats.map((stat, index) => (
            <div key={index} className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-lg">
                <stat.icon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{stat.title}</p>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
                  <span className="text-xs text-green-600">{stat.change}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className={`grid grid-cols-1 gap-6 ${showDragDropView ? 'lg:grid-cols-1' : 'lg:grid-cols-3'}`}>
        {/* Project Tickets */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Project Tickets</h3>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">
                  {selectedProject ? 
                    (metrics?.overview?.projectTickets?.value || 0) : 
                    (metrics?.overview?.totalTickets?.value || 0)
                  } active
                </span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setShowDragDropView(false)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      !showDragDropView 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowDragDropView(true)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      showDragDropView 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6">
            {showDragDropView ? (
              <DragDropTicketBoard
                tickets={projectTickets}
                statuses={statuses}
                onTicketUpdate={handleTicketStatusUpdate}
                onTicketClick={handleTicketClick}
              />
            ) : loading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg animate-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      <div>
                        <div className="h-4 bg-gray-300 rounded w-48 mb-2"></div>
                        <div className="h-3 bg-gray-300 rounded w-32"></div>
                      </div>
                    </div>
                    <div className="h-6 bg-gray-300 rounded w-16"></div>
                  </div>
                ))}
              </div>
            ) : projectTickets.length > 0 ? (
              <div className="space-y-4">
                {projectTickets.map((ticket) => (
                  <div 
                    key={ticket.id} 
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => handleTicketClick(ticket.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <div>
                        <h4 className="font-medium text-gray-900">{ticket.title}</h4>
                        <p className="text-sm text-gray-600">
                          {ticket.project && `${ticket.project} • `}Assigned to {ticket.assignedTo} • {ticket.time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${ticket.priorityColor}20`,
                          color: ticket.priorityColor,
                          border: `1px solid ${ticket.priorityColor}40`
                        }}
                      >
                        {ticket.priority}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        ticket.status.toLowerCase().includes('open') ? 'bg-red-100 text-red-800' :
                        ticket.status.toLowerCase().includes('progress') ? 'bg-blue-100 text-blue-800' :
                        ticket.status.toLowerCase().includes('review') ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {selectedProject ? 'No tickets found for this project' : 'Select a project to view tickets'}
                </p>
              </div>
            )}
            {!showDragDropView && metrics?.pagination && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                {/* Pagination Controls */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, metrics.pagination.totalItems)} of {metrics.pagination.totalItems} tickets
                  </div>
                  
                  {metrics.pagination.totalPages > 1 && (
                    <div className="flex items-center space-x-1">
                      {/* Previous Button */}
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={!metrics.pagination.hasPreviousPage}
                        className={`px-2 py-1 text-sm rounded ${
                          metrics.pagination.hasPreviousPage
                            ? 'text-blue-600 hover:bg-blue-50'
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        ←
                      </button>
                      {/* Page Numbers */}
                      {Array.from({ length: Math.min(5, metrics.pagination.totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, currentPage - 2) + i;
                        // Only render valid page numbers
                        if (pageNum < 1 || pageNum > (metrics.pagination?.totalPages || 1)) return null;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-2 py-1 text-sm rounded ${
                              pageNum === currentPage
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      {/* Next Button */}
                      <button
                        onClick={() => setCurrentPage(Math.min(metrics.pagination?.totalPages ?? 1, currentPage + 1))}
                        disabled={!metrics.pagination?.hasNextPage}
                        className={`px-2 py-1 text-sm rounded ${
                          metrics.pagination?.hasNextPage
                            ? 'text-blue-600 hover:bg-blue-50'
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Team Activity & Stats - Hidden on small screens */}
        <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
          </div>
          <div className="p-6">
            {/* Team Members from API */}
            {teamMembers && teamMembers.length > 0 ? (
              <div className="space-y-4">
                {teamMembers.map((member: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-600">
                      {member.role}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No team members assigned yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;