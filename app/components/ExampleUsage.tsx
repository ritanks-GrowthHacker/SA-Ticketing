'use client'

import { useAuth, useOrgData, useAuthActions, useAuthStore } from '../store/authStore'
import { useApiClient } from '../store/apiClient'
import { useEffect } from 'react'

export default function ExampleUsage() {
  const { isAuthenticated, user, organization, isAdmin } = useAuth()
  const { statuses, roles, departments, getTicketStatuses, getPriorityStatuses } = useOrgData()
  const { logout } = useAuthActions()
  const { fetchOrgData } = useApiClient()

  // Fetch organization data on component mount if authenticated
  useEffect(() => {
    if (isAuthenticated && statuses.length === 0) {
      fetchOrgData()
    }
  }, [isAuthenticated, statuses.length, fetchOrgData])

  if (!isAuthenticated) {
    return <div>Please log in to access this content.</div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Welcome, {user?.name}!</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded">
            <h3 className="font-semibold text-gray-700">User Info</h3>
            <p>Email: {user?.email}</p>
            <p>Organization: {organization?.name}</p>
            <p>Domain: {organization?.domain}</p>
            <p>Admin Access: {isAdmin() ? 'Yes' : 'No'}</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded">
            <h3 className="font-semibold text-gray-700">Organization Stats</h3>
            <p>Total Statuses: {statuses.length}</p>
            <p>Ticket Statuses: {getTicketStatuses().length}</p>
            <p>Priority Levels: {getPriorityStatuses().length}</p>
            <p>Roles: {roles.length}</p>
            <p>Departments: {departments.length}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>

      {/* Ticket Statuses */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Ticket Statuses</h3>
        <div className="flex flex-wrap gap-2">
          {getTicketStatuses().map((status) => (
            <span
              key={status.id}
              className="px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: status.color_code }}
            >
              {status.name}
            </span>
          ))}
        </div>
      </div>

      {/* Priority Levels */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Priority Levels</h3>
        <div className="flex flex-wrap gap-2">
          {getPriorityStatuses().map((priority) => (
            <span
              key={priority.id}
              className="px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: priority.color_code }}
            >
              {priority.name}
            </span>
          ))}
        </div>
      </div>

      {/* Roles */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Organization Roles</h3>
        <div className="grid gap-2">
          {roles.map((role) => (
            <div key={role.id} className="border border-gray-200 rounded p-3">
              <h4 className="font-medium">{role.name}</h4>
              {role.description && (
                <p className="text-gray-600 text-sm">{role.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Departments */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Departments</h3>
        <div className="grid gap-2">
          {departments.map((dept) => (
            <div key={dept.id} className="border border-gray-200 rounded p-3">
              <h4 className="font-medium">{dept.name}</h4>
              <p className="text-gray-500 text-sm">
                Created: {new Date(dept.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Example login form that uses the store
export function LoginForm() {
  const { login } = useApiClient()
  const isLoading = useAuthStore(state => state.isLoading)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    try {
      await login(
        formData.get('email') as string,
        formData.get('password') as string
      )
    } catch (error) {
      console.error('Login failed:', error)
      // Handle error (show toast, etc.)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 bg-white shadow rounded">
      <h2 className="text-2xl font-bold mb-4">Login</h2>
      
      <div className="mb-4">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div className="mb-6">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}