import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase, supabaseAdmin } from '@/app/db/connections';
import { bypassAuthInDev } from '@/lib/devAuth';

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
    
    // Check for development bypass first
    const devBypass = bypassAuthInDev(authHeader);
    let decodedToken: JWTPayload;
    
    if (devBypass) {
      decodedToken = devBypass.data as JWTPayload;
    } else {
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json(
          { error: "Authorization token is required" }, 
          { status: 401 }
        );
      }

      const token = authHeader.split(" ")[1];

      try {
        decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      } catch (jwtError) {
        console.error("JWT verification error:", jwtError);
        return NextResponse.json(
          { error: "Invalid or expired token" }, 
          { status: 401 }
        );
      }
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

    console.log('🔍 Attempting to fetch project members for projectId:', projectId);
    console.log('🔍 User ID from token:', decodedToken.sub);
    console.log('🔍 User role from token:', decodedToken.role);

    // Get team members using exact same pattern as working get-all-projects API
    console.log('🔍 Fetching team members using working API pattern...');
    const { data: members, error: membersError } = await supabase
      .from('user_project')
      .select(`
        user_id,
        users!inner(
          id,
          name,
          email,
          profile_image,
          profile_picture_url
        ),
        global_roles!user_project_role_id_fkey(
          id,
          name,
          description
        )
      `)
      .eq('project_id', projectId);

    console.log('🔍 Supabase query result:', { data: members, error: membersError });

    if (membersError) {
      console.error('❌ Detailed Supabase error:', {
        message: membersError.message,
        code: membersError.code,
        details: membersError.details,
        hint: membersError.hint,
        projectId: projectId
      });
      return NextResponse.json(
        { 
          error: "Failed to fetch project members", 
          details: membersError.message,
          code: membersError.code,
          projectId: projectId
        }, 
        { status: 500 }
      );
    }

    // Format the response using exact same pattern as working API
    console.log('🔍 Raw members data before formatting:', members);
    const formattedMembers = (members || []).map((member, index) => {
      console.log(`🔍 Processing member ${index}:`, member);
      return {
        id: `${member.user_id}-${projectId}`, // Composite ID using projectId from params
        user_id: member.user_id,
        project_id: projectId, // Use projectId from params
        role_id: (member.global_roles as any)?.id || null,
        assigned_at: new Date().toISOString(), // Use current timestamp as fallback
        user: {
          id: (member.users as any)?.id || member.user_id,
          name: (member.users as any)?.name || null,
          email: (member.users as any)?.email || null,
          profile_image: (member.users as any)?.profile_image || null,
          profile_picture_url: (member.users as any)?.profile_picture_url || null
        },
        role: {
          id: (member.global_roles as any)?.id || null,
          name: (member.global_roles as any)?.name || null,
          description: (member.global_roles as any)?.description || null
        }
      };
    });

    console.log('✅ Project members raw data:', members);
    console.log('✅ Project members formatted:', formattedMembers);
    console.log('✅ Project members fetched successfully:', formattedMembers.length);

    return NextResponse.json({
      message: "Project members retrieved successfully",
      members: formattedMembers,
      debug: {
        projectId,
        rawMembersCount: members?.length || 0,
        formattedMembersCount: formattedMembers.length
      }
    });

  } catch (error) {
    console.error('Error fetching project members:', error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}