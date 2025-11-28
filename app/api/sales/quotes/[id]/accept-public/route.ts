import { NextRequest, NextResponse } from 'next/server';
import { salesDb, quotes, clients, transactions, transactionLineItems, eq, and } from '@/lib/sales-db-helper';
import { emailService } from '@/lib/emailService';
import { emailTemplates } from '@/app/emailTemplates';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Verify token matches quote
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
      return NextResponse.json({ error: 'Invalid token or quote not found' }, { status: 404 });
    }

    // Fetch client info
    const clientResult = await salesDb
      .select()
      .from(clients)
      .where(eq(clients.clientId, quote.clientId))
      .limit(1);
    
    const client = clientResult[0];

    // Check if already accepted
    if (quote.status === 'accepted') {
      return NextResponse.json({ error: 'Quote already accepted' }, { status: 400 });
    }

    // Check if expired
    if (quote.magicLinkExpiresAt) {
      const expiryDate = new Date(quote.magicLinkExpiresAt);
      if (new Date() > expiryDate) {
        return NextResponse.json({ error: 'Quote has expired' }, { status: 410 });
      }
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create transaction from quote
    const transactionResult = await salesDb
      .insert(transactions)
      .values({
        organizationId: quote.organizationId,
        clientId: quote.clientId,
        salesMemberId: quote.createdByUserId,
        transactionDate: new Date().toISOString().split('T')[0],
        invoiceNumber,
        subtotalAmount: quote.quoteAmount,
        discountPercentage: '0',
        discountAmount: '0',
        taxPercentage: (quote.taxAmount && quote.quoteAmount) ? ((parseFloat(quote.taxAmount) / parseFloat(quote.quoteAmount)) * 100).toString() : '0',
        taxAmount: quote.taxAmount || '0',
        totalAmount: quote.totalAmount,
        currency: quote.currency || 'INR',
        paymentStatus: 'pending',
        amountPaid: '0',
        amountDue: quote.totalAmount,
        notes: `Generated from Quote ${quote.quoteNumber} (Accepted via magic link)`
      })
      .returning();

    const transaction = transactionResult[0];
    if (!transaction) {
      console.error('Error creating transaction: No result returned');
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }

    // Create line items from quote items
    const quoteItemsArray = quote.quoteItems as any[] || [];
    if (quoteItemsArray && quoteItemsArray.length > 0) {
      const lineItemsData = quoteItemsArray.map((item: any) => ({
        transactionId: transaction.transactionId,
        productName: item.description,
        quantity: item.quantity,
        unitPrice: item.rate.toString(),
        lineTotal: item.amount.toString(),
        discountPercentage: '0'
      }));

      await salesDb
        .insert(transactionLineItems)
        .values(lineItemsData);
    }

    // Update quote status
    await salesDb
      .update(quotes)
      .set({
        status: 'accepted',
        acceptedAt: new Date()
      })
      .where(eq(quotes.quoteId, id));

    // Send payment email to client
    try {
      await emailService.sendEmail({
        to: client.email!,
        subject: `Invoice ${invoiceNumber} - Payment Details`,
        html: emailTemplates.quoteAccepted({
          invoiceNumber,
          quoteNumber: quote.quoteNumber,
          totalAmount: parseFloat(quote.totalAmount),
          currency: quote.currency || 'INR',
          clientName: client.clientName,
          contactPerson: client.contactPerson || ''
        })
      });
      console.log('✅ Payment email sent to:', client.email);
    } catch (emailError) {
      console.error('❌ Error sending payment email:', emailError);
    }

    // Send notification to sales member who created the quote
    try {
      const { createSalesNotification } = await import('@/lib/salesNotifications');
      
      console.log('🔔 Creating sales notification for:', {
        userId: quote.createdByUserId,
        organizationId: quote.organizationId,
        entityType: 'quote',
        entityId: quote.quoteId
      });
      
      const notificationResult = await createSalesNotification({
        userId: quote.createdByUserId,
        organizationId: quote.organizationId,
        entityType: 'quote',
        entityId: quote.quoteId,
        title: '🎉 Quote Accepted!',
        message: `Quote ${quote.quoteNumber} was accepted by ${client.clientName}. Invoice ${invoiceNumber} generated.`,
        type: 'quote_accepted',
        metadata: {
          quote_number: quote.quoteNumber,
          invoice_number: invoiceNumber,
          client_name: client.clientName,
          amount: quote.totalAmount,
          currency: quote.currency || 'INR'
        }
      });
      
      if (notificationResult) {
        console.log('✅ Sales notification created successfully:', notificationResult);
      } else {
        console.error('❌ Sales notification creation returned null');
      }
    } catch (notifError) {
      console.error('❌ Error sending sales notification:', notifError);
    }

    return NextResponse.json({
      message: 'Quote accepted and invoice generated successfully',
      invoice_number: invoiceNumber,
      transaction_id: transaction.transactionId
    });
  } catch (error) {
    console.error('Error in POST /api/sales/quotes/[id]/accept-public:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
