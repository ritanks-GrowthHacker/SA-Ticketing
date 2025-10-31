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
    const { doc_id, title, content, visibility, is_public } = body;

    console.log('📝 Request data:', { doc_id, user_id, title, visibility, is_public });

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

    // Check edit permissions
    const canEdit = existingDoc.author_id === user_id || userRole === 'Admin';
    
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