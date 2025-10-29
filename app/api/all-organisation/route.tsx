import { NextResponse } from "next/server";
import { supabase } from "@/app/db/connections";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');

    let query = supabase
      .from("organizations")
      .select("id, name, domain, created_at")
      .order("name", { ascending: true });

    if (search && search.trim()) {
      query = query.or(`name.ilike.%${search}%,domain.ilike.%${search}%`);
    }

    if (limit && !isNaN(parseInt(limit))) {
      query = query.limit(parseInt(limit));
    }

    const { data: organizations, error: orgError } = await query;

    if (orgError) {
      console.error("Organizations fetch error:", orgError);
      return NextResponse.json(
        { error: "Failed to fetch organizations" }, 
        { status: 500 }
      );
    }

    const response = {
      message: "Organizations retrieved successfully",
      count: organizations?.length || 0,
      data: organizations || [],
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

    return NextResponse.json({
      message: "Organization created successfully",
      organization
    }, { status: 201 });

  } catch (error) {
    console.error("Create organization error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}
