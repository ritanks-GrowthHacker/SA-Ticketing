'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../app/store/authStore';
import BaseModal from './BaseModal';
import ErrorModal from './ErrorModal';
import SuccessModal from './SuccessModal';
import ConfirmationModal from './ConfirmationModal';
import { Users, Plus, Trash2, Shield } from 'lucide-react';

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
}

interface Role {
  id: string;
  name: string;
  description: string;
}

interface UserRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserRoleModal({ isOpen, onClose }: UserRoleModalProps) {
  
  // Handle main modal close with cleanup
  const handleMainModalClose = () => {
    setPendingRoleChanges({});
    setShowAddForm(false);
    setNewUserEmail('');
    setNewUserRole('');
    setError(null);
    setSuccess(null);
    onClose();
  };
  const [users, setUsers] = useState<User[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Modal states
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'role-update' | 'add-user' | 'remove-user';
    data: any;
    message: string;
    originalRoleId?: string;
    userId?: string;
  } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [pendingRoleChanges, setPendingRoleChanges] = useState<Record<string, string>>({});

  const { token, organization, hasRole } = useAuth();

  // Check if current user can manage roles
  const canManage = hasRole('Admin') || hasRole('Manager') || hasRole('Team Lead');

  useEffect(() => {
    if (isOpen && canManage && token && organization?.id) {
      fetchUsers();
    }
  }, [isOpen, canManage, token, organization]);

  // Show modals when error or success state changes
  useEffect(() => {
    if (error) {
      setShowErrorModal(true);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      setShowSuccessModal(true);
    }
  }, [success]);

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

  const updateUserRole = (userId: string, roleId: string, roleName: string) => {
    const user = users.find(u => u.userId === userId);
    const originalRoleId = user?.currentRole?.id || '';
    
    // Store the pending change
    setPendingRoleChanges(prev => ({ ...prev, [userId]: roleId }));
    
    setConfirmAction({
      type: 'role-update',
      data: { userId, roleId, roleName },
      message: `Are you sure you want to change ${user?.name}'s role to "${roleName}"?`,
      originalRoleId,
      userId
    });
    setShowConfirmModal(true);
  };

  const executeRoleUpdate = async (data: any) => {
    const { userId, roleId, roleName } = data;
    setIsActionLoading(true);
    
    try {
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

      const responseData = await response.json();

      if (response.ok) {
        setSuccess(`User role updated to ${roleName} successfully`);
        // Clear the pending change
        setPendingRoleChanges(prev => {
          const newState = { ...prev };
          delete newState[userId];
          return newState;
        });
        fetchUsers();
        setShowConfirmModal(false);
      } else {
        setError(responseData.error || 'Failed to update user role');
        // Revert the dropdown by removing pending change
        setPendingRoleChanges(prev => {
          const newState = { ...prev };
          delete newState[userId];
          return newState;
        });
        setShowConfirmModal(false);
      }
    } catch (err) {
      setError('Failed to update user role');
      // Revert the dropdown by removing pending change
      setPendingRoleChanges(prev => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
      setShowConfirmModal(false);
    } finally {
      setIsActionLoading(false);
    }
  };

  const addUserToOrganization = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserRole) {
      setError('Please enter email and select a role');
      return;
    }

