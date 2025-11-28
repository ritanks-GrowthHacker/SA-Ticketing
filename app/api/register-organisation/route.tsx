import { NextResponse } from "next/server";
// import { supabase } from "@/app/db/connections";
import { db, organizations, globalRoles, statuses, eq, asc } from '@/lib/db-helper';

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

    const existingOrgResults = await db.select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.domain, domain))
      .limit(1);

    if (existingOrgResults.length > 0) {
      return NextResponse.json(
        { error: "Organization with this domain already exists" }, 
        { status: 400 }
      );
    }

    let organization;
    try {
      const newOrgs = await db.insert(organizations)
        .values({ name, domain })
        .returning({ id: organizations.id, name: organizations.name, domain: organizations.domain, createdAt: organizations.createdAt });
      
      organization = newOrgs[0];
    } catch (orgError) {
      console.error("Organization creation error:", orgError);
      return NextResponse.json(
        { error: "Failed to create organization" }, 
        { status: 500 }
      );
    }

    // Roles are now global - no need to create organization-specific roles
    // Just fetch the existing global roles for reference
    let roles: any[] = [];
    try {
      roles = await db.select({
        id: globalRoles.id,
        name: globalRoles.name,
        description: globalRoles.description
      })
        .from(globalRoles)
        .orderBy(asc(globalRoles.name)) as any[];
    } catch (rolesError) {
      console.error("Global roles fetch error:", rolesError);
    }

    const defaultStatuses = [
      { name: "Open", type: "ticket", colorCode: "#3B82F6", sortOrder: 1, organizationId: organization.id },
      { name: "In Progress", type: "ticket", colorCode: "#F59E0B", sortOrder: 2, organizationId: organization.id },
      { name: "Under Review", type: "ticket", colorCode: "#8B5CF6", sortOrder: 3, organizationId: organization.id },
      { name: "Resolved", type: "ticket", colorCode: "#10B981", sortOrder: 4, organizationId: organization.id },
      { name: "Closed", type: "ticket", colorCode: "#6B7280", sortOrder: 5, organizationId: organization.id },
      
      { name: "Low", type: "priority", colorCode: "#10B981", sortOrder: 1, organizationId: organization.id },
      { name: "Medium", type: "priority", colorCode: "#F59E0B", sortOrder: 2, organizationId: organization.id },
      { name: "High", type: "priority", colorCode: "#EF4444", sortOrder: 3, organizationId: organization.id },
      { name: "Critical", type: "priority", colorCode: "#DC2626", sortOrder: 4, organizationId: organization.id }
    ];

    let insertedStatuses: any[] = [];
    try {
      insertedStatuses = await db.insert(statuses)
        .values(defaultStatuses)
        .returning({ id: statuses.id, name: statuses.name, type: statuses.type, colorCode: statuses.colorCode }) as any[];
    } catch (statusesError) {
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
          created_at: organization.createdAt || new Date()
        },
        roles: roles || [],
        statuses: insertedStatuses || []
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


