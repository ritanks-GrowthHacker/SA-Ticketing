import { NextResponse } from "next/server";
import { supabase } from "@/app/db/connections";

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
      const { data: orgs, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, domain, is_master")
        .limit(1);

      if (orgError && orgError.message.includes("is_master does not exist")) {
        results.organizations = {
          status: "⚠️ MISSING COLUMN",
          details: "is_master column missing",
          has_is_master: false
        };
      } else if (orgError) {
        results.organizations = { status: "❌ ERROR", details: orgError.message, has_is_master: false };
      } else {
        results.organizations = {
          status: "✅ OK",
          details: `Found ${orgs?.length || 0} organizations`,
          has_is_master: true
        };
      }
    } catch (error) {
      results.organizations = { status: "❌ ERROR", details: "Table access failed", has_is_master: false };
    }

    // Test roles table
    try {
      const { data: roles, error: rolesError } = await supabase
        .from("roles")
        .select("id, name")
        .limit(1);
      
      if (rolesError) {
        results.roles = { status: "❌ ERROR", details: rolesError.message };
      } else {
        results.roles = { status: "✅ OK", details: `Found ${roles?.length || 0} roles` };
      }
    } catch (error) {
      results.roles = { status: "❌ ERROR", details: "Table access failed" };
    }

    // Test users table
    try {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, name, email")
        .limit(1);
      
      if (usersError) {
        results.users = { status: "❌ ERROR", details: usersError.message };
      } else {
        results.users = { status: "✅ OK", details: `Found ${users?.length || 0} users` };
      }
    } catch (error) {
      results.users = { status: "❌ ERROR", details: "Table access failed" };
    }

    // Test user_organization junction table
    try {
      const { data: userOrgs, error: userOrgError } = await supabase
        .from("user_organization")
        .select("user_id, organization_id, role_id")
        .limit(1);
      
      if (userOrgError) {
        results.user_organization = { status: "❌ ERROR", details: userOrgError.message };
      } else {
        results.user_organization = { status: "✅ OK", details: `Found ${userOrgs?.length || 0} user-org relationships` };
      }
    } catch (error) {
      results.user_organization = { status: "❌ ERROR", details: "Table access failed" };
    }

    // Test projects table
    try {
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id, name")
        .limit(1);
      
      if (projectsError) {
        results.projects = { status: "⚠️ MISSING TABLE", details: projectsError.message };
      } else {
        results.projects = { status: "✅ OK", details: `Found ${projects?.length || 0} projects` };
      }
    } catch (error) {
      results.projects = { status: "❌ ERROR", details: "Table access failed" };
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