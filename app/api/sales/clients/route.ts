import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, clients, salesTeamHierarchy, eq, and, inArray } from '@/lib/sales-db-helper';
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

    const newClientResult = await salesDb
      .insert(clients)
      .values({
        organizationId,
        clientName: clientData.client_name,
        contactPerson: clientData.contact_person,
        contactDesignation: clientData.contact_designation,
        email: clientData.email,
        phone: clientData.phone,
        address: clientData.address,
        city: clientData.city,
        state: clientData.state,
        country: clientData.country,
        postalCode: clientData.postal_code,
        industry: clientData.industry,
        clientType: clientData.client_type,
        companySize: clientData.company_size,
        annualRevenueBracket: clientData.annual_revenue_bracket,
        taxNumber: clientData.tax_number,
        gstNumber: clientData.gst_number,
        paymentTerms: clientData.payment_terms,
        preferredPaymentMethod: clientData.preferred_payment_method,
        creditLimit: clientData.credit_limit,
        clientSource: clientData.client_source,
        createdByUserId: userId,
        assignedSalesMemberId: clientData.assigned_sales_member_id || userId,
        notes: clientData.notes,
        status: 'active'
      })
      .returning();

    const newClient = newClientResult[0];
    if (!newClient) {
      console.error('Error creating client: No result returned');
      return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
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

    let whereConditions: any[] = [
      eq(clients.organizationId, organizationId),
      eq(clients.status, 'active')
    ];

    // Admin: All clients in organization
    if (viewType === 'admin') {
      console.log('👑 Admin view - Fetching ALL clients in org');
      // No additional filter - admin sees all clients
    }
    // Manager: All clients of team members
    else if (viewType === 'manager') {
      console.log('👔 Manager view - Fetching team clients');
      // Get manager's team member IDs
      const teamMembers = await salesDb
        .select({ userId: salesTeamHierarchy.userId })
        .from(salesTeamHierarchy)
        .where(
          and(
            eq(salesTeamHierarchy.managerId, userId),
            eq(salesTeamHierarchy.organizationId, organizationId)
          )
        );

      const memberIds = teamMembers?.map(m => m.userId) || [];
      memberIds.push(userId); // Include manager's own clients

      console.log('👥 Team member IDs:', memberIds);
      whereConditions.push(inArray(clients.assignedSalesMemberId, memberIds));
    }
    // Member: Only own clients
    else if (viewType === 'my') {
      console.log('👤 Member view - Fetching own clients');
      whereConditions.push(eq(clients.assignedSalesMemberId, userId));
    }
    // Specific member filter
    else if (salesMemberId) {
      console.log('🎯 Specific member filter:', salesMemberId);
      whereConditions.push(eq(clients.assignedSalesMemberId, salesMemberId));
    }

    const clientsResult = await salesDb
      .select()
      .from(clients)
      .where(and(...whereConditions))
      .orderBy(clients.createdAt);

    console.log('📦 Returning', clientsResult?.length || 0, 'clients');

    return NextResponse.json({ clients: clientsResult || [] });

  } catch (error: any) {
    console.error('Get clients error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch clients',
      details: error.message 
    }, { status: 500 });
  }
}
