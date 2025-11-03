import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Types for projects
export interface ProjectStatus {
  id: string;
  name: string;
  description?: string;
  color_code: string;
  sort_order: number;
  is_active: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status_id: string;
  status?: ProjectStatus; // Joined status data
  organization_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Additional fields that might come from API
  ticket_count?: number;
  team_members?: number;
  progress_percentage?: number;
  // Stats object from API
  stats?: {
    totalTickets: number;
    openTickets: number;
    completedTickets: number;
    teamMembers: number;
    managerName?: string;
    completionRate: number;
    statusBreakdown?: { [statusName: string]: number };
  };
}

export interface CachedProjectData {
  projects: Project[];
  statuses: ProjectStatus[];
  organizationId: string;
  timestamp: number;
}

export interface ProjectState {
  // Cache data
  cachedData: CachedProjectData | null;
  
  // Loading states
  isLoading: boolean;
  
  // Cache management
  setCachedData: (projects: Project[], statuses: ProjectStatus[], organizationId: string) => void;
  getCachedData: (organizationId: string) => { projects: Project[], statuses: ProjectStatus[] } | null;
  clearCache: () => void;
  isCacheValid: (organizationId: string, maxAgeMinutes?: number) => boolean;
  setLoading: (loading: boolean) => void;
  
  // Cross-tab synchronization
  lastUpdateTimestamp: number;
  invalidateCache: (reason?: string) => void;
  broadcastUpdate: (type: 'project_created' | 'project_updated' | 'project_status_changed', data?: any) => void;
  setupCrossTabSync: () => () => void; // Returns cleanup function
  
  // Project operations
  updateProjectStatus: (projectId: string, newStatusId: string) => void;
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  removeProject: (projectId: string) => void;
}

// Cache expiry time (30 minutes for projects - they change less frequently)
const DEFAULT_CACHE_EXPIRY_MINUTES = 30;

// Create the Project store with persistence
export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      // Initial state
      cachedData: null,
      isLoading: false,
      lastUpdateTimestamp: 0,

      // Cache management actions
      setCachedData: (projects, statuses, organizationId) => {
        const cachedData: CachedProjectData = {
          projects,
          statuses,
          organizationId,
          timestamp: Date.now(),
        };
        
        set({ cachedData });
      },

      getCachedData: (organizationId) => {
        const state = get();
        
        if (!state.cachedData) {
          return null;
        }

        // Check if cache is for the same organization
        if (state.cachedData.organizationId !== organizationId) {
          return null;
        }

        // Check if cache is still valid (not expired)
        if (!state.isCacheValid(organizationId)) {
          return null;
        }

        return {
          projects: state.cachedData.projects,
          statuses: state.cachedData.statuses
        };
      },

      clearCache: () => {
        set({ cachedData: null });
      },

      isCacheValid: (organizationId, maxAgeMinutes = DEFAULT_CACHE_EXPIRY_MINUTES) => {
        const state = get();
        
        if (!state.cachedData) {
          return false;
        }

        // Check if it's for the same organization
        if (state.cachedData.organizationId !== organizationId) {
          return false;
        }

        // Check if cache hasn't expired
        const now = Date.now();
        const cacheAge = now - state.cachedData.timestamp;
        const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
        
        return cacheAge < maxAge;
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      // Cross-tab synchronization methods
      invalidateCache: (reason = 'manual') => {
        set({ cachedData: null, lastUpdateTimestamp: Date.now() });
        
        // Broadcast to other tabs
        if (typeof window !== 'undefined') {
          localStorage.setItem('projects_invalidate', JSON.stringify({
            timestamp: Date.now(),
            reason,
          }));
        }
      },

      broadcastUpdate: (type, data) => {
        const updateData = {
          type,
          data,
          timestamp: Date.now(),
        };
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('projects_update', JSON.stringify(updateData));
          // Remove immediately to trigger event in other tabs
          localStorage.removeItem('projects_update');
        }
        
        // Update local timestamp
        set({ lastUpdateTimestamp: Date.now() });
      },

      setupCrossTabSync: () => {
        if (typeof window === 'undefined') return () => {};
        
        const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'projects_invalidate' && e.newValue) {
            const invalidateData = JSON.parse(e.newValue);
            console.log('🔄 Cross-tab projects cache invalidation:', invalidateData.reason);
            set({ cachedData: null, lastUpdateTimestamp: invalidateData.timestamp });
          }
          
          if (e.key === 'projects_update' && e.newValue) {
            const updateData = JSON.parse(e.newValue);
            console.log('🔄 Cross-tab projects update received:', updateData.type);
            
            // Invalidate cache to force refresh
            set({ cachedData: null, lastUpdateTimestamp: updateData.timestamp });
          }
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        // Return cleanup function
        return () => {
          window.removeEventListener('storage', handleStorageChange);
        };
      },

      // Project operations
      updateProjectStatus: (projectId, newStatusId) => {
        const state = get();
        if (!state.cachedData) return;
        
        const updatedProjects = state.cachedData.projects.map(project => 
          project.id === projectId 
            ? { ...project, status_id: newStatusId }
            : project
        );
        
        set({
          cachedData: {
            ...state.cachedData,
            projects: updatedProjects,
            timestamp: Date.now()
          }
        });
      },

      addProject: (project) => {
        const state = get();
        if (!state.cachedData) return;
        
        set({
          cachedData: {
            ...state.cachedData,
            projects: [...state.cachedData.projects, project],
            timestamp: Date.now()
          }
        });
      },

      updateProject: (projectId, updates) => {
        const state = get();
        if (!state.cachedData) return;
        
        const updatedProjects = state.cachedData.projects.map(project => 
          project.id === projectId 
            ? { ...project, ...updates }
            : project
        );
        
        set({
          cachedData: {
            ...state.cachedData,
            projects: updatedProjects,
            timestamp: Date.now()
          }
        });
      },

      removeProject: (projectId) => {
        const state = get();
        if (!state.cachedData) return;
        
        const filteredProjects = state.cachedData.projects.filter(project => project.id !== projectId);
        
        set({
          cachedData: {
            ...state.cachedData,
            projects: filteredProjects,
            timestamp: Date.now()
          }
        });
      },
    }),
    {
      name: 'project-storage', // unique name for localStorage key
      storage: createJSONStorage(() => localStorage),
      // Only persist the cached data and timestamp, not loading states
      partialize: (state) => ({ 
        cachedData: state.cachedData,
        lastUpdateTimestamp: state.lastUpdateTimestamp
      }),
    }
  )
);