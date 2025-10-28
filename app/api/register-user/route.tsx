import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";

export async function POST(req: Request) {
  try {
    const { name, email, password, organization_domain } = await req.json();

    if (!name || !email || !password || !organization_domain) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const { data: organization } = await supabase
      .from("organizations")
      .select("id, name, domain")
      .eq("domain", organization_domain)
      .maybeSingle();

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const emailDomain = email.split('@')[1];
    if (emailDomain !== organization.domain) {
      return NextResponse.json({ 
        error: `Email must be from ${organization.domain} domain` 
      }, { status: 400 });
    }

    const organization_id = organization.id;

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data: user, error: userError } = await supabase
      .from("users")
      .insert([{ name, email, password_hash }])
      .select("id, name, email, created_at")
      .single();

    if (userError || !user)
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });

    const { data: role } = await supabase
      .from("roles")
      .select("id, name")
      .eq("organization_id", organization_id)
      .eq("name", "Member")
      .maybeSingle();

    await supabase
      .from("user_organization")
      .insert([{ user_id: user.id, organization_id, role_id: role?.id || null }]);

    const { data: roles } = await supabase
      .from("roles")
      .select("name")
      .in(
        "id",
        (
          await supabase
            .from("user_organization")
            .select("role_id")
            .eq("user_id", user.id)
        ).data?.map((r: any) => r.role_id) || []
      );

    const roleNames = roles?.map((r) => r.name) || [];

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        org_id: organization_id,
        roles: roleNames,
        iss: process.env.JWT_ISSUER,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    return NextResponse.json({ user, token }, { status: 201 });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
