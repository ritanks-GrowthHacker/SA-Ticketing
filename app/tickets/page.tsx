'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Filter, MoreVertical, MessageSquare, Clock, AlertCircle, ChevronDown, X, FolderOpen } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status_id: string;
  priority_id: string;
  created_by: string;
  assigned_to: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  projects: { name: string };
  creator: { name: string; email: string };
  assignee: { name: string; email: string } | null;
  statuses: { name: string; color_code: string };
  priorities: { name: string; color_code: string };
}

interface FilterOptions {
  availableProjects: { id: string; name: string }[];
  availableRoles: string[];
}

interface UserAccess {
  role: string;
  canViewAllTickets: boolean;
}

interface TicketsResponse {
  tickets: Ticket[];
  totalCount: number;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filters: FilterOptions;
  userAccess: UserAccess;
}

const Tickets = () => {
  const { token, organization, currentProject } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || 'all');
  const [projectFilter, setProjectFilter] = useState(searchParams.get('project') || 'all');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || 'all');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState<any>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    availableProjects: [],
    availableRoles: []
  });
  const [userAccess, setUserAccess] = useState<UserAccess>({
    role: 'user',
    canViewAllTickets: false
  });

  const [statuses, setStatuses] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch statuses and priorities
  const fetchEntities = async () => {
    try {
      const response = await fetch('/api/all-get-entities', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStatuses(data.data?.statuses?.ticket || []);
        setPriorities(data.data?.priorities?.ticket || []);
      }
    } catch (error) {
      console.error('Error fetching entities:', error);
    }
  };
  // Fetch tickets with search and filters
  const fetchTickets = async () => {
    if (!token || !organization?.id) {
      return;
    }
    
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (projectFilter !== 'all') params.set('project', projectFilter);
      if (roleFilter !== 'all') params.set('role', roleFilter);
      params.set('page', currentPage.toString());
      params.set('limit', '10');
      // Add cache busting parameter for fresh data
      params.set('_t', Date.now().toString());

      const response = await fetch(`/api/search-tickets?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data: TicketsResponse = await response.json();
        setTickets(data.tickets);
        setTotalCount(data.totalCount);
        setPagination(data.pagination);
        setFilterOptions(data.filters);
        setUserAccess(data.userAccess);
      } else {
        console.error('Failed to fetch tickets');
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch tickets with specific page (for pagination)
  const fetchTicketsWithPage = async (page: number) => {
    if (!token || !organization?.id) {
      return;
    }
    
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (projectFilter !== 'all') params.set('project', projectFilter);
      if (roleFilter !== 'all') params.set('role', roleFilter);
      params.set('page', page.toString());
      params.set('limit', '10');
      // Add cache busting parameter for fresh data
      params.set('_t', Date.now().toString());

      const response = await fetch(`/api/search-tickets?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data: TicketsResponse = await response.json();
        setTickets(data.tickets);
        setTotalCount(data.totalCount);
        setPagination(data.pagination);
        setFilterOptions(data.filters);
        setUserAccess(data.userAccess);
      } else {
        console.error('Failed to fetch tickets');
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update URL parameters
  const updateURL = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (projectFilter !== 'all') params.set('project', projectFilter);
    if (roleFilter !== 'all') params.set('role', roleFilter);
    if (currentPage > 1) params.set('page', currentPage.toString());
    
    router.push(`/tickets?${params.toString()}`);
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    
    // Update URL with search query and reset page
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (projectFilter !== 'all') params.set('project', projectFilter);
    if (roleFilter !== 'all') params.set('role', roleFilter);
    // Don't add page=1 to URL
    
    router.push(`/tickets?${params.toString()}`);
    fetchTicketsWithPage(1);
  };

  // Handle filter changes
  const handleFilterChange = (filterType: string, value: string) => {
    setCurrentPage(1);
    
    switch (filterType) {
      case 'status':
        setStatusFilter(value);
        break;
      case 'priority':
        setPriorityFilter(value);
        break;
      case 'project':
        setProjectFilter(value);
        break;
      case 'role':
        setRoleFilter(value);
        break;
    }
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    
    // Update URL with new page
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (projectFilter !== 'all') params.set('project', projectFilter);
    if (roleFilter !== 'all') params.set('role', roleFilter);
    if (page > 1) params.set('page', page.toString());
    
    router.push(`/tickets?${params.toString()}`);
    
    // Fetch tickets with new page
    fetchTicketsWithPage(page);
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setProjectFilter('all');
    setRoleFilter('all');
    setCurrentPage(1);
    router.push('/tickets');
    fetchTickets();
  };

  // Effects
  useEffect(() => {
    if (token && organization?.id) {
      console.log('🔄 Tickets: Refreshing due to auth/project change:', {
        projectName: currentProject?.name,
        projectRole: currentProject?.role
      });
      fetchEntities();
      fetchTickets();
    }
  }, [token || null, organization?.id || null, currentProject?.id || null, currentProject?.role || null]);

  useEffect(() => {
    if (token && organization?.id) {
      fetchTickets();
    }
  }, [statusFilter, priorityFilter, projectFilter, roleFilter]);

  // Auto-refresh for managers to see new tickets immediately
  useEffect(() => {
    if (!currentProject?.role || currentProject.role !== 'Manager') return;
    
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing tickets for Manager...');
      fetchTickets();
    }, 10000); // Refresh every 10 seconds for managers
    
    return () => clearInterval(interval);
  }, [currentProject?.role || null, token || null, organization?.id || null]);

  // Priority color mapping
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Status color mapping  
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'text-blue-600 bg-blue-100';
      case 'in progress': return 'text-yellow-600 bg-yellow-100';
      case 'closed': return 'text-green-600 bg-green-100';
      case 'resolved': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-gray-600 mt-1">
            {userAccess.canViewAllTickets 
              ? 'Manage all tickets across projects' 
              : `Manage tickets for your assigned projects (${userAccess.role})`}
          </p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Create Ticket</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex items-center space-x-4 mb-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tickets by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </form>

        {/* Filter Panel */}
        {showFilters && (
          <div className="border-t border-gray-200 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Priorities</option>
                  {priorities.map((priority) => (
                    <option key={priority.id} value={priority.id}>
                      {priority.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                <select
                  value={projectFilter}
                  onChange={(e) => handleFilterChange('project', e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Projects</option>
                  {filterOptions.availableProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Filter (for users/managers with multiple roles) */}
              {!userAccess.canViewAllTickets && filterOptions.availableRoles.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={roleFilter}
                    onChange={(e) => handleFilterChange('role', e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Roles</option>
                    {filterOptions.availableRoles.map((role) => (
                      <option key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Active Filters & Reset */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || 
                  projectFilter !== 'all' || roleFilter !== 'all') && (
                  <>
                    <span className="text-sm text-gray-600">Active filters:</span>
                    {searchQuery && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        Search: {searchQuery}
                      </span>
                    )}
                    {statusFilter !== 'all' && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        Status: {statuses.find(s => s.id === statusFilter)?.name}
                      </span>
                    )}
                    {priorityFilter !== 'all' && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        Priority: {priorities.find(p => p.id === priorityFilter)?.name}
                      </span>
                    )}
                    {projectFilter !== 'all' && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        Project: {filterOptions.availableProjects.find(p => p.id === projectFilter)?.name}
                      </span>
                    )}
                    {roleFilter !== 'all' && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        Role: {roleFilter}
                      </span>
                    )}
                  </>
                )}
              </div>
              <button
                onClick={resetFilters}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
              >
                <X className="w-4 h-4" />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {loading ? 'Loading...' : `Showing ${totalCount} tickets`}
        </p>
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No tickets found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-hidden">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="p-6 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {ticket.title}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.statuses?.name || 'Unknown')}`}>
                        {ticket.statuses?.name || 'Unknown'}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priorities?.name || 'Unknown')}`}>
                        {ticket.priorities?.name || 'Unknown'}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {ticket.description}
                    </p>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <FolderOpen className="w-4 h-4 mr-1" />
                        {ticket.projects.name}
                      </span>
                      <span className="flex items-center">
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Created by {ticket.creator.name}
                      </span>
                      {ticket.assignee && (
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Assigned to {ticket.assignee.name}
                        </span>
                      )}
                      <span className="flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <button className="ml-4 p-2 hover:bg-gray-100 rounded-lg">
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-6 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, totalCount)} of {totalCount} tickets
              </div>
              
              <div className="flex items-center space-x-1">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={!pagination.hasPreviousPage}
                  className={`px-3 py-1 text-sm rounded ${
                    pagination.hasPreviousPage
                      ? 'text-blue-600 hover:bg-blue-50'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  ←
                </button>
                
                {/* Page Numbers */}
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, currentPage - 2) + i;
                  if (pageNum > pagination.totalPages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1 text-sm rounded ${
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
                  onClick={() => handlePageChange(Math.min(pagination.totalPages, currentPage + 1))}
                  disabled={!pagination.hasNextPage}
                  className={`px-3 py-1 text-sm rounded ${
                    pagination.hasNextPage
                      ? 'text-blue-600 hover:bg-blue-50'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tickets;