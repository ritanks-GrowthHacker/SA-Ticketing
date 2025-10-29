'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, Users, FolderOpen, Ticket, TrendingUp, Clock, User, Target } from 'lucide-react';
import { UserRoleModal } from '../../../components/modals';
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

const ManagerDashboard = () => {
  const { token } = useAuthStore();
  const [selectedProject, setSelectedProject] = useState('all');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
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
        
        // Set default project if not selected and projects are available
        if (!selectedProject && data.data.quickStats?.availableProjects?.length > 0) {
          setSelectedProject(data.data.quickStats.availableProjects[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
    } finally {
      setLoading(false);
    }
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Tickets */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Project Tickets</h3>
              <span className="text-sm text-gray-500">{projectTickets.length} active</span>
            </div>
          </div>
          <div className="p-6">
            {loading ? (
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
                  <div key={ticket.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-mono text-sm text-blue-600 font-medium">#{ticket.id}</span>
                          <span className={`w-2 h-2 rounded-full ${
                            ticket.priority === 'High' ? 'bg-red-500' :
                            ticket.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}></span>
                        </div>
                        <h4 className="font-medium text-gray-900">{ticket.title}</h4>
                        <p className="text-sm text-gray-600">Assigned to {ticket.assignedTo} • {ticket.time}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      ticket.status.toLowerCase().includes('open') ? 'bg-red-100 text-red-800' :
                      ticket.status.toLowerCase().includes('progress') ? 'bg-blue-100 text-blue-800' :
                      ticket.status.toLowerCase().includes('review') ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {ticket.status}
                    </span>
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
            <button className="w-full mt-4 py-2 text-blue-600 hover:text-blue-800 font-medium text-sm">
              View All Project Tickets
            </button>
          </div>
        </div>

        {/* Team & Actions */}
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
      </div>

      {/* User Role Management Modal */}
      <UserRoleModal 
        isOpen={isUserModalOpen} 
        onClose={() => setIsUserModalOpen(false)} 
      />
    </div>
  );
};

export default ManagerDashboard;