import { NextResponse } from "next/server";
// Supabase (commented out - migrated to PostgreSQL)
// import { supabase } from "@/app/db/connections";

// PostgreSQL with Drizzle ORM
import { db, globalRoles, asc } from '@/lib/db-helper';

export async function GET(req: Request) {
  try {
    // Fetch all global roles
    // Supabase (commented out)
    // const { data: roles, error } = await supabase.from("global_roles").select("...")

    // PostgreSQL with Drizzle
    const roles = await db
      .select({
        id: globalRoles.id,
        name: globalRoles.name,
        description: globalRoles.description
      })
      .from(globalRoles)
      .orderBy(asc(globalRoles.name));

    if (!roles) {
      console.error("Error fetching global roles");
      return NextResponse.json(
        { error: "Failed to fetch roles" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      roles: roles || []
    });

  } catch (error) {
    console.error("Global roles fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}