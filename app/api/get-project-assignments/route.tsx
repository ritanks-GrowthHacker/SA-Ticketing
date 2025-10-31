import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../db/connections';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  userId: string;
  org_id: string;
  role: string;
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

    // Only authenticated users can view assignments
    // Team members can only view assignments for projects they're assigned to
    // Admins and Managers can view all assignments in their organization

    // Get query parameters for filtering
    const url = new URL(request.url);
    const projectId = url.searchParams.get('project_id');
    const userId = url.searchParams.get('user_id');

    // For Team members, verify they have access to the requested project
    if (decoded.role === 'Team' && projectId && projectId !== 'all') {
      const { data: userProjectAccess, error: accessError } = await supabase
        .from('user_project')
        .select('user_id, project_id')
        .eq('user_id', decoded.userId)
        .eq('project_id', projectId)
        .single();

      if (accessError || !userProjectAccess) {
        return NextResponse.json(
          { error: 'Access denied - You can only view assignments for projects you are assigned to' },
          { status: 403 }
        );
      }
    }

    // Team members must specify a project_id (can't view all assignments)
    if (decoded.role === 'Team' && (!projectId || projectId === 'all')) {
      return NextResponse.json(
        { error: 'Project ID is required for your role' },
        { status: 400 }
      );
    }

    // Build the query - filter by projects belonging to the organization
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
        roles (
          id,
          name,
          description
        )
      `)
      .eq('projects.organization_id', decoded.org_id);

    // Apply filters if provided
    if (projectId && projectId !== 'all') {
      query = query.eq('project_id', projectId);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: assignments, error } = await query;

    if (error) {
      console.error('Error fetching assignments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch assignments' },
        { status: 500 }
      );
    }

    // Transform the data for easier consumption
    const transformedAssignments = assignments?.map((assignment: any) => {
      // Handle potential array returns from foreign key relationships
      const user = Array.isArray(assignment.users) ? assignment.users[0] : assignment.users;
      const project = Array.isArray(assignment.projects) ? assignment.projects[0] : assignment.projects;
      const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;

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

    return NextResponse.json(
      {
        success: true,
        assignments: transformedAssignments,
        count: transformedAssignments.length
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