import { NextRequest, NextResponse } from 'next/server';
import { salesDb, quotes, clients, eq, and } from '@/lib/sales-db-helper';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { token } = await request.json();

    // Verify magic link token
    const quoteResult = await salesDb
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.quoteId, id),
          eq(quotes.magicLinkToken, token)
        )
      )
      .limit(1);

    const quote = quoteResult[0];
    if (!quote) {
      return NextResponse.json({ error: 'Invalid quote or token' }, { status: 404 });
    }

    // Fetch client info
    const clientResult = await salesDb
      .select()
      .from(clients)
      .where(eq(clients.clientId, quote.clientId))
      .limit(1);
    
    const client = clientResult[0];

    // Check if already processed
    if (quote.status === 'rejected') {
      return NextResponse.json({ error: 'Quote already rejected' }, { status: 400 });
    }

    // Update quote status to rejected
    await salesDb
      .update(quotes)
      .set({
        status: 'rejected',
        rejectedAt: new Date()
      })
      .where(eq(quotes.quoteId, id));

    // Send notification to sales member
    try {
      const { createSalesNotification } = await import('@/lib/salesNotifications');
      
      await createSalesNotification({
        userId: quote.createdByUserId,
        organizationId: quote.organizationId,
        entityType: 'quote',
        entityId: quote.quoteId,
        title: '❌ Quote Rejected',
        message: `Quote ${quote.quoteNumber} was rejected by ${client.clientName}.`,
        type: 'quote_sent',
        metadata: {
          quote_number: quote.quoteNumber,
          client_name: client.clientName,
          amount: quote.totalAmount,
          currency: quote.currency || 'INR'
        }
      });
    } catch (notifError) {
      console.error('❌ Error sending reject notification:', notifError);
    }

    return NextResponse.json({
      message: 'Quote rejected successfully'
    });
  } catch (error) {
    console.error('Error in POST /api/sales/quotes/[id]/reject-public:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
