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

// Helper function to check if user has permission to manage roles
function canManageRoles(userRoles: string[]): boolean {
  const authorizedRoles = ['Admin', 'Manager', 'Team Lead'];
  return userRoles.some(role => authorizedRoles.includes(role));
}

// GET - Get all users and their roles in an organization
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organization_id');
    
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    const tokenData = await verifyToken(authHeader);
    
    if (!tokenData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Debug token data
    console.log('🔍 MANAGE-USER-ROLE: Token data debug:', {
      userId: tokenData.sub,
      role: tokenData.role,
      roles: tokenData.roles,
      project_id: tokenData.project_id,
      org_id: tokenData.org_id
    });

    // Check if user has permission to view roles
    const userRoles = tokenData.roles || [tokenData.role].filter(Boolean);
    console.log('🔍 MANAGE-USER-ROLE: Checking roles:', userRoles);
    
    if (!canManageRoles(userRoles)) {
      console.log('❌ MANAGE-USER-ROLE: Access denied - insufficient permissions');
      return NextResponse.json({ 
        error: "Access denied. Only Admin, Manager, or Team Lead can manage roles" 
      }, { status: 403 });
    }

    console.log('✅ MANAGE-USER-ROLE: Access granted');

    const orgId = organizationId || tokenData.org_id;
    
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    // Get all users in the organization with their roles
    const { data: users, error: usersError } = await supabase
      .from("user_organization_roles")
      .select(`
        user_id,
        role_id,
        users(id, name, email, created_at, profile_picture_url),
        global_roles!user_organization_roles_role_id_fkey(id, name, description)
      `)
      .eq("organization_id", orgId);

    if (usersError) {
      console.error("Users lookup error:", usersError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Get all available global roles
    const { data: availableRoles, error: rolesError } = await supabase
      .from("global_roles")
      .select("id, name, description");

    if (rolesError) {
      console.error("Roles lookup error:", rolesError);
      return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
    }

    // Format the response
    const formattedUsers = users?.map((userOrg: any) => ({
      userId: userOrg.users.id,
      name: userOrg.users.name,
      email: userOrg.users.email,
      joinedAt: userOrg.users.created_at,
      profile_picture_url: userOrg.users.profile_picture_url,
      currentRole: userOrg.global_roles ? {
        id: userOrg.global_roles.id,
        name: userOrg.global_roles.name,
        description: userOrg.global_roles.description
      } : null
    })) || [];

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      availableRoles: availableRoles || []
    }, { status: 200 });

  } catch (error) {
    console.error("GET manage-user-role error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT - Update user role in organization
export async function PUT(req: Request) {
  try {
    const { userId, roleId, organizationId } = await req.json();

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    const tokenData = await verifyToken(authHeader);
    
    if (!tokenData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to manage roles
    if (!canManageRoles(tokenData.roles || [])) {
      return NextResponse.json({ 
        error: "Access denied. Only Admin, Manager, or Team Lead can manage roles" 
      }, { status: 403 });
    }

    // Validate required fields
    if (!userId || !roleId) {
      return NextResponse.json({ 
        error: "User ID and Role ID are required" 
      }, { status: 400 });
    }

    const orgId = organizationId || tokenData.org_id;

    // Prevent users from modifying their own role (security measure)
    if (userId === tokenData.sub) {
      return NextResponse.json({ 
        error: "You cannot modify your own role" 
      }, { status: 403 });
    }

    // Verify the role exists (global role)
    const { data: role, error: roleError } = await supabase
      .from("global_roles")
      .select("id, name")
      .eq("id", roleId)
      .single();

    if (roleError || !role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Get current user's role and target user's current role for hierarchy validation
    const { data: targetUserOrg, error: targetUserError } = await supabase
      .from("user_organization_roles")
      .select(`
        user_id,
        global_roles!user_organization_roles_role_id_fkey(name)
      `)
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .single();

    if (targetUserError || !targetUserOrg) {
      return NextResponse.json({ error: "User not found in this organization" }, { status: 404 });
    }

    // Role hierarchy validation
    const currentUserRoles = tokenData.roles || [];
    const currentUserIsAdmin = currentUserRoles.includes('Admin');
    const currentUserIsManager = currentUserRoles.includes('Manager');
    const targetUserCurrentRole = (targetUserOrg as any).global_roles?.name;
    
    // Only Admins can assign Admin roles
    if (role.name === 'Admin' && !currentUserIsAdmin) {
      return NextResponse.json({ 
        error: "Only Admins can assign Admin roles" 
      }, { status: 403 });
    }
    
    // Managers cannot modify other Managers' roles
    if (currentUserIsManager && !currentUserIsAdmin && targetUserCurrentRole === 'Manager') {
      return NextResponse.json({ 
        error: "Managers cannot modify other Managers' roles" 
      }, { status: 403 });
    }

    // Get user details for activity logging
    const { data: userDetails } = await supabase
      .from("users")
      .select("name, email")
      .eq("id", userId)
      .single();

    // Update user role
    const { error: updateError } = await supabase
      .from("user_organization_roles")
      .update({ role_id: roleId })
      .eq("user_id", userId)
      .eq("organization_id", orgId);

    if (updateError) {
      console.error("Role update error:", updateError);
      return NextResponse.json({ error: "Failed to update user role" }, { status: 500 });
    }

    // Log the activity
    await supabase
      .from("activity_logs")
      .insert({
        user_id: tokenData.sub,
        entity_type: "user_role",
        entity_id: userId,
        action: "role_updated",
        details: {
          target_user: userDetails?.name || "Unknown User",
          target_email: userDetails?.email,
          new_role: role.name,
          updated_by: tokenData.name || tokenData.email,
          organization_id: orgId
        }
      });

    return NextResponse.json({
      success: true,
      message: `User role updated to ${role.name} successfully`,
      updatedUser: {
        userId,
        newRole: {
          id: role.id,
          name: role.name
        }
      }
    }, { status: 200 });

  } catch (error) {
    console.error("PUT manage-user-role error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Add user to organization with role
export async function POST(req: Request) {
  try {
    const { email, roleId, organizationId } = await req.json();

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    const tokenData = await verifyToken(authHeader);
    
    if (!tokenData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to manage roles
    if (!canManageRoles(tokenData.roles || [])) {
      return NextResponse.json({ 
        error: "Access denied. Only Admin, Manager, or Team Lead can manage roles" 
      }, { status: 403 });
    }

    // Validate required fields
    if (!email || !roleId) {
      return NextResponse.json({ 
        error: "Email and Role ID are required" 
      }, { status: 400 });
    }

    const orgId = organizationId || tokenData.org_id;

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("email", email.toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found with this email" }, { status: 404 });
    }

    // Check if user is already in the organization
    const { data: existingMember } = await supabase
      .from("user_organization_roles")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("organization_id", orgId)
      .single();

    if (existingMember) {
      return NextResponse.json({ error: "User is already a member of this organization" }, { status: 400 });
    }

    // Verify the role exists (global role)
    const { data: role, error: roleError } = await supabase
      .from("global_roles")
      .select("id, name")
      .eq("id", roleId)
      .single();

    if (roleError || !role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Role hierarchy validation for adding users
    const currentUserRoles = tokenData.roles || [];
    const currentUserIsAdmin = currentUserRoles.includes('Admin');
    
    // Only Admins can assign Admin roles when adding new users
    if (role.name === 'Admin' && !currentUserIsAdmin) {
      return NextResponse.json({ 
        error: "Only Admins can assign Admin roles to new users" 
      }, { status: 403 });
    }

    // Add user to organization
    const { error: addError } = await supabase
      .from("user_organization_roles")
      .insert({
        user_id: user.id,
        organization_id: orgId,
        role_id: roleId
      });

    if (addError) {
      console.error("Add user error:", addError);
      return NextResponse.json({ error: "Failed to add user to organization" }, { status: 500 });
    }

    // Log the activity
    await supabase
      .from("activity_logs")
      .insert({
        user_id: tokenData.sub,
        entity_type: "user_organization",
        entity_id: user.id,
        action: "user_added",
        details: {
          added_user: user.name,
          added_email: user.email,
          assigned_role: role.name,
          added_by: tokenData.name || tokenData.email,
          organization_id: orgId
        }
      });

    return NextResponse.json({
      success: true,
      message: `User ${user.name} added to organization with role ${role.name}`,
      addedUser: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: {
          id: role.id,
          name: role.name
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error("POST manage-user-role error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE - Remove user from organization
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const organizationId = searchParams.get('organization_id');

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    const tokenData = await verifyToken(authHeader);
    
    if (!tokenData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to manage roles
    if (!canManageRoles(tokenData.roles || [])) {
      return NextResponse.json({ 
        error: "Access denied. Only Admin, Manager, or Team Lead can manage roles" 
      }, { status: 403 });
    }

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const orgId = organizationId || tokenData.org_id;

    // Prevent users from removing themselves
    if (userId === tokenData.sub) {
      return NextResponse.json({ 
        error: "You cannot remove yourself from the organization" 
      }, { status: 403 });
    }

    // Get user details before removal
    const { data: userOrg, error: userOrgError } = await supabase
      .from("user_organization_roles")
      .select(`
        users(name, email),
        global_roles!user_organization_roles_role_id_fkey(name)
      `)
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .single();

    if (userOrgError || !userOrg) {
      return NextResponse.json({ error: "User not found in this organization" }, { status: 404 });
    }

    // Role hierarchy validation for removal
    const currentUserRoles = tokenData.roles || [];
    const currentUserIsAdmin = currentUserRoles.includes('Admin');
    const currentUserIsManager = currentUserRoles.includes('Manager');
    const targetUserRole = (userOrg as any).global_roles?.name;
    
    // Managers cannot remove Admins or other Managers
    if (currentUserIsManager && !currentUserIsAdmin) {
      if (targetUserRole === 'Admin') {
        return NextResponse.json({ 
          error: "Managers cannot remove Admin users" 
        }, { status: 403 });
      }
      if (targetUserRole === 'Manager') {
        return NextResponse.json({ 
          error: "Managers cannot remove other Manager users" 
        }, { status: 403 });
      }
    }

    // Remove user from organization
    const { error: deleteError } = await supabase
      .from("user_organization_roles")
      .delete()
      .eq("user_id", userId)
      .eq("organization_id", orgId);

    if (deleteError) {
      console.error("Remove user error:", deleteError);
      return NextResponse.json({ error: "Failed to remove user from organization" }, { status: 500 });
    }

    // Log the activity
    await supabase
      .from("activity_logs")
      .insert({
        user_id: tokenData.sub,
        entity_type: "user_organization",
        entity_id: userId,
        action: "user_removed",
        details: {
          removed_user: (userOrg as any).users.name,
          removed_email: (userOrg as any).users.email,
          previous_role: (userOrg as any).global_roles?.name,
          removed_by: tokenData.name || tokenData.email,
          organization_id: orgId
        }
      });

    return NextResponse.json({
      success: true,
      message: `User ${(userOrg as any).users.name} removed from organization successfully`
    }, { status: 200 });

  } catch (error) {
    console.error("DELETE manage-user-role error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}