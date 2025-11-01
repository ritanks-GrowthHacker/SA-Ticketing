import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../db/connections';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  sub: string;
  userId?: string;
  org_id: string;
  role: string;
  roles?: string[];
}


export async function GET(request: NextRequest) {
  try {
    // Extract JWT token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    let decoded: DecodedToken;

    try {
      decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    console.log('🔍 GET PROJECT ASSIGNMENTS - User Info:', {
      user_id: decoded.sub,
      role: decoded.role,
      org_id: decoded.org_id,
      roles: decoded.roles
    });

    // Get current user's ID
    const currentUserId = decoded.sub || decoded.userId;

    // Get query parameters for filtering
    const url = new URL(request.url);
    const projectId = url.searchParams.get('project_id');
    const userId = url.searchParams.get('user_id');

    console.log('🔍 Query Parameters:', { projectId, userId });

    // RBAC: Role-based access control
    const userRole = decoded.role;
    const isAdmin = userRole === 'Admin';
    const isManager = userRole === 'Manager';
    const isMember = userRole === 'Member';
    const isViewer = userRole === 'Viewer';

    // For Members/Viewers, verify they have access to the requested project
    if ((isMember || isViewer) && projectId && projectId !== 'all') {
      console.log('🔍 Checking Member/Viewer project access for:', projectId);
      const { data: userProjectAccess, error: accessError } = await supabase
        .from('user_project')
        .select('user_id, project_id')
        .eq('user_id', currentUserId)
        .eq('project_id', projectId)
        .single();

      if (accessError || !userProjectAccess) {
        console.log('❌ Member/Viewer access denied:', accessError);
        return NextResponse.json(
          { error: 'Access denied - You can only view assignments for projects you are assigned to' },
          { status: 403 }
        );
      }
      console.log('✅ Member/Viewer has project access');
    }

    // Members and Viewers must specify a project_id (can't view all assignments)
    if ((isMember || isViewer) && (!projectId || projectId === 'all')) {
      return NextResponse.json(
        { error: 'Project ID is required for your role' },
        { status: 400 }
      );
    }

    // Build the query - filter by projects belonging to the organization
    console.log('🔍 Building query for organization:', decoded.org_id);
    
    let query = supabase
      .from('user_project')
      .select(`
        user_id,
        project_id,
        role_id,
        users!inner (
          id,
          name,
          email
        ),
        projects!inner (
          id,
          name,
          description,
          organization_id
        ),
        global_roles!user_project_global_role_id_fkey (
          id,
          name,
          description
        )
      `)
      .eq('projects.organization_id', decoded.org_id);

    // Apply filters if provided
    if (projectId && projectId !== 'all') {
      console.log('🔍 Filtering by project_id:', projectId);
      query = query.eq('project_id', projectId);
    }

    if (userId) {
      console.log('🔍 Filtering by user_id:', userId);
      query = query.eq('user_id', userId);
    }

    // For Members/Viewers, only show their own assignments unless they have project access
    if ((isMember || isViewer) && !projectId) {
      console.log('🔍 Member/Viewer: filtering to own assignments only');
      query = query.eq('user_id', currentUserId);
    }

    console.log('🔍 Executing query...');
    const { data: assignments, error } = await query;

    if (error) {
      console.error('❌ Error fetching assignments:', error);
      console.error('❌ Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return NextResponse.json(
        { error: 'Failed to fetch assignments', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Query successful, found assignments:', assignments?.length || 0);

    // Transform the data for easier consumption
    const transformedAssignments = assignments?.map((assignment: any) => {
      // Handle potential array returns from foreign key relationships
      const user = Array.isArray(assignment.users) ? assignment.users[0] : assignment.users;
      const project = Array.isArray(assignment.projects) ? assignment.projects[0] : assignment.projects;
      const role = Array.isArray(assignment.global_roles) ? assignment.global_roles[0] : assignment.global_roles;

      return {
        user_id: assignment.user_id,
        project_id: assignment.project_id,
        role_id: assignment.role_id,
        user_name: user?.name || 'Unknown',
        user_email: user?.email || '',
        project_name: project?.name || 'Unknown Project',
        project_description: project?.description || '',
        role_name: role?.name || 'Unknown Role',
        role_description: role?.description || ''
      };
    }) || [];

    console.log('✅ Returning assignments:', {
      count: transformedAssignments.length,
      userRole: userRole,
      projectId: projectId,
      userId: userId
    });

    return NextResponse.json(
      {
        success: true,
        assignments: transformedAssignments,
        count: transformedAssignments.length,
        filters: {
          projectId,
          userId,
          userRole
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in get-project-assignments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}