import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
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
    
    const { data: existingDoc, error: docError } = await supabase
      .from('project_docs')
      .select(`
        *,
        projects!inner(id, name),
        author:users!author_id(id, name, email)
      `)
      .eq('id', doc_id)
      .single();

    if (docError || !existingDoc) {
      console.error('❌ DOCUMENT NOT FOUND:', { docError, doc_id });
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    console.log('✅ DOCUMENT FOUND:', { 
      id: existingDoc.id, 
      title: existingDoc.title, 
      author_id: existingDoc.author_id,
      project_id: existingDoc.project_id,
      author_email: existingDoc.author?.email
    });

    // Check user's organization role first
    console.log('🔍 STEP 2: Checking CURRENT USER role');
    let userRole = 'Member'; // Default role
    let isProjectAdmin = false;
    let isProjectManager = false;
    
    // First check if user is Project Admin or Project Manager
    const { data: userProjectRole, error: userProjectError } = await supabase
      .from('user_project')
      .select(`
        user_id,
        project_id,
        role_id,
        global_roles!inner(id, name)
      `)
      .eq('user_id', user_id)
      .eq('project_id', existingDoc.project_id)
      .single();

    console.log('🔍 User project role query:', { userProjectRole, userProjectError });

    if (userProjectRole?.global_roles) {
      const projectRole = (userProjectRole.global_roles as any)?.name || 'Member';
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
      if (existingDoc.author_id === user_id) {
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
    
    const { data: authorProjectRole, error: authorProjectError } = await supabase
      .from('user_project')
      .select(`
        user_id,
        project_id,
        role_id,
        global_roles!inner(id, name)
      `)
      .eq('user_id', existingDoc.author_id)
      .eq('project_id', existingDoc.project_id)
      .single();

    if (authorProjectRole?.global_roles) {
      authorRole = (authorProjectRole.global_roles as any)?.name || 'Member';
      console.log('✅ Author project role:', authorRole);
    } else {
      console.log('⚠️ Author role not found, using default Member');
    }
    
    console.log('✅ FINAL AUTHOR ROLE DETERMINED:', authorRole);

    // Check delete permissions based on RBAC rules
    console.log('🔍 STEP 4: PERMISSION CHECK');
    console.log('🔍 PERMISSION CHECK INPUTS:', { 
      authorId: existingDoc.author_id, 
      currentUserId: user_id, 
      currentUserRole: userRole, 
      authorRole: authorRole,
      isAuthorSameAsCurrentUser: existingDoc.author_id === user_id
    });
    
    const canDelete = getDeletePermission(existingDoc.author_id, user_id, userRole, authorRole);
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
    const { error: deleteError } = await supabase
      .from('project_docs')
      .delete()
      .eq('id', doc_id);

    if (deleteError) {
      console.error('❌ Error deleting document:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete project document', details: deleteError.message },
        { status: 500 }
      );
    }

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