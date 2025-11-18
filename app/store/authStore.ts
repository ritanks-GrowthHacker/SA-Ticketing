import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Types for our store
export interface User {
  id: string
  name: string
  email: string
  created_at: string
  profile_picture_url?: string
  about?: string
  phone?: string
  location?: string
  job_title?: string
  department?: string
}

export interface Organization {
  id: string
  name: string
  domain: string
}

export interface Role {
  id: string
  name: string
  description?: string
}

export interface Status {
  id: string
  name: string
  type: 'ticket' | 'priority'
  color_code: string
  sort_order: number
  is_active: boolean
}

export interface Department {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface AuthState {
  // Authentication
  isAuthenticated: boolean
  token: string | null
  user: User | null
  organization: Organization | null
  role: string | null
  roles: string[]
  
  // Project Context (for project switching)
  currentProject: {
    id: string
    name: string
    role: string
  } | null
  
  // Organization Data
  statuses: Status[]
  roles_list: Role[]
  departments: Department[]
  
  // Loading states
  isLoading: boolean
  isLoadingOrgData: boolean
  
  // Actions
  login: (loginData: {
    user: User
    organization: Organization
    role: string
    roles: string[]
    token: string
    currentProject?: {
      id: string
      name: string
      role?: string
    } | null
  }) => void
  logout: () => void
  switchProject: (projectData: {
    token: string
    project: {
      id: string
      name: string
      role: string
    }
  }) => void
  setOrgData: (data: {
    statuses?: Status[]
    roles?: Role[]
    departments?: Department[]
  }) => void
  updateUser: (user: Partial<User>) => void
  setLoading: (loading: boolean) => void
  setLoadingOrgData: (loading: boolean) => void
  
  // Getters
  getTicketStatuses: () => Status[]
  getPriorityStatuses: () => Status[]
  hasRole: (roleName: string) => boolean
  isAdmin: () => boolean
}

// Development mode bypass helper
const isDevelopmentBypass = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';

// Default dev user for bypass mode
const getDefaultDevUser = (): User => ({
  id: 'dev-user-id',
  name: 'Developer',
  email: 'dev@example.com',
  created_at: new Date().toISOString(),
  profile_picture_url: undefined,
  about: 'Development Mode User',
  phone: undefined,
  location: undefined,
  job_title: 'Developer',
  department: undefined
});

// Default dev organization for bypass mode
const getDefaultDevOrganization = (): Organization => ({
  id: 'dev-org-id',
  name: 'Development Organization',
  domain: 'dev.local'
});

// Create the Zustand store with persistence
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state - with dev mode bypass
      isAuthenticated: isDevelopmentBypass,
      token: isDevelopmentBypass ? 'dev-token-123' : null,
      user: isDevelopmentBypass ? getDefaultDevUser() : null,
      organization: isDevelopmentBypass ? getDefaultDevOrganization() : null,
      role: isDevelopmentBypass ? 'Admin' : null,
      roles: isDevelopmentBypass ? ['Admin'] : [],
      currentProject: null,
      statuses: [],
      roles_list: [],
      departments: [],
      isLoading: false,
      isLoadingOrgData: false,

      // Actions
      login: (loginData) => {
        set({
          isAuthenticated: true,
          token: loginData.token,
          user: loginData.user,
          organization: loginData.organization,
          role: loginData.role,
          roles: loginData.roles || [],
          currentProject: loginData.currentProject 
            ? {
                id: loginData.currentProject.id,
                name: loginData.currentProject.name,
                role: loginData.currentProject.role || loginData.role
              }
            : null, // Set default project from login
        })
      },

