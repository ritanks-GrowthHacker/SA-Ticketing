import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, userProject, users, projects, globalRoles, eq, and } from "@/lib/db-helper";

// Helper function to verify JWT token and extract user info
async function verifyToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// Helper function to check if user has permission to manage project roles
async function canManageProjectRoles(userId: string, projectId: string, userOrgRoles: string[]): Promise<boolean> {
  // Admins can manage all project roles
  if (userOrgRoles.includes('Admin')) {
    return true;
  }

  // Check if user is a Manager on this specific project
  const projectRole = await db
    .select({
      roleName: globalRoles.name
    })
    .from(userProject)
    .leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
    .where(and(
      eq(userProject.userId, userId),
      eq(userProject.projectId, projectId)
    ))
    .limit(1)
    .then(rows => rows[0] || null);

  return projectRole?.roleName === 'Manager';
}

// PUT - Update user role in a specific project
export async function PUT(req: Request) {
  console.log('🔧 Project role update API called');
  
  try {
    const body = await req.json();
    console.log('🔧 Request body received:', body);

    const { user_id, project_id, role_id } = body;

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    const tokenData = await verifyToken(authHeader);
    
    if (!tokenData) {
      console.log('🔧 Authentication failed');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log('🔧 Token data:', { userId: tokenData.sub, roles: tokenData.roles });

    // Validate required fields
    if (!user_id || !project_id || !role_id) {
      console.log('🔧 Missing required fields:', { user_id, project_id, role_id });
      return NextResponse.json({ 
        error: "User ID, Project ID, and Role ID are required" 
      }, { status: 400 });
    }

    // Prevent users from modifying their own project role (security measure)
    if (user_id === tokenData.sub) {
      console.log('🔧 Self-modification attempt blocked');
      return NextResponse.json({ 
        error: "You cannot modify your own role in this project" 
      }, { status: 403 });
    }

    // Check if user has permission to manage project roles
    const hasPermission = await canManageProjectRoles(tokenData.sub, project_id, tokenData.roles || []);
    if (!hasPermission) {
      console.log('🔧 Permission denied');
      return NextResponse.json({ 
        error: "Access denied. Only Admin or Project Manager can manage project roles" 
      }, { status: 403 });
    }

    // Verify the role exists (global roles)
    const role = await db
      .select({
        id: globalRoles.id,
        name: globalRoles.name
      })
      .from(globalRoles)
      .where(eq(globalRoles.id, role_id))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!role) {
      console.log('🔧 Invalid role');
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Verify the project exists and user has access to it
    const project = await db
      .select({
        id: projects.id,
        name: projects.name
      })
      .from(projects)
      .where(and(
        eq(projects.id, project_id),
        eq(projects.organizationId, tokenData.org_id)
      ))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!project) {
      console.log('🔧 Invalid project');
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user is already assigned to this project
    const existingAssignment = await db
      .select()
      .from(userProject)
      .where(and(
        eq(userProject.userId, user_id),
        eq(userProject.projectId, project_id)
      ))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!existingAssignment) {
      console.log('🔧 User not assigned to project');
      return NextResponse.json({ error: "User is not assigned to this project" }, { status: 404 });
    }

    // Get the target user's CURRENT project role to enforce hierarchy
    const currentRoleData = await db
      .select({
        name: globalRoles.name
      })
      .from(globalRoles)
      .where(eq(globalRoles.id, existingAssignment.roleId))
      .limit(1)
      .then(rows => rows[0] || null);

    const currentRoleName = currentRoleData?.name;
    const newRoleName = role.name;

    // Get CURRENT USER's PROJECT ROLE (not org/dept role)
    const currentUserProjectRole = await db
      .select({
        userId: userProject.userId,
        projectId: userProject.projectId,
        roleName: globalRoles.name
      })
      .from(userProject)
      .leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
      .where(and(
        eq(userProject.userId, tokenData.sub),
        eq(userProject.projectId, project_id)
      ))
      .limit(1)
      .then(rows => rows[0] || null);

    const currentUserRoleName = currentUserProjectRole?.roleName || null;

    console.log('🔧 Current user PROJECT ROLE:', currentUserRoleName);

    // Role hierarchy enforcement: PROJECT MANAGERS cannot modify Admin or Manager roles
    const isCurrentUserProjectManager = currentUserRoleName === 'Manager';
    
    if (isCurrentUserProjectManager) {
      // Project Managers cannot change Admin or Manager project roles
      if (currentRoleName === 'Admin' || currentRoleName === 'Manager') {
        console.log('🔧 Project Manager attempted to modify Admin/Manager role');
        return NextResponse.json({ 
          error: "User permission not allowed" 
        }, { status: 403 });
      }
      
      // Project Managers cannot assign Admin or Manager roles
      if (newRoleName === 'Admin' || newRoleName === 'Manager') {
        console.log('🔧 Project Manager attempted to assign Admin/Manager role');
        return NextResponse.json({ 
          error: "User permission not allowed" 
        }, { status: 403 });
      }
    }

    // Update user role in the project
    await db
      .update(userProject)
      .set({ 
        roleId: role_id
      })
      .where(and(
        eq(userProject.userId, user_id),
        eq(userProject.projectId, project_id)
      ));

    console.log('🔧 Role update successful');

    // Get user details for response
    const userDetails = await db
      .select({
        name: users.name,
        email: users.email
      })
      .from(users)
      .where(eq(users.id, user_id))
      .limit(1)
      .then(rows => rows[0] || null);

    return NextResponse.json({
      success: true,
      message: "User role updated successfully",
      data: {
        user_id,
        project_id,
        role_id,
        role_name: role.name,
        user_name: userDetails?.name,
        user_email: userDetails?.email
      }
    });

  } catch (error) {
    console.error("🔧 PUT manage-project-user-role error:", error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}