    const selectedRole = availableRoles.find(r => r.id === newUserRole);
    setConfirmAction({
      type: 'add-user',
      data: { email: newUserEmail, roleId: newUserRole, roleName: selectedRole?.name },
      message: `Are you sure you want to add "${newUserEmail}" to the organization as "${selectedRole?.name}"?`
    });
    setShowConfirmModal(true);
  };

  const executeAddUser = async (data: any) => {
    setIsActionLoading(true);
    
    try {
      const response = await fetch('/api/manage-user-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: data.email,
          roleId: data.roleId,
          organizationId: organization?.id
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        setSuccess(responseData.message);
        setNewUserEmail('');
        setNewUserRole('');
        setShowAddForm(false);
        fetchUsers();
        setShowConfirmModal(false);
      } else {
        setError(responseData.error || 'Failed to add user');
        setShowConfirmModal(false);
      }
    } catch (err) {
      setError('Failed to add user');
      setShowConfirmModal(false);
    } finally {
      setIsActionLoading(false);
    }
  };

  const removeUser = (userId: string, userName: string) => {
    setConfirmAction({
      type: 'remove-user',
      data: { userId, userName },
      message: `Are you sure you want to remove "${userName}" from the organization? This action cannot be undone.`
    });
    setShowConfirmModal(true);
  };

  const executeRemoveUser = async (data: any) => {
    const { userId } = data;
    setIsActionLoading(true);
    
    try {
      const response = await fetch(`/api/manage-user-role?user_id=${userId}&organization_id=${organization?.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const responseData = await response.json();

      if (response.ok) {
        setSuccess(responseData.message);
        fetchUsers();
        setShowConfirmModal(false);
      } else {
        setError(responseData.error || 'Failed to remove user');
        setShowConfirmModal(false);
      }
    } catch (err) {
      setError('Failed to remove user');
      setShowConfirmModal(false);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle confirmation modal actions
  const handleConfirmAction = () => {
    if (!confirmAction) return;
    
    switch (confirmAction.type) {
      case 'role-update':
        executeRoleUpdate(confirmAction.data);
        break;
      case 'add-user':
        executeAddUser(confirmAction.data);
        break;
      case 'remove-user':
        executeRemoveUser(confirmAction.data);
        break;
    }
  };

  // Handle confirmation modal cancel
  const handleCancelConfirmation = () => {
    if (confirmAction?.type === 'role-update' && confirmAction.userId) {
      // Remove the pending change to revert the dropdown
      setPendingRoleChanges(prev => {
        const newState = { ...prev };
        delete newState[confirmAction.userId!];
        return newState;
      });
    }
    
    setShowConfirmModal(false);
    setConfirmAction(null);
    setIsActionLoading(false);
  };

  const getRoleColor = (roleName: string) => {
    const colors: Record<string, string> = {
      'Admin': 'bg-red-100 text-red-800 border-red-200',
      'Manager': 'bg-blue-100 text-blue-800 border-blue-200',
      'Team Lead': 'bg-purple-100 text-purple-800 border-purple-200',
      'Member': 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[roleName] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (!canManage) {
    return (
      <BaseModal 
        isOpen={isOpen} 
        onClose={onClose} 
        title="Access Denied" 
        size="md"
        closeOnOverlayClick={true}
        closeOnEscape={true}
      >
        <div className="p-6">
          <div className="flex items-center space-x-3 text-amber-600">
            <Shield className="h-8 w-8" />
            <div>
              <h3 className="text-lg font-medium">Insufficient Permissions</h3>
              <p className="text-sm text-gray-600">Only Admin, Manager, or Team Lead can manage user roles.</p>
            </div>
          </div>
        </div>
      </BaseModal>
    );
  }

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={handleMainModalClose} 
      title="Manage Users" 
      size="xl"
      closeOnOverlayClick={!isLoading}
      closeOnEscape={!isLoading}
    >
      <div className="p-6">
        {/* Messages are now handled by modal boundaries */}

        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">
              {users.length} user{users.length !== 1 ? 's' : ''} in {organization?.name}
            </span>
          </div>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={isActionLoading}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            <span>Add User</span>
          </button>
        </div>

        {/* Add User Form */}
        {showAddForm && (
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">Add User to Organization</h3>
            <form onSubmit={addUserToOrganization} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="email"
                  placeholder="Enter user email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  disabled={isActionLoading}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  disabled={isActionLoading}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">Select Role</option>
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} {role.description && `- ${role.description}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add User
                </button>
                <button
                  type="button"
                  disabled={isActionLoading}
                  onClick={() => {
                    setShowAddForm(false);
                    setNewUserEmail('');
                    setNewUserRole('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          /* Users List */
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {users.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No users found in this organization.</p>
              </div>
            ) : (
              users.map((user) => (
                <div
                  key={user.userId}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="shrink-0">
                          <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                          <p className="text-sm text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {/* Role Badge & Selector */}
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleColor(user.currentRole?.name || 'Member')}`}>
                          {user.currentRole?.name || 'No Role'}
                        </span>
                        <select
                          value={pendingRoleChanges[user.userId] || user.currentRole?.id || ''}
                          onChange={(e) => {
                            const selectedRole = availableRoles.find(r => r.id === e.target.value);
                            if (selectedRole) {
                              updateUserRole(user.userId, selectedRole.id, selectedRole.name);
                            }
                          }}
                          disabled={isActionLoading}
                          className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">No Role</option>
                          {availableRoles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeUser(user.userId, user.name)}
                        disabled={isActionLoading}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remove user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    Joined: {new Date(user.joinedAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal Boundaries */}
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => {
          setShowErrorModal(false);
          setError(null);
        }}
        message={error || ''}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          setSuccess(null);
        }}
        message={success || ''}
        autoClose={true}
        autoCloseDelay={2000}
      />

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleCancelConfirmation}
        onConfirm={handleConfirmAction}
        title={confirmAction?.type === 'remove-user' ? 'Remove User' : 
               confirmAction?.type === 'add-user' ? 'Add User' : 'Update Role'}
        message={confirmAction?.message || ''}
        confirmText={confirmAction?.type === 'remove-user' ? 'Remove' : 
                    confirmAction?.type === 'add-user' ? 'Add User' : 'Update Role'}
        confirmButtonColor={confirmAction?.type === 'remove-user' ? 'red' : 'blue'}
        isLoading={isActionLoading}
      />
    </BaseModal>
  );
}