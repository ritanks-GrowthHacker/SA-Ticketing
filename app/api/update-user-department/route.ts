import { NextResponse } from "next/server";
import { supabase } from "@/app/db/connections";

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
    const { data, error } = await supabase
      .from('users')
      .update({ department })
      .eq('id', userId)
      .select();

    if (error) {
      console.error("Error updating user department:", error);
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