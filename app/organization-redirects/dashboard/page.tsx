'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Building2, 
  Search, 
  Filter, 
  Edit, 
  UserCheck, 
  Mail, 
  MapPin,
  Phone,
  Calendar,
  Settings,
  Plus
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOrganizationStore } from '../../store/organizationStore';
import { useAuthStore } from '../../store/authStore';

interface Employee {
  id: string;
  name: string;
  email: string;
  job_title?: string;
  phone?: string;
  location?: string;
  department_id?: string;
  department_name?: string;
  all_departments?: string[]; // Array of all department IDs user belongs to
  created_at: string;
  current_role?: string;
  current_role_id?: string;
  department_roles?: Record<string, { role_id: string; role_name: string }>; // Department-specific roles
}

interface GlobalRole {
  id: string;
  name: string;
  description?: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
  color_code: string;
  employee_count: number;
}

interface DashboardStats {
  total_employees: number;
  total_departments: number;
}

export default function OrganizationDashboard() {
  const router = useRouter();
  const { currentOrg, getCurrentOrgId } = useOrganizationStore();
  const { token } = useAuthStore();
  
  const [stats, setStats] = useState<DashboardStats>({ total_employees: 0, total_departments: 0 });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [globalRoles, setGlobalRoles] = useState<GlobalRole[]>([]);
  const [assigningRole, setAssigningRole] = useState<string | null>(null);

  // Check organization access
  useEffect(() => {
    const orgId = getCurrentOrgId();
    console.log('🔍 ORG DASHBOARD: Checking access', { orgId, currentOrg, hasToken: !!token });
    
    if (!orgId || !currentOrg) {
      console.log('⚠️ ORG DASHBOARD: No org ID or currentOrg, redirecting to login');
      router.push('/org-login');
      return;
    }
    
    if (!token) {
      console.log('⏳ ORG DASHBOARD: Waiting for token to load...');
      // Give it a moment for the token to hydrate from localStorage
      const timeout = setTimeout(() => {
        if (!token) {
          console.log('❌ ORG DASHBOARD: No token after timeout, redirecting to login');
          router.push('/org-login');
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }
    
    console.log('✅ ORG DASHBOARD: All checks passed, fetching data');
    fetchDashboardData();
    fetchGlobalRoles();
  }, [currentOrg, getCurrentOrgId, router, token]);

  const fetchGlobalRoles = async () => {
    try {
      const response = await fetch('/api/get-global-roles');
      if (response.ok) {
        const data = await response.json();
        setGlobalRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Error fetching global roles:', error);
    }
  };

  const assignRoleToUser = async (userId: string, roleId: string, departmentId?: string) => {
    if (!token) return;
    
    setAssigningRole(userId);
    try {
      const response = await fetch('/api/assign-organization-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          role_id: roleId,
          organization_id: getCurrentOrgId(),
          department_id: departmentId // Pass department ID for department-level role assignment
        }),
      });

      if (response.ok) {
        // Update local state immediately for better UX
        if (departmentId) {
          setEmployees(prev => prev.map(emp => {
            if (emp.id === userId) {
              return {
                ...emp,
                department_roles: {
                  ...emp.department_roles,
                  [departmentId]: { role_id: roleId, role_name: globalRoles.find(r => r.id === roleId)?.name || '' }
                }
              };
            }
            return emp;
          }));
        } else {
          // Update org-level role
          setEmployees(prev => prev.map(emp => {
            if (emp.id === userId) {
              return {
                ...emp,
                current_role_id: roleId,
                current_role: globalRoles.find(r => r.id === roleId)?.name || ''
              };
            }
            return emp;
          }));
        }
        
        // Refresh employee data to sync with server
        fetchDashboardData();
      } else {
        console.error('Failed to assign role');
      }
    } catch (error) {
      console.error('Error assigning role:', error);
    } finally {
      setAssigningRole(null);
    }
  };

  const fetchDashboardData = async () => {
    const orgId = getCurrentOrgId();
    if (!orgId || !token) return;

    setLoading(true);
    try {
      // Fetch dashboard stats and employees with authorization header
      const headers = {
        'Authorization': `Bearer ${token}`
      };

      const [statsResponse, employeesResponse] = await Promise.all([
        fetch(`/api/org-dashboard-stats?orgId=${orgId}`, { headers }),
        fetch(`/api/org-employees?orgId=${orgId}`, { headers })
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (employeesResponse.ok) {
        const employeesData = await employeesResponse.json();
        setEmployees(employeesData.employees || []);
        setDepartments(employeesData.departments || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter employees based on search and department
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (employee.job_title && employee.job_title.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Check if employee belongs to selected department (including all_departments array)
    const matchesDepartment = selectedDepartment === 'all' || 
                             employee.department_id === selectedDepartment ||
                             employee.all_departments?.includes(selectedDepartment);
    
    return matchesSearch && matchesDepartment;
  });

  // Group employees by department (show user in ALL departments they belong to)
  const employeesByDepartment = departments.map((dept, index) => ({
    ...dept,
    id: dept.id || dept.name || `dept-${index}`, // Ensure unique ID
    employees: employees.filter(emp => 
      emp.department_id === (dept.id || dept.name) ||
      emp.all_departments?.includes(dept.id)
    )
  }));



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Organization Dashboard</h1>
              <p className="mt-1 text-sm text-gray-600">
                {currentOrg?.name} • Manage your organization
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => router.push('/organization-redirects/edit-departments')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Departments
              </button>
              <button
                onClick={() => router.push('/organization-redirects/reassign-departments')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Re-assign Departments
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0">
                  <Users className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Employees</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.total_employees}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0">
                  <Building2 className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Departments</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.total_departments}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0">
                  <UserCheck className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Users</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.total_employees}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <label htmlFor="search" className="sr-only">Search employees</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="search"
                    type="text"
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Department Filter */}
              <div className="sm:w-64">
                <label htmlFor="department" className="sr-only">Filter by department</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Filter className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    id="department"
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((dept, index) => (
                      <option key={dept.id || dept.name || `dept-option-${index}`} value={dept.id || dept.name}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Employee List by Department */}
        <div className="space-y-6">
          {employeesByDepartment.map(department => (
            <div key={department.id} className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: department.color_code }}
                    />
                    <div>
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        {department.name}
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm text-gray-500">
                        {department.employees.length} employee(s)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {department.employees.length > 0 ? (
                <div className="overflow-hidden">
                  <ul className="divide-y divide-gray-200">
                    {department.employees.map(employee => (
                      <li key={employee.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                                <span className="text-white font-medium">
                                  {employee.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {employee.name}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center space-x-4">
                                <span className="flex items-center">
                                  <Mail className="w-3 h-3 mr-1" />
                                  {employee.email}
                                </span>
                                {employee.job_title && (
                                  <span>{employee.job_title}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              {employee.phone && (
                                <span className="flex items-center">
                                  <Phone className="w-3 h-3 mr-1" />
                                  {employee.phone}
                                </span>
                              )}
                              {employee.location && (
                                <span className="flex items-center">
                                  <MapPin className="w-3 h-3 mr-1" />
                                  {employee.location}
                                </span>
                              )}
                            </div>
                            
                            {/* Role Assignment Dropdown */}
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">Role:</span>
                              <select
                                value={employee.department_roles?.[department.id]?.role_id || employee.current_role_id || ''}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    assignRoleToUser(employee.id, e.target.value, department.id);
                                  }
                                }}
                                disabled={assigningRole === employee.id}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                              >
                                <option value="">Select Role</option>
                                {globalRoles.map(role => (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                              </select>
                              {assigningRole === employee.id && (
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="px-4 py-8 sm:px-6 text-center">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No employees</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No employees found in this department.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* No results */}
        {filteredEmployees.length === 0 && employees.length > 0 && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-8 sm:px-6 text-center">
              <Search className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No employees found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your search terms or filters.
              </p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {employees.length === 0 && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-8 sm:px-6 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No employees yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by inviting team members to your organization.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => router.push('/invite-family')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Invite Team Members
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invite Team Members - Always visible at bottom */}
        {employees.length > 0 && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-6 sm:px-6 text-center border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Invite More Team Members</h3>
              <p className="text-sm text-gray-500 mb-4">
                Expand your team by inviting more colleagues to join your organization.
              </p>
              <button
                type="button"
                onClick={() => router.push('/invite-family')}
                className="inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                Invite Team Members
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}