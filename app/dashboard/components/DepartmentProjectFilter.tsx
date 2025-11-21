'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/app/store/authStore';
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
  refreshKey?: number; // Add this to trigger refresh when projects are created
}

export const DepartmentProjectFilter: React.FC<DepartmentProjectFilterProps> = ({
  token,
  onProjectChange,
  initialProjectId,
  refreshKey
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsByDept, setProjectsByDept] = useState<{ [key: string]: Project[] }>({});
  const [loading, setLoading] = useState(true);
  const [hasMultipleDepartments, setHasMultipleDepartments] = useState(false);
  
  // Initialize from AuthStore's currentDepartment
  const currentDepartmentFromStore = useAuthStore(state => state.currentDepartment);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(
    currentDepartmentFromStore?.id || ''
  );
  const [selectedProject, setSelectedProject] = useState<string>('');

  // Update selected department when store changes (after reload)
  useEffect(() => {
    if (currentDepartmentFromStore?.id) {
      console.log('🔄 FILTER: Setting department from store:', currentDepartmentFromStore.name);
      setSelectedDepartment(currentDepartmentFromStore.id);
    }
  }, [currentDepartmentFromStore]);

  // Refresh projects when refreshKey changes (e.g., after creating a new project)
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      console.log('🔄 FILTER: Refreshing projects due to refreshKey change:', refreshKey);
      fetchDepartmentsAndProjects();
    }
  }, [refreshKey]);

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

        if (initialProjectId) {
          const initialProject = data.projects.find((p: Project) => p.id === initialProjectId);
          if (initialProject) {
            setSelectedProject(initialProject.id);
            setSelectedDepartment(initialProject.department_id || '');
          }
        }
        // DON'T auto-select default project - let user choose manually
        // This prevents auto-selection after department switch
        // else if (data.defaultProject) {
        //   setSelectedProject(data.defaultProject.id);
        //   setSelectedDepartment(data.defaultProject.department_id || '');
        //   onProjectChange(data.defaultProject.id, data.defaultProject.department_id || '');
        // }
      }
    } catch (error) {
      console.error('Error fetching departments and projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = async (deptId: string) => {
    console.log('═══════════════════════════════════════════════════');
    console.log('🔄 DEPARTMENT FILTER: Department change CLICKED');
    console.log('Selected Department ID:', deptId);
    console.log('═══════════════════════════════════════════════════');
    
    setSelectedDepartment(deptId);
    
    // CLEAR SELECTED PROJECT - Department switch should reset project selection
    setSelectedProject('');
    console.log('🔄 FILTER: Clearing selected project on department change');

    try {
      // Call switch-department API to rebuild JWT with new department context and role
      const tokenFromStore = useAuthStore.getState().token;
      console.log('📤 Calling /api/switch-department with:', {
        departmentId: deptId,
        hasToken: !!tokenFromStore,
        tokenPrefix: tokenFromStore?.substring(0, 50)
      });
      
      const response = await fetch('/api/switch-department', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenFromStore}`,
        },
        body: JSON.stringify({ departmentId: deptId }),
      });

      console.log('� API Response Status:', response.status);
      console.log('📥 API Response OK:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('═══════════════════════════════════════════════════');
        console.log('🔄 DEPARTMENT FILTER: API Response:', data);
        console.log('New Department:', data.department?.name);
        console.log('New Role:', data.department?.role);
        console.log('New Token (first 100 chars):', data.token?.substring(0, 100));
        console.log('═══════════════════════════════════════════════════');

        // FORCE IMMEDIATE WRITE TO LOCALSTORAGE - NO WAITING FOR ZUSTAND PERSIST
        // Get current persisted state
        const currentPersistedData = localStorage.getItem('ticketing-metrix-auth');
        console.log('📦 CURRENT localStorage data:', currentPersistedData ? 'EXISTS' : 'NULL');
        
        const currentState = currentPersistedData ? JSON.parse(currentPersistedData) : { state: {}, version: 0 };
        console.log('📦 CURRENT department in localStorage:', currentState.state?.currentDepartment?.name);
        console.log('📦 CURRENT role in localStorage:', currentState.state?.role);
        
        // Update the persisted state with new token and department
        // IMPORTANT: Clear currentProject when switching departments
        const updatedState = {
          ...currentState,
          state: {
            ...currentState.state,
            token: data.token,
            currentDepartment: data.department,
            role: data.department.role, // Update role from department
            currentProject: null, // Clear project - department switch should reset project context
          }
        };
        
        console.log('💾 WRITING to localStorage with:', {
          department: updatedState.state.currentDepartment?.name,
          role: updatedState.state.role,
          hasToken: !!updatedState.state.token
        });
        
        // IMMEDIATELY write to localStorage BEFORE reload
        localStorage.setItem('ticketing-metrix-auth', JSON.stringify(updatedState));
        
        // Verify the write
        const verifyWrite = localStorage.getItem('ticketing-metrix-auth');
        const verifyParsed = JSON.parse(verifyWrite!);
        console.log('✅ VERIFIED localStorage NOW HAS:', {
          department: verifyParsed.state?.currentDepartment?.name,
          role: verifyParsed.state?.role,
          tokenMatch: verifyParsed.state?.token === data.token
        });
        
        // Also update Zustand store for consistency (but don't rely on its persist)
        const { switchDepartment } = useAuthStore.getState();
        switchDepartment({
          token: data.token,
          department: data.department,
        });

        console.log('═══════════════════════════════════════════════════');
        console.log('🔄 RELOADING PAGE NOW...');
        console.log('═══════════════════════════════════════════════════');
        // Reload immediately - localStorage already updated
        window.location.reload();
      } else {
        console.error('═══════════════════════════════════════════════════');
        console.error('❌ API CALL FAILED - Response not OK');
        console.error('Status:', response.status);
        console.error('Status Text:', response.statusText);
        
        const errorText = await response.text();
        console.error('Error Response Body:', errorText);
        console.error('═══════════════════════════════════════════════════');
      }
    } catch (error) {
      console.error('═══════════════════════════════════════════════════');
      console.error('❌ DEPARTMENT FILTER: EXCEPTION while switching department');
      console.error('Error:', error);
      console.error('═══════════════════════════════════════════════════');
    }
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    onProjectChange(projectId, selectedDepartment);
  };

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
