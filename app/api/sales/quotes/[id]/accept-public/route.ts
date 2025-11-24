import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminSales } from '@/app/db/connections';
import { emailService } from '@/lib/emailService';
import { createSalesNotification } from '@/lib/salesNotifications';

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
    const { data: quote, error: quoteError } = await supabaseAdminSales
      .from('quotes')
      .select('*, clients(*)')
      .eq('quote_id', id)
      .eq('magic_link_token', token)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Invalid token or quote not found' }, { status: 404 });
    }

    // Check if already accepted
    if (quote.status === 'accepted') {
      return NextResponse.json({ error: 'Quote already accepted' }, { status: 400 });
    }

    // Check if expired
    if (quote.magic_link_expires_at) {
      const expiryDate = new Date(quote.magic_link_expires_at);
      if (new Date() > expiryDate) {
        return NextResponse.json({ error: 'Quote has expired' }, { status: 410 });
      }
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create transaction from quote
    const { data: transaction, error: txnError } = await supabaseAdminSales
      .from('transactions')
      .insert({
        organization_id: quote.organization_id,
        client_id: quote.client_id,
        sales_member_id: quote.created_by_user_id,
        transaction_date: new Date().toISOString(),
        invoice_number: invoiceNumber,
        subtotal_amount: quote.quote_amount,
        discount_percentage: 0,
        discount_amount: 0,
        tax_percentage: quote.tax_amount && quote.quote_amount ? ((quote.tax_amount / quote.quote_amount) * 100) : 0,
        tax_amount: quote.tax_amount || 0,
        total_amount: quote.total_amount,
        currency: quote.currency || 'INR',
        payment_status: 'pending',
        amount_paid: 0,
        amount_due: quote.total_amount,
        notes: `Generated from Quote ${quote.quote_number} (Accepted via magic link)`
      })
      .select()
      .single();

    if (txnError) {
      console.error('Error creating transaction:', txnError);
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }

    // Create line items from quote items
    if (quote.quote_items && quote.quote_items.length > 0) {
      const lineItems = quote.quote_items.map((item: any) => ({
        transaction_id: transaction.transaction_id,
        product_name: item.description,
        quantity: item.quantity,
        unit_price: item.rate,
        line_total: item.amount,
        discount_percentage: 0
      }));

      await supabaseAdminSales
        .from('transaction_line_items')
        .insert(lineItems);
    }

    // Update quote status
    await supabaseAdminSales
      .from('quotes')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('quote_id', id);

    // Send payment email to client
    try {
      await emailService.sendEmail({
        to: quote.clients.email,
        subject: `Invoice ${invoiceNumber} - Payment Details`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">✅ Quote Accepted - Invoice Generated</h2>
            <p>Hello ${quote.clients.contact_person || quote.clients.client_name},</p>
            <p>Thank you for accepting our quote! Your invoice has been generated:</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
              <p style="margin: 5px 0;"><strong>Quote Number:</strong> ${quote.quote_number}</p>
              <p style="margin: 5px 0;"><strong>Amount Due:</strong> ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: quote.currency || 'INR' }).format(quote.total_amount)}</p>
            </div>
            <h3 style="color: #333;">Payment Details:</h3>
            <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>Bank Name:</strong> Your Bank Name</p>
              <p style="margin: 5px 0;"><strong>Account Number:</strong> XXXX XXXX XXXX</p>
              <p style="margin: 5px 0;"><strong>IFSC Code:</strong> YOURBANK0000</p>
              <p style="margin: 5px 0;"><strong>Account Name:</strong> Your Company Name</p>
              <p style="margin: 5px 0;"><strong>UPI ID:</strong> yourcompany@upi</p>
            </div>
            <p>Please make the payment and send us the payment reference/screenshot for confirmation.</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              For any questions, please contact us at sales@yourcompany.com
            </p>
          </div>
        `
      });
      console.log('✅ Payment email sent to:', quote.clients.email);
    } catch (emailError) {
      console.error('❌ Error sending payment email:', emailError);
    }

    // Send notification to sales member who created the quote
    try {
      await createSalesNotification({
        userId: quote.created_by_user_id,
        organizationId: quote.organization_id,
        entityType: 'quote',
        entityId: quote.quote_id,
        title: '🎉 Quote Accepted!',
        message: `Quote ${quote.quote_number} was accepted by ${quote.clients.client_name}. Invoice ${invoiceNumber} generated.`,
        type: 'quote_accepted',
        metadata: {
          quote_number: quote.quote_number,
          invoice_number: invoiceNumber,
          client_name: quote.clients.client_name,
          amount: quote.total_amount,
          currency: quote.currency || 'INR'
        }
      });
      console.log('✅ Notification sent to user:', quote.created_by_user_id);
    } catch (notifError) {
      console.error('❌ Error sending notification:', notifError);
    }

    return NextResponse.json({
      message: 'Quote accepted and invoice generated successfully',
      invoice_number: invoiceNumber,
      transaction_id: transaction.transaction_id
    });
  } catch (error) {
    console.error('Error in POST /api/sales/quotes/[id]/accept-public:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
