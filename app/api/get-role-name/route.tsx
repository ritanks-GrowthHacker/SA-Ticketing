import { NextResponse } from "next/server";
import { supabase } from "@/app/db/connections";
import jwt from "jsonwebtoken";

export async function GET(req: Request) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // Verify token
    try {
      jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // Get roleId from query parameters
    const { searchParams } = new URL(req.url);
    const roleId = searchParams.get('roleId');

    if (!roleId) {
      return NextResponse.json(
        { error: "Missing roleId parameter" },
        { status: 400 }
      );
    }

    console.log(`🔍 Getting role name for roleId: ${roleId}`);

    // Fetch role name from global_roles table
    const { data: role, error } = await supabase
      .from('global_roles')
      .select('name')
      .eq('id', roleId)
      .single();

    if (error) {
      console.error("❌ Failed to fetch role name:", error);
      return NextResponse.json(
        { error: "Failed to fetch role name" },
        { status: 500 }
      );
    }

    if (!role) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    console.log(`✅ Role name found: ${role.name}`);

    return NextResponse.json({
      success: true,
      roleName: role.name
    });

  } catch (error) {
    console.error("💥 Get role name error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}