import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdminSales } from '@/app/db/connections';
import { DecodedToken, extractUserAndOrgId } from '../../helpers';
import { createSalesNotification } from '@/lib/salesNotifications';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function PATCH(request: NextRequest) {
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
      transaction_id,
      amount_paid,
      payment_method,
      payment_reference,
      payment_date
    } = body;

    if (!transaction_id || amount_paid === undefined) {
      return NextResponse.json(
        { error: 'transaction_id and amount_paid are required' },
        { status: 400 }
      );
    }

    // Fetch current transaction with client and sales member info
    const { data: currentTxn, error: fetchError } = await supabaseAdminSales
      .from('transactions')
      .select('*, clients(client_name), invoice_number, sales_member_id')
      .eq('transaction_id', transaction_id)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Calculate new amounts
    const newAmountPaid = (currentTxn.amount_paid || 0) + amount_paid;
    const newAmountDue = currentTxn.total_amount - newAmountPaid;

    // Determine new payment status
    let newStatus = 'pending';
    if (newAmountPaid >= currentTxn.total_amount) {
      newStatus = 'paid';
    } else if (newAmountPaid > 0) {
      newStatus = 'partial';
    }

    // Update transaction
    const { data: updatedTxn, error: updateError } = await supabaseAdminSales
      .from('transactions')
      .update({
        amount_paid: newAmountPaid,
        amount_due: newAmountDue,
        payment_status: newStatus,
        payment_method,
        payment_reference,
        payment_date,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_id', transaction_id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating transaction:', updateError);
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }

    // Send notification to sales member who created the transaction
    try {
      const clientName = (currentTxn as any).clients?.client_name || 'Client';
      const notificationUserId = currentTxn.sales_member_id || userId;
      
      console.log('🔔 Creating payment notification for:', {
        userId: notificationUserId,
        organizationId,
        entityType: 'payment',
        entityId: transaction_id
      });
      
      const notificationResult = await createSalesNotification({
        userId: notificationUserId,
        organizationId,
        entityType: 'payment',
        entityId: transaction_id,
        title: '💰 Payment Received!',
        message: `Payment of ₹${amount_paid.toLocaleString('en-IN')} received for Invoice ${currentTxn.invoice_number} from ${clientName}. Status: ${newStatus}`,
        type: 'payment_received',
        metadata: {
          invoice_number: currentTxn.invoice_number,
          client_name: clientName,
          amount_paid,
          payment_method,
          payment_reference,
          payment_status: newStatus,
          total_amount: currentTxn.total_amount,
          amount_due: newAmountDue
        }
      });
      console.log('✅ Payment notification sent');
    } catch (notifError) {
      console.error('❌ Error sending payment notification:', notifError);
    }

    return NextResponse.json({
      message: 'Payment recorded successfully',
      transaction: updatedTxn
    });
  } catch (error) {
    console.error('Error in PATCH /api/sales/transactions/payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
