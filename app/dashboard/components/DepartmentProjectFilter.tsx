'use client';

import React, { useState, useEffect } from 'react';
import { Building2, FolderOpen } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  color_code?: string;
}

interface Project {
  id: string;
  name: string;
  role: string;
  role_id: string;
  department_id?: string;
  department_name?: string;
}

interface DepartmentProjectFilterProps {
  token: string;
  onProjectChange: (projectId: string, departmentId?: string) => Promise<void>;
  initialProjectId?: string;
}

export const DepartmentProjectFilter: React.FC<DepartmentProjectFilterProps> = ({
  token,
  onProjectChange,
  initialProjectId
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsByDept, setProjectsByDept] = useState<{ [key: string]: Project[] }>({});
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hasMultipleDepartments, setHasMultipleDepartments] = useState(false);

  useEffect(() => {
    fetchDepartmentsAndProjects();
  }, [token]);

  const fetchDepartmentsAndProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/get-user-departments-projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
        setProjects(data.projects || []);
        setProjectsByDept(data.projectsByDepartment || {});
        setHasMultipleDepartments(data.hasMultipleDepartments);

        // Set defaults from the API response or initialProjectId
        if (initialProjectId) {
          const initialProject = data.projects.find((p: Project) => p.id === initialProjectId);
          if (initialProject) {
            setSelectedProject(initialProject.id);
            setSelectedDepartment(initialProject.department_id || '');
            // Ensure parent knows about the initial project so JWT can be built
            onProjectChange(initialProject.id, initialProject.department_id || '');
          }
        } else if (data.defaultProject) {
          setSelectedProject(data.defaultProject.id);
          setSelectedDepartment(data.defaultProject.department_id || '');
          // Auto-select default project for first-login behavior
          onProjectChange(data.defaultProject.id, data.defaultProject.department_id || '');
        }
      }
    } catch (error) {
      console.error('Error fetching departments and projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = (deptId: string) => {
    setSelectedDepartment(deptId);
    
    // Auto-select first project in the new department
    const deptProjects = projectsByDept[deptId] || [];
    if (deptProjects.length > 0) {
      const firstProject = deptProjects[0];
      setSelectedProject(firstProject.id);
      onProjectChange(firstProject.id, deptId);
    } else {
      setSelectedProject('');
    }
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    onProjectChange(projectId, selectedDepartment);
  };

  // Get filtered projects for the selected department
  const filteredProjects = selectedDepartment 
    ? (projectsByDept[selectedDepartment] || [])
    : projects;

  if (loading) {
    return (
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-600">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3">
      {/* Department Filter - Only show if user has multiple departments */}
      {hasMultipleDepartments && (
        <div className="relative">
          <label className="sr-only">Department</label>
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-gray-500" />
            <select
              value={selectedDepartment}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className="pl-2 pr-8 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Project Filter */}
      <div className="relative">
        <label className="sr-only">Project</label>
        <div className="flex items-center space-x-2">
          <FolderOpen className="w-4 h-4 text-gray-500" />
          <select
            value={selectedProject}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="pl-2 pr-8 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[200px]"
            disabled={filteredProjects.length === 0}
          >
            {filteredProjects.length === 0 ? (
              <option value="">No projects available</option>
            ) : (
              filteredProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>
    </div>
  );
};
