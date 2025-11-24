import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdminSales } from '@/app/db/connections';
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

    // Fetch quote with client info
    const { data: quote, error: quoteError } = await supabaseAdminSales
      .from('quotes')
      .select('*, clients(*)')
      .eq('quote_id', id)
      .eq('organization_id', organizationId)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.status === 'accepted') {
      return NextResponse.json({ error: 'Quote already accepted' }, { status: 400 });
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create transaction from quote
    const { data: transaction, error: txnError } = await supabaseAdminSales
      .from('transactions')
      .insert({
        organization_id: organizationId,
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
        notes: `Generated from Quote ${quote.quote_number}`
      })
      .select()
      .single();

    if (txnError) {
      console.error('Error creating transaction:', txnError);
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
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
            <h2 style="color: #333;">Invoice Generated - Quote Accepted</h2>
            <p>Hello ${quote.clients.contact_person || quote.clients.client_name},</p>
            <p>Thank you for accepting our quote! Your invoice has been generated:</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
              <p style="margin: 5px 0;"><strong>Quote Number:</strong> ${quote.quote_number}</p>
              <p style="margin: 5px 0;"><strong>Amount:</strong> ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: quote.currency || 'INR' }).format(quote.total_amount)}</p>
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
      console.log('✅ Payment email sent to:', quote.clients.email);
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
