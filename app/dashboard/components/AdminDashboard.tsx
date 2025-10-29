'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, Users, FolderOpen, Ticket, TrendingUp, Clock, Filter } from 'lucide-react';
import { UserRoleModal, CreateProjectModal } from '../../../components/modals';
import { ProjectSelect } from '../../../components/ui/ProjectSelect';
import { useAuthStore } from '../../store/authStore';

interface MetricValue {
  value: number | string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
}

interface ActivityItem {
  id: any;
  title: string;
  status: string;
  time: string;
  project?: string;
  priority: string;
  assignedTo: string;
}

interface DashboardMetrics {
  overview: Record<string, MetricValue>;
  recentActivity: ActivityItem[];
  chartData: { weekly?: { day: string; tickets: number; }[] };
  quickStats: Record<string, any>;
}

const AdminDashboard = () => {
  const { token } = useAuthStore();
  const [selectedProject, setSelectedProject] = useState('all');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Fetch dashboard metrics
  useEffect(() => {
    fetchDashboardMetrics();
  }, [selectedProject, token]);

  const fetchDashboardMetrics = async () => {
    try {
      setLoading(true);
      if (!token) return;

      // Build URL with project filter if not 'all'
      const url = selectedProject && selectedProject !== 'all' 
        ? `/api/get-dashboard-metrics?project_id=${selectedProject}`
        : '/api/get-dashboard-metrics';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
    } finally {
      setLoading(false);
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
      {/* Header with Project Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Organization overview and management</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Project Filter */}
          <ProjectSelect
            value={selectedProject}
            onValueChange={setSelectedProject}
            placeholder="Select project to filter"
            includeAllOption={true}
          />
          
          <button 
            onClick={() => setIsCreateProjectModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Project
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Export Data
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <stat.icon className="w-6 h-6 text-blue-600" />
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Tickets</h3>
              <span className="text-sm text-gray-500">
                {selectedProject === 'all' ? 'All Projects' : 'Filtered by Project'}
              </span>
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
              <div className="space-y-4">
                {recentTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
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
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        ticket.priority === 'High' ? 'bg-red-100 text-red-800' :
                        ticket.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {ticket.priority}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No recent tickets found</p>
              </div>
            )}
            <button className="w-full mt-4 py-2 text-blue-600 hover:text-blue-800 font-medium text-sm">
              View All Tickets
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-6 space-y-3">
            <button className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
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
      </div>

      {/* User Role Management Modal */}
      <UserRoleModal 
        isOpen={isUserModalOpen} 
        onClose={() => setIsUserModalOpen(false)} 
      />

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        onProjectCreated={(project: any) => {
          console.log('New project created:', project);
          // Optionally refresh dashboard data
          fetchDashboardMetrics();
        }}
      />
    </div>
  );
};

export default AdminDashboard;