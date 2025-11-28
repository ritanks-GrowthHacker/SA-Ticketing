import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, projectDocs, projects, userProject, globalRoles, users as usersTable, eq, and } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  sub: string;
  org_id: string;
  role: string;
  userId: string;
  email: string;
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ ==== DELETE PROJECT DOC API CALLED ====');
    console.log('🔍 Request Method:', request.method);
    console.log('🔍 Request URL:', request.url);
    
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
    const { doc_id } = body;

    console.log('🗑️ DELETE REQUEST DATA:', { 
      doc_id, 
      user_id,
      token_role: decodedToken.role,
      token_email: decodedToken.email,
      token_org_id: decodedToken.org_id 
    });

    // Validate required fields
    if (!doc_id) {
      return NextResponse.json(
        { error: 'Missing required field: doc_id' },
        { status: 400 }
      );
    }

    // Get the existing document and check permissions
    console.log('🔍 STEP 1: Fetching document details for ID:', doc_id);
    
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
      console.error('❌ DOCUMENT NOT FOUND:', { doc_id });
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    console.log('✅ DOCUMENT FOUND:', { 
      id: existingDoc.id, 
      title: existingDoc.title, 
      author_id: existingDoc.authorId,
      project_id: existingDoc.projectId
    });

    // Check user's organization role first
    console.log('🔍 STEP 2: Checking CURRENT USER role');
    let userRole = 'Member'; // Default role
    let isProjectAdmin = false;
    let isProjectManager = false;
    
    // First check if user is Project Admin or Project Manager
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
      const projectRole = userProjectRole.roleName;
      console.log('✅ User project role:', projectRole);
      
      if (projectRole === 'Admin') {
        isProjectAdmin = true;
        userRole = 'Admin'; // Project Admin
      } else if (projectRole === 'Manager') {
        isProjectManager = true;
        userRole = 'Manager'; // Project Manager
      } else {
        userRole = projectRole;
      }
    } else {
      // User not in user_project table - check if they're the document author
      if (existingDoc.authorId === user_id) {
        console.log('⚠️ User not in user_project but is document author - allowing access');
        userRole = 'Member'; // Treat as member, can delete own doc
      } else {
        console.log('❌ User not assigned to project and not document author');
        return NextResponse.json(
          { error: 'User does not have access to this project' },
          { status: 403 }
        );
      }
    }
    
    console.log('✅ User role determined:', { userRole, isProjectAdmin, isProjectManager });

    // Get author's project role
    console.log('🔍 STEP 3: Checking DOCUMENT AUTHOR role');
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
    
    console.log('✅ FINAL AUTHOR ROLE DETERMINED:', authorRole);

    // Check delete permissions based on RBAC rules
    console.log('🔍 STEP 4: PERMISSION CHECK');
    console.log('🔍 PERMISSION CHECK INPUTS:', { 
      authorId: existingDoc.authorId, 
      currentUserId: user_id, 
      currentUserRole: userRole, 
      authorRole: authorRole,
      isAuthorSameAsCurrentUser: existingDoc.authorId === user_id
    });
    
    const canDelete = getDeletePermission(existingDoc.authorId, user_id, userRole, authorRole);
    console.log('🔍 PERMISSION CHECK RESULT:', canDelete);
    
    if (canDelete) {
      console.log('✅ PERMISSION GRANTED - Proceeding with deletion');
    } else {
      console.log('❌ PERMISSION DENIED - User cannot delete this document');
    }
    
    if (!canDelete) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this document' },
        { status: 403 }
      );
    }

    // Delete the document
    await db.delete(projectDocs)
      .where(eq(projectDocs.id, doc_id));

    console.log('✅ Document deleted successfully:', doc_id);

    return NextResponse.json({
      success: true,
      message: 'Project document deleted successfully',
      deletedDocId: doc_id
    });

  } catch (error) {
    console.error('❌ Unexpected error in delete-project-doc:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to determine delete permissions based on RBAC rules
// Project Admin can delete/edit anyone's documents in their project
// Project Manager can delete/edit anyone's documents EXCEPT other Managers in their project
// Member can only delete/edit their own documents
function getDeletePermission(
  authorId: string, 
  currentUserId: string, 
  currentUserRole: string, 
  authorRole: string
): boolean {
  
  console.log('🔍 PERMISSION FUNCTION INPUTS:', {
    authorId,
    currentUserId,
    currentUserRole,
    authorRole
  });
  
  // Rule 1: Project Admin can delete anyone's documents in the project
  if (currentUserRole === 'Admin') {
    console.log('✅ RULE 1 APPLIED: Current user is Project Admin - PERMISSION GRANTED');
    return true;
  }
  
  // Rule 2: User can delete their own documents
  if (authorId === currentUserId) {
    console.log('✅ RULE 2 APPLIED: User deleting their own document - PERMISSION GRANTED');
    return true;
  }
  
  // Rule 3: Project Manager can delete documents of Members/Viewers, but NOT other Managers
  if (currentUserRole === 'Manager') {
    if (authorRole === 'Manager') {
      console.log('❌ RULE 3 APPLIED: Manager cannot delete another Manager\'s document - PERMISSION DENIED');
      return false;
    }
    if (authorRole === 'Admin') {
      console.log('❌ RULE 3 APPLIED: Manager cannot delete Admin\'s document - PERMISSION DENIED');
      return false;
    }
    console.log('✅ RULE 3 APPLIED: Manager deleting document from Member/Viewer - PERMISSION GRANTED');
    return true;
  }
  
  console.log('❌ NO RULES MATCHED - PERMISSION DENIED');
  return false;
}