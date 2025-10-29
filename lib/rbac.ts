// Role-based access control utilities

export type UserRole = 'admin' | 'manager' | 'user' | 'developer' | 'employee';

export interface RolePermissions {
  canCreateProjects: boolean;
  canManageUsers: boolean;
  canViewAllTickets: boolean;
  canViewAnalytics: boolean;
  canExportData: boolean;
  canAssignTickets: boolean;
  canManageTeam: boolean;
  canViewOrgData: boolean;
}

/**
 * Normalize role names to handle case variations and aliases
 */
export const normalizeRole = (role: string): UserRole => {
  const normalizedRole = role?.toLowerCase().trim() || '';
  
  // Admin variations
  if (['admin', 'administrator', 'super admin', 'superadmin'].includes(normalizedRole)) {
    return 'admin';
  }
  
  // Manager variations
  if (['manager', 'project manager', 'team lead', 'technical lead', 'lead'].includes(normalizedRole)) {
    return 'manager';
  }
  
  // Developer/Employee variations (default user type)
  if (['user', 'developer', 'employee', 'member', 'staff'].includes(normalizedRole)) {
    return 'user';
  }
  
  // Default fallback
  return 'user';
};

/**
 * Get permissions based on user role
 */
export const getRolePermissions = (role: string): RolePermissions => {
  const normalizedRole = normalizeRole(role);
  
  switch (normalizedRole) {
    case 'admin':
      return {
        canCreateProjects: true,
        canManageUsers: true,
        canViewAllTickets: true,
        canViewAnalytics: true,
        canExportData: true,
        canAssignTickets: true,
        canManageTeam: true,
        canViewOrgData: true,
      };
      
    case 'manager':
      return {
        canCreateProjects: false, // Only for assigned projects
        canManageUsers: false, // Only team members
        canViewAllTickets: false, // Only project tickets
        canViewAnalytics: true,
        canExportData: true,
        canAssignTickets: true,
        canManageTeam: true,
        canViewOrgData: false,
      };
      
    case 'user':
    default:
      return {
        canCreateProjects: false,
        canManageUsers: false,
        canViewAllTickets: false, // Only own tickets
        canViewAnalytics: true, // Own analytics only
        canExportData: false,
        canAssignTickets: false,
        canManageTeam: false,
        canViewOrgData: false,
      };
  }
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (role: string, permission: keyof RolePermissions): boolean => {
  const permissions = getRolePermissions(role);
  return permissions[permission];
};

/**
 * Get dashboard type based on role
 */
export const getDashboardType = (role: string): 'admin' | 'manager' | 'user' => {
  const normalizedRole = normalizeRole(role);
  
  switch (normalizedRole) {
    case 'admin':
      return 'admin';
    case 'manager':
      return 'manager';
    default:
      return 'user';
  }
};

/**
 * Get available quick actions based on role
 */
export const getQuickActions = (role: string) => {
  const permissions = getRolePermissions(role);
  const actions = [];
  
  // Always available
  actions.push({ id: 'create-ticket', label: 'Create New Ticket', icon: 'Ticket' });
  
  if (permissions.canViewAnalytics) {
    actions.push({ id: 'view-analytics', label: 'View Analytics', icon: 'BarChart3' });
  }
  
  if (permissions.canCreateProjects) {
    actions.push({ id: 'create-project', label: 'Start New Project', icon: 'FolderOpen' });
  }
  
  if (permissions.canManageUsers) {
    actions.push({ id: 'manage-users', label: 'Manage Users', icon: 'Users' });
  }
  
  if (permissions.canManageTeam) {
    actions.push({ id: 'manage-team', label: 'Manage Team', icon: 'Users' });
  }
  
  return actions;
};