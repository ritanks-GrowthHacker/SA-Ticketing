import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";

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

    // Prepare update object
    const updateData: any = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.profilePictureUrl !== undefined) updateData.profile_picture_url = body.profilePictureUrl;
    if (body.about !== undefined) updateData.about = body.about;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.jobTitle !== undefined) updateData.job_title = body.jobTitle;
    if (body.department !== undefined) updateData.department = body.department;
    if (body.dateOfBirth !== undefined) updateData.date_of_birth = body.dateOfBirth;
    if (body.emailNotificationsEnabled !== undefined) updateData.email_notifications_enabled = body.emailNotificationsEnabled;
    if (body.darkModeEnabled !== undefined) updateData.dark_mode_enabled = body.darkModeEnabled;
    
    // Always update the profile_updated_at timestamp
    updateData.profile_updated_at = new Date().toISOString();

    // Check if email is being changed and if it's already taken
    if (body.email) {
      const { data: existingUser, error: emailCheckError } = await supabase
        .from("users")
        .select("id")
        .eq("email", body.email)
        .neq("id", decodedToken.sub)
        .single();

      if (existingUser) {
        return NextResponse.json(
          { error: "Email address is already in use" }, 
          { status: 409 }
        );
      }
    }

    // Update user profile
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", decodedToken.sub)
      .select(`
        id,
        name,
        email,
        profile_picture_url,
        about,
        phone,
        location,
        job_title,
        department,
        date_of_birth,
        email_notifications_enabled,
        dark_mode_enabled,
        created_at,
        updated_at,
        profile_updated_at
      `)
      .single();

    if (updateError) {
      console.error("❌ Profile update error:", updateError);
      console.error("📝 Update data sent:", updateData);
      console.error("👤 User ID:", decodedToken.sub);
      return NextResponse.json(
        { error: "Failed to update profile" }, 
        { status: 500 }
      );
    }

    if (!updatedUser) {
      return NextResponse.json(
        { error: "User not found or unauthorized" }, 
        { status: 404 }
      );
    }

    // Get user role information
    const { data: userRole, error: roleError } = await supabase
      .from("user_organization_roles")
      .select(`
        role_id,
        global_roles!user_organization_roles_role_id_fkey(id, name, description)
      `)
      .eq("user_id", decodedToken.sub)
      .eq("organization_id", decodedToken.org_id)
      .single();

    // Get organization info separately
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, domain")
      .eq("id", decodedToken.org_id)
      .single();

    if (orgError) {
      console.error("Organization fetch error:", orgError);
    }

    console.log("✅ Profile updated successfully for user:", decodedToken.sub);
    console.log("📊 Updated fields:", Object.keys(updateData));
    
    // Format the response
    const profile = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      profilePicture: updatedUser.profile_picture_url,
      about: updatedUser.about,
      phone: updatedUser.phone,
      location: updatedUser.location,
      jobTitle: updatedUser.job_title,
      department: updatedUser.department,
      dateOfBirth: updatedUser.date_of_birth,
      emailNotificationsEnabled: updatedUser.email_notifications_enabled,
      darkModeEnabled: updatedUser.dark_mode_enabled,
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at,
      profileUpdatedAt: updatedUser.profile_updated_at,
      organization: organization,
      role: userRole ? (userRole as any).global_roles?.name : null
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