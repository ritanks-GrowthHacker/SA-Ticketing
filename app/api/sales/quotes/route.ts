import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, quotes, eq, and, desc } from '@/lib/sales-db-helper';
import { DecodedToken, extractUserAndOrgId } from '../helpers';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Generate unique quote number
function generateQuoteNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `QT-${timestamp}-${random}`;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    const { userId, organizationId } = extractUserAndOrgId(decoded);

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');

    let whereConditions: any[] = [eq(quotes.organizationId, organizationId)];
    if (clientId) {
      whereConditions.push(eq(quotes.clientId, clientId));
    }

    const quotesResult = await salesDb
      .select()
      .from(quotes)
      .where(and(...whereConditions))
      .orderBy(desc(quotes.createdAt));

    return NextResponse.json({ quotes: quotesResult });
  } catch (error) {
    console.error('Error in GET /api/sales/quotes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    const { userId, organizationId } = extractUserAndOrgId(decoded);

    const body = await request.json();
    const {
      client_id,
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

    if (!client_id || !quote_title || !total_amount) {
      return NextResponse.json(
        { error: 'client_id, quote_title, and total_amount are required' },
        { status: 400 }
      );
    }

    const quoteNumber = generateQuoteNumber();

    const quoteResult = await salesDb
      .insert(quotes)
      .values({
        organizationId,
        createdByUserId: userId,
        clientId: client_id,
        quoteNumber,
        quoteTitle: quote_title,
        quoteAmount: quote_amount || 0,
        taxAmount: tax_amount || 0,
        totalAmount: total_amount,
        currency: currency || 'INR',
        validUntil: valid_until ? new Date(valid_until) : null,
        quoteItems: quote_items || [],
        termsConditions: terms_conditions || '',
        notes: notes || '',
        status: 'draft'
      })
      .returning();

    const quote = quoteResult[0];
    if (!quote) {
      console.error('Error creating quote: No result returned');
      return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 });
    }

    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/sales/quotes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
