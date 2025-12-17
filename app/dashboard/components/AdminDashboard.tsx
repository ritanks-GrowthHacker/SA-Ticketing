'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, Users, FolderOpen, Ticket, TrendingUp, Clock, Filter } from 'lucide-react';
import { UserRoleModal, CreateProjectModal, TicketModal } from '../../../components/modals';
import { ProjectSelect } from '../../../components/ui/ProjectSelect';
import DragDropTicketBoard from '../../../components/ui/DragDropTicketBoard';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore, DashboardMetrics, MetricValue, ActivityItem } from '../../store/dashboardStore';
import { useSearchParams, useRouter } from 'next/navigation';
import { DepartmentProjectFilter } from './DepartmentProjectFilter';

interface AdminDashboardProps {
  projectId?: string | null;
}

const AdminDashboard = ({ projectId }: AdminDashboardProps) => {
  console.log('🎯 ADMIN: AdminDashboard component rendered with projectId:', projectId);
  const { token, organization, roles, currentProject, currentDepartment, switchProject } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Get project role from JWT
  const projectRole = currentProject?.role || 'Admin';

  const { 
    getCachedData, 
    setCachedData, 
    isCacheValid, 
    clearCache,
    isLoading: dashboardLoading,
    setLoading: setDashboardLoading,
    invalidateCache,
    broadcastUpdate,
    setupCrossTabSync,
    lastUpdateTimestamp
  } = useDashboardStore();
  
  const [selectedProject, setSelectedProject] = useState(projectId || currentProject?.id || '');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>(undefined);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDragDropView, setShowDragDropView] = useState(false);
  const [statuses, setStatuses] = useState<Array<{ id: string; name: string; color_code?: string; type: string }>>([]);
  const [priorities, setPriorities] = useState<Array<{ id: string; name: string; color_code?: string; type: string }>>([]);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0); // Add refresh key for project filter
  
  // Pagination state with URL persistence
  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get('page');
    return pageParam ? parseInt(pageParam, 10) : 1;
  });
  const [itemsPerPage] = useState(10);
  
  // Add debug state for easy monitoring
  const [debugInfo, setDebugInfo] = useState('Ready to load metrics...');
  
  // Update selectedDepartment when currentDepartment changes
  useEffect(() => {
    if (currentDepartment?.id) {
      setSelectedDepartment(currentDepartment.id);
      console.log('🏢 AdminDashboard: Department context changed to', currentDepartment.name);
    }
  }, [currentDepartment]);
  
  // Fetch dashboard metrics with caching
  useEffect(() => {
    console.log('🔄 ADMIN: useEffect triggered', { selectedProject, selectedStatus, selectedPriority, hasToken: !!token, currentPage, orgId: organization?.id });
    fetchDashboardMetrics();
  }, [selectedProject, selectedStatus, selectedPriority, token, currentPage]);
  
  // Force initial call on mount
  useEffect(() => {
    console.log('🚀 ADMIN: Component mounted, forcing initial metrics fetch');
    setTimeout(() => fetchDashboardMetrics(true), 1000);
  }, []);

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

  // Effect to sync currentPage with URL parameters
  useEffect(() => {
    const pageParam = searchParams.get('page');
    const urlPage = pageParam ? parseInt(pageParam, 10) : 1;
    if (urlPage !== currentPage) {
      setCurrentPage(urlPage);
    }
  }, [searchParams]);

  // Effect to fetch data when currentPage changes
  useEffect(() => {
    if (organization?.id && token && currentPage > 0) {
      console.log('📄 Page changed, fetching data for page:', currentPage);
      fetchDashboardMetrics(true);
    }
  }, [currentPage, organization?.id, token]);

  // Effect to handle cache loading on component mount
  useEffect(() => {
    if (organization?.id && token) {
      const projectId = selectedProject === 'all' ? null : selectedProject;
      const cachedMetrics = getCachedData(projectId, organization.id);
      
      if (cachedMetrics) {
        setMetrics(cachedMetrics);
        setLoading(false);
        console.log('✅ Dashboard data loaded from cache');
      } else {
        // No valid cache, will fetch from API
        fetchDashboardMetrics();
      }
    }
  }, [organization?.id, token]);

  // Update selected project when projectId prop changes
  useEffect(() => {
    if (projectId && projectId !== selectedProject) {
      console.log('🎯 ADMIN: Project context changed, updating filter:', { from: selectedProject, to: projectId });
      setSelectedProject(projectId);
    }
  }, [projectId]);

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

  const handleProjectModalClose = () => {
    setIsCreateProjectModalOpen(false);
    // Refresh dashboard data and project filter after project creation
    fetchDashboardMetrics(true);
    setProjectRefreshKey(prev => prev + 1); // Trigger project filter refresh
  };

  const handleTicketSuccess = () => {
    // Broadcast ticket creation/update to other tabs
    broadcastUpdate('ticket_created', {});
    // Refresh dashboard data
    fetchDashboardMetrics(true);
  };

  const handleRefresh = () => {
    // Force refresh from API
    fetchDashboardMetrics(true);
  };

  // Fetch statuses for drag and drop
  useEffect(() => {
    if (token && showDragDropView) {
      fetchStatuses();
    }
  }, [token, showDragDropView]);

  const fetchStatuses = async () => {
    try {
      console.log('🔄 ADMIN: Fetching statuses from /api/all-get-entities...');
      const response = await fetch('/api/all-get-entities', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📥 ADMIN: Status fetch response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 ADMIN: Full API response:', data);
        
        const ticketStatuses = data.data?.statuses?.ticket || [];
        const ticketPriorities = data.data?.priorities?.ticket || [];
        console.log('📊 ADMIN: Extracted ticket statuses:', ticketStatuses);
        console.log('📊 ADMIN: Extracted ticket priorities:', ticketPriorities);
        
        if (ticketStatuses.length === 0) {
          console.warn('⚠️ ADMIN: No ticket statuses found in API response');
        }
        
        setStatuses(ticketStatuses);
        setPriorities(ticketPriorities);
      } else {
        const errorText = await response.text();
        console.error('❌ ADMIN: Status fetch failed:', {
          status: response.status,
          error: errorText
        });
      }
    } catch (error) {
      console.error('❌ ADMIN: Status fetch exception:', error);
    }
  };

  const fetchDashboardMetrics = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setDashboardLoading(true);
      
      console.log('🔍 ADMIN: fetchDashboardMetrics called', { token: !!token, orgId: organization?.id });
      
      if (!token || !organization?.id) {
        console.log('❌ ADMIN: No token or org, skipping fetch');
        return;
      }

      const projectId = selectedProject === 'all' ? null : selectedProject;
      
      // Check cache first (unless force refresh is requested)
      if (!forceRefresh && organization?.id) {
        const cachedMetrics = getCachedData(projectId, organization.id);
        if (cachedMetrics) {
          setMetrics(cachedMetrics);
          setLoading(false);
          setDashboardLoading(false);
          console.log('✅ Dashboard data loaded from cache');
          return;
        }
      }

      console.log('🔄 Fetching dashboard data from API...');

      // Build URL with filters and pagination
      const params = new URLSearchParams();
      
      console.log('🔧 ADMIN: Building API params with selectedProject:', selectedProject);
      
      if (selectedDepartment) {
        params.set('department_id', selectedDepartment);
        console.log('✅ ADMIN: Added department_id to params:', selectedDepartment);
      }
      
      if (selectedProject && selectedProject !== 'all') {
        params.set('project_id', selectedProject);
        console.log('✅ ADMIN: Added project_id to params:', selectedProject);
      } else {
        console.log('⚠️ ADMIN: No specific project selected, will fetch all department data');
      }
      
      if (selectedStatus && selectedStatus !== 'all') {
        params.set('status_id', selectedStatus);
      }
      if (selectedPriority && selectedPriority !== 'all') {
        params.set('priority_id', selectedPriority);
      }
      params.set('page', currentPage.toString());
      params.set('limit', itemsPerPage.toString());
      

      
      const url = `/api/get-dashboard-metrics?${params.toString()}`;

      const headers: any = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, { headers });
      setDebugInfo(`API call completed: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        const dashboardMetrics = data.data;
        
        console.log('📊 ADMIN: Dashboard data received:', {
          success: data.success,
          hasRecentActivity: !!dashboardMetrics?.recentActivity,
          recentActivityLength: dashboardMetrics?.recentActivity?.length,
          hasPagination: !!dashboardMetrics?.pagination,
          paginationData: dashboardMetrics?.pagination,
          rawData: dashboardMetrics
        });
        
        // Set metrics in component state
        setMetrics(dashboardMetrics);
        
        // Cache the metrics
        const userRole = roles?.join(',') || 'user';
        if (organization?.id) {
          setCachedData(dashboardMetrics, projectId, userRole, organization.id);
        }
        
        console.log('✅ Dashboard data fetched and cached');
        setDebugInfo(`✅ Success! ${dashboardMetrics?.recentActivity?.length || 0} tickets loaded. Pagination: ${JSON.stringify(dashboardMetrics?.pagination)}`);
      }
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
    } finally {
      setLoading(false);
      setDashboardLoading(false);
    }
  };

  // Handle ticket status update from drag and drop
  const handleTicketStatusUpdate = async (ticketId: string, newStatusId: string): Promise<boolean> => {
    console.log('🔄 ADMIN: Starting ticket update:', {
      ticketId,
      newStatusId,
      ticketIdType: typeof ticketId,
      newStatusIdType: typeof newStatusId,
      hasToken: !!token,
      tokenLength: token?.length || 0
    });

    try {
      const requestBody = {
        ticket_id: ticketId,
        status_id: newStatusId
      };

      console.log('📤 ADMIN: Sending request:', {
        url: '/api/update-ticket',
        method: 'PUT',
        body: requestBody
      });

      const response = await fetch('/api/update-ticket', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 ADMIN: API Response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ ADMIN: Update successful:', responseData);
        
        // Broadcast update to other tabs
        broadcastUpdate('ticket_updated', { ticketId, newStatusId });
        
        // Refresh dashboard data after successful update
        fetchDashboardMetrics(true);
        return true;
      } else {
        const errorData = await response.text();
        console.error('❌ ADMIN: API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          requestData: requestBody
        });
        return false;
      }
    } catch (error) {
      console.error('❌ ADMIN: Network/Exception Error:', error);
      return false;
    }
  };

  // Prepare stats from API data
  const stats = metrics ? [
    {
      title: 'Total Tickets',
      value: metrics.overview.totalTickets?.value || 0,
      change: metrics.overview.totalTickets?.change || '0%',
      changeType: metrics.overview.totalTickets?.changeType || 'neutral',
      icon: Ticket
    },
    {
      title: 'Active Projects',
      value: metrics.overview.activeProjects?.value || 0,
      change: metrics.overview.activeProjects?.change || '0%',
      changeType: metrics.overview.activeProjects?.changeType || 'neutral',
      icon: FolderOpen
    },
    {
      title: 'Team Members',
      value: metrics.overview.teamMembers?.value || 0,
      change: metrics.overview.teamMembers?.change || '0%',
      changeType: metrics.overview.teamMembers?.changeType || 'neutral',
      icon: Users
    },
    {
      title: 'Avg Resolution Time',
      value: metrics.overview.avgResolutionTime?.value || '0h',
      change: metrics.overview.avgResolutionTime?.change || '0%',
      changeType: metrics.overview.avgResolutionTime?.changeType || 'neutral',
      icon: Clock
    }
  ] : [];

  const recentTickets = metrics?.recentActivity || [];

  return (
    <div className="space-y-6">
      {/* Header with Department & Project Filter */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
            {currentProject && (
              <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full border border-blue-200 dark:border-blue-700">
                {projectRole}
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {currentProject ? `${currentProject.name} - Department overview and management` : 'Department overview and management'}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Department & Project Filter */}
          {token && (
            <DepartmentProjectFilter
              token={token}
              refreshKey={projectRefreshKey}
              onProjectChange={async (projectId, departmentId) => {
                setSelectedProject(projectId);
                setSelectedDepartment(departmentId || '');
                if (projectId && token) {
                  try {
                    console.log('🔄 Admin switching to project:', projectId, 'in department:', departmentId);
                    // Call the switch project API
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
                      
                      // Refresh dashboard metrics
                      fetchDashboardMetrics();
                    } else {
                      console.error('❌ Failed to switch project');
                    }
                  } catch (error) {
                    console.error('❌ Error switching project:', error);
                  }
                }
              }}
              initialProjectId={selectedProject}
            />
          )}
          
          {/* Refresh Button */}
          <button 
            onClick={handleRefresh}
            disabled={loading || dashboardLoading}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh dashboard data"
          >
            <Filter className={`w-4 h-4 ${(loading || dashboardLoading) ? 'animate-spin' : ''}`} />
          </button>
          
          <button 
            onClick={() => setIsCreateProjectModalOpen(true)}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Create Project
          </button>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Export Data
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{stat.value}</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/50 rounded-lg">
                <stat.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm font-medium text-green-600">{stat.change}</span>
              <span className="text-sm text-gray-600 ml-1">vs last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className={`grid grid-cols-1 gap-6 ${showDragDropView ? 'lg:grid-cols-1' : 'lg:grid-cols-3'}`}>
        {/* Recent Activity */}
        <div className={`${showDragDropView ? 'lg:col-span-1' : 'lg:col-span-2'} bg-white rounded-xl shadow-sm border border-gray-100`}>
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Tickets</h3>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">
                  {selectedProject === 'all' ? 'All Projects' : 'Filtered by Project'}
                </span>
                
                {/* Drag Drop Toggle */}
                <button
                  onClick={() => setShowDragDropView(!showDragDropView)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    showDragDropView 
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={showDragDropView ? 'Switch to list view' : 'Switch to Kanban board'}
                >
                  {showDragDropView ? '📋 List' : '🗂️ Kanban'}
                </button>
                
                {organization?.id && isCacheValid(selectedProject === 'all' ? null : selectedProject, organization.id) && (
                  // small accessible green dot to indicate cached state (no text label)
                  <span
                    className="inline-block w-3 h-3 bg-green-500 rounded-full"
                    title="Cached"
                    role="status"
                    aria-label="Cached data"
                  />
                )}
                {(loading || dashboardLoading) && (
                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                    Loading...
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="space-y-4">
                {[1,2,3,4].map(i => (
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
            ) : recentTickets.length > 0 ? (
              showDragDropView ? (
                <DragDropTicketBoard
                  tickets={recentTickets}
                  onTicketUpdate={handleTicketStatusUpdate}
                  onTicketClick={handleTicketClick}
                  loading={loading}
                  statuses={statuses}
                  compact={true}
                  className="mb-4"
                />
              ) : (
                <div className="space-y-4">
                  {recentTickets.map((ticket) => (
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
                            {ticket.project && `${ticket.project} • `}{ticket.time} • {ticket.assignedTo}
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
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {ticket.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-8">
                <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No recent tickets found</p>
              </div>
            )}
            {!showDragDropView && (recentTickets.length > 0 || metrics?.pagination) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                {/* Pagination Controls */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {(() => {
                      const pagination = metrics?.pagination;
                      const totalItems = pagination?.totalItems || 0;
                      const startItem = totalItems > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0;
                      const endItem = totalItems > 0 ? Math.min(currentPage * itemsPerPage, totalItems) : 0;
                      
                      return `Showing ${startItem} to ${endItem} of ${totalItems} tickets`;
                    })()}
                  </div>
                  
                  {(() => {
                    // Smart pagination controls with fallback
                    const pagination = metrics?.pagination;
                    const hasData = recentTickets.length > 0;
                    const totalPages = pagination?.totalPages || (hasData ? Math.ceil(recentTickets.length / itemsPerPage) : 1);
                    const hasPrev = pagination?.hasPreviousPage ?? (currentPage > 1);
                    const hasNext = pagination?.hasNextPage ?? (recentTickets.length >= itemsPerPage);
                    
                    if (totalPages <= 1 && !hasNext) return null;
                    
                    return (
                    <div className="flex items-center space-x-1">
                      {/* Previous Button */}
                      <button
                        onClick={() => {
                          const prevPage = Math.max(1, currentPage - 1);
                          setCurrentPage(prevPage);
                          const params = new URLSearchParams(searchParams.toString());
                          params.set('page', prevPage.toString());
                          router.push(`/dashboard?${params.toString()}`);
                        }}
                        disabled={!hasPrev}
                        className={`px-2 py-1 text-sm rounded ${
                          hasPrev
                            ? 'text-blue-600 hover:bg-blue-50'
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        ←
                      </button>
                      
                      {/* Page Numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, currentPage - 2) + i;
                        if (pageNum > totalPages) return null;
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => {
                              setCurrentPage(pageNum);
                              const params = new URLSearchParams(searchParams.toString());
                              params.set('page', pageNum.toString());
                              router.push(`/dashboard?${params.toString()}`);
                            }}
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
                        onClick={() => {
                          const nextPage = Math.min(totalPages, currentPage + 1);
                          setCurrentPage(nextPage);
                          const params = new URLSearchParams(searchParams.toString());
                          params.set('page', nextPage.toString());
                          router.push(`/dashboard?${params.toString()}`);
                        }}
                        disabled={!hasNext}
                        className={`px-2 py-1 text-sm rounded ${
                          hasNext
                            ? 'text-blue-600 hover:bg-blue-50'
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        →
                      </button>
                    </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions - Hide in Kanban view */}
        {!showDragDropView && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-fit">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-6 space-y-3">
            <button 
              onClick={() => {
                setSelectedTicketId(undefined); // Create mode
                setIsTicketModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900">Create New Ticket</span>
              <Ticket className="w-5 h-5 text-gray-400" />
            </button>
            <button 
              onClick={() => setIsCreateProjectModalOpen(true)}
              className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900">Start New Project</span>
              <FolderOpen className="w-5 h-5 text-gray-400" />
            </button>
            <button 
              onClick={() => setIsUserModalOpen(true)}
              className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900">Manage Users</span>
              <Users className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <span className="font-medium text-gray-900">View Analytics</span>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          </div>
        )}
      </div>

      {/* User Role Management Modal */}
      <UserRoleModal 
        isOpen={isUserModalOpen} 
        onClose={() => setIsUserModalOpen(false)} 
      />

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={handleProjectModalClose}
        onProjectCreated={(project: any) => {
          console.log('New project created:', project);
          handleProjectModalClose(); // This will refresh the data
        }}
      />

      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={handleTicketModalClose}
        ticketId={selectedTicketId}
        onSuccess={handleTicketSuccess}
        departmentId={selectedDepartment}
      />
    </div>
  );
};

export default AdminDashboard;