      logout: () => {
        // Clear dashboard cache on logout
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('dashboard-storage');
          } catch (error) {
            console.warn('Failed to clear dashboard cache:', error);
          }
        }
        
        set({
          isAuthenticated: false,
          token: null,
          user: null,
          organization: null,
          role: null,
          roles: [],
          currentProject: null,
          statuses: [],
          roles_list: [],
          departments: [],
        })
      },

      switchProject: (projectData) => {
        const currentState = get();
        
        console.log('🔄 Switching project in store:', {
          from: currentState.currentProject?.name || 'none',
          to: projectData.project.name,
          newRole: projectData.project.role
        });

        // Clear dashboard cache when switching projects
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('dashboard-storage');
            console.log('🗑️ Cleared dashboard cache for project switch');
          } catch (error) {
            console.warn('Failed to clear dashboard cache:', error);
          }
        }
        
        // Update state with new project context and token
        set({
          token: projectData.token,
          role: projectData.project.role, // Update current role to project role
          currentProject: projectData.project,
        });

        console.log('✅ Project switched successfully in store');
      },

      setOrgData: (data) => {
        set((state) => ({
          ...state,
          ...(data.statuses && { statuses: data.statuses }),
          ...(data.roles && { roles_list: data.roles }),
          ...(data.departments && { departments: data.departments }),
        }))
      },

      updateUser: (userData) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        }))
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setLoadingOrgData: (loading) => {
        set({ isLoadingOrgData: loading })
      },

      // Getters
      getTicketStatuses: () => {
        return get().statuses.filter(status => status.type === 'ticket')
      },

      getPriorityStatuses: () => {
        return get().statuses.filter(status => status.type === 'priority')
      },

      hasRole: (roleName) => {
        const state = get();
        // Check both global roles array and current project role
        return state.roles.includes(roleName) || 
               state.role === roleName ||
               (state.currentProject?.role === roleName);
      },

      isAdmin: () => {
        const state = get()
        return state.role === 'Admin' || state.roles.includes('Admin')
      },
    }),
    {
      name: 'ticketing-metrix-auth', // Storage key
      storage: createJSONStorage(() => localStorage),
      
      // Only persist certain fields (exclude loading states)
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        token: state.token,
        user: state.user,
        organization: state.organization,
        role: state.role,
        roles: state.roles,
        currentProject: state.currentProject,
        statuses: state.statuses,
        roles_list: state.roles_list,
        departments: state.departments,
      }),
      
      // Version for migration support
      version: 1,
      
      // Migrate function for handling version changes
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Migration logic for version 0 to 1
          return {
            ...persistedState,
            roles_list: persistedState.roles_list || [],
            departments: persistedState.departments || [],
          }
        }
        return persistedState
      },
    }
  )
)

// Helper hooks for commonly used selectors
export const useAuth = () => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const user = useAuthStore(state => state.user)
  const organization = useAuthStore(state => state.organization)
  const role = useAuthStore(state => state.role)
  const roles = useAuthStore(state => state.roles)
  const token = useAuthStore(state => state.token)
  const currentProject = useAuthStore(state => state.currentProject)
  const switchProject = useAuthStore(state => state.switchProject)
  const isAdmin = useAuthStore(state => state.isAdmin)
  const hasRole = useAuthStore(state => state.hasRole)

  return {
    isAuthenticated,
    user,
    organization,
    role,
    roles,
    token,
    currentProject,
    switchProject,
    isAdmin,
    hasRole,
  }
}

export const useOrgData = () => {
  const statuses = useAuthStore(state => state.statuses)
  const roles = useAuthStore(state => state.roles_list)
  const departments = useAuthStore(state => state.departments)
  const getTicketStatuses = useAuthStore(state => state.getTicketStatuses)
  const getPriorityStatuses = useAuthStore(state => state.getPriorityStatuses)
  const isLoadingOrgData = useAuthStore(state => state.isLoadingOrgData)

  return {
    statuses,
    roles,
    departments,
    getTicketStatuses,
    getPriorityStatuses,
    isLoadingOrgData,
  }
}

export const useAuthActions = () => {
  const login = useAuthStore(state => state.login)
  const logout = useAuthStore(state => state.logout)
  const switchProject = useAuthStore(state => state.switchProject)
  const setOrgData = useAuthStore(state => state.setOrgData)
  const updateUser = useAuthStore(state => state.updateUser)
  const setLoading = useAuthStore(state => state.setLoading)
  const setLoadingOrgData = useAuthStore(state => state.setLoadingOrgData)

  return {
    login,
    logout,
    switchProject,
    setOrgData,
    updateUser,
    setLoading,
    setLoadingOrgData,
  }
}