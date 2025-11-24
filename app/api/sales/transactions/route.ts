import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdminSales } from '@/app/db/connections';
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

    let query = supabaseAdminSales
      .from('transactions')
      .select(`
        *,
        clients (client_name)
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // Format response
    const formatted = transactions.map(txn => ({
      ...txn,
      client_name: txn.clients?.client_name || 'Unknown Client'
    }));

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
    const { data: transaction, error: transactionError } = await supabaseAdminSales
      .from('transactions')
      .insert({
        organization_id: organizationId,
        client_id: transactionData.client_id,
        sales_member_id: transactionData.sales_member_id || userId,
        transaction_date: transactionData.transaction_date || new Date().toISOString(),
        invoice_number: invoiceNumber,
        subtotal_amount: subtotal,
        discount_percentage: transactionData.discount_percentage || 0,
        discount_amount: discountAmount,
        tax_percentage: transactionData.tax_percentage || 0,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        currency: transactionData.currency || 'INR',
        payment_status: 'pending',
        amount_paid: 0,
        amount_due: totalAmount,
        contract_start_date: transactionData.contract_start_date,
        contract_end_date: transactionData.contract_end_date,
        contract_duration_months: transactionData.contract_duration_months,
        renewal_date: transactionData.renewal_date,
        commission_percentage: transactionData.commission_percentage || 0,
        commission_amount: (totalAmount * (transactionData.commission_percentage || 0)) / 100,
        notes: transactionData.notes
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      return NextResponse.json({ error: transactionError.message }, { status: 500 });
    }

    // Insert line items if provided
    if (transactionData.line_items && transactionData.line_items.length > 0) {
      const lineItems = transactionData.line_items.map((item: any) => {
        const lineTotal = item.quantity * item.unit_price * (1 - (item.discount_percentage || 0) / 100);
        const totalCost = item.quantity * (item.cost_price || 0);
        const profitMargin = lineTotal - totalCost;
        const profitPercentage = totalCost > 0 ? (profitMargin / totalCost) * 100 : 0;

        return {
          transaction_id: transaction.transaction_id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.cost_price,
          discount_percentage: item.discount_percentage || 0,
          line_total: lineTotal,
          total_cost: totalCost,
          profit_margin: profitMargin,
          profit_percentage: profitPercentage
        };
      });

      const { error: lineItemsError } = await supabaseAdminSales
        .from('transaction_line_items')
        .insert(lineItems);

      if (lineItemsError) {
        console.error('Error inserting line items:', lineItemsError);
      }
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

    const { data: updated, error } = await supabaseAdminSales
      .from('transactions')
      .update({
        amount_paid,
        payment_method,
        payment_reference,
        payment_date: payment_date || new Date().toISOString()
      })
      .eq('transaction_id', transaction_id)
      .eq('organization_id', decoded.organization_id)
      .select()
      .single();

    if (error) throw error;

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
