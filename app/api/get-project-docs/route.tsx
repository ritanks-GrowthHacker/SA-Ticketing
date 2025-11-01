import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  sub: string;
  org_id: string;
  role: string;
  userId: string;
}

/**
 * PROJECT DOCUMENTS RBAC WORKFLOW:
 * 
 * 📖 VISIBILITY: Documents visible to project team members + organization admins
 * ✏️  CREATION: All project team members can create documents
 * 🗑️  DELETION: 
 *    - Admin: Can delete anyone's documents
 *    - Manager: Can delete their own + Member/Viewer documents (not other Manager docs)
 *    - Member/Viewer: Can only delete their own documents
 * 🔒 ACCESS: Only project team members and organization admins can access documents
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📖 Get Project Docs API called');
    
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
      console.log('🔧 Decoded token:', decodedToken);
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return NextResponse.json(
        { error: "Invalid or expired token" }, 
        { status: 401 }
      );
    }

    const user_id = decodedToken.sub || decodedToken.userId; // Get user ID from token
    console.log('🔧 User ID extracted:', user_id);
    
    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');

    console.log('📖 Request params:', { project_id, user_id });

    if (!project_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: project_id' },
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
    } else {
      console.log('❌ No organization role found, using default Member role');
    }

    // Check access: Admin (org-level) OR Project team member
    let hasAccess = false;
    let projectRole = userRole; // Default to org role
    
    if (userRole === 'Admin') {
      console.log('✅ Admin user - full organization access granted');
      hasAccess = true;
    } else {
      console.log('🔍 Non-Admin user, checking project team membership for:', { user_id, project_id, userRole });
      
      // Check if user is part of the project team
      const { data: userProject, error: userProjectError } = await supabase
        .from('user_project')
        .select(`
          user_id,
          project_id,
          role_id,
          global_roles!user_project_role_id_fkey(id, name)
        `)
        .eq('user_id', user_id)
        .eq('project_id', project_id)
        .single();

      console.log('🔍 Project team membership check result:', { userProject, userProjectError });

      if (!userProjectError && userProject) {
        hasAccess = true;
        projectRole = (userProject.global_roles as any)?.name || 'Member';
        console.log('✅ User is project team member with role:', projectRole);
      } else {
        console.log('❌ User is not part of project team and not Admin');
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied. Only project team members and organization admins can view documents.' },
        { status: 403 }
      );
    }

    // Get all project documents (all team members can see all project docs)
    let query = supabase
      .from('project_docs')
      .select(`
        *,
        author:users!author_id(id, name, email),
        updater:users!updated_by(id, name, email),
        projects!inner(id, name)
      `)
      .eq('project_id', project_id);

    // No visibility restrictions - all project team members can see all project documents

    const { data: docs, error: docsError } = await query.order('created_at', { ascending: false });

    if (docsError) {
      console.error('❌ Error fetching documents:', docsError);
      return NextResponse.json(
        { error: 'Failed to fetch project documents', details: docsError.message },
        { status: 500 }
      );
    }

    console.log('✅ Documents fetched successfully:', docs?.length || 0);

    // Add permission flags for each document with enhanced RBAC
    const docsWithPermissions = await Promise.all(
      docs?.map(async (doc) => ({
        ...doc,
        permissions: {
          canEdit: doc.author_id === user_id || userRole === 'Admin',
          canDelete: await getDeletePermission(doc.author_id, user_id, userRole, project_id)
        }
      })) || []
    );

    return NextResponse.json({
      success: true,
      documents: docsWithPermissions || [],
      userRole,
      totalCount: docsWithPermissions?.length || 0
    });

  } catch (error) {
    console.error('❌ Unexpected error in get-project-docs:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to determine delete permissions with enhanced RBAC
async function getDeletePermission(authorId: string, currentUserId: string, currentUserRole: string, projectId: string): Promise<boolean> {
  // Rule 1: Admin can delete anyone's documents
  if (currentUserRole === 'Admin') {
    return true;
  }
  
  // Rule 2: User can delete their own documents
  if (authorId === currentUserId) {
    return true;
  }
  
  // Rule 3: Get author's role to apply proper RBAC
  try {
    const { data: authorProject } = await supabase
      .from('user_project')
      .select(`
        user_id,
        project_id,
        role_id,
        roles!inner(id, name)
      `)
      .eq('user_id', authorId)
      .eq('project_id', projectId)
      .single();

    const authorRole = (authorProject?.roles as any)?.name || 'Member';

    // Rule 4: Documents created by Admin cannot be deleted by anyone else (except Admin)
    if (authorRole === 'Admin' && currentUserRole !== 'Admin') {
      return false;
    }

    // Rule 5: Manager can delete documents of normal users (Member, Viewer)
    if (currentUserRole === 'Manager') {
      const normalUserRoles = ['Member', 'Viewer'];
      if (normalUserRoles.includes(authorRole)) {
        return true;
      }
    }

  } catch (error) {
    console.error('Error fetching author role:', error);
    return false;
  }
  
  return false;
}