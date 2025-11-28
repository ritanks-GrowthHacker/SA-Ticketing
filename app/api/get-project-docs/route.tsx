import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, projects, userOrganizationRoles, userProject, globalRoles, projectDocs, users as usersTable, eq, and } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  sub: string;
  org_id: string;
  role: string;
  userId: string;
}

/**
 * PROJECT DOCUMENTS RBAC WORKFLOW:
 * 
 * 📖 VISIBILITY: Documents visible to project team members + organization admins
 * ✏️  CREATION: All project team members can create documents
 * 🗑️  DELETION: 
 *    - Admin: Can delete anyone's documents
 *    - Manager: Can delete their own + Member/Viewer documents (not other Manager docs)
 *    - Member/Viewer: Can only delete their own documents
 * 🔒 ACCESS: Only project team members and organization admins can access documents
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📖 Get Project Docs API called');
    
    // Get JWT token from authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" }, 
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    let decodedToken: JWTPayload;
    
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      console.log('🔧 Decoded token:', decodedToken);
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return NextResponse.json(
        { error: "Invalid or expired token" }, 
        { status: 401 }
      );
    }

    const user_id = decodedToken.sub || decodedToken.userId; // Get user ID from token
    console.log('🔧 User ID extracted:', user_id);
    
    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');

    console.log('📖 Request params:', { project_id, user_id });

    if (!project_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: project_id' },
        { status: 400 }
      );
    }

    // First check if project exists in user's organization
    const project = await db.select({ id: projects.id, organizationId: projects.organizationId, name: projects.name })
      .from(projects)
      .where(and(eq(projects.id, project_id), eq(projects.organizationId, decodedToken.org_id)))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!project) {
      console.log('❌ Project not found or not in user organization');
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 403 }
      );
    }

    console.log('✅ Project found in organization:', project);

    // Check user's organization role first  
    let userRole = 'Member'; // Default role
    
    const userOrgRoleData = await db.select({
      roleId: userOrganizationRoles.roleId,
      roleName: globalRoles.name
    })
    .from(userOrganizationRoles)
    .leftJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
    .where(and(eq(userOrganizationRoles.userId, user_id), eq(userOrganizationRoles.organizationId, decodedToken.org_id)))
    .limit(1);

    const userOrgRole = userOrgRoleData[0];
    if (userOrgRole && userOrgRole.roleName) {
      userRole = userOrgRole.roleName;
      console.log('✅ User organization role:', userRole);
    } else {
      console.log('❌ No organization role found, using default Member role');
    }

    // Check access: Admin (org-level) OR Project team member
    let hasAccess = false;
    let projectRole = userRole; // Default to org role
    
    if (userRole === 'Admin') {
      console.log('✅ Admin user - full organization access granted');
      hasAccess = true;
    } else {
      console.log('🔍 Non-Admin user, checking project team membership for:', { user_id, project_id, userRole });
      
      // Check if user is part of the project team
      const userProjectData = await db.select({
        userId: userProject.userId,
        projectId: userProject.projectId,
        roleId: userProject.roleId,
        roleName: globalRoles.name
      })
      .from(userProject)
      .leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
      .where(and(eq(userProject.userId, user_id), eq(userProject.projectId, project_id)))
      .limit(1);

      const userProjectEntry = userProjectData[0];
      console.log('🔍 Project team membership check result:', { userProjectEntry });

      if (userProjectEntry) {
        hasAccess = true;
        projectRole = userProjectEntry.roleName || 'Member';
        console.log('✅ User is project team member with role:', projectRole);
      } else {
        console.log('❌ User is not part of project team and not Admin');
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied. Only project team members and organization admins can view documents.' },
        { status: 403 }
      );
    }

    // Get all project documents (all team members can see all project docs)
    const docsData = await db.select({
      id: projectDocs.id,
      projectId: projectDocs.projectId,
      authorId: projectDocs.authorId,
      title: projectDocs.title,
      content: projectDocs.content,
      visibility: projectDocs.visibility,
      isPublic: projectDocs.isPublic,
      createdAt: projectDocs.createdAt,
      updatedAt: projectDocs.updatedAt,
      updatedBy: projectDocs.updatedBy,
      fileUrl: projectDocs.fileUrl,
      fileName: projectDocs.fileName,
      fileType: projectDocs.fileType,
      fileSize: projectDocs.fileSize,
      hasFile: projectDocs.hasFile,
      authorName: usersTable.name,
      authorEmail: usersTable.email
    })
    .from(projectDocs)
    .leftJoin(usersTable, eq(projectDocs.authorId, usersTable.id))
    .leftJoin(projects, eq(projectDocs.projectId, projects.id))
    .where(eq(projectDocs.projectId, project_id))
    .orderBy(projectDocs.createdAt);

    console.log('✅ Documents fetched successfully:', docsData.length);

    // Add permission flags for each document with enhanced RBAC
    const docsWithPermissions = docsData.map((doc) => ({
      id: doc.id,
      project_id: doc.projectId,
      author_id: doc.authorId,
      title: doc.title,
      content: doc.content,
      visibility: doc.visibility,
      is_public: doc.isPublic,
      created_at: doc.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: doc.updatedAt?.toISOString() || new Date().toISOString(),
      updated_by: doc.updatedBy,
      file_url: doc.fileUrl,
      file_name: doc.fileName,
      file_type: doc.fileType,
      file_size: doc.fileSize,
      has_file: doc.hasFile,
      author: {
        id: doc.authorId,
        name: doc.authorName,
        email: doc.authorEmail
      },
      permissions: {
        canEdit: doc.authorId === user_id || userRole === 'Admin',
        canDelete: doc.authorId === user_id || userRole === 'Admin' || (userRole === 'Manager' && projectRole !== 'Admin' && projectRole !== 'Manager')
      }
    }));

    return NextResponse.json({
      success: true,
      documents: docsWithPermissions || [],
      userRole,
      totalCount: docsWithPermissions.length || 0
    });

  } catch (error) {
    console.error('❌ Unexpected error in get-project-docs:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}