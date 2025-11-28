import { NextRequest, NextResponse } from 'next/server';
// Supabase (commented out - migrated to PostgreSQL)
// import { supabase } from '@/app/db/connections';

// PostgreSQL with Drizzle ORM
import { db, resourceRequests, users, departments, eq, inArray } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { project_id, requests } = await request.json();

    if (!project_id || !requests || !Array.isArray(requests)) {
      return NextResponse.json(
        { error: 'Project ID and requests array are required' },
        { status: 400 }
      );
    }

    // Verify user from token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;

    // Prepare bulk insert data
    const requestsData = requests.map((req: any) => ({
      projectId: project_id,
      requestedBy: decoded.sub,
      requestedUserId: req.user_id,
      userDepartmentId: req.department_id,
      requestedRoleId: req.role_id || null,
      message: req.message || null,
      status: 'pending'
    }));

    // Insert all requests
    // Supabase (commented out)
    // const { data, error } = await supabase.from('resource_requests').insert(requestsData).select(`...`);

    // PostgreSQL with Drizzle
    const insertedRequests = await db
      .insert(resourceRequests)
      .values(requestsData)
      .returning();

    if (!insertedRequests || insertedRequests.length === 0) {
      console.error('Error creating resource requests');
      return NextResponse.json(
        { error: 'Failed to create resource requests' },
        { status: 500 }
      );
    }

    // Fetch the requests with user and department details
    const requestIds = insertedRequests.map(r => r.id);
    const data = await db
      .select({
        id: resourceRequests.id,
        requested_user_id: resourceRequests.requestedUserId,
        user_department_id: resourceRequests.userDepartmentId,
        status: resourceRequests.status,
        message: resourceRequests.message,
        created_at: resourceRequests.createdAt,
        user_name: users.name,
        user_email: users.email,
        user_job_title: users.jobTitle,
        dept_name: departments.name,
        dept_color_code: departments.colorCode
      })
      .from(resourceRequests)
      .leftJoin(users, eq(resourceRequests.requestedUserId, users.id))
      .leftJoin(departments, eq(resourceRequests.userDepartmentId, departments.id))
      .where(inArray(resourceRequests.id, requestIds));

    if (!data) {
      console.error('Error fetching created resource requests');
      return NextResponse.json(
        { error: 'Failed to fetch created requests' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${requests.length} resource request(s) submitted successfully`,
      requests: data
    });

  } catch (error) {
    console.error('Submit resource requests error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
