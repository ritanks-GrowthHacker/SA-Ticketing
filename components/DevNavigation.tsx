'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DevNavigation = () => {
  const pathname = usePathname();
  
  // Only show in development mode
  if (process.env.NEXT_PUBLIC_BYPASS_AUTH !== 'true') {
    return null;
  }

  const routes = [
    { path: '/', label: 'Home' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/projects', label: 'Projects' },
    { path: '/tickets', label: 'Tickets' },
    { path: '/create-ticket', label: 'Create Ticket' },
    { path: '/profile', label: 'Profile' },
    { path: '/settings', label: 'Settings' },
    { path: '/role-management', label: 'Role Management' },
    { path: '/manage-access', label: 'Manage Access' },
    { path: '/user-login', label: 'User Login' },
    { path: '/org-onboarding', label: 'Org Signup' },
    { path: '/org-login', label: 'Org Login' },
    { path: '/org-signup', label: 'Org Dashboard' },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 shadow-lg max-w-sm">
        <div className="flex items-center mb-2">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          <span className="text-sm font-semibold text-yellow-800">DEV MODE</span>
        </div>
        <div className="text-xs text-yellow-700 mb-3">
          Authentication bypassed - Click any route
        </div>
        <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
          {routes.map((route) => (
            <Link
              key={route.path}
              href={route.path}
              className={`text-xs p-1 rounded transition-colors ${
                pathname === route.path
                  ? 'bg-yellow-400 text-yellow-900 font-medium'
                  : 'text-yellow-800 hover:bg-yellow-200'
              }`}
            >
              {route.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DevNavigation;