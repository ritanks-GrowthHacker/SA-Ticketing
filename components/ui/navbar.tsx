'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut, Settings, User, Building2 } from 'lucide-react';
import { useAuthStore } from '@/app/store/authStore';
import { useRouter } from 'next/navigation';
import { SimpleThemeToggle } from './ThemeToggle';
import NotificationBell from './NotificationBell';

interface NavbarProps {
  className?: string;
}

const Navbar: React.FC<NavbarProps> = ({ className = '' }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDepartmentDropdownOpen, setIsDepartmentDropdownOpen] = useState(false);
  const [userDepartments, setUserDepartments] = useState<any[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [organizationLogo, setOrganizationLogo] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const departmentDropdownRef = useRef<HTMLDivElement>(null);
  const { user, logout, currentDepartment, hasMultipleDepartments, switchDepartment, switchProject, token } = useAuthStore();
  const router = useRouter();

  // Fetch organization logo
  useEffect(() => {
    const fetchOrganizationLogo = async () => {
      if (!token || !user) return;
      
      try {
        const response = await fetch('/api/get-organization-info', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.organization?.logo_url) {
            setOrganizationLogo(data.organization.logo_url);
          }
        }
      } catch (error) {
        console.error('Error fetching organization logo:', error);
      }
    };

    fetchOrganizationLogo();
  }, [token, user]);

  // Fetch user departments when component mounts if user has multiple departments
  useEffect(() => {
    const fetchDepartments = async () => {
      if (!hasMultipleDepartments) return;
      
      setIsLoadingDepartments(true);
      try {
        // Use token from auth store
        const tokenToUse = token;
        const response = await fetch('/api/get-user-departments-projects', {
          headers: {
            Authorization: `Bearer ${tokenToUse}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setUserDepartments(data.departments || []);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
      } finally {
        setIsLoadingDepartments(false);
      }
    };

    fetchDepartments();
  }, [hasMultipleDepartments]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target as Node)) {
        setIsDepartmentDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Generate initials from user name
  const getInitials = (name: string): string => {
    if (!name) return 'U';
    
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
    router.push('/user-login');
  };

  const handleDepartmentSwitch = async (departmentId: string) => {
    setIsDepartmentDropdownOpen(false);
    setIsDropdownOpen(false);
    
    console.log('🔄 NAVBAR: Starting department switch to:', departmentId);
    
    try {
      const tokenToUse = token;
      console.log('🔄 NAVBAR: Current token exists:', !!tokenToUse);
      
      const response = await fetch('/api/switch-department', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenToUse}`,
        },
        body: JSON.stringify({ departmentId }),
      });

      console.log('🔄 NAVBAR: Switch department response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔄 NAVBAR: Switch department response data:', data);
        
        // Update auth store with new department context (store persists token)
        switchDepartment({
          token: data.token,
          department: data.department,
        });
        console.log('✅ NAVBAR: Auth store updated with department:', data.department);

        // If a default project was returned, also update project context
        if (data.project) {
          switchProject({
            token: data.token,
            project: data.project
          });
          console.log('✅ NAVBAR: Auth store updated with project:', data.project);
        }

        console.log('🔄 NAVBAR: Reloading page in 500ms...');
        
        // Small delay to ensure state is persisted
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        const errorText = await response.text();
        console.error('❌ NAVBAR: Failed to switch department. Status:', response.status, 'Error:', errorText);
      }
    } catch (error) {
      console.error('❌ NAVBAR: Error switching department:', error);
    }
  };

  const handleProfileClick = () => {
    setIsDropdownOpen(false);
    router.push('/profile');
  };

  const handleSettingsClick = () => {
    setIsDropdownOpen(false);
    router.push('/settings');
  };

  // Mock user data if no user is available (for development)
  const displayUser = user || {
    name: 'John Doe',
    email: 'john.doe@example.com'
  };

  // Check if user has profile picture URL
  const avatarUrl = (user as any)?.profile_picture_url;

  return (
    <header className={`
      bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between transition-colors
      ${className}
    `}>
      {/* Left side - Organization Logo or empty */}
      <div className="flex-1">
        {organizationLogo ? (
          <img 
            src={organizationLogo} 
            alt="Organization Logo" 
            className="h-10 object-contain"
            onError={() => setOrganizationLogo(null)}
          />
        ) : (
          <div className="h-10"></div>
        )}
      </div>

      {/* Right side - User menu */}
      <div className="flex items-center space-x-4">
        {/* Notification Bell */}
        <NotificationBell />
        
        {/* Theme Toggle */}
        <SimpleThemeToggle />
        
        {/* User Avatar and Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800"
          >
            {/* Avatar */}
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center border border-gray-200">
                  <span className="text-sm font-semibold text-white">
                    {getInitials(displayUser.name)}
                  </span>
                </div>
              )}
              
              {/* Online indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
            </div>

            {/* User info */}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {displayUser.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {displayUser.email}
              </p>
            </div>

            {/* Dropdown arrow */}
            <ChevronDown className={`
              w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200
              ${isDropdownOpen ? 'rotate-180' : 'rotate-0'}
            `} />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
              {/* User info in dropdown (visible on mobile) */}
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 sm:hidden">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {displayUser.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {displayUser.email}
                </p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={handleProfileClick}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <User className="w-4 h-4 mr-3 text-gray-500 dark:text-gray-400" />
                  View Profile
                </button>

                <button
                  onClick={handleSettingsClick}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Settings className="w-4 h-4 mr-3 text-gray-500 dark:text-gray-400" />
                  Settings
                </button>

                {/* Department Switcher - Only show if user has multiple departments */}
                {hasMultipleDepartments && (
                  <>
                    <hr className="my-1 border-gray-100 dark:border-gray-700" />
                    <div className="relative" ref={departmentDropdownRef}>
                      <button
                        onClick={() => setIsDepartmentDropdownOpen(!isDepartmentDropdownOpen)}
                        className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-center">
                          <Building2 className="w-4 h-4 mr-3 text-gray-500 dark:text-gray-400" />
                          <span className="truncate">
                            {currentDepartment?.name || 'Select Department'}
                          </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isDepartmentDropdownOpen ? 'rotate-180' : 'rotate-0'}`} />
                      </button>

                      {/* Department dropdown submenu */}
                      {isDepartmentDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-1 mx-2 bg-white dark:bg-gray-700 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-50 max-h-60 overflow-y-auto">
                          {isLoadingDepartments ? (
                            <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                              Loading departments...
                            </div>
                          ) : userDepartments.length > 0 ? (
                            userDepartments.map((dept) => (
                              <button
                                key={dept.id}
                                onClick={() => handleDepartmentSwitch(dept.id)}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                  currentDepartment?.id === dept.id
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                                }`}
                              >
                                {dept.name}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                              No departments found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <hr className="my-1 border-gray-100 dark:border-gray-700" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-3 text-red-500 dark:text-red-400" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
