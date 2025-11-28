import { NextResponse } from "next/server";
// import { supabase } from "@/app/db/connections";
import { db, userDepartmentRoles, userOrganizationRoles, eq, and } from '@/lib/db-helper';

export async function POST(req: Request) {
  try {
    const { user_id, role_id, organization_id, department_id } = await req.json();

    if (!user_id || !role_id || !organization_id) {
      return NextResponse.json(
        { error: "User ID, role ID, and organization ID are required" },
        { status: 400 }
      );
    }

    // If department_id is provided, assign department-level role
    if (department_id) {
      // Check if the user already has a department role assignment
      const existingDeptAssignment = await db
        .select({ id: userDepartmentRoles.id })
        .from(userDepartmentRoles)
        .where(
          and(
            eq(userDepartmentRoles.userId, user_id),
            eq(userDepartmentRoles.departmentId, department_id),
            eq(userDepartmentRoles.organizationId, organization_id)
          )
        )
        .limit(1)
        .then(rows => rows[0] || null);

      if (existingDeptAssignment) {
        // Update existing department role assignment
        await db
          .update(userDepartmentRoles)
          .set({
            roleId: role_id,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(userDepartmentRoles.userId, user_id),
              eq(userDepartmentRoles.departmentId, department_id),
              eq(userDepartmentRoles.organizationId, organization_id)
            )
          );
      } else {
        // Create new department role assignment
        await db
          .insert(userDepartmentRoles)
          .values({
            userId: user_id,
            roleId: role_id,
            departmentId: department_id,
            organizationId: organization_id
          });
      }

      return NextResponse.json({
        success: true,
        message: "Department role assigned successfully"
      });
    }

    // Otherwise, assign organization-level role (for backward compatibility)
    // Check if the user already has a role assignment for this organization
    const existingAssignment = await db
      .select({ id: userOrganizationRoles.id })
      .from(userOrganizationRoles)
      .where(
        and(
          eq(userOrganizationRoles.userId, user_id),
          eq(userOrganizationRoles.organizationId, organization_id)
        )
      )
      .limit(1)
      .then(rows => rows[0] || null);

    if (existingAssignment) {
      // Update existing role assignment
      await db
        .update(userOrganizationRoles)
        .set({
          roleId: role_id,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(userOrganizationRoles.userId, user_id),
            eq(userOrganizationRoles.organizationId, organization_id)
          )
        );
    } else {
      // Create new role assignment
      await db
        .insert(userOrganizationRoles)
        .values({
          userId: user_id,
          roleId: role_id,
          organizationId: organization_id
        });
    }

    return NextResponse.json({
      success: true,
      message: "Role assigned successfully"
    });

  } catch (error) {
    console.error("Role assignment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}