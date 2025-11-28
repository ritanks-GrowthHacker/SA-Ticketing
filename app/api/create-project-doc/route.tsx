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

export async function POST(request: NextRequest) {
  try {
    console.log('📝 Create Project Doc API called - UPDATED VERSION');
    
    // Get JWT token from authorization header
    const authHeader = request.headers.get("authorization");
    console.log('🔧 Auth header received:', authHeader);
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('❌ Missing or invalid auth header');
      return NextResponse.json(
        { error: "Missing or invalid authorization header" }, 
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    console.log('🔧 Token extracted:', token ? 'Token present' : 'Token missing');
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

    const author_id = decodedToken.sub || decodedToken.userId; // Get user ID from token
    console.log('🔧 Author ID extracted:', author_id);
    
    const body = await request.json();
    const { 
      project_id, 
      title, 
      content, 
      visibility = 'project', 
      is_public = false,
      file_url,
      file_name,
      file_type,
      file_size
    } = body;

    console.log('📝 Request data:', { 
      project_id, 
      author_id, 
      title, 
      visibility, 
      is_public, 
      has_file: !!file_url 
    });

    // Validate required fields - either content or file must be provided
    if (!project_id || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: project_id, title' },
        { status: 400 }
      );
    }

    if (!content && !file_url) {
      return NextResponse.json(
        { error: 'Either content or file must be provided' },
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

    // Check if user has access to the project (either through assignment or Admin role)
    let userRole = 'Member'; // Default role
    
    // Check user's organization role first
    console.log('🔧 Checking organization role for user:', author_id, 'in org:', decodedToken.org_id);
    
    const userOrgRoleData = await db.select({
      roleId: userOrganizationRoles.roleId,
      roleName: globalRoles.name
    })
    .from(userOrganizationRoles)
    .leftJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
    .where(and(eq(userOrganizationRoles.userId, author_id), eq(userOrganizationRoles.organizationId, decodedToken.org_id)))
    .limit(1);

    const userOrgRole = userOrgRoleData[0];
    console.log('🔧 User org role query result:', { userOrgRole });

    if (userOrgRole && userOrgRole.roleName) {
      userRole = userOrgRole.roleName;
      console.log('✅ User organization role:', userRole);
    } else {
      console.log('⚠️ No organization role found, using JWT role:', decodedToken.role);
      // Fall back to JWT role if available
      userRole = decodedToken.role || 'Member';
    }

    // Check access: Admin (org-level) OR Project team member
    let hasAccess = false;
    
    if (userRole === 'Admin') {
      console.log('✅ Admin user - can create documents in any project');
      hasAccess = true;
    } else {
      // For non-admin users, check project team membership
      const userProjectData = await db.select({
        userId: userProject.userId,
        projectId: userProject.projectId,
        roleId: userProject.roleId,
        roleName: globalRoles.name
      })
      .from(userProject)
      .leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
      .where(and(eq(userProject.userId, author_id), eq(userProject.projectId, project_id)))
      .limit(1);

      const userProjectEntry = userProjectData[0];
      if (userProjectEntry) {
        hasAccess = true;
        console.log('✅ User is project team member - can create documents');
      } else {
        console.log('❌ User not assigned to project and not Admin');
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied. Only project team members and organization admins can create documents.' },
        { status: 403 }
      );
    }

    console.log('✅ User has access to create documents in project');

    // Create the project document
    const newDocs = await db.insert(projectDocs)
      .values({
        projectId: project_id,
        authorId: author_id,
        title,
        content,
        visibility,
        isPublic: is_public,
        fileUrl: file_url,
        fileName: file_name,
        fileType: file_type,
        fileSize: file_size,
        hasFile: !!file_url,
        updatedBy: author_id
      })
      .returning();

    const newDoc = newDocs[0];
    if (!newDoc) {
      console.error('❌ Error creating document: No doc returned');
      return NextResponse.json(
        { error: 'Failed to create project document' },
        { status: 500 }
      );
    }

    // Fetch related data
    const [author, updater, projectData] = await Promise.all([
      db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, newDoc.authorId)).limit(1).then(rows => rows[0] || null),
      newDoc.updatedBy ? db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, newDoc.updatedBy)).limit(1).then(rows => rows[0] || null) : Promise.resolve(null),
      db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.id, newDoc.projectId)).limit(1).then(rows => rows[0] || null)
    ]);

    const formattedDoc = {
      ...newDoc,
      author,
      updater,
      projects: projectData
    };

    console.log('✅ Document created successfully:', newDoc.id);

    return NextResponse.json({
      success: true,
      message: 'Project document created successfully',
      document: formattedDoc
    });

  } catch (error) {
    console.error('❌ Unexpected error in create-project-doc:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}