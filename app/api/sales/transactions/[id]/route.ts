import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, transactions, clients, transactionLineItems, eq, and } from '@/lib/sales-db-helper';
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

    // Fetch transaction
    const transactionResult = await salesDb
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.transactionId, id),
          eq(transactions.organizationId, organizationId)
        )
      )
      .limit(1);

    const transaction = transactionResult[0];
    if (!transaction) {
      console.error('Error fetching transaction: not found');
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Fetch client info
    const clientResult = await salesDb
      .select()
      .from(clients)
      .where(eq(clients.clientId, transaction.clientId))
      .limit(1);

    const client = clientResult[0];

    // Fetch line items
    const lineItems = await salesDb
      .select()
      .from(transactionLineItems)
      .where(eq(transactionLineItems.transactionId, id));

    return NextResponse.json({
      transaction: {
        ...transaction,
        clients: client,
        client_name: client?.clientName,
        line_items: lineItems || []
      }
    });
  } catch (error) {
    console.error('Error in GET /api/sales/transactions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
