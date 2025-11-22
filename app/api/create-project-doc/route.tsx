import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
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
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, organization_id, name')
      .eq('id', project_id)
      .eq('organization_id', decodedToken.org_id)
      .single();

    if (projectError || !project) {
      console.log('❌ Project not found or not in user organization:', projectError);
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
    
    const { data: userOrgRole, error: orgRoleError } = await supabase
      .from('user_organization_roles')
      .select(`
        role_id,
        global_roles!user_organization_roles_role_id_fkey(name)
      `)
      .eq('user_id', author_id)
      .eq('organization_id', decodedToken.org_id)
      .single();

    console.log('🔧 User org role query result:', { userOrgRole, orgRoleError });

    if (userOrgRole && userOrgRole.global_roles) {
      userRole = (userOrgRole.global_roles as any).name;
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
      const { data: userProject, error: userProjectError } = await supabase
        .from('user_project')
        .select(`
          user_id,
          project_id,
          role_id,
          global_roles!user_project_role_id_fkey(name)
        `)
        .eq('user_id', author_id)
        .eq('project_id', project_id)
        .single();

      if (!userProjectError && userProject) {
        hasAccess = true;
        console.log('✅ User is project team member - can create documents');
      } else {
        console.log('❌ User not assigned to project and not Admin:', userProjectError);
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
    const { data: newDoc, error: createError } = await supabase
      .from('project_docs')
      .insert({
        project_id,
        author_id,
        title,
        content,
        visibility,
        is_public,
        file_url,
        file_name,
        file_type,
        file_size,
        has_file: !!file_url,
        updated_by: author_id
      })
      .select(`
        *,
        author:users!author_id(id, name, email),
        updater:users!updated_by(id, name, email),
        projects!inner(id, name)
      `)
      .single();

    if (createError) {
      console.error('❌ Error creating document:', createError);
      return NextResponse.json(
        { error: 'Failed to create project document', details: createError.message },
        { status: 500 }
      );
    }

    console.log('✅ Document created successfully:', newDoc.id);

    return NextResponse.json({
      success: true,
      message: 'Project document created successfully',
      document: newDoc
    });

  } catch (error) {
    console.error('❌ Unexpected error in create-project-doc:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}