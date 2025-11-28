import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, transactions, clients, eq, and } from '@/lib/sales-db-helper';
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
    
    // Accept both camelCase and snake_case
    const transactionId = body.transactionId || body.transaction_id;
    const rawAmountPaid = body.amountPaid || body.amount_paid;
    const paymentMethod = body.paymentMethod || body.payment_method;
    const paymentReference = body.paymentReference || body.payment_reference;
    const paymentDate = body.paymentDate || body.payment_date;

    // Convert amount_paid to number and validate
    const amount_paid = parseFloat(rawAmountPaid);
    
    if (!transactionId || !rawAmountPaid || isNaN(amount_paid) || amount_paid <= 0) {
      return NextResponse.json(
        { error: 'transaction_id and valid amount_paid are required' },
        { status: 400 }
      );
    }

    console.log('🔍 Looking for transaction:', {
      transactionId,
      organizationId,
      amount_paid
    });

    // Fetch current transaction with Drizzle
    const txnResults = await salesDb
      .select({
        transactionId: transactions.transactionId,
        organizationId: transactions.organizationId,
        totalAmount: transactions.totalAmount,
        amountPaid: transactions.amountPaid,
        amountDue: transactions.amountDue,
        paymentStatus: transactions.paymentStatus,
        invoiceNumber: transactions.invoiceNumber,
        salesMemberId: transactions.salesMemberId,
        clientId: transactions.clientId,
        clientName: clients.clientName
      })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.clientId))
      .where(
        and(
          eq(transactions.transactionId, transactionId),
          eq(transactions.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!txnResults || txnResults.length === 0) {
      console.error('❌ Transaction not found');
      
      // Debug query without org filter
      const debugResults = await salesDb
        .select({
          transactionId: transactions.transactionId,
          organizationId: transactions.organizationId
        })
        .from(transactions)
        .where(eq(transactions.transactionId, transactionId));
      
      console.log('Debug - Transaction with matching ID:', debugResults);
      
      return NextResponse.json({ 
        error: 'Transaction not found',
        debug: debugResults,
        searchedOrgId: organizationId
      }, { status: 404 });
    }

    const currentTxn = txnResults[0];

    console.log('✅ Transaction found:', currentTxn);

    // Calculate new amounts
    const newAmountPaid = (parseFloat(currentTxn.amountPaid || '0')) + amount_paid;
    const newAmountDue = parseFloat(currentTxn.totalAmount) - newAmountPaid;

    // Determine new payment status
    let newStatus: 'pending' | 'partial' | 'paid' = 'pending';
    if (newAmountPaid >= parseFloat(currentTxn.totalAmount)) {
      newStatus = 'paid';
    } else if (newAmountPaid > 0) {
      newStatus = 'partial';
    }

    // Update transaction with Drizzle
    const updatedTxn = await salesDb
      .update(transactions)
      .set({
        amountPaid: newAmountPaid.toString(),
        amountDue: newAmountDue.toString(),
        paymentStatus: newStatus,
        paymentMethod,
        paymentReference,
        paymentDate: paymentDate || new Date().toISOString().split('T')[0],
        updatedAt: new Date()
      })
      .where(
        and(
          eq(transactions.transactionId, transactionId),
          eq(transactions.organizationId, organizationId)
        )
      )
      .returning();

    

    if (!updatedTxn || updatedTxn.length === 0) {
      console.error('Error updating transaction');
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }

    // Send notification to sales member who created the transaction
    try {
      const clientName = currentTxn.clientName || 'Client';
      const notificationUserId = currentTxn.salesMemberId || userId;
      
      console.log('🔔 Creating payment notification for:', {
        userId: notificationUserId,
        organizationId,
        entityType: 'payment',
        entityId: transactionId
      });
      
      const notificationResult = await createSalesNotification({
        userId: notificationUserId,
        organizationId,
        entityType: 'payment',
        entityId: transactionId,
        title: '💰 Payment Received!',
        message: `Payment of ₹${amount_paid.toLocaleString('en-IN')} received for Invoice ${currentTxn.invoiceNumber} from ${clientName}. Status: ${newStatus}`,
        type: 'payment_received',
        metadata: {
          invoiceNumber: currentTxn.invoiceNumber,
          clientName: clientName,
          amountPaid: amount_paid,
          paymentMethod,
          paymentReference,
          paymentStatus: newStatus,
          totalAmount: currentTxn.totalAmount,
          amountDue: newAmountDue.toString()
        }
      });
      console.log('✅ Payment notification sent');
    } catch (notifError) {
      console.error('❌ Error sending payment notification:', notifError);
    }

    return NextResponse.json({
      message: 'Payment recorded successfully',
      transaction: updatedTxn[0]
    });
  } catch (error) {
    console.error('Error in PATCH /api/sales/transactions/payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}