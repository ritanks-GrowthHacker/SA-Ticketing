import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, users, eq } from '@/lib/db-helper';

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
    const currentTime = new Date();
    const updatedUserData = await db.update(users)
      .set({
        profilePictureUrl: imageData,
        profileUpdatedAt: currentTime
      })
      .where(eq(users.id, decodedToken.sub))
      .returning();
    
    const updatedUser = updatedUserData[0];
    const updateError = null;

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
      profilePicture: updatedUser.profilePictureUrl,
      about: updatedUser.about,
      phone: updatedUser.phone,
      location: updatedUser.location,
      jobTitle: updatedUser.jobTitle,
      department: updatedUser.department,
      dateOfBirth: updatedUser.dateOfBirth,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      profileUpdatedAt: updatedUser.profileUpdatedAt
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