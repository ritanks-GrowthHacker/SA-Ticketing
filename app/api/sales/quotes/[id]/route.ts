import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, quotes, eq, and } from '@/lib/sales-db-helper';
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

    const quoteResult = await salesDb
      .update(quotes)
      .set({
        quoteTitle: quote_title,
        quoteAmount: quote_amount,
        taxAmount: tax_amount,
        totalAmount: total_amount,
        currency,
        validUntil: valid_until ? new Date(valid_until) : null,
        quoteItems: quote_items,
        termsConditions: terms_conditions,
        notes,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(quotes.quoteId, id),
          eq(quotes.organizationId, organizationId)
        )
      )
      .returning();

    const quote = quoteResult[0];
    if (!quote) {
      console.error('Error updating quote: not found');
      return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
    }

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('Error in PATCH /api/sales/quotes/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
