import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db, users, userOrganizationRoles, globalRoles, organizations, eq, and, ne } from '@/lib/db-helper';

interface JWTPayload {
  sub: string;        // user ID
  org_id: string;     // organization ID
  org_name: string;   // organization name
  org_domain: string; // organization domain
  role: string;       // user role
  roles: string[];    // all user roles
  iat?: number;
  exp?: number;
}

interface UpdateProfileRequest {
  name?: string;
  email?: string;
  profilePictureUrl?: string;
  about?: string;
  phone?: string;
  location?: string;
  jobTitle?: string;
  department?: string;
  dateOfBirth?: string;
  emailNotificationsEnabled?: boolean;
  darkModeEnabled?: boolean;
}

export async function PUT(req: Request) {
  try {
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

    // Parse request body
    let body: UpdateProfileRequest;
    try {
      body = await req.json();
      console.log('📥 Update profile request body:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid request body" }, 
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" }, 
        { status: 400 }
      );
    }

    // Prepare update object - only add fields that have actual values
    const updateData: any = {};
    
    if (body.name !== undefined && body.name !== null && body.name !== '') updateData.name = body.name;
    if (body.email !== undefined && body.email !== null && body.email !== '') updateData.email = body.email;
    if (body.profilePictureUrl !== undefined && body.profilePictureUrl !== null && body.profilePictureUrl !== '') updateData.profilePictureUrl = body.profilePictureUrl;
    if (body.about !== undefined && body.about !== null && body.about !== '') updateData.about = body.about;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.location !== undefined && body.location !== null && body.location !== '') updateData.location = body.location;
    if (body.jobTitle !== undefined && body.jobTitle !== null && body.jobTitle !== '') updateData.jobTitle = body.jobTitle;
    if (body.department !== undefined && body.department !== null && body.department !== '') updateData.department = body.department;
    if (body.dateOfBirth !== undefined && body.dateOfBirth !== null && body.dateOfBirth !== '') updateData.dateOfBirth = body.dateOfBirth;
    if (body.emailNotificationsEnabled !== undefined) updateData.emailNotificationsEnabled = body.emailNotificationsEnabled;
    if (body.darkModeEnabled !== undefined) updateData.darkModeEnabled = body.darkModeEnabled;
    
    console.log('📊 Update data object:', JSON.stringify(updateData, null, 2));
    
    // Check if there are any fields to update (before adding timestamp)
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" }, 
        { status: 400 }
      );
    }

    // Always update the profile_updated_at timestamp
    updateData.profileUpdatedAt = new Date();

    // Check if email is being changed and if it's already taken
    if (body.email) {
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.email, body.email),
            ne(users.id, decodedToken.sub)
          )
        )
        .limit(1)
        .then(rows => rows[0] || null);

      if (existingUser) {
        return NextResponse.json(
          { error: "Email address is already in use" }, 
          { status: 409 }
        );
      }
    }

    // Update user profile
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, decodedToken.sub))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        profilePictureUrl: users.profilePictureUrl,
        about: users.about,
        phone: users.phone,
        location: users.location,
        jobTitle: users.jobTitle,
        department: users.department,
        dateOfBirth: users.dateOfBirth,
        emailNotificationsEnabled: users.emailNotificationsEnabled,
        darkModeEnabled: users.darkModeEnabled,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        profileUpdatedAt: users.profileUpdatedAt
      });

    if (!updatedUser) {
      return NextResponse.json(
        { error: "User not found or unauthorized" }, 
        { status: 404 }
      );
    }

    // Get user role information
    const userRole = await db
      .select({
        roleId: userOrganizationRoles.roleId,
        globalRoleId: globalRoles.id,
        globalRoleName: globalRoles.name,
        globalRoleDescription: globalRoles.description
      })
      .from(userOrganizationRoles)
      .leftJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
      .where(
        and(
          eq(userOrganizationRoles.userId, decodedToken.sub),
          eq(userOrganizationRoles.organizationId, decodedToken.org_id)
        )
      )
      .limit(1)
      .then(rows => rows[0] || null);

    // Get organization info separately
    const organization = await db
      .select({ id: organizations.id, name: organizations.name, domain: organizations.domain })
      .from(organizations)
      .where(eq(organizations.id, decodedToken.org_id))
      .limit(1)
      .then(rows => rows[0] || null);

    console.log("✅ Profile updated successfully for user:", decodedToken.sub);
    console.log("📊 Updated fields:", Object.keys(updateData));
    
    // Format the response
    const profile = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      profilePicture: updatedUser.profilePictureUrl,
      about: updatedUser.about,
      phone: updatedUser.phone,
      location: updatedUser.location,
      jobTitle: updatedUser.jobTitle,
      department: updatedUser.department,
      dateOfBirth: updatedUser.dateOfBirth || null,
      emailNotificationsEnabled: updatedUser.emailNotificationsEnabled,
      darkModeEnabled: updatedUser.darkModeEnabled,
      createdAt: updatedUser.createdAt?.toISOString(),
      updatedAt: updatedUser.updatedAt?.toISOString(),
      profileUpdatedAt: updatedUser.profileUpdatedAt?.toISOString() || null,
      organization: organization,
      role: userRole?.globalRoleName || null
    };

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      profile
    }, { status: 200 });

  } catch (error) {
    console.error("Update user profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}