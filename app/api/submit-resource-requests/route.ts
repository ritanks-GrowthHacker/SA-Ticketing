import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
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
      project_id,
      requested_by: decoded.sub,
      requested_user_id: req.user_id,
      user_department_id: req.department_id,
      message: req.message || null,
      status: 'pending'
    }));

    // Insert all requests
    const { data, error } = await supabase
      .from('resource_requests')
      .insert(requestsData)
      .select(`
        id,
        requested_user_id,
        user_department_id,
        status,
        message,
        created_at,
        users!resource_requests_requested_user_id_fkey(name, email, job_title),
        departments!resource_requests_user_department_id_fkey(name, color_code)
      `);

    if (error) {
      console.error('Error creating resource requests:', error);
      return NextResponse.json(
        { error: 'Failed to create resource requests' },
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
