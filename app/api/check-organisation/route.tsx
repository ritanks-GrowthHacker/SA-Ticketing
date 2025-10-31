import { NextRequest, NextResponse } from 'next/server';
import { supabase } from "@/app/db/connections";

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

    let query = supabase.from('organizations').select('id, name, domain, created_at');
    let conditions = [];

    // Build query based on provided parameters
    if (domain) {
      query = query.eq('domain', domain.toLowerCase());
      conditions.push(`domain: ${domain}`);
    }

    if (name) {
      query = query.ilike('name', `%${name}%`);
      conditions.push(`name: ${name}`);
    }

    if (email) {
      // Extract domain from email for organization lookup
      const emailDomain = email.split('@')[1];
      if (emailDomain) {
        query = query.eq('domain', emailDomain.toLowerCase());
        conditions.push(`email domain: ${emailDomain}`);
      }
    }

    const { data: organizations, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { 
          error: 'Failed to check organization',
          exists: false
        }, 
        { status: 500 }
      );
    }

    const exists = organizations && organizations.length > 0;
    const organization = exists ? organizations[0] : null;

    return NextResponse.json({
      exists,
      organization: organization ? {
        id: organization.id,
        name: organization.name,
        domain: organization.domain,
        created_at: organization.created_at
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

    let query = supabase.from('organizations').select('id, name, domain, created_at');
    let conditions = [];

    // Build query based on provided parameters
    if (domain) {
      query = query.eq('domain', domain.toLowerCase());
      conditions.push(`domain: ${domain}`);
    }

    if (name) {
      query = query.ilike('name', `%${name}%`);
      conditions.push(`name: ${name}`);
    }

    if (email) {
      // Extract domain from email for organization lookup
      const emailDomain = email.split('@')[1];
      if (emailDomain) {
        query = query.eq('domain', emailDomain.toLowerCase());
        conditions.push(`email domain: ${emailDomain}`);
      }
    }

    const { data: organizations, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { 
          error: 'Failed to check organization',
          exists: false
        }, 
        { status: 500 }
      );
    }

    const exists = organizations && organizations.length > 0;
    const organization = exists ? organizations[0] : null;

    return NextResponse.json({
      exists,
      organization: organization ? {
        id: organization.id,
        name: organization.name,
        domain: organization.domain,
        created_at: organization.created_at
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