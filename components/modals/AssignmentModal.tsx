'use client';

import React, { useState, useEffect } from 'react';
import { X, Users, FolderOpen, Shield } from 'lucide-react';
import BaseModal from './BaseModal';
import { ProjectSelect } from '../../components/ui/ProjectSelect';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Role {
  id: string;
  name: string;
  description?: string;
}

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: string[];
  userNames: string[];
  onAssign: (projectId: string, roleId: string) => void;
  loading?: boolean;
}

export const AssignmentModal: React.FC<AssignmentModalProps> = ({
  isOpen,
  onClose,
  selectedUsers,
  userNames,
  onAssign,
  loading = false
}) => {
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  // Fetch roles when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchRoles();
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedProject('');
      setSelectedRole('');
    }
  }, [isOpen]);

  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch('/api/all-get-entities', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setRolesLoading(false);
    }
  };

  const handleAssign = () => {
    if (!selectedProject || !selectedRole) {
      alert('Please select both a project and a role.');
      return;
    }

    onAssign(selectedProject, selectedRole);
  };

  const canAssign = selectedProject && selectedRole && !loading;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      closeOnOverlayClick={!loading}
      closeOnEscape={!loading}
      showCloseButton={false}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Assign Users to Project</h3>
              <p className="text-sm text-gray-600">
                Assigning {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} to a project
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Selected Users Preview */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selected Users
          </label>
          <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {userNames.map((name, index) => (
                <span
                  key={selectedUsers[index]}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Project Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Project *
          </label>
          <div className="flex items-center space-x-2">
            <FolderOpen className="w-4 h-4 text-gray-400" />
            <div className="flex-1">
              <ProjectSelect
                value={selectedProject}
                onValueChange={setSelectedProject}
                placeholder="Select a project to assign users to"
                includeAllOption={false}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Role Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role *
          </label>
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-gray-400" />
            <div className="flex-1">
              <Select value={selectedRole} onValueChange={setSelectedRole} disabled={loading || rolesLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={rolesLoading ? "Loading roles..." : "Select a role for the users"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Available Roles</SelectLabel>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{role.name}</span>
                          {role.description && (
                            <span className="text-xs text-gray-500">{role.description}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                    {roles.length === 0 && !rolesLoading && (
                      <SelectItem value="no-roles" disabled>
                        No roles available
                      </SelectItem>
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Assignment Info */}
        {selectedProject && selectedRole && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full mt-0.5 shrink-0"></div>
              <div className="text-sm text-blue-800">
                <p className="font-medium">Assignment Summary:</p>
                <p>
                  {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} will be assigned 
                  to the selected project with the <strong>{roles.find(r => r.id === selectedRole)?.name}</strong> role.
                </p>
                <p className="text-xs mt-1 text-blue-600">
                  Users will receive email notifications about this assignment.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!canAssign}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
              canAssign
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
            <span>{loading ? 'Assigning...' : 'Assign Users'}</span>
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export default AssignmentModal;