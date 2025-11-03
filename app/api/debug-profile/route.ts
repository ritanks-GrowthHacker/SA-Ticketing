// Debug route to test profile update
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("🔍 Debug - Received body:", body);
    
    const authHeader = req.headers.get("authorization");
    console.log("🔍 Debug - Auth header:", authHeader ? "Present" : "Missing");
    
    return NextResponse.json({
      success: true,
      message: "Debug endpoint working",
      receivedData: body
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json({ error: "Debug error" }, { status: 500 });
  }
}