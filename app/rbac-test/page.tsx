'use client';

import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { normalizeRole, getRolePermissions, hasPermission } from '@/lib/rbac';

const RoleTestPage = () => {
  const { user, role, login } = useAuthStore();
  const [selectedRole, setSelectedRole] = useState('user');

  const testRoles = [
    { value: 'admin', label: 'Administrator' },
    { value: 'manager', label: 'Project Manager' },
    { value: 'user', label: 'Normal User' },
    { value: 'developer', label: 'Developer' },
    { value: 'employee', label: 'Employee' }
  ];

  const simulateLogin = (testRole: string) => {
    // Simulate login with different roles for testing
    const mockUser = {
      id: 'test-user-id',
      name: `Test ${testRole.charAt(0).toUpperCase() + testRole.slice(1)}`,
      email: `test.${testRole}@company.com`,
      created_at: new Date().toISOString()
    };

    const mockLoginData = {
      user: mockUser,
      role: testRole,
      organization: {
        id: 'test-org',
        name: 'Test Organization',
        domain: 'testorg'
      },
      token: 'mock-jwt-token',
      roles: [testRole],
      statuses: [],
      roles_list: [],
      departments: []
    };

    login(mockLoginData);
  };

  const currentPermissions = role ? getRolePermissions(role) : null;
  const normalizedRole = role ? normalizeRole(role) : 'user';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">RBAC Testing Dashboard</h1>
        <p className="text-gray-600 mb-6">
          Test different user roles to see how the dashboard and permissions change.
        </p>

        {/* Role Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Role to Test:
          </label>
          <div className="flex flex-wrap gap-2">
            {testRoles.map((testRole) => (
              <button
                key={testRole.value}
                onClick={() => {
                  setSelectedRole(testRole.value);
                  simulateLogin(testRole.value);
                }}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  role === testRole.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {testRole.label}
              </button>
            ))}
          </div>
        </div>

        {/* Current User Info */}
        {user && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Current User</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Name:</span> {user.name}
              </div>
              <div>
                <span className="text-gray-600">Email:</span> {user.email}
              </div>
              <div>
                <span className="text-gray-600">Role:</span> {role}
              </div>
              <div>
                <span className="text-gray-600">Normalized Role:</span> {normalizedRole}
              </div>
            </div>
          </div>
        )}

        {/* Permissions Display */}
        {currentPermissions && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Role Permissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(currentPermissions).map(([permission, hasAccess]) => (
                <div key={permission} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 capitalize">
                    {permission.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    hasAccess 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {hasAccess ? 'Allowed' : 'Denied'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dashboard Preview Link */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Dashboard Preview</h4>
          <p className="text-blue-700 text-sm mb-3">
            Navigate to the dashboard to see the role-specific interface:
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Dashboard →
          </a>
        </div>
      </div>

      {/* Role Comparison Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Role Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-medium text-gray-900">Permission</th>
                <th className="text-center py-2 font-medium text-gray-900">Admin</th>
                <th className="text-center py-2 font-medium text-gray-900">Manager</th>
                <th className="text-center py-2 font-medium text-gray-900">User</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(getRolePermissions('admin')).map((permission) => (
                <tr key={permission} className="border-b border-gray-100">
                  <td className="py-2 text-gray-700 capitalize">
                    {permission.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </td>
                  <td className="py-2 text-center">
                    {hasPermission('admin', permission as any) ? '✅' : '❌'}
                  </td>
                  <td className="py-2 text-center">
                    {hasPermission('manager', permission as any) ? '✅' : '❌'}
                  </td>
                  <td className="py-2 text-center">
                    {hasPermission('user', permission as any) ? '✅' : '❌'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RoleTestPage;