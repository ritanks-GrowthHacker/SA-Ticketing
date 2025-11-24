import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminSales } from '@/app/db/connections';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Fetch quote by magic link token
    const { data: quote, error } = await supabaseAdminSales
      .from('quotes')
      .select(`
        *,
        clients (
          client_name,
          contact_person,
          email,
          phone,
          address,
          city,
          state,
          country
        )
      `)
      .eq('magic_link_token', token)
      .single();

    if (error || !quote) {
      return NextResponse.json(
        { error: 'Quote not found or link is invalid' },
        { status: 404 }
      );
    }

    // Check if link has expired
    if (quote.magic_link_expires_at) {
      const expiryDate = new Date(quote.magic_link_expires_at);
      const now = new Date();
      
      if (now > expiryDate && quote.status !== 'accepted') {
        // Update status to expired
        await supabaseAdminSales
          .from('quotes')
          .update({ status: 'expired' })
          .eq('quote_id', quote.quote_id);

        return NextResponse.json(
          { error: 'This quote link has expired. Please contact the sender for a new link.' },
          { status: 410 }
        );
      }
    }

    // Mark as viewed if not already (only if status is 'sent')
    // Don't override hold, accepted, or rejected status
    if (quote.status === 'sent' && !quote.viewed_at) {
      await supabaseAdminSales
        .from('quotes')
        .update({ 
          status: 'viewed',
          viewed_at: new Date().toISOString()
        })
        .eq('quote_id', quote.quote_id);
      
      // Update local quote object
      quote.status = 'viewed';
      quote.viewed_at = new Date().toISOString();
    }

    // TODO: Fetch organization details from main database
    // For now, using placeholder data
    const organizationData = {
      organization_name: 'Your Company Name',
      organization_email: 'sales@yourcompany.com',
      organization_phone: '+91 1234567890',
      organization_address: 'Your Company Address, City, State - PIN'
    };

    return NextResponse.json({
      quote: {
        ...quote,
        client: quote.clients,
        ...organizationData
      }
    });
  } catch (error) {
    console.error('Error in GET /api/sales/quotes/preview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
