import { NextResponse } from "next/server";
// import { supabase } from "@/app/db/connections";
import { db, organizations, eq, ilike, or, asc } from "@/lib/db-helper";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');

    let query = db
      .select()
      .from(organizations)
      .orderBy(asc(organizations.name));

    let orgsData = await query;

    if (search && search.trim()) {
      orgsData = orgsData.filter(org => 
        org.name?.toLowerCase().includes(search.toLowerCase()) ||
        org.domain?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (limit && !isNaN(parseInt(limit))) {
      orgsData = orgsData.slice(0, parseInt(limit));
    }

    const response = {
      message: "Organizations retrieved successfully",
      count: orgsData.length,
      data: orgsData.map(org => ({
        ...org,
        created_at: org.createdAt?.toISOString()
      })),
      filters: {
        search: search || null,
        limit: limit ? parseInt(limit) : null
      }
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error("Get organizations error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: "Invalid JSON format in request body" }, 
        { status: 400 }
      );
    }

    const { name, domain } = requestBody;

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

    const existingOrg = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.domain, domain))
      .limit(1)
      .then(rows => rows[0] || null);

    if (existingOrg) {
      return NextResponse.json(
        { error: "Organization with this domain already exists" }, 
        { status: 400 }
      );
    }

    const organization = await db
      .insert(organizations)
      .values({ name, domain, createdAt: new Date() })
      .returning()
      .then(rows => rows[0] || null);

    if (!organization) {
      console.error("Organization creation error");
      return NextResponse.json(
        { error: "Failed to create organization" }, 
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Organization created successfully",
      organization: {
        ...organization,
        created_at: organization.createdAt?.toISOString()
      }
    }, { status: 201 });

  } catch (error) {
    console.error("Create organization error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}
