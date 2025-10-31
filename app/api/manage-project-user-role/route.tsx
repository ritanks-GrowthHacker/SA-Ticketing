import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";

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
  const { data: projectRole } = await supabase
    .from('user_project')
    .select('role:roles!inner(name)')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .single();

  return (projectRole?.role as any)?.name === 'Manager';
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

    // Check if user has permission to manage project roles
    const hasPermission = await canManageProjectRoles(tokenData.sub, project_id, tokenData.roles || []);
    if (!hasPermission) {
      console.log('🔧 Permission denied');
      return NextResponse.json({ 
        error: "Access denied. Only Admin or Project Manager can manage project roles" 
      }, { status: 403 });
    }

    // Verify the role exists in this organization
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id, name")
      .eq("id", role_id)
      .eq("organization_id", tokenData.org_id)
      .single();

    if (roleError || !role) {
      console.log('🔧 Invalid role:', roleError);
      return NextResponse.json({ error: "Invalid role for this organization" }, { status: 400 });
    }

    // Verify the project exists and user has access to it
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", project_id)
      .eq("organization_id", tokenData.org_id)
      .single();

    if (projectError || !project) {
      console.log('🔧 Invalid project:', projectError);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user is already assigned to this project
    const { data: existingAssignment, error: assignmentError } = await supabase
      .from("user_project")
      .select("*")
      .eq("user_id", user_id)
      .eq("project_id", project_id)
      .single();

    if (assignmentError && assignmentError.code !== 'PGRST116') {
      console.log('🔧 Error checking existing assignment:', assignmentError);
      return NextResponse.json({ error: "Error checking user assignment" }, { status: 500 });
    }

    if (!existingAssignment) {
      console.log('🔧 User not assigned to project');
      return NextResponse.json({ error: "User is not assigned to this project" }, { status: 404 });
    }

    // Update user role in the project
    const { error: updateError } = await supabase
      .from("user_project")
      .update({ 
        role_id: role_id
      })
      .eq("user_id", user_id)
      .eq("project_id", project_id);

    if (updateError) {
      console.error("🔧 Project role update error:", updateError);
      return NextResponse.json({ error: "Failed to update user role in project" }, { status: 500 });
    }

    console.log('🔧 Role update successful');

    // Get user details for response
    const { data: userDetails } = await supabase
      .from("users")
      .select("name, email")
      .eq("id", user_id)
      .single();

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