import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '../../db/connections';
import { db, userProject, users, projects, globalRoles, eq, and } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  sub: string;
  userId?: string;
  org_id: string;
  role: string;
  roles?: string[];
  department_role?: string; // Add this field
  project_role?: string;    // Add this field
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

    const currentUserId = decoded.sub || decoded.userId;
    const url = new URL(request.url);
    const projectId = url.searchParams.get('project_id');
    const userId = url.searchParams.get('user_id');

    // Build the query - filter by projects belonging to the organization
    let whereConditions = [eq(projects.organizationId, decoded.org_id)];

    // Apply filters if provided
    if (projectId && projectId !== 'all') {
      whereConditions.push(eq(userProject.projectId, projectId));
    }

    if (userId) {
      whereConditions.push(eq(userProject.userId, userId));
    }

    const assignments = await db.select({
      userId: userProject.userId,
      projectId: userProject.projectId,
      roleId: userProject.roleId,
      userName: users.name,
      userEmail: users.email,
      projectName: projects.name,
      projectDescription: projects.description,
      roleName: globalRoles.name,
      roleDescription: globalRoles.description
    })
      .from(userProject)
      .innerJoin(users, eq(userProject.userId, users.id))
      .innerJoin(projects, eq(userProject.projectId, projects.id))
      .leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
      .where(and(...whereConditions));

    console.log('✅ Query successful, found assignments:', assignments?.length || 0);

    // Transform the data for easier consumption
    const transformedAssignments = assignments?.map((assignment) => ({
      user_id: assignment.userId,
      project_id: assignment.projectId,
      role_id: assignment.roleId,
      user_name: assignment.userName || 'Unknown',
      user_email: assignment.userEmail || '',
      project_name: assignment.projectName || 'Unknown Project',
      project_description: assignment.projectDescription || '',
      role_name: assignment.roleName || 'Unknown Role',
      role_description: assignment.roleDescription || ''
    })) || [];

    return NextResponse.json(
      {
        success: true,
        assignments: transformedAssignments,
        count: transformedAssignments.length,
        filters: {
          projectId,
          userId
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