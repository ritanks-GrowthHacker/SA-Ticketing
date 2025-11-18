import { NextResponse } from "next/server";
import { supabase } from "@/app/db/connections";

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
      const { data: existingDeptAssignment } = await supabase
        .from("user_department_roles")
        .select("id")
        .eq("user_id", user_id)
        .eq("department_id", department_id)
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (existingDeptAssignment) {
        // Update existing department role assignment
        const { error: updateError } = await supabase
          .from("user_department_roles")
          .update({
            role_id: role_id,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", user_id)
          .eq("department_id", department_id)
          .eq("organization_id", organization_id);

        if (updateError) {
          console.error("Error updating department role assignment:", updateError);
          return NextResponse.json(
            { error: "Failed to update department role assignment" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: "Department role updated successfully"
        });
      } else {
        // Create new department role assignment
        const { error: insertError } = await supabase
          .from("user_department_roles")
          .insert({
            user_id,
            role_id,
            department_id,
            organization_id
          });

        if (insertError) {
          console.error("Error creating department role assignment:", insertError);
          return NextResponse.json(
            { error: "Failed to create department role assignment" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: "Department role assigned successfully"
        });
      }
    }

    // Otherwise, assign organization-level role (for backward compatibility)
    // Check if the user already has a role assignment for this organization
    const { data: existingAssignment } = await supabase
      .from("user_organization_roles")
      .select("id")
      .eq("user_id", user_id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (existingAssignment) {
      // Update existing role assignment
      const { error: updateError } = await supabase
        .from("user_organization_roles")
        .update({
          role_id: role_id,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user_id)
        .eq("organization_id", organization_id);

      if (updateError) {
        console.error("Error updating role assignment:", updateError);
        return NextResponse.json(
          { error: "Failed to update role assignment" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Role updated successfully"
      });
    } else {
      // Create new role assignment
      const { error: insertError } = await supabase
        .from("user_organization_roles")
        .insert({
          user_id,
          role_id,
          organization_id
        });

      if (insertError) {
        console.error("Error creating role assignment:", insertError);
        return NextResponse.json(
          { error: "Failed to assign role" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Role assigned successfully"
      });
    }

  } catch (error) {
    console.error("Role assignment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}