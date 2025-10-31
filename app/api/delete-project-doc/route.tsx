import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  sub: string;
  org_id: string;
  role: string;
  userId: string;
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ Delete Project Doc API called');
    
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

    console.log('🗑️ Request data:', { doc_id, user_id });

    // Validate required fields
    if (!doc_id) {
      return NextResponse.json(
        { error: 'Missing required field: doc_id' },
        { status: 400 }
      );
    }

    // Get the existing document and check permissions
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
      console.log('❌ Document not found:', docError);
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check user's organization role first
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
      console.log('✅ User organization role:', userRole);
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

    // Get author's role to check delete permissions
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

    const authorRole = authorProjectError ? 'Member' : (authorProject?.roles as any)?.name || 'Member';
    console.log('✅ Author role in project:', authorRole);

    // Check delete permissions based on RBAC rules
    const canDelete = getDeletePermission(existingDoc.author_id, user_id, userRole, authorRole);
    
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
  
  // Rule 1: Admin can delete anyone's documents
  if (currentUserRole === 'Admin') {
    return true;
  }
  
  // Rule 2: User can delete their own documents
  if (authorId === currentUserId) {
    return true;
  }
  
  // Rule 3: Documents created by Admin cannot be deleted by anyone else
  if (authorRole === 'Admin' && currentUserId !== authorId) {
    return false;
  }
  
  // Rule 4: Manager can delete documents of normal users (Member, Viewer)
  if (currentUserRole === 'Manager') {
    const normalUserRoles = ['Member', 'Viewer'];
    if (normalUserRoles.includes(authorRole)) {
      return true;
    }
  }
  
  return false;
}