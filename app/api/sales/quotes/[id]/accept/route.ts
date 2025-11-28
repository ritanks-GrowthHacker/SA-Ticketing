import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, quotes, clients, transactions, transactionLineItems, eq, and } from '@/lib/sales-db-helper';
import { DecodedToken, extractUserAndOrgId } from '../../../helpers';
import { emailService } from '@/lib/emailService';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(
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

    // Fetch quote
    const quoteResult = await salesDb
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.quoteId, id),
          eq(quotes.organizationId, organizationId)
        )
      )
      .limit(1);

    const quote = quoteResult[0];
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Fetch client info
    const clientResult = await salesDb
      .select()
      .from(clients)
      .where(eq(clients.clientId, quote.clientId))
      .limit(1);
    
    const client = clientResult[0];

    if (quote.status === 'accepted') {
      return NextResponse.json({ error: 'Quote already accepted' }, { status: 400 });
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create transaction from quote
    const transactionResult = await salesDb
      .insert(transactions)
      .values({
        organizationId,
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
        notes: `Generated from Quote ${quote.quoteNumber}`
      })
      .returning();

    const transaction = transactionResult[0];
    if (!transaction) {
      console.error('Error creating transaction: No result returned');
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
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
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Invoice Generated - Quote Accepted</h2>
            <p>Hello ${client.contactPerson || client.clientName},</p>
            <p>Thank you for accepting our quote! Your invoice has been generated:</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
              <p style="margin: 5px 0;"><strong>Quote Number:</strong> ${quote.quoteNumber}</p>
              <p style="margin: 5px 0;"><strong>Amount:</strong> ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: quote.currency || 'INR' }).format(parseFloat(quote.totalAmount))}</p>
            </div>
            <p><strong>Payment Details:</strong></p>
            <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <p style="margin: 5px 0;">Bank Name: [Your Bank Name]</p>
              <p style="margin: 5px 0;">Account Number: [Your Account Number]</p>
              <p style="margin: 5px 0;">IFSC Code: [Your IFSC]</p>
              <p style="margin: 5px 0;">UPI ID: [Your UPI]</p>
            </div>
            <p>Please make the payment and send us the payment reference for confirmation.</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">For any questions, please contact us.</p>
          </div>
        `
      });
      console.log('✅ Payment email sent to:', client.email);
    } catch (emailError) {
      console.error('❌ Error sending payment email:', emailError);
    }

    return NextResponse.json({
      message: 'Quote accepted and invoice generated',
      transaction,
      invoice_number: invoiceNumber
    });
  } catch (error) {
    console.error('Error in POST /api/sales/quotes/[id]/accept:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
