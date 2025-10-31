'use client';

import React, { useState, useEffect } from 'react';
import { Plus, FolderOpen, Users, Calendar, MoreVertical, Grid, List, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { useProjectStore, Project, ProjectStatus } from '../store/projectStore';
import ProjectKanban from '../../components/ui/ProjectKanban';
import { CreateProjectModal } from '../../components/modals';

const Projects = () => {
  const router = useRouter();
  const { token, organization, roles } = useAuthStore();
  const { 
    getCachedData, 
    setCachedData, 
    isCacheValid, 
    clearCache,
    isLoading,
    setLoading,
    invalidateCache,
    broadcastUpdate,
    setupCrossTabSync,
    lastUpdateTimestamp,
    updateProjectStatus
  } = useProjectStore();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLocalLoading] = useState(true);
  const [showKanbanView, setShowKanbanView] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  
  // Setup cross-tab synchronization
  useEffect(() => {
    const cleanup = setupCrossTabSync();
    return cleanup;
  }, [setupCrossTabSync]);

  // Refresh when cross-tab updates detected
  useEffect(() => {
    if (lastUpdateTimestamp > 0) {
      console.log('🔄 Cross-tab projects update detected, refreshing...');
      fetchProjects();
    }
  }, [lastUpdateTimestamp]);

  // Fetch projects with caching and auto-fix statuses
  useEffect(() => {
    if (organization?.id && token) {
      const cachedData = getCachedData(organization.id);
      
      if (cachedData && isCacheValid(organization.id)) {
        setProjects(cachedData.projects);
        setStatuses(cachedData.statuses);
        setLocalLoading(false);
        console.log('✅ Projects loaded from cache');
      } else {
        // Fetch fresh data
        fetchProjects();
      }
    }
  }, [organization?.id, token]);

  const fetchProjects = async (forceRefresh = false) => {
    if (!token || !organization?.id) return;
    
    try {
      setLoading(true);
      setLocalLoading(true);
      
      console.log('📡 Fetching projects from API...');
      
      const response = await fetch('/api/get-all-projects?includeStats=true', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        console.log('📦 Raw API response:', data);
        
        const projectsData = data.projects || [];
        const statusesData = data.statuses || [];
        
        console.log('📊 Parsed data:', {
          projects: projectsData,
          statuses: statusesData,
          projectsCount: projectsData.length,
          statusesCount: statusesData.length
        });
        
        setProjects(projectsData);
        setStatuses(statusesData);
        
        // Cache the data
        setCachedData(projectsData, statusesData, organization.id);
        
        console.log('✅ Projects fetched successfully:', {
          projectsCount: projectsData.length,
          statusesCount: statusesData.length
        });

        // Debug data
        if (projectsData.length > 0) {
          console.log('🔍 First project sample:', projectsData[0]);
        }
        if (statusesData.length > 0) {
          console.log('🔍 Statuses sample:', statusesData);
        } else {
          console.log('⚠️ No statuses returned from API');
        }
      } else {
        console.error('❌ Failed to fetch projects:', response.status, response.statusText);
        const errorData = await response.text();
        console.error('Error details:', errorData);
      }
    } catch (error) {
      console.error('❌ Error fetching projects:', error);
    } finally {
      setLoading(false);
      setLocalLoading(false);
    }
  };

  const handleProjectStatusUpdate = async (projectId: string, newStatusId: string): Promise<boolean> => {
    console.log('🔄 Updating project status:', { projectId, newStatusId });

    try {
      const requestBody = {
        project_id: projectId,
        status_id: newStatusId
      };

      const response = await fetch('/api/update-project-status', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ Project status updated successfully:', responseData);
        
        // Update local state immediately (optimistic update)
        setProjects(prevProjects => 
          prevProjects.map(project => 
            project.id === projectId 
              ? { ...project, status_id: newStatusId }
              : project
          )
        );
        
        // Update local store
        updateProjectStatus(projectId, newStatusId);
        
        // Broadcast update to other tabs
        broadcastUpdate('project_status_changed', { projectId, newStatusId });
        
        return true;
      } else {
        const errorData = await response.text();
        console.error('❌ Failed to update project status:', errorData);
        return false;
      }
    } catch (error) {
      console.error('❌ Error updating project status:', error);
      return false;
    }
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  const handleCreateProjectSuccess = () => {
    console.log('✅ Project created successfully');
    // Broadcast update and refresh
    broadcastUpdate('project_created', {});
    fetchProjects(true);
  };



  const getStatusColor = (statusId: string) => {
    const status = statuses.find(s => s.id === statusId);
    return status?.color_code || '#6b7280';
  };

  const getStatusBadgeColor = (statusId: string) => {
    const status = statuses.find(s => s.id === statusId);
    const colorCode = status?.color_code || '#6b7280';
    
    // Map hex colors to Tailwind classes
    const colorMap: { [key: string]: string } = {
      '#ef4444': 'bg-red-100 text-red-800',
      '#f59e0b': 'bg-yellow-100 text-yellow-800',
      '#3b82f6': 'bg-blue-100 text-blue-800',
      '#10b981': 'bg-green-100 text-green-800',
      '#6b7280': 'bg-gray-100 text-gray-800',
      '#8b5cf6': 'bg-purple-100 text-purple-800',
      '#f97316': 'bg-orange-100 text-orange-800'
    };
    
    return colorMap[colorCode] || 'bg-gray-100 text-gray-800';
  };

  const getStatusName = (statusId: string | null) => {
    if (!statusId) return 'No Status';
    const status = statuses.find(s => s.id === statusId);
    return status?.name || 'Unknown Status';
  };

  const initializeProjectStatuses = async () => {
    if (!token) return;
    
    try {
      console.log('🔧 Initializing project statuses...');
      
      const response = await fetch('/api/initialize-project-statuses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      console.log('📋 Initialize statuses response:', data);
      
      if (response.ok && data.success) {
        console.log('✅ Project statuses initialized:', data);
        alert(`✅ Success: ${data.message}`);
        
        // Refresh projects to get the new statuses
        fetchProjects(true);
      } else {
        console.log('ℹ️ Initialize statuses info:', data);
        alert(`ℹ️ ${data.error || data.message}`);
      }
    } catch (error) {
      console.error('❌ Error initializing statuses:', error);
      alert('❌ Error initializing statuses. Check console for details.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading projects...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage and track your ongoing projects</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setShowKanbanView(false)}
              className={`px-3 py-2 rounded-md flex items-center space-x-2 transition-colors ${
                !showKanbanView 
                  ? 'bg-white shadow text-gray-900' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="text-sm">List</span>
            </button>
            <button
              onClick={() => setShowKanbanView(true)}
              className={`px-3 py-2 rounded-md flex items-center space-x-2 transition-colors ${
                showKanbanView 
                  ? 'bg-white shadow text-gray-900' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span className="text-sm">Kanban</span>
            </button>
          </div>
          
          {/* Initialize Statuses Button - Show if no statuses exist */}
          {statuses.length === 0 && (
            <button 
              onClick={initializeProjectStatuses}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              title="Initialize project statuses"
            >
              <span>Setup Statuses</span>
            </button>
          )}
          
          {/* New Project Button */}
          <button 
            onClick={() => setIsCreateProjectModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
            </div>
            <FolderOpen className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        {statuses.slice(0, 3).map((status, index) => {
          const statusProjects = projects.filter(p => p.status_id === status.id);
          const colors = ['text-green-600 bg-green-100', 'text-yellow-600 bg-yellow-100', 'text-purple-600 bg-purple-100'];
          
          return (
            <div key={status.id} className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{status.name}</p>
                  <p className={`text-2xl font-bold ${colors[index]?.split(' ')[0] || 'text-gray-600'}`}>
                    {statusProjects.length}
                  </p>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[index]?.split(' ')[1] || 'bg-gray-100'}`}>
                  <div className={`w-3 h-3 rounded-full ${status.color_code ? `bg-[${status.color_code}]` : 'bg-gray-500'}`}></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Projects Content */}
      {showKanbanView ? (
        /* Kanban View */
        <ProjectKanban
          projects={projects}
          onProjectStatusUpdate={handleProjectStatusUpdate}
          onProjectClick={handleProjectClick}
          loading={loading}
          statuses={statuses}
          className="min-h-96"
        />
      ) : (
        /* List View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          {projects.length > 0 ? (
            projects.map((project) => (
              <div 
                key={project.id} 
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer w-full"
                onClick={() => handleProjectClick(project.id)}
              >
                {/* Project Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3 w-full">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: getStatusColor(project.status_id) }}
                    >
                      <FolderOpen className="w-5 h-5 text-white" />
                    </div>
                    <button 
                      className="p-1 hover:bg-gray-100 rounded shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Add dropdown menu functionality here
                      }}
                      title="More actions"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">{project.name}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{project.description}</p>
                  
                  {/* Status Badge */}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    project.status_id ? getStatusBadgeColor(project.status_id) : 'bg-gray-100 text-gray-800'
                  }`}>
                    {getStatusName(project.status_id)}
                  </span>
                  
                  {/* Ticket Status Breakdown */}
                  {project.stats?.statusBreakdown && Object.keys(project.stats.statusBreakdown).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 w-full">
                      <h4 className="text-xs font-medium text-gray-700 mb-2">Ticket Status</h4>
                      <div className="space-y-1 w-full">
                        {Object.entries(project.stats.statusBreakdown).map(([statusName, count]) => (
                          <div key={statusName} className="flex items-center justify-between text-xs w-full">
                            <div className="flex items-center space-x-2 grow min-w-0">
                              <div className={`w-2 h-2 rounded-full ${
                                statusName.toLowerCase().includes('open') ? 'bg-blue-500' :
                                statusName.toLowerCase().includes('progress') ? 'bg-yellow-500' :
                                statusName.toLowerCase().includes('review') ? 'bg-purple-500' :
                                statusName.toLowerCase().includes('closed') ? 'bg-green-500' :
                                statusName.toLowerCase().includes('done') ? 'bg-green-500' :
                                'bg-gray-400'
                              }`}></div>
                              <span className="text-gray-600 truncate">{statusName}</span>
                            </div>
                            <span className="font-medium text-gray-900">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                {project.progress_percentage !== undefined && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium">{project.progress_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${project.progress_percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Project Footer */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{project.stats?.teamMembers || 0} members</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{new Date(project.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  {project.ticket_count !== undefined && (
                    <div className="flex items-center space-x-1 mt-2">
                      <FolderOpen className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{project.ticket_count} tickets</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <FolderOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
              <p className="text-gray-600 mb-4">Get started by creating your first project.</p>
              <button 
                onClick={() => setIsCreateProjectModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Create Project
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        onProjectCreated={handleCreateProjectSuccess}
      />
    </div>
  );
};

export default Projects;