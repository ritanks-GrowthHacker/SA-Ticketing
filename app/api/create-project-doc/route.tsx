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
    const { project_id, title, content, visibility = 'project', is_public = false } = body;

    console.log('📝 Request data:', { project_id, author_id, title, visibility, is_public });

    // Validate required fields
    if (!project_id || !title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: project_id, title, content' },
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
      .from('user_organization')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', author_id)
      .eq('organization_id', decodedToken.org_id)
      .single();

    console.log('🔧 User org role query result:', { userOrgRole, orgRoleError });

    if (userOrgRole && userOrgRole.roles) {
      userRole = (userOrgRole.roles as any).name;
      console.log('✅ User organization role:', userRole);
    } else {
      console.log('⚠️ No organization role found, using JWT role:', decodedToken.role);
      // Fall back to JWT role if available
      userRole = decodedToken.role || 'Member';
    }

    // If user is Admin, they have access to all projects in the organization
    if (userRole !== 'Admin') {
      // For non-admin users, check project-specific assignment
      const { data: userProject, error: userProjectError } = await supabase
        .from('user_project')
        .select(`
          user_id,
          project_id,
          roles!inner(name)
        `)
        .eq('user_id', author_id)
        .eq('project_id', project_id)
        .single();

      if (userProjectError || !userProject) {
        console.log('❌ User not assigned to project and not Admin:', userProjectError);
        return NextResponse.json(
          { error: 'User does not have access to this project' },
          { status: 403 }
        );
      }

      // Use project-specific role if available
      userRole = (userProject.roles as any).name;
      console.log('✅ User project role:', userRole);
    }

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