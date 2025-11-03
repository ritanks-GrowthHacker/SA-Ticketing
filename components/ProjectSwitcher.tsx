'use client'

import React, { useState } from 'react'
import { useProjectSwitch } from '../app/hooks/useProjectSwitch'

interface ProjectSwitcherProps {
  className?: string
  compact?: boolean
}

interface ProjectOption {
  projectId: string
  projectName: string
  role: string
  roleId: string
}

export default function ProjectSwitcher({ className = '', compact = false }: ProjectSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [switchingToProject, setSwitchingToProject] = useState<string | null>(null)
  
  const {
    availableProjects,
    currentProject,
    shouldShowSwitcher,
    isLoading,
    switchToProject,
  } = useProjectSwitch()

  // Don't render if user doesn't have multiple projects with different roles
  if (!shouldShowSwitcher) {
    return null
  }

  const handleProjectSwitch = async (projectId: string) => {
    if (projectId === currentProject?.id) {
      setIsOpen(false)
      return
    }

    setSwitchingToProject(projectId)
    
    try {
      const result = await switchToProject(projectId)
      if (result.success) {
        setIsOpen(false)
        // Optional: Show success toast
        console.log('✅ Project switched successfully')
      } else {
        console.error('❌ Failed to switch project:', result.error)
        // Optional: Show error toast
      }
    } catch (error) {
      console.error('❌ Error switching project:', error)
    } finally {
      setSwitchingToProject(null)
    }
  }

  if (isLoading && availableProjects.length === 0) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className={`bg-gray-200 rounded ${compact ? 'h-8 w-32' : 'h-10 w-40'}`}></div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between w-full px-3 py-2 
          text-sm font-medium text-gray-700 bg-white border border-gray-300 
          rounded-md shadow-sm hover:bg-gray-50 focus:outline-none 
          focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          ${compact ? 'text-xs px-2 py-1' : ''}
        `}
        disabled={isLoading}
      >
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 bg-blue-500 rounded-full ${compact ? 'w-1.5 h-1.5' : ''}`}></div>
          <span className="truncate max-w-32">
            {currentProject?.name || 'Select Project'}
          </span>
          {currentProject && (
            <span className={`text-xs text-gray-500 ${compact ? 'hidden' : ''}`}>
              ({currentProject.role})
            </span>
          )}
        </div>
        <svg 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${compact ? 'w-3 h-3' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          ></div>
          
          {/* Dropdown */}
          <div className="absolute right-0 z-20 w-64 mt-2 bg-white border border-gray-200 rounded-md shadow-lg">
            <div className="py-1">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">
                Switch Project
              </div>
              
              {availableProjects.map((project: ProjectOption) => {
                const isCurrentProject = project.projectId === currentProject?.id
                const isSwitching = switchingToProject === project.projectId
                
                return (
                  <button
                    key={project.projectId}
                    onClick={() => handleProjectSwitch(project.projectId)}
                    disabled={isSwitching || isCurrentProject}
                    className={`
                      w-full px-3 py-2 text-left text-sm hover:bg-gray-50 
                      focus:outline-none focus:bg-gray-50 flex items-center justify-between
                      ${isCurrentProject ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                      ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium truncate">
                        {project.projectName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {project.role}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {isSwitching && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {isCurrentProject && (
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            
            <div className="px-3 py-2 text-xs text-gray-500 border-t bg-gray-50">
              💡 Switching will update your role and permissions
            </div>
          </div>
        </>
      )}
    </div>
  )
}