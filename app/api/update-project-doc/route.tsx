import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
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

    // Check user's project role
    console.log('🔍 Checking current user project role');
    let userRole = 'Member'; // Default role
    
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
      userRole = (userProjectRole.global_roles as any)?.name || 'Member';
      console.log('✅ User project role:', userRole);
    } else {
      // User not in user_project table - check if they're the document author
      if (existingDoc.author_id === user_id) {
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
    
    const { data: authorProjectRole } = await supabase
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

    // Check edit permissions based on role hierarchy
    const canEdit = getUpdatePermission(existingDoc.author_id, user_id, userRole, authorRole);
    
    if (!canEdit) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this document' },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updated_by: user_id,
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (is_public !== undefined) updateData.is_public = is_public;
    if (file_url !== undefined) {
      updateData.file_url = file_url;
      updateData.file_name = file_name;
      updateData.file_type = file_type;
      updateData.file_size = file_size;
      updateData.has_file = !!file_url;
    }

    // Update the document
    const { data: updatedDoc, error: updateError } = await supabase
      .from('project_docs')
      .update(updateData)
      .eq('id', doc_id)
      .select(`
        *,
        author:users!author_id(id, name, email),
        updater:users!updated_by(id, name, email),
        projects!inner(id, name)
      `)
      .single();

    if (updateError) {
      console.error('❌ Error updating document:', updateError);
      return NextResponse.json(
        { error: 'Failed to update project document', details: updateError.message },
        { status: 500 }
      );
    }

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