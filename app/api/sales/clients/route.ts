import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdminSales } from '@/app/db/connections';
import { DecodedToken, extractUserAndOrgId } from '../helpers';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    const { userId, organizationId } = extractUserAndOrgId(decoded);

    const clientData = await req.json();

    const { data: newClient, error } = await supabaseAdminSales
      .from('clients')
      .insert({
        organization_id: organizationId,
        client_name: clientData.client_name,
        contact_person: clientData.contact_person,
        contact_designation: clientData.contact_designation,
        email: clientData.email,
        phone: clientData.phone,
        address: clientData.address,
        city: clientData.city,
        state: clientData.state,
        country: clientData.country,
        postal_code: clientData.postal_code,
        industry: clientData.industry,
        client_type: clientData.client_type,
        company_size: clientData.company_size,
        annual_revenue_bracket: clientData.annual_revenue_bracket,
        tax_number: clientData.tax_number,
        gst_number: clientData.gst_number,
        payment_terms: clientData.payment_terms,
        preferred_payment_method: clientData.preferred_payment_method,
        credit_limit: clientData.credit_limit,
        client_source: clientData.client_source,
        created_by_user_id: userId,
        assigned_sales_member_id: clientData.assigned_sales_member_id || userId,
        notes: clientData.notes,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating client:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Client registered successfully',
      client: newClient 
    });

  } catch (error: any) {
    console.error('Register client error:', error);
    return NextResponse.json({ 
      error: 'Failed to register client',
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    const { userId, organizationId } = extractUserAndOrgId(decoded);

    const { searchParams } = new URL(req.url);
    const viewType = searchParams.get('view'); // 'my', 'admin', 'manager'
    const salesMemberId = searchParams.get('salesMemberId');

    console.log('🔍 Get Clients API - View:', viewType, 'User:', userId, 'Org:', organizationId);

    let query = supabaseAdminSales
      .from('clients')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    // Admin: All clients in organization
    if (viewType === 'admin') {
      console.log('👑 Admin view - Fetching ALL clients in org');
      // No additional filter - admin sees all clients
    }
    // Manager: All clients of team members
    else if (viewType === 'manager') {
      console.log('👔 Manager view - Fetching team clients');
      // Get manager's team member IDs
      const { data: teamMembers } = await supabaseAdminSales
        .from('sales_team_hierarchy')
        .select('user_id')
        .eq('manager_id', userId)
        .eq('organization_id', organizationId);

      const memberIds = teamMembers?.map(m => m.user_id) || [];
      memberIds.push(userId); // Include manager's own clients

      console.log('👥 Team member IDs:', memberIds);
      query = query.in('assigned_sales_member_id', memberIds);
    }
    // Member: Only own clients
    else if (viewType === 'my') {
      console.log('👤 Member view - Fetching own clients');
      query = query.eq('assigned_sales_member_id', userId);
    }
    // Specific member filter
    else if (salesMemberId) {
      console.log('🎯 Specific member filter:', salesMemberId);
      query = query.eq('assigned_sales_member_id', salesMemberId);
    }

    const { data: clients, error } = await query;

    if (error) throw error;

    console.log('📦 Returning', clients?.length || 0, 'clients');

    return NextResponse.json({ clients: clients || [] });

  } catch (error: any) {
    console.error('Get clients error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch clients',
      details: error.message 
    }, { status: 500 });
  }
}
