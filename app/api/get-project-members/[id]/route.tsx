import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from '@/app/db/connections';

interface JWTPayload {
  sub: string;
  org_id: string;
  role: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    console.log('🔍 API params received:', resolvedParams);
    console.log('🔍 Project ID from params:', resolvedParams.id);
    
    const projectId = resolvedParams.id;
    
    if (!projectId || projectId === 'undefined') {
      console.error('❌ Invalid project ID:', projectId);
      return NextResponse.json(
        { error: "Invalid project ID" }, 
        { status: 400 }
      );
    }
    
    // Get JWT token from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization token is required" }, 
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    let decodedToken: JWTPayload;

    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return NextResponse.json(
        { error: "Invalid or expired token" }, 
        { status: 401 }
      );
    }

    console.log('🔍 Fetching project members for ID:', projectId);
    console.log('🔍 Updated API - removed id column from query');

    // Verify project exists and user has access
    const { data: project } = await supabase
      .from('projects')
      .select('id, organization_id')
      .eq('id', projectId)
      .eq('organization_id', decodedToken.org_id)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" }, 
        { status: 404 }
      );
    }

    // Check if user has access to this project
    const userRole = decodedToken.role;
    
    if (userRole !== 'Admin') {
      // For non-admins, check if they're assigned to this project
      const { data: userProject } = await supabase
        .from('user_project')
        .select('user_id, project_id')
        .eq('user_id', decodedToken.sub)
        .eq('project_id', projectId)
        .single();

      if (!userProject) {
        return NextResponse.json(
          { error: "Access denied. You are not assigned to this project." }, 
          { status: 403 }
        );
      }
    }

    // Get project members with user and role details
    const { data: members, error: membersError } = await supabase
      .from('user_project')
      .select(`
        user_id,
        project_id,
        role_id,
        users!inner(
          id,
          name,
          email
        ),
        roles(
          id,
          name,
          description
        )
      `)
      .eq('project_id', projectId);

    if (membersError) {
      console.error('Error fetching project members:', membersError);
      return NextResponse.json(
        { error: "Failed to fetch project members" }, 
        { status: 500 }
      );
    }

    // Format the response
    const formattedMembers = (members || []).map(member => ({
      id: `${member.user_id}-${member.project_id}`, // Composite ID
      user_id: member.user_id,
      project_id: member.project_id,
      role_id: member.role_id,
      assigned_at: new Date().toISOString(), // Use current timestamp as fallback
      user: member.users,
      role: member.roles
    }));

    console.log('✅ Project members fetched successfully:', formattedMembers.length);

    return NextResponse.json({
      message: "Project members retrieved successfully",
      members: formattedMembers
    });

  } catch (error) {
    console.error('Error fetching project members:', error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}