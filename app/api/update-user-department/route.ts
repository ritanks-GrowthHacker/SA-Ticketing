import { NextResponse } from "next/server";
// Supabase (commented out - migrated to PostgreSQL)
// import { supabase } from "@/app/db/connections";

// PostgreSQL with Drizzle ORM
import { db, users, eq } from '@/lib/db-helper';

export async function POST(req: Request) {
  try {
    const { userId, department } = await req.json();

    if (!userId || !department) {
      return NextResponse.json(
        { error: "User ID and department are required" },
        { status: 400 }
      );
    }

    // Update user department
    // Supabase (commented out)
    // const { data, error } = await supabase.from('users').update({ department }).eq('id', userId).select();

    // PostgreSQL with Drizzle
    const data = await db
      .update(users)
      .set({ department })
      .where(eq(users.id, userId))
      .returning();

    if (!data || data.length === 0) {
      console.error("Error updating user department");
      return NextResponse.json(
        { error: "Failed to update user department" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: data[0]
    });

  } catch (error) {
    console.error("Update user department error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}