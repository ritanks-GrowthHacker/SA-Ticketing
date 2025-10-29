'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Organization {
  id: string
  name: string
  domain: string
  created_at: string
}

interface OrganizationSelectorProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function OrganizationSelector({
  value,
  onValueChange,
  placeholder = "Select an organization...",
  className = "",
  disabled = false
}: OrganizationSelectorProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const fetchOrganizations = async (search?: string) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const url = new URL('/api/all-organisation', window.location.origin)
      if (search) {
        url.searchParams.append('search', search)
      }
      url.searchParams.append('limit', '50') // Limit results for performance
      
      const response = await fetch(url.toString())
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch organizations')
      }
      
      setOrganizations(data.data || [])
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching organizations:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const handleSearch = (search: string) => {
    setSearchTerm(search)
    if (search.length >= 2 || search.length === 0) {
      fetchOrganizations(search)
    }
  }

  const selectedOrg = organizations.find(org => org.domain === value)

  return (
    <div className={className}>
      <Select 
        value={value} 
        onValueChange={onValueChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            {selectedOrg ? (
              <div className="flex items-center justify-between w-full">
                <span className="font-medium">{selectedOrg.name}</span>
                <span className="text-sm text-gray-500">{selectedOrg.domain}</span>
              </div>
            ) : (
              placeholder
            )}
          </SelectValue>
        </SelectTrigger>
        
        <SelectContent>
          {/* Search input */}
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Loading...</span>
            </div>
          )}
          
          {/* Error state */}
          {error && (
            <div className="p-4 text-red-600 text-sm">
              Error: {error}
            </div>
          )}
          
          {/* Organizations list */}
          {!isLoading && !error && organizations.length > 0 && (
            <>
              {organizations.map((org) => (
                <SelectItem 
                  key={org.id} 
                  value={org.domain}
                  className="cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{org.name}</span>
                    <span className="text-xs text-gray-500">{org.domain}</span>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
          
          {/* No results */}
          {!isLoading && !error && organizations.length === 0 && (
            <div className="p-4 text-gray-500 text-sm text-center">
              {searchTerm ? 'No organizations found' : 'No organizations available'}
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

// Simple version without search
export function SimpleOrganizationSelector({
  value,
  onValueChange,
  placeholder = "Select organization...",
  className = ""
}: OrganizationSelectorProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchOrgs = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/all-organisation')
        const data = await response.json()
        if (response.ok) {
          setOrganizations(data.data || [])
        }
      } catch (error) {
        console.error('Error fetching organizations:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrgs()
  }, [])

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
      <SelectTrigger className={`w-full ${className}`}>
        <SelectValue placeholder={isLoading ? "Loading..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {organizations.map((org) => (
          <SelectItem key={org.id} value={org.domain}>
            <div className="flex flex-col">
              <span className="font-medium">{org.name}</span>
              <span className="text-xs text-gray-500">{org.domain}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}