import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// Supabase (commented out - migrated to PostgreSQL)
// import { supabase } from "@/app/db/connections";

// PostgreSQL with Drizzle ORM
import { db, userDepartmentRoles, departments, globalRoles, eq, and } from '@/lib/db-helper';

export async function POST(req: Request) {
  try {
    const { departmentId } = await req.json();
    
    if (!departmentId) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
    }

    // Get JWT token from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization token is required" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    let decodedToken: any;

    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as any;
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const userId = decodedToken.sub;
    const organizationId = decodedToken.org_id;

    console.log(`🔄 SWITCH-DEPARTMENT: User ${userId} switching to department ${departmentId}`);

    // Verify user has access to this department
    // Supabase (commented out)
    // const { data: departmentRole, error: deptRoleError } = await supabase.from("user_department_roles").select(`...`)

    // PostgreSQL with Drizzle
    const departmentRole = await db
      .select({
        departmentId: userDepartmentRoles.departmentId,
        roleId: userDepartmentRoles.roleId,
        organizationId: userDepartmentRoles.organizationId,
        deptId: departments.id,
        deptName: departments.name,
        roleIdGlobal: globalRoles.id,
        roleName: globalRoles.name
      })
      .from(userDepartmentRoles)
      .innerJoin(departments, eq(userDepartmentRoles.departmentId, departments.id))
      .innerJoin(globalRoles, eq(userDepartmentRoles.roleId, globalRoles.id))
      .where(
        and(
          eq(userDepartmentRoles.userId, userId),
          eq(userDepartmentRoles.departmentId, departmentId),
          eq(userDepartmentRoles.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!departmentRole || departmentRole.length === 0) {
      console.error("❌ SWITCH-DEPARTMENT: User does not have access to department");
      return NextResponse.json(
        { error: "You do not have access to this department" },
        { status: 403 }
      );
    }

    const dept = { id: departmentRole[0].deptId, name: departmentRole[0].deptName };
    const deptRole = { name: departmentRole[0].roleName };

    console.log(`✅ SWITCH-DEPARTMENT: User has ${deptRole?.name} role in department ${dept.name}`);

    // Rebuild JWT with new department context ONLY (no project)
    const newTokenPayload = {
      sub: decodedToken.sub,
      email: decodedToken.email,
      name: decodedToken.name,
      org_id: organizationId,
      org_name: decodedToken.org_name,
      org_domain: decodedToken.org_domain,
      role: decodedToken.role,
      roles: decodedToken.roles,
      department_id: dept.id,
      department_name: dept.name,
      department_role: deptRole?.name || null,
      department_roles: decodedToken.department_roles, // Keep all department roles
      iss: 'ticket-manager',
    };

    const newToken = jwt.sign(
      newTokenPayload,
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    console.log(`✅ SWITCH-DEPARTMENT: New JWT created with department_role: ${deptRole?.name}`);

    return NextResponse.json({
      success: true,
      message: "Department switched successfully",
      token: newToken,
      department: {
        id: dept.id,
        name: dept.name,
        role: deptRole?.name
      }
    }, { status: 200 });

  } catch (error) {
    console.error("SWITCH DEPARTMENT ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
