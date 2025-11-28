import { NextResponse } from 'next/server';
// Supabase (commented out - migrated to PostgreSQL)
// import { supabase } from '@/app/db/connections';

// PostgreSQL with Drizzle ORM
import { db, users, resourceRequests, projects, departments, globalRoles, eq, and } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  org_id: string;
  role: string;
}

export async function GET(req: Request) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

    console.log('🔍 GET PENDING REQUESTS - User:', decoded.sub);

    // Get user's department
    // Supabase (commented out)
    // const { data: userData } = await supabase.from('users').select('department_id').eq('id', decoded.sub).single();

    // PostgreSQL with Drizzle
    const userData = await db
      .select({ departmentId: users.departmentId })
      .from(users)
      .where(eq(users.id, decoded.sub))
      .limit(1);

    console.log('👤 User department data:', userData);

    if (!userData || userData.length === 0 || !userData[0]?.departmentId) {
      console.error('❌ User department not found');
      return NextResponse.json({ error: 'User department not found' }, { status: 404 });
    }

    const userDepartmentId = userData[0].departmentId;
    console.log('📂 Fetching requests for department:', userDepartmentId);

    // Get all pending resource requests where the requested user belongs to this department
    // Supabase (commented out)
    // const { data: requests, error } = await supabase.from('resource_requests').select(`...`)

    // PostgreSQL with Drizzle
    const requests = await db
      .select({
        id: resourceRequests.id,
        projectId: resourceRequests.projectId,
        requestedUserId: resourceRequests.requestedUserId,
        userDepartmentId: resourceRequests.userDepartmentId,
        status: resourceRequests.status,
        message: resourceRequests.message,
        createdAt: resourceRequests.createdAt,
        updatedAt: resourceRequests.updatedAt,
        reviewedAt: resourceRequests.reviewedAt,
        reviewNotes: resourceRequests.reviewNotes,
        projectId2: projects.id,
        projectName: projects.name,
        projectCreatedBy: projects.createdBy,
        requestedUserName: users.name,
        requestedUserEmail: users.email,
        requestedUserJobTitle: users.jobTitle,
        deptId: departments.id,
        deptName: departments.name,
        deptColorCode: departments.colorCode
      })
      .from(resourceRequests)
      .leftJoin(projects, eq(resourceRequests.projectId, projects.id))
      .leftJoin(users, eq(resourceRequests.requestedUserId, users.id))
      .leftJoin(departments, eq(resourceRequests.userDepartmentId, departments.id))
      .where(and(
        eq(resourceRequests.userDepartmentId, userDepartmentId),
        eq(resourceRequests.status, 'pending')
      ))
      .orderBy(resourceRequests.createdAt);

    console.log('📊 Query result:', { 
      requestCount: requests?.length || 0,
      userDepartmentId 
    });

    if (!requests) {
      console.error('❌ Error fetching pending requests');
      return NextResponse.json(
        { error: 'Failed to fetch pending requests' },
        { status: 500 }
      );
    }

    // Format the response
    const formattedRequests = (requests || []).map((req: any) => ({
      id: req.id,
      project: {
        id: req.projectId2,
        name: req.projectName
      },
      requested_user: {
        id: req.requestedUserId,
        name: req.requestedUserName,
        email: req.requestedUserEmail,
        job_title: req.requestedUserJobTitle
      },
      department: {
        id: req.deptId,
        name: req.deptName,
        color_code: req.deptColorCode
      },
      requester: {
        id: req.requestedUserId,
        name: req.requestedUserName,
        email: req.requestedUserEmail
      },
      status: req.status,
      message: req.message,
      created_at: req.createdAt,
      updated_at: req.updatedAt
    }));

    console.log(`✅ Found ${formattedRequests.length} pending requests for department ${userDepartmentId}`);

    return NextResponse.json({
      success: true,
      requests: formattedRequests,
      total: formattedRequests.length
    });

  } catch (error) {
    console.error('Error in get-pending-requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
