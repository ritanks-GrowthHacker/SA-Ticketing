import { NextRequest, NextResponse } from 'next/server';
// Supabase (commented out - migrated to PostgreSQL)
// import { supabase } from '@/app/db/connections';

// PostgreSQL with Drizzle ORM
import { db, organizations, eq, sql } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify and decode token
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch (error) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    console.log('=== DEBUG: Full decoded token ===');
    console.log(JSON.stringify(decoded, null, 2));

    // Try multiple possible field names for organization ID
    const organizationId = decoded.org_id || decoded.orgId || decoded.organizationId;

    console.log('=== DEBUG: Organization ID ===');
    console.log('organizationId:', organizationId);
    console.log('type:', typeof organizationId);

    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization ID found in token' },
        { status: 400 }
      );
    }

    // First, let's see what organizations exist in the database
    console.log('=== DEBUG: Checking all organizations ===');
    const allOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name
      })
      .from(organizations)
      .limit(10);
    
    console.log('All organizations in DB:', JSON.stringify(allOrgs, null, 2));

    // Try method 1: Direct eq comparison
    console.log('=== DEBUG: Method 1 - Direct eq comparison ===');
    const org1 = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        domain: organizations.domain,
        logoUrl: organizations.logoUrl,
        address: organizations.address,
        taxPercentage: organizations.taxPercentage,
        gstNumber: organizations.gstNumber,
        cin: organizations.cin
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    
    console.log('Method 1 result:', org1);

    // Try method 2: Text casting
    console.log('=== DEBUG: Method 2 - Text casting ===');
    const org2 = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        domain: organizations.domain,
        logoUrl: organizations.logoUrl,
        address: organizations.address,
        taxPercentage: organizations.taxPercentage,
        gstNumber: organizations.gstNumber,
        cin: organizations.cin
      })
      .from(organizations)
      .where(sql`${organizations.id}::text = ${organizationId}::text`)
      .limit(1);
    
    console.log('Method 2 result:', org2);

    // Try method 3: Raw SQL with parameterized query
    console.log('=== DEBUG: Method 3 - Raw SQL ===');
    const org3 = await db.execute(sql`
      SELECT id, name, domain, logo_url, address, tax_percentage, gst_number, cin
      FROM organizations 
      WHERE id::text = ${organizationId}::text
      LIMIT 1
    `);
    
    console.log('Method 3 result:', org3.rows);

    // Use whichever method worked
    let organization = org1.length > 0 ? org1 : (org2.length > 0 ? org2 : []);
    
    if (organization.length === 0 && org3.rows && org3.rows.length > 0) {
      // Map raw SQL result to expected format
      const rawOrg = org3.rows[0] as any;
      organization = [{
        id: rawOrg.id,
        name: rawOrg.name,
        domain: rawOrg.domain,
        logoUrl: rawOrg.logo_url,
        address: rawOrg.address,
        taxPercentage: rawOrg.tax_percentage,
        gstNumber: rawOrg.gst_number,
        cin: rawOrg.cin
      }];
    }

    if (!organization || organization.length === 0) {
      console.error('=== ERROR: Organization not found ===');
      console.error('Searched for ID:', organizationId);
      console.error('Available org IDs:', allOrgs.map(o => o.id));
      
      return NextResponse.json(
        { 
          error: 'Organization not found',
          debug: {
            searchedId: organizationId,
            searchedIdType: typeof organizationId,
            availableOrgs: allOrgs.map(o => ({ id: o.id, name: o.name })),
            decodedToken: decoded
          }
        },
        { status: 404 }
      );
    }

    const org = organization[0];

    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        domain: org.domain,
        logo_url: org.logoUrl,
        address: org.address,
        tax_percentage: org.taxPercentage,
        gst_number: org.gstNumber,
        cin: org.cin
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get-organization-info:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}