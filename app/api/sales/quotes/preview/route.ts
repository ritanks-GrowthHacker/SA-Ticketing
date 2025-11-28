import { NextRequest, NextResponse } from 'next/server';
import { salesDb, quotes, clients, eq, gt } from '@/lib/sales-db-helper';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Fetch quote by magic link token
    const quoteResult = await salesDb
      .select()
      .from(quotes)
      .where(eq(quotes.magicLinkToken, token))
      .limit(1);

    const quote = quoteResult[0];
    if (!quote) {
      return NextResponse.json(
        { error: 'Quote not found or link is invalid' },
        { status: 404 }
      );
    }

    // Fetch client info
    const clientResult = await salesDb
      .select()
      .from(clients)
      .where(eq(clients.clientId, quote.clientId))
      .limit(1);
    
    const client = clientResult[0];

    // Check if link has expired
    if (quote.magicLinkExpiresAt) {
      const expiryDate = new Date(quote.magicLinkExpiresAt);
      const now = new Date();
      
      if (now > expiryDate && quote.status !== 'accepted') {
        // Update status to expired
        await salesDb
          .update(quotes)
          .set({ status: 'expired' })
          .where(eq(quotes.quoteId, quote.quoteId));

        return NextResponse.json(
          { error: 'This quote link has expired. Please contact the sender for a new link.' },
          { status: 410 }
        );
      }
    }

    // Mark as viewed if not already (only if status is 'sent')
    if (quote.status === 'sent' && !quote.viewedAt) {
      await salesDb
        .update(quotes)
        .set({ 
          status: 'viewed',
          viewedAt: new Date()
        })
        .where(eq(quotes.quoteId, quote.quoteId));
      
      // Update local quote object
      quote.status = 'viewed';
      quote.viewedAt = new Date();
    }

    // TODO: Fetch organization details from main database
    const organizationData = {
      organization_name: 'Your Company Name',
      organization_email: 'sales@yourcompany.com',
      organization_phone: '+91 1234567890',
      organization_address: 'Your Company Address, City, State - PIN'
    };

    return NextResponse.json({
      quote: {
        ...quote,
        clients: client,
        client,
        ...organizationData
      }
    });
  } catch (error) {
    console.error('Error in GET /api/sales/quotes/preview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
