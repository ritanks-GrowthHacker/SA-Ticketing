import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, userOrganizationRoles, users as usersTable, globalRoles, eq, and } from "@/lib/db-helper";

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
    const usersData = await db.select({
      userId: userOrganizationRoles.userId,
      roleId: userOrganizationRoles.roleId,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userCreatedAt: usersTable.createdAt,
      userProfilePictureUrl: usersTable.profilePictureUrl,
      globalRoleId: globalRoles.id,
      globalRoleName: globalRoles.name,
      globalRoleDescription: globalRoles.description
    })
    .from(userOrganizationRoles)
    .leftJoin(usersTable, eq(userOrganizationRoles.userId, usersTable.id))
    .leftJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
    .where(eq(userOrganizationRoles.organizationId, orgId));

    // Get all available global roles
    const availableRoles = await db.select({
      id: globalRoles.id,
      name: globalRoles.name,
      description: globalRoles.description
    })
    .from(globalRoles);

    // Format the response
    const formattedUsers = usersData.map((userOrg) => ({
      userId: userOrg.userId,
      name: userOrg.userName,
      email: userOrg.userEmail,
      joinedAt: userOrg.userCreatedAt,
      profile_picture_url: userOrg.userProfilePictureUrl,
      currentRole: userOrg.globalRoleId ? {
        id: userOrg.globalRoleId,
        name: userOrg.globalRoleName,
        description: userOrg.globalRoleDescription
      } : null
    }));

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
    const role = await db.select({ id: globalRoles.id, name: globalRoles.name })
      .from(globalRoles)
      .where(eq(globalRoles.id, roleId))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Get current user's role and target user's current role for hierarchy validation
    const targetUserOrgData = await db.select({
      userId: userOrganizationRoles.userId,
      roleName: globalRoles.name
    })
    .from(userOrganizationRoles)
    .leftJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
    .where(and(eq(userOrganizationRoles.userId, userId), eq(userOrganizationRoles.organizationId, orgId)))
    .limit(1);

    const targetUserOrg = targetUserOrgData[0];
    if (!targetUserOrg) {
      return NextResponse.json({ error: "User not found in this organization" }, { status: 404 });
    }

    // Role hierarchy validation
    const currentUserRoles = tokenData.roles || [];
    const currentUserIsAdmin = currentUserRoles.includes('Admin');
    const currentUserIsManager = currentUserRoles.includes('Manager');
    const targetUserCurrentRole = targetUserOrg.roleName;
    
    // Only Admins can assign Admin roles
    if (role.name === 'Admin' && !currentUserIsAdmin) {
      return NextResponse.json({ 
        error: "Only Admins can assign Admin roles" 
      }, { status: 403 });
    }
    
    // Managers cannot modify other Managers' roles
    if (currentUserIsManager && !currentUserIsAdmin && targetUserCurrentRole === 'Manager') {
      return NextResponse.json({ 
        error: "User permission not allowed" 
      }, { status: 403 });
    }

    // Managers cannot modify Admin roles
    if (currentUserIsManager && !currentUserIsAdmin && targetUserCurrentRole === 'Admin') {
      return NextResponse.json({ 
        error: "User permission not allowed" 
      }, { status: 403 });
    }

    // Get user details for activity logging
    const userDetails = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .then(rows => rows[0] || null);

    // Update user role
    await db.update(userOrganizationRoles)
      .set({ roleId: roleId })
      .where(and(eq(userOrganizationRoles.userId, userId), eq(userOrganizationRoles.organizationId, orgId)));

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
    const user = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!user) {
      return NextResponse.json({ error: "User not found with this email" }, { status: 404 });
    }

    // Check if user is already in the organization
    const existingMember = await db.select({ userId: userOrganizationRoles.userId })
      .from(userOrganizationRoles)
      .where(and(eq(userOrganizationRoles.userId, user.id), eq(userOrganizationRoles.organizationId, orgId)))
      .limit(1)
      .then(rows => rows[0] || null);

    if (existingMember) {
      return NextResponse.json({ error: "User is already a member of this organization" }, { status: 400 });
    }

    // Verify the role exists (global role)
    const role = await db.select({ id: globalRoles.id, name: globalRoles.name })
      .from(globalRoles)
      .where(eq(globalRoles.id, roleId))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!role) {
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
    await db.insert(userOrganizationRoles)
      .values({
        userId: user.id,
        organizationId: orgId,
        roleId: roleId
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
    const userOrgData = await db.select({
      userName: usersTable.name,
      userEmail: usersTable.email,
      roleName: globalRoles.name
    })
    .from(userOrganizationRoles)
    .leftJoin(usersTable, eq(userOrganizationRoles.userId, usersTable.id))
    .leftJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
    .where(and(eq(userOrganizationRoles.userId, userId), eq(userOrganizationRoles.organizationId, orgId)))
    .limit(1);

    const userOrg = userOrgData[0];
    if (!userOrg) {
      return NextResponse.json({ error: "User not found in this organization" }, { status: 404 });
    }

    // Role hierarchy validation for removal
    const currentUserRoles = tokenData.roles || [];
    const currentUserIsAdmin = currentUserRoles.includes('Admin');
    const currentUserIsManager = currentUserRoles.includes('Manager');
    const targetUserRole = userOrg.roleName;
    
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
    await db.delete(userOrganizationRoles)
      .where(and(eq(userOrganizationRoles.userId, userId), eq(userOrganizationRoles.organizationId, orgId)));

    return NextResponse.json({
      success: true,
      message: `User ${userOrg.userName} removed from organization successfully`
    }, { status: 200 });

  } catch (error) {
    console.error("DELETE manage-user-role error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}