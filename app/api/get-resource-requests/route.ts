import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
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

    // Get all resource requests for this project
    const { data: requests, error } = await supabase
      .from('resource_requests')
      .select(`
        id,
        requested_user_id,
        user_department_id,
        status,
        message,
        created_at,
        updated_at,
        reviewed_at,
        review_notes,
        users!resource_requests_requested_user_id_fkey(id, name, email, job_title),
        departments!resource_requests_user_department_id_fkey(id, name, color_code),
        requested_by_user:users!resource_requests_requested_by_fkey(name, email),
        reviewed_by_user:users!resource_requests_reviewed_by_fkey(name)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ GET-RESOURCE-REQUESTS: Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch resource requests', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ GET-RESOURCE-REQUESTS: Found ${requests?.length || 0} requests`);

    // Format the response
    const formattedRequests = (requests || []).map((req: any) => ({
      id: req.id,
      user: {
        id: req.users?.id,
        name: req.users?.name,
        email: req.users?.email,
        job_title: req.users?.job_title
      },
      department: {
        id: req.departments?.id,
        name: req.departments?.name,
        color_code: req.departments?.color_code
      },
      requested_by: req.requested_by_user?.name,
      status: req.status,
      message: req.message,
      created_at: req.created_at,
      updated_at: req.updated_at,
      reviewed_at: req.reviewed_at,
      reviewed_by: req.reviewed_by_user?.name,
      review_notes: req.review_notes
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
