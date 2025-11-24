import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdminSales } from '@/app/db/connections';
import { DecodedToken, extractUserAndOrgId } from '../../helpers';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
    const {
      quote_title,
      quote_amount,
      tax_amount,
      total_amount,
      currency,
      valid_until,
      quote_items,
      terms_conditions,
      notes
    } = body;

    const { data: quote, error } = await supabaseAdminSales
      .from('quotes')
      .update({
        quote_title,
        quote_amount,
        tax_amount,
        total_amount,
        currency,
        valid_until,
        quote_items,
        terms_conditions,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('quote_id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating quote:', error);
      return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
    }

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('Error in PATCH /api/sales/quotes/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
