import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
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

    const organizationId = decoded.org_id;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization ID found in token' },
        { status: 400 }
      );
    }

    // Fetch organization info including logo
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, domain, logo_url, address, tax_percentage, gst_number, cin')
      .eq('id', organizationId)
      .single();

    if (orgError || !organization) {
      console.error('Error fetching organization:', orgError);
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        domain: organization.domain,
        logo_url: organization.logo_url,
        address: organization.address,
        tax_percentage: organization.tax_percentage,
        gst_number: organization.gst_number,
        cin: organization.cin
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get-organization-info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
