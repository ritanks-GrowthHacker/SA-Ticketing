import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";

interface JWTPayload {
  sub: string;
  org_id: string;
  org_name: string;
  org_domain: string;
  role: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export async function POST(req: Request) {
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
    const { imageData } = await req.json();
    
    if (!imageData) {
      return NextResponse.json(
        { error: "Image data is required" }, 
        { status: 400 }
      );
    }

    // Validate image data size (8KB limit for database storage)
    if (imageData.length > 8000) {
      return NextResponse.json(
        { error: "Image too large. Please compress further or use a smaller image." }, 
        { status: 413 }
      );
    }

    console.log(`📸 Uploading image of size: ${imageData.length} characters for user: ${decodedToken.sub}`);

    // Update user profile with image
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        profile_picture_url: imageData,
        profile_updated_at: new Date().toISOString()
      })
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
        created_at,
        updated_at,
        profile_updated_at
      `)
      .single();

    if (updateError) {
      console.error("❌ Profile image update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile picture" }, 
        { status: 500 }
      );
    }

    if (!updatedUser) {
      return NextResponse.json(
        { error: "User not found" }, 
        { status: 404 }
      );
    }

    console.log("✅ Profile image updated successfully for user:", decodedToken.sub);

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
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at,
      profileUpdatedAt: updatedUser.profile_updated_at
    };

    return NextResponse.json({
      success: true,
      message: "Profile picture updated successfully",
      profile
    }, { status: 200 });

  } catch (error) {
    console.error("Upload profile image error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}