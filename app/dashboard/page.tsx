'use client';

import React, { useEffect, useState } from 'react';
import { useAuth, useAuthStore } from '../store/authStore';
import { useSearchParams } from 'next/navigation';
import AdminDashboard from './components/AdminDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import UserDashboard from './components/UserDashboard';
import { Loader2 } from 'lucide-react';
import { AttendanceCheckInOut } from '@/components/AttendanceCheckInOut';

const Dashboard = () => {
  const { user, role, isAuthenticated, token, currentProject, switchProject } = useAuth();
  const { currentDepartment } = useAuthStore();
  const searchParams = useSearchParams();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectRole, setCurrentProjectRole] = useState<string | null>(null);
  const [resolvedRoleName, setResolvedRoleName] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Wait for Zustand to hydrate from localStorage
  useEffect(() => {
    // CHECK WHAT'S IN LOCALSTORAGE IMMEDIATELY
    const rawData = localStorage.getItem('ticketing-metrix-auth');
    console.log('═══════════════════════════════════════════════════');
    console.log('📦 DASHBOARD PAGE LOAD - localStorage RAW DATA:');
    if (rawData) {
      const parsed = JSON.parse(rawData);
      console.log('Department:', parsed.state?.currentDepartment?.name);
      console.log('Role:', parsed.state?.role);
      console.log('Has Token:', !!parsed.state?.token);
      console.log('Token prefix:', parsed.state?.token?.substring(0, 100));
      
      // Decode JWT
      if (parsed.state?.token) {
        try {
          const decoded: any = JSON.parse(atob(parsed.state.token.split('.')[1]));
          console.log('JWT department_id:', decoded.department_id);
          console.log('JWT department_name:', decoded.department_name);
          console.log('JWT department_role:', decoded.department_role);
        } catch (e) {
          console.error('Failed to decode JWT:', e);
        }
      }
    } else {
      console.log('NO DATA IN LOCALSTORAGE!');
    }
    console.log('═══════════════════════════════════════════════════');
    
    setHasHydrated(true);
  }, []);

  // Log token state for debugging
  useEffect(() => {
    if (hasHydrated) {
      console.log('🔐 Dashboard token state:', { 
        hasToken: !!token, 
        tokenLength: token?.length,
        isAuthenticated,
        user: user?.email
      });
    }
  }, [hasHydrated, token, isAuthenticated, user]);

  // Set project context from auth store
  useEffect(() => {
    if (currentProject && token && isAuthenticated) {
      setCurrentProjectId(currentProject.id);
      setCurrentProjectRole(currentProject.role);
      setResolvedRoleName(currentProject.role);
      console.log('✅ Using existing project context:', currentProject);
    }
  }, [currentProject, token, isAuthenticated]);

  // Get project and role from URL parameters
  useEffect(() => {
    const projectId = searchParams.get('project');
    const roleParam = searchParams.get('role');
    
    // Only override if URL params exist and differ from current context
    if (projectId && projectId !== currentProjectId) {
      setCurrentProjectId(projectId);
    }
    if (roleParam && roleParam !== currentProjectRole) {
      setCurrentProjectRole(roleParam);
    }
    
    console.log('🔍 Dashboard URL params:', { projectId, roleParam });
    console.log('🔍 Dashboard URL params types:', { 
      projectIdType: typeof projectId, 
      roleParamType: typeof roleParam,
      roleParamValue: roleParam 
    });

    // If roleParam looks like a UUID (role ID), map to known roles or fetch the role name
    if (roleParam && roleParam.includes('-')) {
      // Temporary role ID mapping until fresh login with role names
      const roleIdMapping: { [key: string]: string } = {
        'dc6d2df6-b334-409d-bd67-9375bbfb10b8': 'Member',  // Based on logs showing Member dashboard
        'de8a62cf-35e2-4c42-819c-12a95887d5b1': 'Manager', // Likely the other role
        // Add more mappings as needed
      };
      
      const mappedRole = roleIdMapping[roleParam];
      if (mappedRole) {
        console.log(`✅ Mapped role ID ${roleParam} to ${mappedRole}`);
        setResolvedRoleName(mappedRole);
      } else {
        console.log(`🔍 Unknown role ID ${roleParam}, attempting to fetch role name`);
        fetchRoleName(roleParam);
      }
    } else {
      setResolvedRoleName(roleParam);
    }
  }, [searchParams, currentProjectId, currentProjectRole]);

  // Show loading while hydrating
  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const fetchRoleName = async (roleId: string) => {
    try {
      const token = useAuthStore.getState().token;
      if (!token) {
        console.error('No token available for role lookup');
        setResolvedRoleName(null);
        return;
      }

      console.log('🔍 Fetching role name for roleId:', roleId);
      
      const response = await fetch(`/api/get-role-name?roleId=${roleId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Role name resolved:', data.roleName);
        setResolvedRoleName(data.roleName);
      } else {
        console.error('❌ Failed to fetch role name, status:', response.status);
        const errorData = await response.json();
        console.error('❌ Error details:', errorData);
        setResolvedRoleName(null);
      }
    } catch (error) {
      console.error('❌ Error fetching role name:', error);
      setResolvedRoleName(null);
    }
  };

  // Debug logging (remove in production)
  console.log('Dashboard - Auth Status:', { 
    isAuthenticated, 
    user: user?.name, 
    role,
    projectId: currentProjectId,
    projectRole: currentProjectRole
  });

  // Development mode bypass
  const isDevelopmentBypass = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';

  // Loading state (bypass in development mode)
  if (!isDevelopmentBypass && (!isAuthenticated || !user)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // Loading state when resolving role name
  if (currentProjectRole && currentProjectRole.includes('-') && !resolvedRoleName) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Resolving user role...</span>
        </div>
      </div>
    );
  }

  // Role-based dashboard rendering
  const renderDashboard = () => {
    // Decode token to get roles
    let projectRole: string | null = null;
    let departmentRole: string | null = null;
    let orgLevelRole: string | null = null;
    
    if (token) {
      try {
        const decoded: any = JSON.parse(atob(token.split('.')[1]));
        projectRole = decoded.project_role; // For within-project permissions (tickets, docs)
        departmentRole = decoded.department_role; // For dashboard/feature access
        orgLevelRole = decoded.org_role; // For dashboard/feature access
        
        console.log('🔍 Decoded JWT Roles:', {
          project_role: projectRole,
          department_role: departmentRole,
          org_role: orgLevelRole,
          project_id: decoded.project_id,
          department_id: decoded.department_id
        });
      } catch (error) {
        console.error('Failed to decode token:', error);
      }
    }
    
    // IMPORTANT: Dashboard selection is based on ORG/DEPT role, NOT project role
    // This determines which features you see (Create Project, Requests, etc.)
    const effectiveRole = departmentRole || orgLevelRole || currentDepartment?.role || role || 'Member';
    const userRole = effectiveRole?.toLowerCase() || '';
    
    console.log('🎯 DASHBOARD: Selecting dashboard based on ORG/DEPT role:', userRole);
    console.log('🔍 DASHBOARD ROLE PRIORITY:');
    console.log('  - departmentRole (from JWT) [SELECTED]:', departmentRole);
    console.log('  - orgLevelRole (from JWT):', orgLevelRole);
    console.log('  - currentDepartment.role:', currentDepartment?.role);
    console.log('  - global role:', role);
    console.log('  - effectiveRole:', effectiveRole);
    console.log('  - userRole (lowercase):', userRole);
    console.log('  NOTE: projectRole is for tickets/docs, not dashboard selection');
    
    try {
      switch (userRole) {
        case 'admin':
        case 'administrator':
          console.log('✅ DASHBOARD: Loading AdminDashboard');
          return <AdminDashboard projectId={currentProjectId} />;
        
        case 'manager':
        case 'project manager':
        case 'team lead':
        case 'technical lead':
          console.log('✅ DASHBOARD: Loading ManagerDashboard');
          return <ManagerDashboard projectId={currentProjectId} />;
        
        case 'user':
        case 'developer':
        case 'employee':
        case 'member':
        default:
          console.log('✅ DASHBOARD: Loading UserDashboard (default)');
          return <UserDashboard projectId={currentProjectId} />;
      }
    } catch (error) {
      console.error('Error rendering dashboard:', error);
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
            <p className="text-gray-600 mb-4">There was an issue loading your dashboard.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
  };

  // Debug role display
  const displayRole = currentProject?.role || resolvedRoleName || currentProjectRole || role;
  console.log('🔍 ROLE DEBUG:', {
    'currentProject?.role': currentProject?.role,
    'resolvedRoleName': resolvedRoleName,
    'currentProjectRole': currentProjectRole,
    'global role': role,
    'displayRole': displayRole,
    'currentProject': currentProject
  });

  return (
    <div>
      {renderDashboard()}
    </div>
  );
};

export default Dashboard;