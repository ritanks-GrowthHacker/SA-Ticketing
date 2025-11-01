import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'ticket' or 'priority' (for statuses)
    const entity = searchParams.get('entity'); // 'statuses', 'roles', 'departments', or 'all'
    const authHeader = req.headers.get('authorization');

    let organizationId: string | null = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        organizationId = decoded.org_id;
      } catch (jwtError) {
        console.error("JWT verification error:", jwtError);
        return NextResponse.json(
          { error: "Invalid or expired token" }, 
          { status: 401 }
        );
      }
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: "Authentication required" }, 
        { status: 401 }
      );
    }

    const entityType = entity || 'all';
    let responseData: any = {};

    if (entityType === 'statuses' || entityType === 'all') {
      let statusQuery = supabase
        .from("statuses")
        .select("id, name, type, color_code, sort_order, is_active, created_at")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (type && (type === 'ticket' || type === 'priority')) {
        statusQuery = statusQuery.eq("type", type);
      }

      const { data: statuses, error: statusError } = await statusQuery;

      if (statusError) {
        console.error("Status fetch error:", statusError);
        return NextResponse.json(
          { error: "Failed to fetch statuses" }, 
          { status: 500 }
        );
      }

      responseData.statuses = {
        ticket: statuses?.filter((s: any) => s.type === 'ticket') || [],
        priority: statuses?.filter((s: any) => s.type === 'priority') || [],
        all: statuses || []
      };
    }

    if (entityType === 'roles' || entityType === 'all') {
      const { data: roles, error: rolesError } = await supabase
        .from("global_roles")
        .select("id, name, description, created_at")
        .order("name", { ascending: true });

      if (rolesError) {
        console.error("Global roles fetch error:", rolesError);
        return NextResponse.json(
          { error: "Failed to fetch global roles" }, 
          { status: 500 }
        );
      }

      responseData.roles = roles || [];
    }

    if (entityType === 'departments' || entityType === 'all') {
      const { data: departments, error: deptError } = await supabase
        .from("departments")
        .select("id, name, created_at, updated_at")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true });

      if (deptError) {
        console.error("Departments fetch error:", deptError);
        return NextResponse.json(
          { error: "Failed to fetch departments" }, 
          { status: 500 }
        );
      }

      responseData.departments = departments || [];
    }

    const response = {
      message: `${entityType === 'all' ? 'Organization data' : entityType} retrieved successfully`,
      organization_id: organizationId,
      filters: {
        entity: entityType,
        type: type || "all"
      },
      count: {
        statuses: responseData.statuses?.all?.length || 0,
        roles: responseData.roles?.length || 0,
        departments: responseData.departments?.length || 0,
        ...(responseData.statuses && {
          ticket_statuses: responseData.statuses.ticket.length,
          priority_statuses: responseData.statuses.priority.length
        })
      },
      data: responseData
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error("Get statuses error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get('entity'); // 'status', 'role', or 'department'
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: "Authorization token required" }, 
        { status: 401 }
      );
    }

    let userInfo: any;
    try {
      const token = authHeader.substring(7);
      userInfo = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch (jwtError) {
      return NextResponse.json(
        { error: "Invalid or expired token" }, 
        { status: 401 }
      );
    }

    if (!userInfo.roles?.includes('Admin') && userInfo.role !== 'Admin') {
      return NextResponse.json(
        { error: "Admin privileges required" }, 
        { status: 403 }
      );
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: "Invalid JSON format in request body" }, 
        { status: 400 }
      );
    }

    const { name, type, color_code, sort_order, description } = requestBody;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" }, 
        { status: 400 }
      );
    }

    let newEntity, createError;

    switch (entity) {
      case 'status':
        if (!type || (type !== 'ticket' && type !== 'priority')) {
          return NextResponse.json(
            { error: "Valid type ('ticket' or 'priority') is required for status" }, 
            { status: 400 }
          );
        }

        const { data: newStatus, error: statusError } = await supabase
          .from("statuses")
          .insert([{
            organization_id: userInfo.org_id,
            name,
            type,
            color_code: color_code || "#6B7280",
            sort_order: sort_order || 0,
            is_active: true
          }])
          .select("id, name, type, color_code, sort_order, is_active, created_at")
          .single();

        newEntity = newStatus;
        createError = statusError;
        break;

      case 'role':
        const { data: newRole, error: roleError } = await supabase
          .from("global_roles")
          .insert([{
            name,
            description: description || null
          }])
          .select("id, name, description, created_at")
          .single();

        newEntity = newRole;
        createError = roleError;
        break;

      case 'department':
        const { data: newDept, error: deptError } = await supabase
          .from("departments")
          .insert([{
            organization_id: userInfo.org_id,
            name
          }])
          .select("id, name, created_at, updated_at")
          .single();

        newEntity = newDept;
        createError = deptError;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid entity type. Use 'status', 'role', or 'department'" }, 
          { status: 400 }
        );
    }

    if (createError || !newEntity) {
      console.error(`${entity} creation error:`, createError);
      return NextResponse.json(
        { error: `Failed to create ${entity}` }, 
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `${entity.charAt(0).toUpperCase() + entity.slice(1)} created successfully`,
      [entity]: newEntity
    }, { status: 201 });

  } catch (error) {
    console.error("Create entity error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}
