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
    
    const { data: userOrgRole, error: orgRoleError } = await supabase
      .from('user_organization')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', user_id)
      .eq('organization_id', decodedToken.org_id)
      .single();

    if (userOrgRole && userOrgRole.roles) {
      userRole = (userOrgRole.roles as any).name;
      console.log('✅ CURRENT USER ORGANIZATION ROLE:', userRole);
    } else {
      console.log('❌ CURRENT USER: No organization role found, keeping default:', userRole);
    }

    // If user is not Admin, check project-specific assignment
    if (userRole !== 'Admin') {
      const { data: userProject, error: userProjectError } = await supabase
        .from('user_project')
        .select(`
          user_id,
          project_id,
          role_id,
          roles!inner(id, name)
        `)
        .eq('user_id', user_id)
        .eq('project_id', existingDoc.project_id)
        .single();

      if (userProjectError || !userProject) {
        console.log('❌ User not assigned to project and not Admin:', userProjectError);
        return NextResponse.json(
          { error: 'User does not have access to this project' },
          { status: 403 }
        );
      }

      // Use project-specific role if available
      userRole = (userProject.roles as any)?.name || 'Member';
      console.log('✅ User project role:', userRole);
    }

    // Get author's organization role first - check multiple sources
    console.log('🔍 STEP 3: Checking DOCUMENT AUTHOR role');
    let authorRole = 'Member'; // Default role
    
    console.log('🔍 AUTHOR DETAILS: Checking role for user:', existingDoc.author_id, 'in org:', decodedToken.org_id);
    
    // Method 1: Check user_organization_roles table
    const { data: authorOrgRole, error: authorOrgRoleError } = await supabase
      .from('user_organization_roles')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', existingDoc.author_id)
      .eq('organization_id', decodedToken.org_id)
      .single();

    console.log('🔍 AUTHOR ORG ROLE QUERY RESULT:', { 
      authorOrgRole, 
      authorOrgRoleError,
      hasRoles: !!(authorOrgRole && authorOrgRole.roles)
    });

    if (authorOrgRole && authorOrgRole.roles) {
      authorRole = (authorOrgRole.roles as any).name;
      console.log('✅ AUTHOR ORGANIZATION ROLE FROM TABLE:', authorRole);
    } else {
      console.log('❌ NO ORGANIZATION ROLE FOUND IN TABLE FOR AUTHOR');
      
      // Method 2: Check if author is the same person making the request (to get their JWT role)
      console.log('🔍 CHECKING IF AUTHOR IS CURRENT USER:', {
        author_id: existingDoc.author_id,
        token_sub: decodedToken.sub,
        token_userId: decodedToken.userId,
        are_same: existingDoc.author_id === decodedToken.sub || existingDoc.author_id === decodedToken.userId
      });
      
      if (existingDoc.author_id === decodedToken.sub || existingDoc.author_id === decodedToken.userId) {
        authorRole = decodedToken.role || 'Member';
        console.log('✅ AUTHOR ROLE FROM JWT TOKEN (SAME USER):', authorRole);
      } else {
        // Method 3: Check users table for role information
        const { data: authorUser, error: authorUserError } = await supabase
          .from('users')
          .select('role')
          .eq('id', existingDoc.author_id)
          .single();
        
        console.log('🔍 USER TABLE QUERY RESULT:', { authorUser, authorUserError });
        
        if (authorUser && authorUser.role) {
          authorRole = authorUser.role;
          console.log('✅ AUTHOR ROLE FROM USERS TABLE:', authorRole);
        } else {
          console.log('❌ NO ROLE FOUND IN USERS TABLE, KEEPING DEFAULT MEMBER');
        }
      }
    }

    // If author is not Admin at org level, check project-specific role
    if (authorRole !== 'Admin') {
      const { data: authorProject, error: authorProjectError } = await supabase
        .from('user_project')
        .select(`
          user_id,
          project_id,
          role_id,
          roles!inner(id, name)
        `)
        .eq('user_id', existingDoc.author_id)
        .eq('project_id', existingDoc.project_id)
        .single();

      if (!authorProjectError && authorProject?.roles) {
        const projectRole = (authorProject.roles as any)?.name || 'Member';
        console.log('✅ Author project role (fallback check):', projectRole);
        // Only override if we haven't found a role yet
        if (authorRole === 'Member') {
          authorRole = projectRole;
        }
      }
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
  
  // Rule 1: Admin can delete anyone's documents
  if (currentUserRole === 'Admin') {
    console.log('✅ RULE 1 APPLIED: Current user is Admin - PERMISSION GRANTED');
    return true;
  }
  
  // Rule 2: User can delete their own documents
  if (authorId === currentUserId) {
    console.log('✅ RULE 2 APPLIED: User deleting their own document - PERMISSION GRANTED');
    return true;
  }
  
  // Rule 3: Documents created by Admin cannot be deleted by anyone else
  if (authorRole === 'Admin' && currentUserId !== authorId) {
    console.log('❌ RULE 3 APPLIED: Document created by Admin, current user is not Admin - PERMISSION DENIED');
    return false;
  }
  
  // Rule 4: Manager can delete documents of normal users (Member, Viewer)
  if (currentUserRole === 'Manager') {
    const normalUserRoles = ['Member', 'Viewer'];
    if (normalUserRoles.includes(authorRole)) {
      console.log('✅ RULE 4 APPLIED: Manager deleting document from Member/Viewer - PERMISSION GRANTED');
      return true;
    } else {
      console.log('❌ RULE 4 FAILED: Manager cannot delete document from role:', authorRole);
    }
  }
  
  console.log('❌ NO RULES MATCHED - PERMISSION DENIED');
  return false;
}