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

    // Get user profile from database (without organization_id filter for now)
    const { data: userProfile, error: userError } = await supabase
      .from("users")
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
      .eq("id", decodedToken.sub)
      .single();

    console.log("📊 User Profile Query Result:", {
      data: userProfile,
      error: userError
    });

    if (userError || !userProfile) {
      console.error("❌ User profile fetch error:", userError);
      
      // If it's a column doesn't exist error, let's try a simpler query
      if (userError?.code === '42703') {
        console.log("🔧 Trying basic user query without new profile fields...");
        
        const { data: basicUserProfile, error: basicError } = await supabase
          .from("users")
          .select(`
            id,
            name,
            email,
            created_at,
            updated_at
          `)
          .eq("id", decodedToken.sub)
          .single();
          
        console.log("📊 Basic User Query Result:", {
          data: basicUserProfile,
          error: basicError
        });
        
        if (basicError || !basicUserProfile) {
          return NextResponse.json(
            { error: "User profile not found" }, 
            { status: 404 }
          );
        }
        
        // Use basic profile data
        const profile = {
          id: basicUserProfile.id,
          name: basicUserProfile.name,
          email: basicUserProfile.email,
          profilePicture: null,
          about: null,
          phone: null,
          location: null,
          jobTitle: null,
          department: null,
          dateOfBirth: null,
          createdAt: basicUserProfile.created_at,
          updatedAt: basicUserProfile.updated_at,
          profileUpdatedAt: null,
          organization: null,
          role: 'Member'
        };
        
        return NextResponse.json({
          success: true,
          profile
        }, { status: 200 });
      }
      
      return NextResponse.json(
        { error: "User profile not found" }, 
        { status: 404 }
      );
    }

    // Get user role information - check BOTH org and department roles
    const { data: userOrgRole, error: orgRoleError } = await supabase
      .from("user_organization_roles")
      .select(`
        role_id,
        global_roles!user_organization_roles_role_id_fkey(id, name, description)
      `)
      .eq("user_id", decodedToken.sub)
      .eq("organization_id", decodedToken.org_id)
      .maybeSingle();

    // Get department role from JWT (already decoded above)
    let displayRole = null;
    
    // Priority: current department role > org role
    if (decodedToken.department_role) {
      displayRole = decodedToken.department_role;
    } else if (userOrgRole) {
      displayRole = (userOrgRole as any).global_roles?.name;
    }

    if (orgRoleError) {
      console.error("User org role fetch error:", orgRoleError);
    }

    // Get organization info separately
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, domain")
      .eq("id", decodedToken.org_id)
      .single();

    if (orgError) {
      console.error("Organization fetch error:", orgError);
    }

    // Format the response
    const profile = {
      id: userProfile.id,
      name: userProfile.name,
      email: userProfile.email,
      profilePicture: userProfile.profile_picture_url,
      about: userProfile.about,
      phone: userProfile.phone,
      location: userProfile.location,
      jobTitle: userProfile.job_title,
      department: userProfile.department,
      dateOfBirth: userProfile.date_of_birth,
      emailNotificationsEnabled: userProfile.email_notifications_enabled,
      darkModeEnabled: userProfile.dark_mode_enabled,
      createdAt: userProfile.created_at,
      updatedAt: userProfile.updated_at,
      profileUpdatedAt: userProfile.profile_updated_at,
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