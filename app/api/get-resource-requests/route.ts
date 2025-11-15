import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

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
      console.error('Error fetching resource requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch resource requests' },
        { status: 500 }
      );
    }

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
