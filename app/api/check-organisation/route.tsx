import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from "@/app/db/connections";
import { db, organizations, eq, ilike, or, and, sql } from "@/lib/db-helper";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain, name, email } = body;

    // Validate required fields
    if (!domain && !name && !email) {
      return NextResponse.json(
        { 
          error: 'At least one parameter is required (domain, name, or email)',
          exists: false
        }, 
        { status: 400 }
      );
    }

    let conditions: any[] = [];
    let whereClauses: any[] = [];
    let criteriaDescriptions: string[] = [];

    // Build query based on provided parameters
    if (domain) {
      whereClauses.push(eq(organizations.domain, domain.toLowerCase()));
      conditions.push(`domain: ${domain}`);
    }

    if (name) {
      whereClauses.push(ilike(organizations.name, `%${name}%`));
      conditions.push(`name: ${name}`);
    }

    if (email) {
      // Extract domain from email for organization lookup
      const emailDomain = email.split('@')[1];
      if (emailDomain) {
        whereClauses.push(eq(organizations.domain, emailDomain.toLowerCase()));
        conditions.push(`email domain: ${emailDomain}`);
      }
    }

    // Execute query with combined WHERE clauses
    const orgsResult = whereClauses.length > 0
      ? await db.select().from(organizations).where(or(...whereClauses))
      : [];

    if (!orgsResult) {
      console.error('Database error: Query failed');
      return NextResponse.json(
        { 
          error: 'Failed to check organization',
          exists: false
        }, 
        { status: 500 }
      );
    }

    const exists = orgsResult && orgsResult.length > 0;
    const organization = exists ? orgsResult[0] : null;

    return NextResponse.json({
      exists,
      organization: organization ? {
        id: organization.id,
        name: organization.name,
        domain: organization.domain,
        created_at: organization.createdAt
      } : null,
      searchCriteria: conditions,
      message: exists 
        ? 'Organization found' 
        : 'Organization not found'
    });

  } catch (error) {
    console.error('Organization check error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        exists: false
      }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const name = searchParams.get('name');
    const email = searchParams.get('email');

    // Validate required fields
    if (!domain && !name && !email) {
      return NextResponse.json(
        { 
          error: 'At least one parameter is required (domain, name, or email)',
          exists: false
        }, 
        { status: 400 }
      );
    }

    let whereClauses: any[] = [];
    let criteriaDescriptions: string[] = [];

    // Build query based on provided parameters
    if (domain) {
      whereClauses.push(eq(organizations.domain, domain.toLowerCase()));
      criteriaDescriptions.push(`domain: ${domain}`);
    }

    if (name) {
      whereClauses.push(ilike(organizations.name, `%${name}%`));
      criteriaDescriptions.push(`name: ${name}`);
    }

    if (email) {
      // Extract domain from email for organization lookup
      const emailDomain = email.split('@')[1];
      if (emailDomain) {
        whereClauses.push(eq(organizations.domain, emailDomain.toLowerCase()));
        criteriaDescriptions.push(`email domain: ${emailDomain}`);
      }
    }

    const orgsData = whereClauses.length > 0
      ? await db
          .select()
          .from(organizations)
          .where(and(...whereClauses))
      : [];

    const exists = orgsData && orgsData.length > 0;
    const organization = exists ? orgsData[0] : null;

    return NextResponse.json({
      exists,
      organization: organization ? {
        id: organization.id,
        name: organization.name,
        domain: organization.domain,
        created_at: organization.createdAt?.toISOString()
      } : null,
      searchCriteria: criteriaDescriptions,
      message: exists 
        ? 'Organization found' 
        : 'Organization not found'
    });

  } catch (error) {
    console.error('Organization check error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        exists: false
      }, 
      { status: 500 }
    );
  }
}