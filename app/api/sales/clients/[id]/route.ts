import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdminSales } from '@/app/db/connections';
import { DecodedToken, extractUserAndOrgId } from '../../helpers';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    const { userId, organizationId } = extractUserAndOrgId(decoded);
    const { id } = await params;

    const { data: client, error } = await supabaseAdminSales
      .from('clients')
      .select('*')
      .eq('client_id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      console.error('Error fetching client:', error);
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ client });
  } catch (error) {
    console.error('Error in GET /api/sales/clients/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    const { userId, organizationId } = extractUserAndOrgId(decoded);
    const { id } = await params;

    const body = await request.json();

    const { data, error } = await supabaseAdminSales
      .from('clients')
      .update(body)
      .eq('client_id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating client:', error);
      return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
    }

    return NextResponse.json({ client: data });
  } catch (error) {
    console.error('Error in PATCH /api/sales/clients/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
