'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useAuthStore } from '@/app/store/authStore';
import { useRouter } from 'next/navigation';

interface NavbarProps {
  className?: string;
}

const Navbar: React.FC<NavbarProps> = ({ className = '' }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuthStore();
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
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

  // Check if user has avatar URL (extend interface as needed)
  const avatarUrl = (user as any)?.avatarUrl || (user as any)?.avatar_url;

  return (
    <header className={`
      bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between
      ${className}
    `}>
      {/* Left side - can add breadcrumb or page title here */}
      <div className="flex-1">
        <h1 className="text-xl font-semibold text-gray-900">
          SA Ticketing System
        </h1>
      </div>

      {/* Right side - User menu */}
      <div className="flex items-center space-x-4">
        {/* User Avatar and Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
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
              <p className="text-sm font-medium text-gray-900">
                {displayUser.name}
              </p>
              <p className="text-xs text-gray-500">
                {displayUser.email}
              </p>
            </div>

            {/* Dropdown arrow */}
            <ChevronDown className={`
              w-4 h-4 text-gray-500 transition-transform duration-200
              ${isDropdownOpen ? 'rotate-180' : 'rotate-0'}
            `} />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
              {/* User info in dropdown (visible on mobile) */}
              <div className="px-4 py-2 border-b border-gray-100 sm:hidden">
                <p className="text-sm font-medium text-gray-900">
                  {displayUser.name}
                </p>
                <p className="text-xs text-gray-500">
                  {displayUser.email}
                </p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={handleProfileClick}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <User className="w-4 h-4 mr-3 text-gray-500" />
                  View Profile
                </button>

                <button
                  onClick={handleSettingsClick}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-4 h-4 mr-3 text-gray-500" />
                  Settings
                </button>

                <hr className="my-1 border-gray-100" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-3 text-red-500" />
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
