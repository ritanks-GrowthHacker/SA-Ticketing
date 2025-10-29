import { useAuthStore } from './authStore'

// API utility functions that work with the Zustand store
export class ApiClient {
  private static getAuthHeaders() {
    const token = useAuthStore.getState().token
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  }

  private static async handleResponse(response: Response) {
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid, logout user
        useAuthStore.getState().logout()
        throw new Error('Authentication required')
      }
      const error = await response.json()
      throw new Error(error.error || 'API request failed')
    }
    return response.json()
  }

  // Auth APIs
  static async login(email: string, password: string) {
    const response = await fetch('/api/user-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await this.handleResponse(response)
    
    // Update store with login data
    useAuthStore.getState().login({
      user: data.user,
      organization: data.organization,
      role: data.role,
      roles: data.roles,
      token: data.token,
    })

    return data
  }

  static async register(userData: {
    name: string
    email: string
    password: string
    organization_domain: string
  }) {
    const response = await fetch('/api/register-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    })

    return this.handleResponse(response)
  }

  static async registerOrganization(orgData: {
    name: string
    domain: string
  }) {
    const response = await fetch('/api/register-organisation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orgData),
    })

    return this.handleResponse(response)
  }

  static async getAllOrganizations(search?: string, limit?: number) {
    const url = new URL('/api/all-organisation', window.location.origin)
    
    if (search) {
      url.searchParams.append('search', search)
    }
    if (limit) {
      url.searchParams.append('limit', limit.toString())
    }

    const response = await fetch(url.toString())
    return this.handleResponse(response)
  }

  // Organization data APIs
  static async fetchOrgData(entity?: 'statuses' | 'roles' | 'departments' | 'all') {
    const { setLoadingOrgData, setOrgData } = useAuthStore.getState()
    
    try {
      setLoadingOrgData(true)
      
      const url = entity 
        ? `/api/all-status?entity=${entity}`
        : '/api/all-status'
        
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
      })

      const data = await this.handleResponse(response)
      
      // Update store with organization data
      if (data.data) {
        setOrgData({
          statuses: data.data.statuses?.all || [],
          roles: data.data.roles || [],
          departments: data.data.departments || [],
        })
      }

      return data
    } finally {
      setLoadingOrgData(false)
    }
  }

  static async createStatus(statusData: {
    name: string
    type: 'ticket' | 'priority'
    color_code?: string
    sort_order?: number
  }) {
    const response = await fetch('/api/all-status?entity=status', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(statusData),
    })

    const data = await this.handleResponse(response)
    
    // Refresh org data after creation
    await this.fetchOrgData()
    
    return data
  }

  static async createRole(roleData: {
    name: string
    description?: string
  }) {
    const response = await fetch('/api/all-status?entity=role', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(roleData),
    })

    const data = await this.handleResponse(response)
    
    // Refresh org data after creation
    await this.fetchOrgData()
    
    return data
  }

  static async createDepartment(deptData: {
    name: string
  }) {
    const response = await fetch('/api/all-status?entity=department', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(deptData),
    })

    const data = await this.handleResponse(response)
    
    // Refresh org data after creation
    await this.fetchOrgData()
    
    return data
  }

  // Project APIs
  static async createProject(projectData: {
    name: string
    description?: string
  }) {
    const response = await fetch('/api/create-project', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(projectData),
    })

    return this.handleResponse(response)
  }

  static async getProjects(params?: {
    page?: number
    limit?: number
    search?: string
  }) {
    const url = new URL('/api/create-project', window.location.origin)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value.toString())
        }
      })
    }

    const response = await fetch(url.toString(), {
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse(response)
  }
}

// React hooks for API calls
export const useApiClient = () => {
  const { setLoading } = useAuthStore()

  const withLoading = async <T>(apiCall: () => Promise<T>): Promise<T> => {
    try {
      setLoading(true)
      return await apiCall()
    } finally {
      setLoading(false)
    }
  }

  return {
    login: (email: string, password: string) => 
      withLoading(() => ApiClient.login(email, password)),
    
    register: (userData: Parameters<typeof ApiClient.register>[0]) =>
      withLoading(() => ApiClient.register(userData)),
    
    registerOrganization: (orgData: Parameters<typeof ApiClient.registerOrganization>[0]) =>
      withLoading(() => ApiClient.registerOrganization(orgData)),
    
    fetchOrgData: (entity?: Parameters<typeof ApiClient.fetchOrgData>[0]) =>
      ApiClient.fetchOrgData(entity),
    
    createStatus: (statusData: Parameters<typeof ApiClient.createStatus>[0]) =>
      withLoading(() => ApiClient.createStatus(statusData)),
    
    createRole: (roleData: Parameters<typeof ApiClient.createRole>[0]) =>
      withLoading(() => ApiClient.createRole(roleData)),
    
    createDepartment: (deptData: Parameters<typeof ApiClient.createDepartment>[0]) =>
      withLoading(() => ApiClient.createDepartment(deptData)),
    
    getAllOrganizations: (search?: string, limit?: number) =>
      ApiClient.getAllOrganizations(search, limit),
    
    // Project methods
    createProject: (projectData: Parameters<typeof ApiClient.createProject>[0]) =>
      withLoading(() => ApiClient.createProject(projectData)),
    
    getProjects: (params?: Parameters<typeof ApiClient.getProjects>[0]) =>
      ApiClient.getProjects(params),
  }
}