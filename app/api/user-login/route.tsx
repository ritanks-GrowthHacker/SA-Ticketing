import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";

export async function POST(req: Request) {
  try {
    // 🔍 Better JSON parsing with error handling
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      console.error("JSON parsing error:", jsonError);
      return NextResponse.json(
        { error: "Invalid JSON format in request body" }, 
        { status: 400 }
      );
    }

    const { email, password } = requestBody;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" }, 
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" }, 
        { status: 400 }
      );
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email, password_hash, created_at")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (userError) {
      console.error("User lookup error:", userError);
      return NextResponse.json(
        { error: "Internal Server Error" }, 
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" }, 
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" }, 
        { status: 401 }
      );
    }

    const { data: userOrganizations, error: orgError } = await supabase
      .from("user_organization")
      .select(`
        organization_id,
        role_id,
        organizations(id, name, domain),
        roles(id, name, description)
      `)
      .eq("user_id", user.id);

    if (orgError) {
      console.error("Organization lookup error:", orgError);
      return NextResponse.json(
        { error: "Failed to fetch user organizations" }, 
        { status: 500 }
      );
    }

    if (!userOrganizations || userOrganizations.length === 0) {
      return NextResponse.json(
        { error: "User is not associated with any organization" }, 
        { status: 403 }
      );
    }

  
    const primaryOrg = userOrganizations[0] as any;
    const organization = primaryOrg.organizations;
    const role = primaryOrg.roles;

    const allRoles = userOrganizations
      .map((uo: any) => uo.roles?.name)
      .filter(Boolean) as string[];

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      org_id: organization.id,
      org_name: organization.name,
      org_domain: organization.domain,
      role: role?.name || "Member",
      roles: allRoles,
      iss: process.env.JWT_ISSUER,
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    const responseData = {
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at
      },
      organization: {
        id: organization.id,
        name: organization.name,
        domain: organization.domain
      },
      role: role?.name || "Member",
      roles: allRoles,
      token,
      organizations: userOrganizations.map((uo: any) => ({
        id: uo.organizations.id,
        name: uo.organizations.name,
        domain: uo.organizations.domain,
        role: uo.roles?.name || "Member"
      }))
    };

    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}


