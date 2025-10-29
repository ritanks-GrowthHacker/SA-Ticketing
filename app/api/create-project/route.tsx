import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";

interface ProjectRequestBody {
  name: string;
  description?: string;
}

interface JWTPayload {
  sub: string;        // user ID
  org_id: string;     // organization ID
  org_name: string;   // organization name
  org_domain: string; // organization domain
  role: string;       // user role
  roles: string[];    // all user roles
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
    let requestBody: ProjectRequestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      console.error("JSON parsing error:", jsonError);
      return NextResponse.json(
        { error: "Invalid JSON format in request body" }, 
        { status: 400 }
      );
    }

    const { 
      name, 
      description
    } = requestBody;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Project name is required" }, 
        { status: 400 }
      );
    }

    // Check if user belongs to the organization through user_organization table
    const { data: userOrg, error: userOrgError } = await supabase
      .from("user_organization")
      .select(`
        user_id,
        organization_id,
        role_id,
        organizations(id, name, domain),
        roles(id, name, description)
      `)
      .eq("user_id", decodedToken.sub)
      .eq("organization_id", decodedToken.org_id)
      .maybeSingle();

    if (userOrgError || !userOrg) {
      console.error("User organization validation error:", userOrgError);
      return NextResponse.json(
        { error: "User not found or unauthorized" }, 
        { status: 403 }
      );
    }

    // Get user basic info
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", decodedToken.sub)
      .maybeSingle();

    if (userError || !user) {
      console.error("User validation error:", userError);
      return NextResponse.json(
        { error: "User not found" }, 
        { status: 403 }
      );
    }

    const userRole = (userOrg as any).roles;
    const userOrganization = (userOrg as any).organizations;

    // Check if the user has permission to create projects (Admin or Manager)
    if (!userRole || !["Admin", "Manager"].includes(userRole.name)) {
      return NextResponse.json(
        { error: "Insufficient permissions. Only Admins and Managers can create projects" }, 
        { status: 403 }
      );
    }

    // Use user's organization for the project
    let targetOrganizationId = decodedToken.org_id;

    // Check if project with same name already exists in the target organization
    const { data: existingProject } = await supabase
      .from("projects")
      .select("id, name")
      .eq("name", name.trim())
      .eq("organization_id", targetOrganizationId)
      .maybeSingle();

    if (existingProject) {
      return NextResponse.json(
        { error: "A project with this name already exists in the target organization" }, 
        { status: 409 }
      );
    }

    // Create the project (matching exact schema)
    const projectData = {
      name: name.trim(),
      description: description?.trim() || null,
      organization_id: targetOrganizationId,
      created_by: decodedToken.sub,
      updated_by: decodedToken.sub
    };

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert([projectData])
      .select("*")
      .single();

    if (projectError) {
      console.error("Project creation error:", projectError);
      
      // Handle specific database constraints
      if (projectError.code === "23505") {
        return NextResponse.json(
          { error: "A project with this name already exists" }, 
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to create project" }, 
        { status: 500 }
      );
    }

    // Fetch related data separately
    let createdBy = null;
    if (project.created_by) {
      const { data: creatorData } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("id", project.created_by)
        .maybeSingle();
      createdBy = creatorData;
    }

    let organization = null;
    if (project.organization_id) {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id, name, domain")
        .eq("id", project.organization_id)
        .maybeSingle();
      organization = orgData;
    }

    return NextResponse.json(
      {
        message: "Project created successfully",
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          created_at: project.created_at,
          updated_at: project.updated_at,
          created_by: createdBy,
          organization: organization
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Project creation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}

// GET method to retrieve projects for the organization
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

    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const search = url.searchParams.get("search");

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 100" }, 
        { status: 400 }
      );
    }

    const offset = (page - 1) * limit;

    // Use user's organization for querying projects
    let targetOrganizationId = decodedToken.org_id;

    // Build the query
    let query = supabase
      .from("projects")
      .select("*", { count: 'exact' })
      .eq("organization_id", targetOrganizationId)
      .order("created_at", { ascending: false });

    // Apply search filter if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: projects, error: projectsError, count } = await query;

    if (projectsError) {
      console.error("Projects retrieval error:", projectsError);
      return NextResponse.json(
        { error: "Failed to retrieve projects" }, 
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    // Fetch related data for each project
    const enrichedProjects = await Promise.all(
      (projects || []).map(async (project: any) => {
        // Fetch creator
        let createdBy = null;
        if (project.created_by) {
          const { data: creatorData } = await supabase
            .from("users")
            .select("id, name, email")
            .eq("id", project.created_by)
            .maybeSingle();
          createdBy = creatorData;
        }

        // Fetch organization
        let organization = null;
        if (project.organization_id) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("id, name, domain")
            .eq("id", project.organization_id)
            .maybeSingle();
          organization = orgData;
        }

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          created_at: project.created_at,
          updated_at: project.updated_at,
          created_by: createdBy,
          organization: organization
        };
      })
    );

    return NextResponse.json(
      {
        message: "Projects retrieved successfully",
        projects: enrichedProjects,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_count: count || 0,
          limit: limit,
          has_next_page: page < totalPages,
          has_previous_page: page > 1
        },
        filters: {
          search
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Projects retrieval error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}
