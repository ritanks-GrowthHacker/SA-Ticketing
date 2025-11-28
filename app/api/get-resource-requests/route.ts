import { NextRequest, NextResponse } from 'next/server';
import { db, resourceRequests, users, departments, eq, desc } from '@/lib/db-helper';
import { alias } from 'drizzle-orm/pg-core';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ GET-RESOURCE-REQUESTS: No auth header');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    try {
      jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      console.error('❌ GET-RESOURCE-REQUESTS: Invalid token');
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      console.error('❌ GET-RESOURCE-REQUESTS: No project ID');
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    console.log('🔍 GET-RESOURCE-REQUESTS: Fetching for project:', projectId);

    // Create aliases for multiple joins to the same table
    const requestedUser = alias(users, 'requestedUser');
    const requestedByUser = alias(users, 'requestedByUser');
    const reviewedByUser = alias(users, 'reviewedByUser');
    
    const requests = await db
      .select({
        id: resourceRequests.id,
        requestedUserId: resourceRequests.requestedUserId,
        userDepartmentId: resourceRequests.userDepartmentId,
        status: resourceRequests.status,
        message: resourceRequests.message,
        createdAt: resourceRequests.createdAt,
        updatedAt: resourceRequests.updatedAt,
        reviewedAt: resourceRequests.reviewedAt,
        reviewNotes: resourceRequests.reviewNotes,
        userId: requestedUser.id,
        userName: requestedUser.name,
        userEmail: requestedUser.email,
        userJobTitle: requestedUser.jobTitle,
        deptId: departments.id,
        deptName: departments.name,
        deptColorCode: departments.colorCode,
        requestedByName: requestedByUser.name,
        requestedByEmail: requestedByUser.email,
        reviewedByName: reviewedByUser.name
      })
      .from(resourceRequests)
      .leftJoin(requestedUser, eq(resourceRequests.requestedUserId, requestedUser.id))
      .leftJoin(departments, eq(resourceRequests.userDepartmentId, departments.id))
      .leftJoin(
        requestedByUser,
        eq(resourceRequests.requestedBy, requestedByUser.id)
      )
      .leftJoin(
        reviewedByUser,
        eq(resourceRequests.reviewedBy, reviewedByUser.id)
      )
      .where(eq(resourceRequests.projectId, projectId))
      .orderBy(desc(resourceRequests.createdAt));

    console.log(`✅ GET-RESOURCE-REQUESTS: Found ${requests?.length || 0} requests`);

    // Format the response
    const formattedRequests = (requests || []).map((req: any) => ({
      id: req.id,
      user: {
        id: req.userId,
        name: req.userName,
        email: req.userEmail,
        job_title: req.userJobTitle
      },
      department: {
        id: req.deptId,
        name: req.deptName,
        color_code: req.deptColorCode
      },
      requested_by: req.requestedByName,
      status: req.status,
      message: req.message,
      created_at: req.createdAt?.toISOString(),
      updated_at: req.updatedAt?.toISOString(),
      reviewed_at: req.reviewedAt?.toISOString(),
      reviewed_by: req.reviewedByName,
      review_notes: req.reviewNotes
    }));

    return NextResponse.json({
      success: true,
      requests: formattedRequests
    });

  } catch (error) {
    console.error('Get resource requests error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}