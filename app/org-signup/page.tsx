'use client';

import React, { useState } from 'react';
import { Building2, Users, Settings, BarChart3, FileText, LogOut, Menu, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Organization {
  id: string;
  name: string;
  domain: string;
  org_email: string;
  username: string;
  onboarding_completed: boolean;
  created_at: string;
}

const OrganizationSignup: React.FC = () => {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // This would normally come from your auth context or API
  const [organization, setOrganization] = useState<Organization | null>(null);

  React.useEffect(() => {
    // Check if user is logged in
    const orgToken = localStorage.getItem('orgToken');
    if (!orgToken) {
      router.push('/org-login');
      return;
    }

    // TODO: Decode token and get organization info
    // For now, using dummy data
    setOrganization({
      id: '123',
      name: 'Sample Organization',
      domain: 'sample.com',
      org_email: 'admin@sample.com',
      username: 'sampleorg',
      onboarding_completed: false,
      created_at: '2024-01-01'
    });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('orgToken');
    router.push('/org-login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/org-dashboard', icon: BarChart3, current: true },
    { name: 'Users', href: '/org-users', icon: Users, current: false },
    { name: 'Projects', href: '/org-projects', icon: FileText, current: false },
    { name: 'Settings', href: '/org-settings', icon: Settings, current: false },
  ];

  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} fixed inset-0 flex z-40 md:inset-y-0 md:flex md:w-64 md:flex-col`}>
        <div className="flex min-h-0 flex-1 flex-col bg-white shadow-xl">
          <div className="flex h-16 flex-shrink-0 items-center px-4 bg-blue-600">
            <Building2 className="h-8 w-8 text-white" />
            <h1 className="ml-3 text-lg font-semibold text-white">
              {organization.name}
            </h1>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto">
            <nav className="flex-1 space-y-1 px-2 py-4">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => router.push(item.href)}
                    className={`${
                      item.current
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    } group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left`}
                  >
                    <Icon
                      className={`${
                        item.current ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                      } mr-3 h-5 w-5 flex-shrink-0`}
                    />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex flex-shrink-0 border-t border-gray-200 p-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center text-sm text-gray-700 hover:text-gray-900"
            >
              <LogOut className="mr-3 h-5 w-5 text-gray-400" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex w-0 flex-1 flex-col overflow-hidden md:ml-64">
        <div className="relative z-10 flex h-16 flex-shrink-0 bg-white shadow">
          <button
            type="button"
            className="border-r border-gray-200 px-4 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
          <div className="flex flex-1 justify-between px-4">
            <div className="flex flex-1">
              <div className="flex w-full md:ml-0">
                <div className="flex items-center">
                  <h1 className="text-2xl font-semibold text-gray-900">Organization Dashboard</h1>
                </div>
              </div>
            </div>
          </div>
        </div>

        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {/* Welcome Section */}
              <div className="bg-blue-50 rounded-lg p-6 mb-8">
                <div className="flex items-center">
                  <Building2 className="h-12 w-12 text-blue-600" />
                  <div className="ml-4">
                    <h2 className="text-2xl font-bold text-blue-900">
                      Welcome to {organization.name}!
                    </h2>
                    <p className="text-blue-700 mt-2">
                      Your organization account has been created successfully. Get started by exploring the features below.
                    </p>
                  </div>
                </div>
              </div>

              {/* Organization Info */}
              <div className="bg-white shadow rounded-lg mb-8">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Organization Information</h3>
                </div>
                <div className="px-6 py-4">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Organization Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{organization.name}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Domain</dt>
                      <dd className="mt-1 text-sm text-gray-900">{organization.domain}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Email</dt>
                      <dd className="mt-1 text-sm text-gray-900">{organization.org_email}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Username</dt>
                      <dd className="mt-1 text-sm text-gray-900">{organization.username}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Users className="h-8 w-8 text-blue-600" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Manage Users
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            Add team members
                          </dd>
                        </dl>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => router.push('/org-users')}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Manage Users →
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <FileText className="h-8 w-8 text-green-600" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Create Projects
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            Start new projects
                          </dd>
                        </dl>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => router.push('/org-projects')}
                        className="text-sm text-green-600 hover:text-green-800 font-medium"
                      >
                        Create Project →
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Settings className="h-8 w-8 text-purple-600" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Settings
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            Configure your org
                          </dd>
                        </dl>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => router.push('/org-settings')}
                        className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                      >
                        Go to Settings →
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className="mt-8 bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Next Steps</h3>
                </div>
                <div className="px-6 py-4">
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">1</span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">Verify your email address</p>
                        <p className="text-sm text-gray-500">Check your inbox for verification email</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">2</span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">Add team members</p>
                        <p className="text-sm text-gray-500">Invite users to join your organization</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">3</span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">Create your first project</p>
                        <p className="text-sm text-gray-500">Start organizing your work with projects</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default OrganizationSignup;