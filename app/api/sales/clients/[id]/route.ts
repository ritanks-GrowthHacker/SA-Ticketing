import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, clients, eq, and } from '@/lib/sales-db-helper';
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

    const clientResult = await salesDb
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.clientId, id),
          eq(clients.organizationId, organizationId)
        )
      )
      .limit(1);

    const client = clientResult[0];
    if (!client) {
      console.error('Error fetching client: not found');
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

    const updatedResult = await salesDb
      .update(clients)
      .set(body)
      .where(
        and(
          eq(clients.clientId, id),
          eq(clients.organizationId, organizationId)
        )
      )
      .returning();

    const updatedClient = updatedResult[0];
    if (!updatedClient) {
      console.error('Error updating client: no result');
      return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
    }

    return NextResponse.json({ client: updatedClient });
  } catch (error) {
    console.error('Error in PATCH /api/sales/clients/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
