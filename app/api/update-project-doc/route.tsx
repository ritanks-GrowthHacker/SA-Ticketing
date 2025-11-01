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
      .from('user_organization_roles')
      .select(`
        role_id,
        global_roles!user_organization_roles_role_id_fkey(name)
      `)
      .eq('user_id', user_id)
      .eq('organization_id', decodedToken.org_id)
      .single();

    if (userOrgRole && userOrgRole.global_roles) {
      userRole = (userOrgRole.global_roles as any).name;
      console.log('✅ User organization role:', userRole);
    }

    // Check access: Admin (org-level) OR Project team member
    let hasAccess = false;
    
    if (userRole === 'Admin') {
      console.log('✅ Admin user - can update any document');
      hasAccess = true;
    } else {
      // For non-admin users, check project team membership
      const { data: userProject, error: userProjectError } = await supabase
        .from('user_project')
        .select(`
          user_id,
          project_id,
          role_id,
          global_roles!user_project_role_id_fkey(id, name)
        `)
        .eq('user_id', user_id)
        .eq('project_id', existingDoc.project_id)
        .single();

      if (!userProjectError && userProject) {
        hasAccess = true;
        console.log('✅ User is project team member - can update documents');
      } else {
        console.log('❌ User not assigned to project and not Admin:', userProjectError);
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied. Only project team members and organization admins can update documents.' },
        { status: 403 }
      );
    }

    console.log('✅ User has access to update documents in project');

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