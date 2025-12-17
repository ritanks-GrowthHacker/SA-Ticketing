// Enhanced RBAC helper functions for project documents

import { db } from '@/db';
import { userProject, globalRoles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export interface RBACResult {
  canCreate: boolean;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
  userRole: string;
  reasons: string[];
}

export interface DocumentRBAC {
  documentId: string;
  authorId: string;
  authorRole: string;
  projectId: string;
  visibility: string;
  isPublic: boolean;
}

/**
 * Comprehensive RBAC validation for project documents
 * 
 * Rules:
 * 1. Admin can do everything
 * 2. Users can manage their own documents
 * 3. Documents created by Admin cannot be deleted by non-Admin users
 * 4. Manager can delete documents of Member/Viewer roles only
 * 5. Project visibility documents are visible to all project members
 * 6. Public documents are visible to everyone in the organization
 * 7. Private documents are only visible to the author and Admins
 */
export async function validateProjectDocumentRBAC(
  userId: string,
  projectId: string,
  documentInfo?: DocumentRBAC
): Promise<RBACResult> {
  
  const result: RBACResult = {
    canCreate: false,
    canRead: false,
    canEdit: false,
    canDelete: false,
    userRole: '',
    reasons: []
  };

  try {
    // Get user's role in the project
    const userProjectData = await db
      .select({
        userId: userProject.userId,
        projectId: userProject.projectId,
        roleId: userProject.roleId,
        roleName: globalRoles.name
      })
      .from(userProject)
      .innerJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
      .where(and(
        eq(userProject.userId, userId),
        eq(userProject.projectId, projectId)
      ))
      .limit(1);

    if (!userProjectData || userProjectData.length === 0) {
      result.reasons.push('User does not have access to this project');
      return result;
    }

    const userRole = userProjectData[0].roleName || 'Member';
    result.userRole = userRole;

    // Base permissions for project members
    result.canCreate = true;
    result.reasons.push(`User has ${userRole} role in project`);

    // Admin permissions
    if (userRole === 'Admin') {
      result.canCreate = true;
      result.canRead = true;
      result.canEdit = true;
      result.canDelete = true;
      result.reasons.push('Admin has full permissions');
      return result;
    }

    // Document-specific permissions
    if (documentInfo) {
      const { documentId, authorId, authorRole, visibility, isPublic } = documentInfo;

      // Read permissions
      if (isPublic) {
        result.canRead = true;
        result.reasons.push('Document is public');
      } else if (visibility === 'project') {
        result.canRead = true;
        result.reasons.push('Document is visible to project team');
      } else if (authorId === userId) {
        result.canRead = true;
        result.reasons.push('User is the document author');
      } else {
        result.reasons.push('Document is private and user is not the author');
      }

      // Edit permissions
      if (authorId === userId) {
        result.canEdit = true;
        result.reasons.push('User can edit their own documents');
      } else {
        result.reasons.push('User cannot edit documents created by others');
      }

      // Delete permissions with enhanced RBAC rules
      if (authorId === userId) {
        result.canDelete = true;
        result.reasons.push('User can delete their own documents');
      } else if (authorRole === 'Admin') {
        result.canDelete = false;
        result.reasons.push('Documents created by Admin cannot be deleted by non-Admin users');
      } else if (userRole === 'Manager' && ['Member', 'Viewer'].includes(authorRole)) {
        result.canDelete = true;
        result.reasons.push('Manager can delete documents created by Member/Viewer roles');
      } else {
        result.reasons.push(`${userRole} cannot delete documents created by ${authorRole}`);
      }

    } else {
      // General read permission for listing documents
      result.canRead = true;
      result.reasons.push('User can view project documents list');
    }

  } catch (error) {
    console.error('Error in RBAC validation:', error);
    result.reasons.push('Error occurred during permission validation');
  }

  return result;
}

/**
 * Get author's role for a specific document
 */
export async function getDocumentAuthorRole(authorId: string, projectId: string): Promise<string> {
  try {
    const authorProjectData = await db
      .select({
        roleName: globalRoles.name
      })
      .from(userProject)
      .innerJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
      .where(and(
        eq(userProject.userId, authorId),
        eq(userProject.projectId, projectId)
      ))
      .limit(1);

    return authorProjectData[0]?.roleName || 'Member';
  } catch (error) {
    console.error('Error fetching author role:', error);
    return 'Member';
  }
}

/**
 * Validate if user can perform a specific action on a document
 */
export async function canPerformAction(
  action: 'create' | 'read' | 'edit' | 'delete',
  userId: string,
  projectId: string,
  documentInfo?: DocumentRBAC
): Promise<{ allowed: boolean; reason: string }> {
  
  const rbac = await validateProjectDocumentRBAC(userId, projectId, documentInfo);
  
  let allowed = false;
  let reason = '';

  switch (action) {
    case 'create':
      allowed = rbac.canCreate;
      reason = allowed ? 'User can create documents' : 'User cannot create documents in this project';
      break;
    case 'read':
      allowed = rbac.canRead;
      reason = allowed ? 'User can read this document' : 'User cannot access this document';
      break;
    case 'edit':
      allowed = rbac.canEdit;
      reason = allowed ? 'User can edit this document' : 'User cannot edit this document';
      break;
    case 'delete':
      allowed = rbac.canDelete;
      reason = allowed ? 'User can delete this document' : 'User cannot delete this document';
      break;
  }

  return { allowed, reason };
}

/**
 * Log RBAC decisions for auditing
 */
export function logRBACDecision(
  action: string,
  userId: string,
  resourceId: string,
  allowed: boolean,
  reason: string
): void {
  console.log(`🔒 RBAC Decision: ${action} on ${resourceId} by ${userId} - ${allowed ? 'ALLOWED' : 'DENIED'} - ${reason}`);
}