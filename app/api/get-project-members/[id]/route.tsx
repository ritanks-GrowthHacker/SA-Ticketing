import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
// import { supabase, supabaseAdmin } from '@/app/db/connections';
import { db, projects, userProject, users as usersTable, globalRoles, eq, and } from '@/lib/db-helper';
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
    const project = await db.select({ id: projects.id, organizationId: projects.organizationId })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, decodedToken.org_id)))
      .limit(1)
      .then(rows => rows[0] || null);

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
      const userProjectAssignment = await db.select({ userId: userProject.userId, projectId: userProject.projectId })
        .from(userProject)
        .where(and(eq(userProject.userId, decodedToken.sub), eq(userProject.projectId, projectId)))
        .limit(1)
        .then(rows => rows[0] || null);

      if (!userProjectAssignment) {
        return NextResponse.json(
          { error: "Access denied. You are not assigned to this project." }, 
          { status: 403 }
        );
      }
    }

    console.log('🔍 Attempting to fetch project members for projectId:', projectId);
    console.log('🔍 User ID from token:', decodedToken.sub);
    console.log('🔍 User role from token:', decodedToken.role);

    // Get team members using Drizzle with joins
    console.log('🔍 Fetching team members using Drizzle...');
    const members = await db.select({
      userId: userProject.userId,
      projectId: userProject.projectId,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userProfileImage: usersTable.profileImage,
      userProfilePictureUrl: usersTable.profilePictureUrl,
      roleId: globalRoles.id,
      roleName: globalRoles.name,
      roleDescription: globalRoles.description
    })
    .from(userProject)
    .leftJoin(usersTable, eq(userProject.userId, usersTable.id))
    .leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
    .where(eq(userProject.projectId, projectId));

    console.log('🔍 Drizzle query result:', { membersCount: members.length });

    // Format the response
    console.log('🔍 Raw members data before formatting:', members);
    const formattedMembers = (members || []).map((member, index) => {
      console.log(`🔍 Processing member ${index}:`, member);
      return {
        id: `${member.userId}-${projectId}`, // Composite ID using projectId from params
        user_id: member.userId,
        project_id: projectId, // Use projectId from params
        role_id: member.roleId || null,
        assigned_at: new Date().toISOString(), // Default timestamp since schema doesn't have this field
        user: {
          id: member.userId,
          name: member.userName || null,
          email: member.userEmail || null,
          profile_image: member.userProfileImage || null,
          profile_picture_url: member.userProfilePictureUrl || null
        },
        role: {
          id: member.roleId || null,
          name: member.roleName || null,
          description: member.roleDescription || null
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