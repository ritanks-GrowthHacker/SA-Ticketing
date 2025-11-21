/**
 * Role Hierarchy Utility
 * Defines role levels and permissions for role management across the application
 */

export type RoleName = 'Admin' | 'Manager' | 'Member';

/**
 * Role hierarchy levels (higher = more permissions)
 */
export const ROLE_LEVELS: Record<RoleName, number> = {
  Admin: 3,
  Manager: 2,
  Member: 1,
};

/**
 * Get the numeric level for a role name
 * @param roleName - The role name (case-insensitive)
 * @returns The role level, or 0 if invalid role
 */
export function getRoleLevel(roleName: string | null | undefined): number {
  if (!roleName) return 0;
  
  const normalized = roleName.trim();
  // Case-insensitive match
  const matchedRole = Object.keys(ROLE_LEVELS).find(
    role => role.toLowerCase() === normalized.toLowerCase()
  ) as RoleName | undefined;
  
  return matchedRole ? ROLE_LEVELS[matchedRole] : 0;
}

/**
 * Check if current user can assign a specific role to another user
 * Rule: Users can only assign roles at their level or below
 * 
 * @param currentUserRole - The role of the user performing the assignment
 * @param targetRole - The role being assigned
 * @returns true if assignment is allowed, false otherwise
 */
export function canAssignRole(
  currentUserRole: string | null | undefined,
  targetRole: string | null | undefined
): boolean {
  const currentLevel = getRoleLevel(currentUserRole);
  const targetLevel = getRoleLevel(targetRole);
  
  // Can only assign roles at or below your own level
  return currentLevel >= targetLevel && currentLevel > 0;
}

/**
 * Check if current user can modify (edit/delete) a user with a specific role
 * Rule: Users cannot modify users with higher or equal roles
 * 
 * @param currentUserRole - The role of the user performing the modification
 * @param targetUserRole - The role of the user being modified
 * @returns true if modification is allowed, false otherwise
 */
export function canModifyRole(
  currentUserRole: string | null | undefined,
  targetUserRole: string | null | undefined
): boolean {
  const currentLevel = getRoleLevel(currentUserRole);
  const targetLevel = getRoleLevel(targetUserRole);
  
  // Can only modify users with lower roles
  return currentLevel > targetLevel && currentLevel > 0;
}

/**
 * Get all roles that the current user can assign
 * @param currentUserRole - The role of the user
 * @returns Array of assignable role names
 */
export function getAssignableRoles(currentUserRole: string | null | undefined): RoleName[] {
  const currentLevel = getRoleLevel(currentUserRole);
  
  return (Object.keys(ROLE_LEVELS) as RoleName[]).filter(
    role => ROLE_LEVELS[role] <= currentLevel
  );
}

/**
 * Check if a role is higher than the current user's role (should be disabled/frozen)
 * @param currentUserRole - The role of the user
 * @param targetRole - The role to check
 * @returns true if the role should be disabled, false otherwise
 */
export function isRoleDisabled(
  currentUserRole: string | null | undefined,
  targetRole: string | null | undefined
): boolean {
  return !canAssignRole(currentUserRole, targetRole);
}

/**
 * Get a user-friendly message explaining why a role is disabled
 * @param roleName - The disabled role name
 * @returns Tooltip/error message
 */
export function getDisabledRoleMessage(roleName: string): string {
  return `Insufficient permissions to assign ${roleName} role`;
}
