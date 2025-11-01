import { NextResponse } from "next/server";
import { supabase } from "@/app/db/connections";

export async function POST(req: Request) {
  try {
    const { name, domain } = await req.json();

    if (!name || !domain) {
      return NextResponse.json(
        { error: "Organization name and domain are required" }, 
        { status: 400 }
      );
    }

    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(domain)) {
      return NextResponse.json(
        { error: "Invalid domain format" }, 
        { status: 400 }
      );
    }

    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("domain", domain)
      .maybeSingle();

    if (existingOrg) {
      return NextResponse.json(
        { error: "Organization with this domain already exists" }, 
        { status: 400 }
      );
    }

    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .insert([{ name, domain }])
      .select("id, name, domain, created_at")
      .single();

    if (orgError || !organization) {
      console.error("Organization creation error:", orgError);
      return NextResponse.json(
        { error: "Failed to create organization" }, 
        { status: 500 }
      );
    }

    // Roles are now global - no need to create organization-specific roles
    // Just fetch the existing global roles for reference
    const { data: roles, error: rolesError } = await supabase
      .from("global_roles")
      .select("id, name, description")
      .order("name");

    if (rolesError) {
      console.error("Global roles fetch error:", rolesError);
    }

    const defaultStatuses = [
      { name: "Open", type: "ticket", color_code: "#3B82F6", sort_order: 1, organization_id: organization.id },
      { name: "In Progress", type: "ticket", color_code: "#F59E0B", sort_order: 2, organization_id: organization.id },
      { name: "Under Review", type: "ticket", color_code: "#8B5CF6", sort_order: 3, organization_id: organization.id },
      { name: "Resolved", type: "ticket", color_code: "#10B981", sort_order: 4, organization_id: organization.id },
      { name: "Closed", type: "ticket", color_code: "#6B7280", sort_order: 5, organization_id: organization.id },
      
      { name: "Low", type: "priority", color_code: "#10B981", sort_order: 1, organization_id: organization.id },
      { name: "Medium", type: "priority", color_code: "#F59E0B", sort_order: 2, organization_id: organization.id },
      { name: "High", type: "priority", color_code: "#EF4444", sort_order: 3, organization_id: organization.id },
      { name: "Critical", type: "priority", color_code: "#DC2626", sort_order: 4, organization_id: organization.id }
    ];

    const { data: statuses, error: statusesError } = await supabase
      .from("statuses")
      .insert(defaultStatuses)
      .select("id, name, type, color_code");

    if (statusesError) {
      console.error("Statuses creation error:", statusesError);
    }

    // Project statuses are now global and don't need to be created per organization

    return NextResponse.json(
      {
        message: "Organization created successfully",
        organization: {
          id: organization.id,
          name: organization.name,
          domain: organization.domain,
          created_at: organization.created_at
        },
        roles: roles || [],
        statuses: statuses || []
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Organization registration error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}


