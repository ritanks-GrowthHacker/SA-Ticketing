import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, statuses, priorities, globalRoles, departments, eq, or, sql, asc, and } from "@/lib/db-helper";

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
      let statusesData = await db
        .select()
        .from(statuses)
        .where(and(
          or(
            eq(statuses.organizationId, organizationId),
            sql`${statuses.organizationId} IS NULL`
          ),
          eq(statuses.isActive, true)
        ))
        .orderBy(asc(statuses.sortOrder), asc(statuses.name));

      if (type && (type === 'ticket' || type === 'priority')) {
        statusesData = statusesData.filter(s => s.type === type);
      }

      // Get priorities from priorities table for backward compatibility
      const prioritiesFromTable = await db
        .select()
        .from(priorities)
        .where(and(
          or(
            eq(priorities.organizationId, organizationId),
            sql`${priorities.organizationId} IS NULL`
          ),
          eq(priorities.isActive, true)
        ))
        .orderBy(asc(priorities.sortOrder));

      // Map priorities to match status structure
      const prioritiesAsStatuses = prioritiesFromTable.map((p: any) => ({
        id: p.id,
        name: p.name,
        type: 'priority',
        color_code: p.colorCode,
        sort_order: p.sortOrder,
        is_active: p.isActive,
        created_at: p.createdAt?.toISOString()
      }));

      responseData.statuses = {
        ticket: statusesData.filter((s: any) => s.type === 'ticket').map(s => ({
          ...s,
          color_code: s.colorCode,
          sort_order: s.sortOrder,
          is_active: s.isActive,
          created_at: s.createdAt?.toISOString()
        })),
        priority: prioritiesAsStatuses,
        all: [...statusesData.map(s => ({
          ...s,
          color_code: s.colorCode,
          sort_order: s.sortOrder,
          is_active: s.isActive,
          created_at: s.createdAt?.toISOString()
        })), ...prioritiesAsStatuses]
      };
    }

    if (entityType === 'roles' || entityType === 'all') {
      const roles = await db
        .select()
        .from(globalRoles)
        .orderBy(asc(globalRoles.name));

      responseData.roles = roles.map(r => ({
        ...r,
        created_at: r.createdAt?.toISOString()
      }));
    }

    if (entityType === 'departments' || entityType === 'all') {
      const depts = await db
        .select()
        .from(departments)
        .where(eq(departments.isActive, true))
        .orderBy(asc(departments.sortOrder), asc(departments.name));

      responseData.departments = depts.map(d => ({
        ...d,
        color_code: d.colorCode,
        sort_order: d.sortOrder,
        is_active: d.isActive,
        created_at: d.createdAt?.toISOString()
      }));
    }

    if (entityType === 'priorities' || entityType === 'all') {
      const prios = await db
        .select()
        .from(priorities)
        .where(and(
          or(
            eq(priorities.organizationId, organizationId),
            sql`${priorities.organizationId} IS NULL`
          ),
          eq(priorities.isActive, true)
        ))
        .orderBy(asc(priorities.sortOrder), asc(priorities.name));

      responseData.priorities = prios.map(p => ({
        ...p,
        color_code: p.colorCode,
        sort_order: p.sortOrder,
        is_active: p.isActive,
        created_at: p.createdAt?.toISOString()
      }));
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
        priorities: responseData.priorities?.length || 0,
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

        const newStatus = await db
          .insert(statuses)
          .values({
            organizationId: userInfo.org_id,
            name,
            type,
            colorCode: color_code || "#6B7280",
            sortOrder: sort_order || 0,
            isActive: true,
            createdAt: new Date()
          })
          .returning()
          .then(rows => rows[0] || null);

        newEntity = newStatus ? {
          ...newStatus,
          color_code: newStatus.colorCode,
          sort_order: newStatus.sortOrder,
          is_active: newStatus.isActive,
          created_at: newStatus.createdAt?.toISOString()
        } : null;
        createError = !newStatus;
        break;

      case 'role':
        const newRole = await db
          .insert(globalRoles)
          .values({
            name,
            description: description || null,
            createdAt: new Date()
          })
          .returning()
          .then(rows => rows[0] || null);

        newEntity = newRole ? {
          ...newRole,
          created_at: newRole.createdAt?.toISOString()
        } : null;
        createError = !newRole;
        break;

      case 'department':
        const newDept = await db
          .insert(departments)
          .values({
            name,
            createdAt: new Date()
          })
          .returning()
          .then(rows => rows[0] || null);

        newEntity = newDept ? {
          ...newDept,
          created_at: newDept.createdAt?.toISOString(),
          updated_at: newDept.updatedAt?.toISOString()
        } : null;
        createError = !newDept;
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
