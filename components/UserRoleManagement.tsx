'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../app/store/authStore';

interface User {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  currentRole: {
    id: string;
    name: string;
    description: string;
  } | null;
  roleLevel?: 'organization' | 'department';
  departmentName?: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

export default function UserRoleManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);

  const { token, organization, hasRole, user: currentUser } = useAuth();

  // Check if current user can manage roles
  const canManage = hasRole('Admin') || hasRole('Manager') || hasRole('Team Lead');

  // Helper function to filter available roles based on role hierarchy
  const getAvailableRolesForUser = (targetUser?: User) => {
    const currentUserIsAdmin = hasRole('Admin');
    const currentUserIsManager = hasRole('Manager');
    
    return availableRoles.filter(role => {
      // Only Admins can assign Admin roles
      if (role.name === 'Admin' && !currentUserIsAdmin) {
        return false;
      }
      
      // Managers cannot change other Managers' roles
      if (currentUserIsManager && !currentUserIsAdmin) {
        const targetUserIsManager = targetUser?.currentRole?.name === 'Manager';
        if (targetUserIsManager && role.name !== 'Manager') {
          return false; // Manager trying to change another Manager's role
        }
      }
      
      return true;
    });
  };

  useEffect(() => {
    if (canManage && token && organization?.id) {
      fetchUsers();
    }
  }, [canManage, token, organization]);

  // Auto-dismiss success/error messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/manage-user-role?organization_id=${organization?.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setUsers(data.users || []);
        setAvailableRoles(data.availableRoles || []);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserRole = async (userId: string, roleId: string, roleName: string) => {
    try {
      setError(null);
      setSuccess(null);
      
      console.log('🔄 Updating role for user:', userId, 'to:', roleName);
      
      const response = await fetch('/api/manage-user-role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          roleId,
          organizationId: organization?.id
        }),
      });

      const data = await response.json();
      console.log('📡 Role update response:', data);

      if (response.ok) {
        setSuccess(`✅ User role updated to ${roleName} successfully`);
        // Force refresh after a short delay to ensure DB is updated
        setTimeout(() => {
          console.log('🔄 Refreshing user list...');
          fetchUsers();
        }, 500);
      } else {
        console.error('❌ Role update failed:', data.error);
        setError(data.error || 'Failed to update user role');
      }
    } catch (err) {
      console.error('❌ Role update error:', err);
      setError('Failed to update user role');
    }
  };

  const addUserToOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserRole) {
      setError('Please enter email and select a role');
      return;
    }

    try {
      setIsAddingUser(true);
      const response = await fetch('/api/manage-user-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newUserEmail,
          roleId: newUserRole,
          organizationId: organization?.id
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setNewUserEmail('');
        setNewUserRole('');
        fetchUsers(); // Refresh the list
      } else {
        setError(data.error || 'Failed to add user');
      }
    } catch (err) {
      setError('Failed to add user');
    } finally {
      setIsAddingUser(false);
    }
  };

  const removeUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to remove ${userName} from the organization?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/manage-user-role?user_id=${userId}&organization_id=${organization?.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        fetchUsers(); // Refresh the list
      } else {
        setError(data.error || 'Failed to remove user');
      }
    } catch (err) {
      setError('Failed to remove user');
    }
  };

  if (!canManage) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <h3 className="text-lg font-medium text-yellow-800">Access Denied</h3>
          <p className="text-yellow-700">Only Admin, Manager, or Team Lead can manage user roles.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Role Management</h1>
        <p className="text-gray-600">Manage user roles in {organization?.name}</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Add User Form */}
      <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Add User to Organization</h2>
        <form onSubmit={addUserToOrganization} className="flex flex-col sm:flex-row gap-4">
          <input
            type="email"
            placeholder="Enter user email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <select
            value={newUserRole}
            onChange={(e) => setNewUserRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select Role</option>
            {getAvailableRolesForUser().map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isAddingUser}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isAddingUser ? 'Adding...' : 'Add User'}
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.userId}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    {(() => {
                      const isUserAdmin = user.currentRole?.name === 'Admin';
                      const isUserManager = user.currentRole?.name === 'Manager';
                      const currentUserIsAdmin = hasRole('Admin');
                      const currentUserIsManager = hasRole('Manager');
                      const isSelf = user.email === currentUser?.email;
                      
                      // Enhanced permissions logic
                      const canModifyThisUser = !isSelf && (
                        currentUserIsAdmin || // Admins can modify anyone
                        (currentUserIsManager && !isUserAdmin && !isUserManager) // Managers can only modify non-Admin/non-Manager users
                      );
                      
                      return canModifyThisUser ? (
                        <>
                          <select
                            value={user.currentRole?.id || ''}
                            onChange={(e) => {
                              const selectedRole = availableRoles.find(r => r.id === e.target.value);
                              if (selectedRole) {
                                updateUserRole(user.userId, selectedRole.id, selectedRole.name);
                              }
                            }}
                            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">No Role</option>
                            {getAvailableRolesForUser(user).map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                          {user.roleLevel && (
                            <span className="text-xs text-gray-500 mt-1">
                              {user.roleLevel === 'organization' ? '🏢 Org-level' : `🏬 Dept: ${user.departmentName || 'N/A'}`}
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 border border-gray-300 rounded">
                            {user.currentRole?.name || 'No Role'} {isSelf ? '(Self)' : '(Protected)'}
                          </span>
                          {user.roleLevel && (
                            <span className="text-xs text-gray-500 mt-1">
                              {user.roleLevel === 'organization' ? '🏢 Org-level' : `🏬 Dept: ${user.departmentName || 'N/A'}`}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.joinedAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {(() => {
                    const isUserAdmin = user.currentRole?.name === 'Admin';
                    const isUserManager = user.currentRole?.name === 'Manager';
                    const currentUserIsAdmin = hasRole('Admin');
                    const currentUserIsManager = hasRole('Manager');
                    const isSelf = user.email === currentUser?.email;
                    
                    // Enhanced permissions logic for removal
                    const canRemoveThisUser = !isSelf && (
                      currentUserIsAdmin || // Admins can remove anyone
                      (currentUserIsManager && !isUserAdmin && !isUserManager) // Managers can only remove non-Admin/non-Manager users
                    );
                    
                    return canRemoveThisUser ? (
                      <button
                        onClick={() => removeUser(user.userId, user.name)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">
                        {isSelf ? 'Self' : 'Protected'}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No users found in this organization.
        </div>
      )}
    </div>
  );
}