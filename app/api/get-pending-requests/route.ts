import { NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
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
    const { data: userData } = await supabase
      .from('users')
      .select('department_id')
      .eq('id', decoded.sub)
      .single();

    console.log('👤 User department data:', userData);

    if (!userData?.department_id) {
      console.error('❌ User department not found');
      return NextResponse.json({ error: 'User department not found' }, { status: 404 });
    }

    const userDepartmentId = userData.department_id;
    console.log('📂 Fetching requests for department:', userDepartmentId);

    // Get all pending resource requests where the requested user belongs to this department
    const { data: requests, error } = await supabase
      .from('resource_requests')
      .select(`
        id,
        project_id,
        requested_user_id,
        user_department_id,
        status,
        message,
        created_at,
        updated_at,
        reviewed_at,
        review_notes,
        projects(id, name, created_by),
        requested_user:users!resource_requests_requested_user_id_fkey(id, name, email, job_title),
        user_department:departments!resource_requests_user_department_id_fkey(id, name, color_code),
        requester:users!resource_requests_requested_by_fkey(id, name, email, department_id),
        reviewer:users!resource_requests_reviewed_by_fkey(name)
      `)
      .eq('user_department_id', userDepartmentId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    console.log('📊 Query result:', { 
      requestCount: requests?.length || 0, 
      error: error,
      userDepartmentId 
    });

    if (error) {
      console.error('❌ Error fetching pending requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pending requests' },
        { status: 500 }
      );
    }

    // Format the response
    const formattedRequests = (requests || []).map((req: any) => ({
      id: req.id,
      project: {
        id: req.projects?.id,
        name: req.projects?.name
      },
      requested_user: {
        id: req.requested_user?.id,
        name: req.requested_user?.name,
        email: req.requested_user?.email,
        job_title: req.requested_user?.job_title
      },
      department: {
        id: req.user_department?.id,
        name: req.user_department?.name,
        color_code: req.user_department?.color_code
      },
      requester: {
        id: req.requester?.id,
        name: req.requester?.name,
        email: req.requester?.email
      },
      status: req.status,
      message: req.message,
      created_at: req.created_at,
      updated_at: req.updated_at
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
