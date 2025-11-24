import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdminSales } from '@/app/db/connections';
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

    let query = supabaseAdminSales
      .from('quotes')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data: quotes, error } = await query;

    if (error) {
      console.error('Error fetching quotes:', error);
      return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
    }

    return NextResponse.json({ quotes });
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

    const { data: quote, error } = await supabaseAdminSales
      .from('quotes')
      .insert([{
        organization_id: organizationId,
        created_by_user_id: userId,
        client_id,
        quote_number: quoteNumber,
        quote_title,
        quote_amount: quote_amount || 0,
        tax_amount: tax_amount || 0,
        total_amount,
        currency: currency || 'INR',
        valid_until: valid_until || null,
        quote_items: quote_items || [],
        terms_conditions: terms_conditions || '',
        notes: notes || '',
        status: 'draft'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating quote:', error);
      return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 });
    }

    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/sales/quotes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
