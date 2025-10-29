'use client';

import React, { useState, useEffect } from 'react';
import { Filter, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from '../../app/store/authStore';

interface Project {
  id: string;
  name: string;
  value: string;
  label: string;
}

interface ProjectSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  includeAllOption?: boolean;
  disabled?: boolean;
  className?: string;
}

export const ProjectSelect: React.FC<ProjectSelectProps> = ({
  value,
  onValueChange,
  placeholder = "Select project",
  includeAllOption = true,
  disabled = false,
  className = ""
}) => {
  const { token, isAuthenticated } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Handle component mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Add a small delay to allow auth store to hydrate
    const timer = setTimeout(() => {
      if (isAuthenticated && token) {
        fetchProjects();
      } else {
        // Try fallback to localStorage as backup
        const fallbackToken = localStorage.getItem('authToken');
        if (fallbackToken) {
          fetchProjectsWithToken(fallbackToken);
        } else {
          setLoading(false);
          setError('Authentication required');
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [token, isAuthenticated, mounted]);

  const fetchProjectsWithToken = async (authToken: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/get-all-projects?format=dropdown', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch projects');
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    if (token) {
      await fetchProjectsWithToken(token);
    } else {
      setError('Authentication required');
      setLoading(false);
    }
  };

  const allProjects = includeAllOption 
    ? [{ id: 'all', name: 'All Projects', value: 'all', label: 'All Projects' }, ...projects]
    : projects;

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Loading projects...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center space-x-2 text-red-500 ${className}`}>
        <Filter className="w-4 h-4" />
        <div className="flex flex-col">
          <span className="text-sm">{error}</span>
          <button 
            onClick={() => {
              setError(null);
              if (token) {
                fetchProjects();
              } else {
                const fallbackToken = localStorage.getItem('authToken');
                if (fallbackToken) {
                  fetchProjectsWithToken(fallbackToken);
                }
              }
            }}
            className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-[200px]">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <SelectValue placeholder={placeholder} />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Projects</SelectLabel>
            {allProjects.map((project) => (
              <SelectItem key={project.id} value={project.value}>
                {project.label}
              </SelectItem>
            ))}
            {allProjects.length === 0 && (
              <SelectItem value="no-projects" disabled>
                No projects found
              </SelectItem>
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export default ProjectSelect;