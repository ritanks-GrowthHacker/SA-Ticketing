'use client';

import React from 'react';
import { useAuth } from '../store/authStore';
import AdminDashboard from './components/AdminDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import UserDashboard from './components/UserDashboard';
import { Loader2 } from 'lucide-react';

const Dashboard = () => {
  const { user, role, isAuthenticated } = useAuth();

  // Debug logging (remove in production)
  console.log('Dashboard - Auth Status:', { isAuthenticated, user: user?.name, role });

  // Loading state
  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // Role-based dashboard rendering
  const renderDashboard = () => {
    // Normalize role for comparison (handle case variations)
    const userRole = role?.toLowerCase() || '';
    
    console.log('🎯 DASHBOARD: Rendering dashboard for role:', userRole);
    
    try {
      switch (userRole) {
        case 'admin':
        case 'administrator':
          console.log('✅ DASHBOARD: Loading AdminDashboard');
          return <AdminDashboard />;
        
        case 'manager':
        case 'project manager':
        case 'team lead':
        case 'technical lead':
          console.log('✅ DASHBOARD: Loading ManagerDashboard');
          return <ManagerDashboard />;
        
        case 'user':
        case 'developer':
        case 'employee':
        case 'member':
        default:
          console.log('✅ DASHBOARD: Loading UserDashboard (default)');
          return <UserDashboard />;
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

  return (
    <div>
      {renderDashboard()}
    </div>
  );
};

export default Dashboard;