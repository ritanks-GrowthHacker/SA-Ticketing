import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, transactions, clients, transactionLineItems, eq, and } from '@/lib/sales-db-helper';
import { DecodedToken, extractUserAndOrgId } from '../helpers';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    const { userId, organizationId } = extractUserAndOrgId(decoded);

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('client_id');

    let whereConditions: any[] = [eq(transactions.organizationId, organizationId)];
    if (clientId) {
      whereConditions.push(eq(transactions.clientId, clientId));
    }

    const transactionsResult = await salesDb
      .select()
      .from(transactions)
      .where(and(...whereConditions))
      .orderBy(transactions.createdAt);

    // Format response with client names
    const formatted = await Promise.all(
      transactionsResult.map(async (txn) => {
        const clientResult = await salesDb
          .select({ clientName: clients.clientName })
          .from(clients)
          .where(eq(clients.clientId, txn.clientId))
          .limit(1);
        
        return {
          ...txn,
          client_name: clientResult[0]?.clientName || 'Unknown Client'
        };
      })
    );

    return NextResponse.json({ transactions: formatted });
  } catch (error) {
    console.error('Error in GET /api/sales/transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    const { userId, organizationId } = extractUserAndOrgId(decoded);

    const transactionData = await req.json();

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Calculate amounts
    const subtotal = transactionData.subtotal_amount;
    const discountAmount = (subtotal * (transactionData.discount_percentage || 0)) / 100;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * (transactionData.tax_percentage || 0)) / 100;
    const totalAmount = afterDiscount + taxAmount;

    // Insert transaction
    const transactionResult = await salesDb
      .insert(transactions)
      .values({
        organizationId,
        clientId: transactionData.client_id,
        salesMemberId: transactionData.sales_member_id || userId,
        transactionDate: transactionData.transaction_date || new Date().toISOString().split('T')[0],
        invoiceNumber,
        subtotalAmount: subtotal.toString(),
        discountPercentage: (transactionData.discount_percentage || 0).toString(),
        discountAmount: discountAmount.toString(),
        taxPercentage: (transactionData.tax_percentage || 0).toString(),
        taxAmount: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
        currency: transactionData.currency || 'INR',
        paymentStatus: 'pending',
        amountPaid: '0',
        amountDue: totalAmount.toString(),
        contractStartDate: transactionData.contract_start_date,
        contractEndDate: transactionData.contract_end_date,
        contractDurationMonths: transactionData.contract_duration_months,
        renewalDate: transactionData.renewal_date,
        commissionPercentage: (transactionData.commission_percentage || 0).toString(),
        commissionAmount: ((totalAmount * (transactionData.commission_percentage || 0)) / 100).toString(),
        notes: transactionData.notes
      })
      .returning();

    const transaction = transactionResult[0];
    if (!transaction) {
      console.error('Error creating transaction: No result returned');
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }

    // Insert line items if provided
    if (transactionData.line_items && transactionData.line_items.length > 0) {
      const lineItemsData = transactionData.line_items.map((item: any) => {
        const lineTotal = item.quantity * item.unit_price * (1 - (item.discount_percentage || 0) / 100);
        const totalCost = item.quantity * (item.cost_price || 0);
        const profitMargin = lineTotal - totalCost;
        const profitPercentage = totalCost > 0 ? (profitMargin / totalCost) * 100 : 0;

        return {
          transactionId: transaction.transactionId,
          productId: item.product_id,
          productName: item.product_name,
          productCode: item.product_code,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          costPrice: item.cost_price,
          discountPercentage: item.discount_percentage || 0,
          lineTotal,
          totalCost,
          profitMargin,
          profitPercentage
        };
      });

      await salesDb
        .insert(transactionLineItems)
        .values(lineItemsData);
    }

    return NextResponse.json({ 
      message: 'Transaction created successfully',
      transaction 
    });

  } catch (error: any) {
    console.error('Create transaction error:', error);
    return NextResponse.json({ 
      error: 'Failed to create transaction',
      details: error.message 
    }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;

    const { transaction_id, amount_paid, payment_method, payment_reference, payment_date } = await req.json();

    if (!transaction_id) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
    }

    const updatedResult = await salesDb
      .update(transactions)
      .set({
        amountPaid: amount_paid.toString(),
        paymentMethod: payment_method,
        paymentReference: payment_reference,
        paymentDate: payment_date || new Date().toISOString().split('T')[0]
      })
      .where(
        and(
          eq(transactions.transactionId, transaction_id),
          eq(transactions.organizationId, decoded.organization_id || decoded.org_id || '')
        )
      )
      .returning();

    const updated = updatedResult[0];
    if (!updated) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Payment updated successfully',
      transaction: updated 
    });

  } catch (error: any) {
    console.error('Update payment error:', error);
    return NextResponse.json({ 
      error: 'Failed to update payment',
      details: error.message 
    }, { status: 500 });
  }
}
