'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, Users, FolderOpen, Ticket, TrendingUp, Clock, User, Target, Filter, LayoutGrid, List } from 'lucide-react';
import { UserRoleModal, TicketModal } from '../../../components/modals';
import { ProjectSelect } from '../../../components/ui/ProjectSelect';
import DragDropTicketBoard from '../../../components/ui/DragDropTicketBoard';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore, DashboardMetrics, MetricValue, ActivityItem } from '../../store/dashboardStore';

const ManagerDashboard = () => {
  const { token, organization, roles } = useAuthStore();
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
  
  const [selectedProject, setSelectedProject] = useState('all');
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
  
  // Fetch dashboard metrics with caching
  useEffect(() => {
    fetchDashboardMetrics();
  }, [selectedProject, token, currentPage]);

  // Setup cross-tab synchronization
  useEffect(() => {
    const cleanup = setupCrossTabSync();
    return cleanup;
  }, [setupCrossTabSync]);

  // Refresh when cross-tab updates detected
  useEffect(() => {
    if (lastUpdateTimestamp > 0) {
      console.log('🔄 Cross-tab update detected, refreshing dashboard...');
      fetchDashboardMetrics();
    }
  }, [lastUpdateTimestamp]);

  // Effect to handle cache loading on component mount
  useEffect(() => {
    if (organization?.id && token) {
      const projectId = selectedProject === 'all' ? null : selectedProject;
      const cachedMetrics = getCachedData(projectId, organization.id);
      
      if (cachedMetrics) {
        setMetrics(cachedMetrics);
        setLoading(false);
        console.log('✅ Manager Dashboard data loaded from cache');
      } else {
        fetchDashboardMetrics();
      }
    }
  }, [organization?.id, token]);

  // Fetch statuses on component mount
  useEffect(() => {
    if (token) {
      fetchStatuses();
    }
  }, [token]);

  // Fetch ticket statuses for drag-and-drop board
  const fetchStatuses = async () => {
    try {
      console.log('🔄 MANAGER: Fetching statuses from /api/all-get-entities...');
      const response = await fetch('/api/all-get-entities', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 MANAGER: Status fetch response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 MANAGER: Full API response:', data);
        
        if (data.data?.statuses?.ticket) {
          const formattedStatuses = data.data.statuses.ticket.map((status: any) => ({
            id: status.id,
            name: status.name,
            color: status.color_code || '#6b7280'
          }));
          console.log('📊 MANAGER: Formatted statuses:', formattedStatuses);
          setStatuses(formattedStatuses);
        } else {
          console.warn('⚠️ MANAGER: No ticket statuses found in response structure');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ MANAGER: Status fetch failed:', {
          status: response.status,
          error: errorText
        });
      }
    } catch (error) {
      console.error('❌ MANAGER: Status fetch exception:', error);
    }
  };

  const fetchDashboardMetrics = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setDashboardLoading(true);
      
      if (!token || !organization?.id) return;

      const projectId = selectedProject === 'all' ? null : selectedProject;
      
      // Check cache first (unless force refresh is requested)
      if (!forceRefresh) {
        const cachedMetrics = getCachedData(projectId, organization.id);
        if (cachedMetrics) {
          setMetrics(cachedMetrics);
          setLoading(false);
          setDashboardLoading(false);
          console.log('✅ Manager Dashboard data loaded from cache');
          return;
        }
      }

      console.log('🔄 Fetching manager dashboard data from API...');

      // Build URL with project filter and pagination
      const params = new URLSearchParams();
      if (selectedProject && selectedProject !== 'all') {
        params.set('project_id', selectedProject);
      }
      params.set('page', currentPage.toString());
      params.set('limit', itemsPerPage.toString());
      
      const url = `/api/get-dashboard-metrics?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const dashboardMetrics = data.data;
        
        // Set metrics in component state
        setMetrics(dashboardMetrics);
        
        // Cache the metrics
        const userRole = roles?.join(',') || 'manager';
        setCachedData(dashboardMetrics, projectId, userRole, organization.id);
        
        // Set default project if not selected and projects are available
        if (!selectedProject && dashboardMetrics.quickStats?.availableProjects?.length > 0) {
          setSelectedProject(dashboardMetrics.quickStats.availableProjects[0].id);
        }
        
        console.log('✅ Manager Dashboard data fetched and cached');
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
        console.log('✅ Ticket status updated successfully');
        
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

  const managedProjects = metrics?.quickStats?.availableProjects || [];
  const currentProject = managedProjects.find((p: any) => p.id === selectedProject);

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

  const teamMembers = [
    { name: 'Alice Johnson', role: 'Frontend Developer', tickets: 5, status: 'Active' },
    { name: 'Bob Smith', role: 'Backend Developer', tickets: 8, status: 'Active' },
    { name: 'Carol Davis', role: 'UI/UX Designer', tickets: 3, status: 'Active' },
    { name: 'David Wilson', role: 'QA Engineer', tickets: 6, status: 'Active' }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Project Selection */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage your assigned projects and team</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Project Selector */}
          <ProjectSelect
            value={selectedProject}
            onValueChange={setSelectedProject}
            placeholder="Select your project"
            includeAllOption={true}
          />
          
          <span className="text-sm text-gray-500 bg-blue-50 px-3 py-1 rounded-full">
            Manager
          </span>
          
          <button 
            onClick={() => setIsUserModalOpen(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Manage Team
          </button>
          
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Create Ticket
          </button>
        </div>
      </div>

      {/* Project Stats */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{currentProject?.name} Overview</h3>
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
                <span className="text-sm text-gray-500">{projectTickets.length} active</span>
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
                        <p className="text-sm text-gray-600">Assigned to {ticket.assignedTo} • {ticket.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        ticket.priority === 'High' ? 'bg-red-100 text-red-800' :
                        ticket.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
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
                        if (pageNum > (metrics.pagination?.totalPages || 0)) return null;
                        
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
                        onClick={() => setCurrentPage(Math.min(metrics.pagination?.totalPages || 1, currentPage + 1))}
                        disabled={!metrics.pagination.hasNextPage}
                        className={`px-2 py-1 text-sm rounded ${
                          metrics.pagination.hasNextPage
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

        {/* Team & Actions */}
        {!showDragDropView && (
          <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            </div>
            <div className="p-6 space-y-3">
              <button className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <span className="font-medium text-gray-900">Create Ticket</span>
                <Ticket className="w-5 h-5 text-gray-400" />
              </button>
              <button 
                onClick={() => setIsUserModalOpen(true)}
                className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-900">Manage Team</span>
                <Users className="w-5 h-5 text-gray-400" />
              </button>
              <button className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <span className="font-medium text-gray-900">Project Analytics</span>
                <BarChart3 className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {teamMembers.map((member, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{member.name}</p>
                        <p className="text-xs text-gray-600">{member.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{member.tickets}</p>
                      <p className="text-xs text-gray-600">tickets</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* User Role Management Modal */}
      <UserRoleModal 
        isOpen={isUserModalOpen} 
        onClose={() => setIsUserModalOpen(false)} 
      />

      {/* Ticket Edit Modal */}
      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={handleTicketModalClose}
        ticketId={selectedTicketId}
        onSuccess={() => {
          // Refresh dashboard data when ticket is updated
          fetchDashboardMetrics(true);
        }}
      />
    </div>
  );
};

export default ManagerDashboard;