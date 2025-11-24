'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './sidebar';
import Navbar from './navbar';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const pathname = usePathname();

  // Define pages where sidebar and navbar should be visible
  const protectedRoutes = [
    '/dashboard',
    '/projects',
    '/profile',
    '/tickets',
    '/settings',
    '/rbac-test',
    '/manage-access',
    '/create-ticket',
    '/requests',
    '/sales'
  ];

  // Check if current path should show the layout
  const shouldShowLayout = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );

  // If not a protected route, render children without layout
  if (!shouldShowLayout) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col ml-16">
        {/* Navbar */}
        <Navbar />
        
        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;