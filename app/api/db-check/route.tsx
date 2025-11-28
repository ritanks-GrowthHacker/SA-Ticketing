import { NextResponse } from "next/server";
// import { supabase } from "@/app/db/connections";
import { db, organizations, globalRoles, users, userOrganizationRoles, projects } from '@/lib/db-helper';

export async function GET(req: Request) {
  try {
    const results = {
      organizations: { status: "❌", details: "", has_is_master: false },
      roles: { status: "❌", details: "" },
      users: { status: "❌", details: "" },
      user_organization: { status: "❌", details: "" },
      projects: { status: "❌", details: "" }
    };

    // Test organizations table and is_master column
    try {
      const orgs = await db.select().from(organizations).limit(1);

      results.organizations = {
        status: "✅ OK",
        details: `Found ${orgs?.length || 0} organizations`,
        has_is_master: true
      };
    } catch (error: any) {
      if (error?.message?.includes("is_master does not exist")) {
        results.organizations = {
          status: "⚠️ MISSING COLUMN",
          details: "is_master column missing",
          has_is_master: false
        };
      } else {
        results.organizations = { status: "❌ ERROR", details: error?.message || "Table access failed", has_is_master: false };
      }
    }

    // Test roles table
    try {
      const roles = await db.select().from(globalRoles).limit(1);
      results.roles = { status: "✅ OK", details: `Found ${roles?.length || 0} roles` };
    } catch (error: any) {
      results.roles = { status: "❌ ERROR", details: error?.message || "Table access failed" };
    }

    // Test users table
    try {
      const usersList = await db.select().from(users).limit(1);
      results.users = { status: "✅ OK", details: `Found ${usersList?.length || 0} users` };
    } catch (error: any) {
      results.users = { status: "❌ ERROR", details: error?.message || "Table access failed" };
    }

    // Test user_organization junction table
    try {
      const userOrgs = await db.select().from(userOrganizationRoles).limit(1);
      results.user_organization = { status: "✅ OK", details: `Found ${userOrgs?.length || 0} user-org relationships` };
    } catch (error: any) {
      results.user_organization = { status: "❌ ERROR", details: error?.message || "Table access failed" };
    }

    // Test projects table
    try {
      const projectsList = await db.select().from(projects).limit(1);
      results.projects = { status: "✅ OK", details: `Found ${projectsList?.length || 0} projects` };
    } catch (error: any) {
      results.projects = { status: "❌ ERROR", details: error?.message || "Table access failed" };
    }

    // Determine overall status
    const hasErrors = Object.values(results).some(r => r.status.includes("❌"));
    const hasWarnings = Object.values(results).some(r => r.status.includes("⚠️"));
    
    let overallStatus = "✅ ALL GOOD";
    let statusCode = 200;
    
    if (hasErrors) {
      overallStatus = "❌ ERRORS FOUND";
      statusCode = 500;
    } else if (hasWarnings) {
      overallStatus = "⚠️ SETUP NEEDED";
      statusCode = 206; // Partial Content
    }

    return NextResponse.json({
      status: overallStatus,
      message: hasErrors || hasWarnings 
        ? "Database setup required. See DATABASE_MIGRATION.md for SQL scripts." 
        : "Database schema is ready for projects API",
      tables: results,
      next_steps: hasErrors || hasWarnings ? [
        "1. Go to Supabase Dashboard → SQL Editor",
        "2. Run the SQL scripts from DATABASE_MIGRATION.md",
        "3. Test the create-project API endpoint"
      ] : [
        "✅ Ready to use the create-project API!"
      ]
    }, { status: statusCode });

  } catch (error) {
    console.error("Database check error:", error);
    return NextResponse.json(
      { error: "Database connection failed" }, 
      { status: 500 }
    );
  }
}