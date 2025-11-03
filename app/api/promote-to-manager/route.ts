import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";

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
    const { data: managerRole } = await supabase
      .from('global_roles')
      .select('id')
      .eq('name', 'Manager')
      .single();

    if (!managerRole) {
      return NextResponse.json({ error: "Manager role not found" }, { status: 404 });
    }

    // Update user's organization role to Manager
    const { data, error } = await supabase
      .from('user_organization_roles')
      .upsert({
        user_id: userId,
        organization_id: organizationId,
        role_id: managerRole.id
      })
      .select();

    if (error) {
      console.error('Error promoting user to Manager:', error);
      return NextResponse.json({ error: "Failed to promote user" }, { status: 500 });
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