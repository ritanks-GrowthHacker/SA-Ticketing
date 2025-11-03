'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, Users, FolderOpen, Ticket, TrendingUp, Clock, User, Target, Filter, LayoutGrid, List, AlertCircle } from 'lucide-react';
import { TicketModal } from '../../../components/modals';
import DragDropTicketBoard from '../../../components/ui/DragDropTicketBoard';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore, DashboardMetrics, MetricValue, ActivityItem } from '../../store/dashboardStore';

interface ProjectInfo {
  id: string;
  name: string;
  role?: string;
}

interface UserDashboardProps {
  projectId?: string | null;
}

const UserDashboard = ({ projectId }: UserDashboardProps) => {
  console.log('🎯 USER: UserDashboard component rendered with projectId:', projectId);
  const { token, organization, user, roles, currentProject, switchProject } = useAuthStore();
  
  // Debug auth data availability
  console.log('🚨 MEMBER: Component render - Auth Data Check:');
  console.log('🚨 MEMBER: token:', !!token);
  console.log('🚨 MEMBER: organization:', organization);  
  console.log('🚨 MEMBER: user:', user);
  
  // FORCE CLEAR ALL CACHE ON EVERY RENDER (TEMPORARY DEBUG)
  useEffect(() => {
    console.log('🧹 MEMBER: FORCE CLEARING ALL DASHBOARD CACHE');
    localStorage.removeItem('dashboard-store');
    sessionStorage.removeItem('dashboard-store');
  }, []);
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
  
  const [selectedProject, setSelectedProject] = useState(projectId || currentProject?.id || '');
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>(undefined);

  // Update selectedProject when projectId prop changes
  useEffect(() => {
    if (projectId) {
      setSelectedProject(projectId);
      console.log(`UserDashboard: Project context changed to ${projectId}`);
    } else if (currentProject?.id) {
      setSelectedProject(currentProject.id);
    }
  }, [projectId, currentProject?.id]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false); // Start with false to show UI immediately
  const [dataLoading, setDataLoading] = useState(true); // Separate state for data loading
  const [showDragDropView, setShowDragDropView] = useState(false);
  const [statuses, setStatuses] = useState<Array<{ id: string; name: string; color_code?: string; type: string }>>([]);
  const [availableProjects, setAvailableProjects] = useState<ProjectInfo[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Fetch dashboard metrics with caching
  const fetchDashboardMetrics = async () => {
    console.log('🔄 MEMBER: fetchDashboardMetrics called!');
    console.log('🔄 MEMBER: token exists:', !!token);
    console.log('🔄 MEMBER: organization exists:', !!organization);
    console.log('🔄 MEMBER: organization.id:', organization?.id);
    
    if (!token || !organization?.id) {
      console.log('❌ MEMBER: Missing token or organization - early return!');
      setLoading(false);
      return;
    }

    // TEMPORARY: Force fresh API call every time - bypassing cache completely
    console.log('� MEMBER: FORCING FRESH API CALL - CACHE BYPASSED');

    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (selectedProject) {
        params.append('project_id', selectedProject);
      }
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());
      
      // Use dedicated user-dashboard-metrics API for Member role
      const url = `/api/user-dashboard-metrics?${params.toString()}`;
      console.log('🔄 MEMBER: Fetching from dedicated user dashboard API:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 MEMBER: User dashboard API response:', data);
        
        if (data.success && data.data) {
          setMetrics(data.data);
          
          // Extract available projects for dropdown
          if (data.data.quickStats?.memberInfo?.assignedProjects) {
            setAvailableProjects(data.data.quickStats.memberInfo.assignedProjects);
          }
          
          console.log('✅ MEMBER: Dashboard metrics loaded successfully');
          console.log('✅ MEMBER: Recent activity count:', data.data.recentActivity?.length || 0);
        }
      } else {
        const errorData = await response.json();
        console.error('❌ MEMBER: Failed to fetch tickets:', errorData);
      }
    } catch (error) {
      console.error('❌ MEMBER: Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // SIMPLIFIED: Direct API call without complex caching
  useEffect(() => {
    console.log('🔄 MEMBER: SIMPLIFIED useEffect triggered');
    console.log('🔄 MEMBER: Token available:', !!token);
    
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('⏰ MEMBER: Timeout reached, stopping data loading');
      setDataLoading(false);
    }, 5000);
    
    const loadTickets = async () => {
      if (!token) {
        console.log('⏳ MEMBER: No token yet, waiting...');
        setDataLoading(false); // Stop data loading, show empty state
        return;
      }
      
      clearTimeout(timeout); // Clear timeout if we have token
      setDataLoading(true); // Start loading data
      console.log('🚀 MEMBER: Making API call to user-dashboard-metrics');
      
      // Build query params
      const params = new URLSearchParams();
      if (selectedProject) {
        params.append('project_id', selectedProject);
      }
      params.append('page', '1');
      params.append('limit', '10');
      
      try {
        const response = await fetch(`/api/user-dashboard-metrics?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ MEMBER: Dashboard API response:', data);
          
          if (data.success && data.data) {
            setMetrics(data.data);
            
            // Extract available projects for dropdown
            if (data.data.quickStats?.memberInfo?.assignedProjects) {
              setAvailableProjects(data.data.quickStats.memberInfo.assignedProjects);
            }
            
            setDataLoading(false);
            console.log('✅ MEMBER: Dashboard metrics loaded via useEffect');
          }
        }
      } catch (error) {
        console.error('❌ MEMBER: Error:', error);
        setDataLoading(false);
      }
    };
    
    loadTickets();
    
    // Cleanup function
    return () => {
      clearTimeout(timeout);
    };
  }, [token, selectedProject]);

  // Setup cross-tab synchronization
  useEffect(() => {
    const cleanup = setupCrossTabSync();
    return cleanup;
  }, [setupCrossTabSync]);

  // Refresh when cross-tab updates detected
  useEffect(() => {
    if (lastUpdateTimestamp > 0) {
      console.log('🔄 MEMBER: Cross-tab update detected, refreshing dashboard...');
      fetchDashboardMetrics();
    }
  }, [lastUpdateTimestamp]);

  // Fetch ticket statuses for drag-and-drop board
  const fetchStatuses = async () => {
    try {
      console.log('🔄 MEMBER: Fetching statuses from /api/all-get-entities...');
      const response = await fetch('/api/all-get-entities', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 MEMBER: Statuses data:', data);
        
        if (data.data?.statuses?.ticket) {
          const formattedStatuses = data.data.statuses.ticket.map((status: any) => ({
            id: status.id,
            name: status.name,
            color_code: status.color_code,
            type: 'ticket'
          }));
          setStatuses(formattedStatuses);
          console.log('✅ MEMBER: Statuses loaded:', formattedStatuses.length);
        }
      }
    } catch (error) {
      console.error('❌ MEMBER: Error fetching statuses:', error);
    }
  };

  // Fetch statuses on component mount
  useEffect(() => {
    if (token) {
      fetchStatuses();
    }
  }, [token]);

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
        console.log('✅ MEMBER: Ticket status updated successfully');
        
        // Broadcast update to other tabs
        broadcastUpdate('ticket_updated', { ticketId, newStatusId });
        
        // Refresh dashboard data
        fetchDashboardMetrics();
        return true;
      } else {
        console.error('❌ MEMBER: Error updating ticket status');
        return false;
      }
    } catch (error) {
      console.error('❌ MEMBER: Error updating ticket status:', error);
      return false;
    }
  };

  const handleTicketModalClose = () => {
    setIsTicketModalOpen(false);
    setSelectedTicketId(undefined);
  };

  const handleTicketClick = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setIsTicketModalOpen(true);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Get ticket data from metrics - same as ManagerDashboard
    console.log('🔍 MEMBER: Full metrics state:', metrics);
    console.log('🔍 MEMBER: metrics.recentActivity:', metrics?.recentActivity);
    const memberTickets = metrics?.recentActivity || [];
    console.log('🎯 MEMBER: memberTickets array:', memberTickets, 'Length:', memberTickets.length);

  // Create stats for Member dashboard using new API data
  const stats: Array<{ title: string; value: string | number; change: string; changeType: 'positive' | 'negative' | 'neutral'; icon: any; color: string; bgColor: string }> = [
    {
      title: 'My Assigned Tickets',
      value: metrics?.overview?.myAssignedTickets?.value || 0,
      change: metrics?.overview?.myAssignedTickets?.change || '0',
      changeType: metrics?.overview?.myAssignedTickets?.changeType || 'neutral',
      icon: Ticket,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'My Created Tickets', 
      value: metrics?.overview?.myCreatedTickets?.value || 0,
      change: metrics?.overview?.myCreatedTickets?.change || '0',
      changeType: metrics?.overview?.myCreatedTickets?.changeType || 'neutral',
      icon: Target,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'In Progress',
      value: metrics?.overview?.inProgressTickets?.value || 0,
      change: metrics?.overview?.inProgressTickets?.change || '0',
      changeType: metrics?.overview?.inProgressTickets?.changeType || 'neutral',
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: 'Completed',
      value: metrics?.overview?.completedTickets?.value || 0,
      change: metrics?.overview?.completedTickets?.change || '0',
      changeType: metrics?.overview?.completedTickets?.changeType || 'neutral',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Project Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {user?.name || 'Member'}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Project Filter */}
          {availableProjects.length > 0 && (
            <select
              value={selectedProject}
              onChange={async (e) => {
                const value = e.target.value;
                setSelectedProject(value);
                if (value && token) {
                  try {
                    console.log('🔄 Switching to project:', value);
                    // Call the switch project API
                    const response = await fetch('/api/switch-project', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ projectId: value })
                    });

                    if (response.ok) {
                      const data = await response.json();
                      console.log('✅ Project switch successful:', data);
                      // Update the auth store with the new token and project data
                      switchProject({
                        token: data.token,
                        project: {
                          id: data.project.id,
                          name: data.project.name,
                          role: data.role
                        }
                      });
                    } else {
                      console.error('❌ Failed to switch project');
                      throw new Error('Failed to switch project');
                    }
                  } catch (error) {
                    console.error('❌ Error switching project:', error);
                    // Revert selection on error
                    setSelectedProject(currentProject?.id || '');
                  }
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
          
          <button 
            onClick={() => {
              setSelectedTicketId(undefined);
              setIsTicketModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Ticket
          </button>
        </div>
      </div>

      {/* Stats Grid - Same structure as ManagerDashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`p-3 ${stat.bgColor} rounded-lg`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <span className={`text-sm font-medium ${
                stat.changeType === 'positive' ? 'text-green-600' : 'text-gray-600'
              }`}>
                {stat.change}
              </span>
              <span className="text-sm text-gray-600 ml-1">from last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tickets Section - Same structure as ManagerDashboard */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">My Tickets</h3>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">{memberTickets.length} tickets</span>
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
              tickets={memberTickets}
              statuses={statuses}
              onTicketUpdate={handleTicketStatusUpdate}
              userRole={roles?.[0] || 'Member'}
            />
          ) : (
            <div className="space-y-4">
              {dataLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Loading tickets...</h3>
                  <p className="text-gray-600">Fetching your assigned tickets</p>
                </div>
              ) : memberTickets.length === 0 ? (
                <div className="text-center py-12">
                  <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h3>
                  <p className="text-gray-600">
                    {selectedProject 
                      ? "No tickets found for the selected project." 
                      : "You don't have any tickets yet."
                    }
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {memberTickets.map((ticket: ActivityItem) => (
                    <div 
                      key={ticket.id} 
                      className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleTicketClick(ticket.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium 
                            ${ticket.status === 'Open' ? 'bg-red-100 text-red-800' : 
                              ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 
                              ticket.status === 'Completed' ? 'bg-green-100 text-green-800' : 
                              'bg-gray-100 text-gray-800'
                            }`}>
                            {ticket.status}
                          </span>
                        </div>
                        {ticket.priority && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            ticket.priority === 'High' ? 'bg-red-100 text-red-800' :
                            ticket.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {ticket.priority}
                          </span>
                        )}
                      </div>
                      
                      <h4 className="text-base font-medium text-gray-900 mb-2 line-clamp-2">
                        {ticket.title}
                      </h4>
                      
                      <div className="text-xs text-gray-500 space-y-1">
                        {ticket.project && <div>📁 {ticket.project}</div>}
                        {(ticket as any).creator?.name && (
                          <div>👨‍💻 Created By: {(ticket as any).creator.name}</div>
                        )}
                        {(ticket.assignedTo || (ticket as any).assignee?.name) && (
                          <div>👤 Assigned To: {ticket.assignedTo || (ticket as any).assignee?.name}</div>
                        )}
                        {ticket.time && <div>🕒 {ticket.time}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {metrics?.pagination && metrics.pagination.totalPages > 1 && (
          <div className="p-6 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing page {metrics.pagination.currentPage} of {metrics.pagination.totalPages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!metrics.pagination.hasPreviousPage}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!metrics.pagination.hasNextPage}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Modal */}
      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={handleTicketModalClose}
        ticketId={selectedTicketId}
      />
    </div>
  );
};

export default UserDashboard;