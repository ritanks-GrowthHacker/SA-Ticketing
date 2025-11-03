import { useState, useCallback, useEffect } from 'react';
import { useAuth, useAuthActions } from '../store/authStore';
import { useApiClient } from '../store/apiClient';

interface UserProject {
  project_id: string;
  role_id: string;
  projects: {
    id: string;
    name: string;
  };
  global_roles: {
    id: string;
    name: string;
  };
}

interface ProjectSwitchOption {
  projectId: string;
  projectName: string;
  role: string;
  roleId: string;
}

export const useProjectSwitch = () => {
  const [availableProjects, setAvailableProjects] = useState<ProjectSwitchOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shouldShowSwitcher, setShouldShowSwitcher] = useState(false);
  
  const { currentProject, isAuthenticated } = useAuth();
  const { switchProject } = useAuthActions();
  const { fetchWithAuth } = useApiClient();

  // Initialize on mount and fetch project availability
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const checkProjectAvailability = async () => {
      try {
        setIsLoading(true);
        console.log('🔍 Checking project availability for switching...');
        
        // Get user's project assignments
        const response = await fetchWithAuth('/api/get-all-projects?format=user-projects');
        
        if (response.success && response.projects) {
          const userProjects: UserProject[] = response.projects;
          
          // Convert to switch options
          const projectOptions: ProjectSwitchOption[] = userProjects.map(up => ({
            projectId: up.project_id,
            projectName: up.projects.name,
            role: up.global_roles.name,
            roleId: up.role_id,
          }));

          setAvailableProjects(projectOptions);
          
          // Determine if switcher should be shown
          // Show if user has multiple projects AND they have different roles
          const uniqueRoles = new Set(projectOptions.map(p => p.role));
          const hasMultipleProjects = projectOptions.length > 1;
          const hasDifferentRoles = uniqueRoles.size > 1;
          
          const showSwitcher = hasMultipleProjects && hasDifferentRoles;
          setShouldShowSwitcher(showSwitcher);
          
          console.log('📊 Project switching analysis:', {
            totalProjects: projectOptions.length,
            uniqueRoles: Array.from(uniqueRoles),
            hasMultipleProjects,
            hasDifferentRoles,
            shouldShowSwitcher: showSwitcher,
            projects: projectOptions.map(p => `${p.projectName} (${p.role})`)
          });
          
        } else {
          console.log('❌ Failed to fetch user projects');
          setAvailableProjects([]);
          setShouldShowSwitcher(false);
        }
      } catch (error) {
        console.error('❌ Error checking project availability:', error);
        setAvailableProjects([]);
        setShouldShowSwitcher(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkProjectAvailability();
  }, [isAuthenticated]); // REMOVED fetchWithAuth to prevent infinite loop

  // Switch to a different project
  const switchToProject = useCallback(async (projectId: string) => {
    try {
      setIsLoading(true);
      console.log('🔄 Switching to project:', projectId);
      
      const response = await fetchWithAuth('/api/switch-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ project_id: projectId }),
      });

      if (response.success) {
        // Update auth store with new token and project info
        switchProject({
          token: response.token,
          project: response.project,
        });
        
        console.log('✅ Successfully switched to project:', response.project.name);
        return { success: true, message: response.message };
      } else {
        console.error('❌ Project switch failed:', response.error);
        return { success: false, error: response.error || 'Failed to switch project' };
      }
    } catch (error) {
      console.error('❌ Error during project switch:', error);
      return { success: false, error: 'Network error during project switch' };
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, switchProject]);

  // Manual refresh method
  const refreshProjectAvailability = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoading(true);
      const response = await fetchWithAuth('/api/get-all-projects?format=user-projects');
      
      if (response.success && response.projects) {
        const userProjects: UserProject[] = response.projects;
        const projectOptions: ProjectSwitchOption[] = userProjects.map(up => ({
          projectId: up.project_id,
          projectName: up.projects.name,
          role: up.global_roles.name,
          roleId: up.role_id,
        }));

        setAvailableProjects(projectOptions);
        
        const uniqueRoles = new Set(projectOptions.map(p => p.role));
        const showSwitcher = projectOptions.length > 1 && uniqueRoles.size > 1;
        setShouldShowSwitcher(showSwitcher);
      }
    } catch (error) {
      console.error('❌ Error refreshing project availability:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]); // REMOVED fetchWithAuth to prevent infinite loop

  // Get current project info
  const getCurrentProjectInfo = useCallback(() => {
    return currentProject;
  }, [currentProject]);

  // Check if user can switch to a specific project
  const canSwitchToProject = useCallback((projectId: string) => {
    return availableProjects.some(p => p.projectId === projectId);
  }, [availableProjects]);

  return {
    // State
    availableProjects,
    currentProject: getCurrentProjectInfo(),
    shouldShowSwitcher,
    isLoading,
    
    // Actions
    switchToProject,
    refreshProjectAvailability,
    canSwitchToProject,
    
    // Computed
    hasMultipleProjects: availableProjects.length > 1,
    currentProjectName: currentProject?.name || null,
    currentProjectRole: currentProject?.role || null,
  };
};