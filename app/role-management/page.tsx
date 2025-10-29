'use client';

import UserRoleManagement from '../../components/UserRoleManagement';
import MainLayout from '../../components/ui/MainLayout';

export default function RoleManagementPage() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        <UserRoleManagement />
      </div>
    </MainLayout>
  );
}