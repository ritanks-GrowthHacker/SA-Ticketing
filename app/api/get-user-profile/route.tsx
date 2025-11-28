import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, users, userOrganizationRoles, globalRoles, organizations, eq, and } from '@/lib/db-helper';

interface JWTPayload {
  sub: string;        // user ID
  org_id: string;     // organization ID
  org_name: string;   // organization name
  org_domain: string; // organization domain
  role: string;       // user role
  roles: string[];    // all user roles
  department_role?: string; // department role
  department_id?: string; // department ID
  iat?: number;
  exp?: number;
}

export async function GET(req: Request) {
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

    console.log("🔍 Profile API Debug:", {
      userId: decodedToken.sub,
      orgId: decodedToken.org_id,
      orgName: decodedToken.org_name
    });

    // Get user profile from database
    const userProfile = await db
      .select({
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
      })
      .from(users)
      .where(eq(users.id, decodedToken.sub))
      .limit(1)
      .then(rows => rows[0] || null);

    console.log("📊 User Profile Query Result:", {
      data: userProfile
    });

    if (!userProfile) {
      console.error("❌ User profile fetch error - user not found");
      return NextResponse.json(
        { error: "User profile not found" }, 
        { status: 404 }
      );
    }

    // Get user role information - check BOTH org and department roles
    const userOrgRole = await db
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

    // Get department role from JWT (already decoded above)
    let displayRole = null;
    
    // Priority: current department role > org role
    if (decodedToken.department_role) {
      displayRole = decodedToken.department_role;
    } else if (userOrgRole) {
      displayRole = userOrgRole.globalRoleName;
    }

    // Get organization info separately
    const organization = await db
      .select({ id: organizations.id, name: organizations.name, domain: organizations.domain })
      .from(organizations)
      .where(eq(organizations.id, decodedToken.org_id))
      .limit(1)
      .then(rows => rows[0] || null);

    // Format the response
    const profile = {
      id: userProfile.id,
      name: userProfile.name,
      email: userProfile.email,
      profilePicture: userProfile.profilePictureUrl,
      about: userProfile.about,
      phone: userProfile.phone,
      location: userProfile.location,
      jobTitle: userProfile.jobTitle,
      department: userProfile.department,
      dateOfBirth: userProfile.dateOfBirth || null,
      emailNotificationsEnabled: userProfile.emailNotificationsEnabled,
      darkModeEnabled: userProfile.darkModeEnabled,
      createdAt: userProfile.createdAt?.toISOString(),
      updatedAt: userProfile.updatedAt?.toISOString(),
      profileUpdatedAt: userProfile.profileUpdatedAt?.toISOString() || null,
      organization: organization,
      role: displayRole || 'Member'
    };

    return NextResponse.json({
      success: true,
      profile
    }, { status: 200 });

  } catch (error) {
    console.error("Get user profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}