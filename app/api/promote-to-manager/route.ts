import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, globalRoles, userOrganizationRoles, eq, and } from '@/lib/db-helper';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const userId = decoded.sub;
    const organizationId = decoded.org_id;

    // Get Manager role ID
    const managerRole = await db
      .select({ id: globalRoles.id })
      .from(globalRoles)
      .where(eq(globalRoles.name, 'Manager'))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!managerRole) {
      return NextResponse.json({ error: "Manager role not found" }, { status: 404 });
    }

    // Check if user already has an org role
    const existingRole = await db
      .select({ id: userOrganizationRoles.id })
      .from(userOrganizationRoles)
      .where(
        and(
          eq(userOrganizationRoles.userId, userId),
          eq(userOrganizationRoles.organizationId, organizationId)
        )
      )
      .limit(1)
      .then(rows => rows[0] || null);

    let data;
    if (existingRole) {
      // Update existing role
      [data] = await db
        .update(userOrganizationRoles)
        .set({ roleId: managerRole.id })
        .where(
          and(
            eq(userOrganizationRoles.userId, userId),
            eq(userOrganizationRoles.organizationId, organizationId)
          )
        )
        .returning();
    } else {
      // Insert new role
      [data] = await db
        .insert(userOrganizationRoles)
        .values({
          userId: userId,
          organizationId: organizationId,
          roleId: managerRole.id
        })
        .returning();
    }

    return NextResponse.json({ 
      success: true, 
      message: "User promoted to Manager role successfully",
      data 
    });

  } catch (error) {
    console.error('Error in promote-to-manager:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}