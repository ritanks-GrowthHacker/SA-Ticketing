import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, projectDocs, projects, userProject, globalRoles, users as usersTable, eq, and } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  sub: string;
  org_id: string;
  role: string;
  userId: string;
}

export async function PUT(request: NextRequest) {
  try {
    console.log('📝 Update Project Doc API called');
    
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
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return NextResponse.json(
        { error: "Invalid or expired token" }, 
        { status: 401 }
      );
    }

    const user_id = decodedToken.sub || decodedToken.userId; // Get user ID from token
    
    const body = await request.json();
    const { 
      doc_id, 
      title, 
      content, 
      visibility, 
      is_public,
      file_url,
      file_name,
      file_type,
      file_size
    } = body;

    console.log('📝 Request data:', { 
      doc_id, 
      user_id, 
      title, 
      visibility, 
      is_public,
      has_file: !!file_url 
    });

    // Validate required fields
    if (!doc_id) {
      return NextResponse.json(
        { error: 'Missing required field: doc_id' },
        { status: 400 }
      );
    }

    // Get the existing document and check permissions
    const existingDocsData = await db.select({
      id: projectDocs.id,
      projectId: projectDocs.projectId,
      authorId: projectDocs.authorId,
      title: projectDocs.title,
      projectName: projects.name
    })
    .from(projectDocs)
    .leftJoin(projects, eq(projectDocs.projectId, projects.id))
    .where(eq(projectDocs.id, doc_id))
    .limit(1);

    const existingDoc = existingDocsData[0];
    if (!existingDoc) {
      console.log('❌ Document not found');
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check user's project role
    console.log('🔍 Checking current user project role');
    let userRole = 'Member'; // Default role
    
    const userProjectRoleData = await db.select({
      userId: userProject.userId,
      projectId: userProject.projectId,
      roleId: userProject.roleId,
      roleName: globalRoles.name
    })
    .from(userProject)
    .leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
    .where(and(eq(userProject.userId, user_id), eq(userProject.projectId, existingDoc.projectId)))
    .limit(1);

    const userProjectRole = userProjectRoleData[0];
    console.log('🔍 User project role query:', { userProjectRole });

    if (userProjectRole && userProjectRole.roleName) {
      userRole = userProjectRole.roleName;
      console.log('✅ User project role:', userRole);
    } else {
      // User not in user_project table - check if they're the document author
      if (existingDoc.authorId === user_id) {
        console.log('⚠️ User not in user_project but is document author - allowing access');
        userRole = 'Member'; // Treat as member, can edit own doc
      } else {
        console.log('❌ User not assigned to project and not document author');
        return NextResponse.json(
          { error: 'User does not have access to this project' },
          { status: 403 }
        );
      }
    }

    console.log('✅ User has access to project');


    // Get author's project role to enforce hierarchy
    console.log('🔍 Checking document author project role');
    let authorRole = 'Member'; // Default role
    
    const authorProjectRoleData = await db.select({
      userId: userProject.userId,
      projectId: userProject.projectId,
      roleId: userProject.roleId,
      roleName: globalRoles.name
    })
    .from(userProject)
    .leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
    .where(and(eq(userProject.userId, existingDoc.authorId), eq(userProject.projectId, existingDoc.projectId)))
    .limit(1);

    const authorProjectRole = authorProjectRoleData[0];
    if (authorProjectRole && authorProjectRole.roleName) {
      authorRole = authorProjectRole.roleName;
      console.log('✅ Author project role:', authorRole);
    } else {
      console.log('⚠️ Author role not found, using default Member');
    }

    // Check edit permissions based on role hierarchy
    const canEdit = getUpdatePermission(existingDoc.authorId, user_id, userRole, authorRole);
    
    if (!canEdit) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this document' },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updatedBy: user_id,
      updatedAt: new Date()
    };

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (is_public !== undefined) updateData.isPublic = is_public;
    if (file_url !== undefined) {
      updateData.fileUrl = file_url;
      updateData.fileName = file_name;
      updateData.fileType = file_type;
      updateData.fileSize = file_size;
      updateData.hasFile = !!file_url;
    }

    // Update the document
    const updatedDocs = await db.update(projectDocs)
      .set(updateData)
      .where(eq(projectDocs.id, doc_id))
      .returning();

    const updatedDocBase = updatedDocs[0];
    if (!updatedDocBase) {
      console.error('❌ Error updating document: No doc returned');
      return NextResponse.json(
        { error: 'Failed to update project document' },
        { status: 500 }
      );
    }

    // Fetch related data
    const [author, updater, projectData] = await Promise.all([
      db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, updatedDocBase.authorId)).limit(1).then(rows => rows[0] || null),
      updatedDocBase.updatedBy ? db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, updatedDocBase.updatedBy)).limit(1).then(rows => rows[0] || null) : Promise.resolve(null),
      db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.id, updatedDocBase.projectId)).limit(1).then(rows => rows[0] || null)
    ]);

    const updatedDoc = {
      ...updatedDocBase,
      author,
      updater,
      projects: projectData
    };

    console.log('✅ Document updated successfully:', updatedDoc.id);

    return NextResponse.json({
      success: true,
      message: 'Project document updated successfully',
      document: updatedDoc
    });

  } catch (error) {
    console.error('❌ Unexpected error in update-project-doc:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to determine update permissions based on RBAC rules
// Project Admin can delete/edit anyone's documents in their project
// Project Manager can delete/edit anyone's documents EXCEPT other Managers in their project
// Member can only delete/edit their own documents
function getUpdatePermission(
  authorId: string, 
  currentUserId: string, 
  currentUserRole: string, 
  authorRole: string
): boolean {
  
  console.log('🔍 UPDATE PERMISSION CHECK:', {
    authorId,
    currentUserId,
    currentUserRole,
    authorRole
  });
  
  // Rule 1: Project Admin can edit anyone's documents in the project
  if (currentUserRole === 'Admin') {
    console.log('✅ RULE 1: Project Admin can edit any document');
    return true;
  }
  
  // Rule 2: User can edit their own documents
  if (authorId === currentUserId) {
    console.log('✅ RULE 2: User editing their own document');
    return true;
  }
  
  // Rule 3: Project Manager can edit documents of Members/Viewers, but NOT other Managers
  if (currentUserRole === 'Manager') {
    if (authorRole === 'Manager') {
      console.log('❌ RULE 3: Manager cannot edit another Manager\'s document');
      return false;
    }
    if (authorRole === 'Admin') {
      console.log('❌ RULE 3: Manager cannot edit Admin\'s document');
      return false;
    }
    console.log('✅ RULE 3: Manager editing document from Member/Viewer');
    return true;
  }
  
  console.log('❌ NO RULES MATCHED - PERMISSION DENIED');
  return false;
}