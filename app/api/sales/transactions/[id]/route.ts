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

    // Fetch transaction with line items and client info
    const { data: transaction, error } = await supabaseAdminSales
      .from('transactions')
      .select(`
        *,
        clients (client_name, email, phone, address, city, state)
      `)
      .eq('transaction_id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      console.error('Error fetching transaction:', error);
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Fetch line items
    const { data: lineItems } = await supabaseAdminSales
      .from('transaction_line_items')
      .select('*')
      .eq('transaction_id', id);

    return NextResponse.json({
      transaction: {
        ...transaction,
        client_name: transaction.clients?.client_name,
        line_items: lineItems || []
      }
    });
  } catch (error) {
    console.error('Error in GET /api/sales/transactions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
