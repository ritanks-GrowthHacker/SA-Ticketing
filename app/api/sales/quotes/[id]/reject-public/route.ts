import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminSales } from '@/app/db/connections';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { token } = await request.json();

    // Verify magic link token
    const { data: quote, error: quoteError } = await supabaseAdminSales
      .from('quotes')
      .select('*, clients(*)')
      .eq('quote_id', id)
      .eq('magic_link_token', token)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Invalid quote or token' }, { status: 404 });
    }

    // Check if already processed
    if (quote.status === 'rejected') {
      return NextResponse.json({ error: 'Quote already rejected' }, { status: 400 });
    }

    // Update quote status to rejected
    await supabaseAdminSales
      .from('quotes')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString()
      })
      .eq('quote_id', id);

    return NextResponse.json({
      message: 'Quote rejected successfully'
    });
  } catch (error) {
    console.error('Error in POST /api/sales/quotes/[id]/reject-public:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
