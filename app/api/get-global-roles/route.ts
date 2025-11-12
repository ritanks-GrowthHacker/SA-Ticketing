import { NextResponse } from "next/server";
import { supabase } from "@/app/db/connections";

export async function GET(req: Request) {
  try {
    // Fetch all global roles
    const { data: roles, error } = await supabase
      .from("global_roles")
      .select("id, name, description")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching global roles:", error);
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