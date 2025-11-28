'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/app/store/authStore';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, DollarSign, FileText, CheckCircle, X, Eye, Download } from 'lucide-react';
import { useSalesRealtime } from '@/app/hooks/useSalesRealtime';

interface Transaction {
  transactionId: string;
  invoiceNumber: string;
  clientId: string;
  client_name: string;
  transactionDate: string;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: string;
  paymentMethod: string;
  currency: string;
  createdAt: string;
}

interface TransactionDetail extends Transaction {
  subtotalAmount: number;
  discountPercentage: number;
  discountAmount: number;
  taxPercentage: number;
  taxAmount: number;
  lineItems: {
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  notes: string;
}

export default function TransactionsPage() {
  const { token } = useAuth();
  const router = useRouter();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [paymentData, setPaymentData] = useState({
    transaction_id: '',
    amount_paid: 0,
    payment_method: 'Bank Transfer',
    payment_reference: '',
    payment_date: new Date().toISOString().split('T')[0]
  });

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    show: boolean;
  }>({ type: 'info', message: '', show: false });

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message, show: true });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Connect to sales realtime notifications (60 second polling)
  useSalesRealtime({
    onNotification: (notification) => {
      console.log('🔔 Sales notification received:', notification);
      
      // Show toast notification
      showNotification('success', notification.message);
      
      // Refresh transactions if it's a payment or quote acceptance
      if (notification.type === 'payment_received' || notification.type === 'quote_accepted') {
        console.log('♻️ Refreshing transactions...');
        fetchTransactions();
      }
    }
  });

  useEffect(() => {
    if (!token) {
      router.push('/user-login');
      return;
    }
    fetchTransactions();
  }, [token]);

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/sales/transactions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionDetail = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/sales/transactions/${transactionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSelectedTransaction(data.transaction);
        setIsDetailOpen(true);
      }
    } catch (error) {
      console.error('Error fetching transaction detail:', error);
    }
  };

  const openPaymentDialog = (transaction: Transaction) => {
    setPaymentData({
      transaction_id: transaction.transactionId,
      amount_paid: transaction.amountDue,
      payment_method: 'Bank Transfer',
      payment_reference: '',
      payment_date: new Date().toISOString().split('T')[0]
    });
    setIsPaymentOpen(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/sales/transactions/payment', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      const data = await response.json();

      if (response.ok) {
        showNotification('success', 'Payment recorded successfully!');
        setIsPaymentOpen(false);
        fetchTransactions();
      } else {
        showNotification('error', data.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      showNotification('error', 'Network error - Please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadInvoice = async (transactionId: string, invoiceNumber: string) => {
    try {
      const response = await fetch(`/api/sales/transactions/${transactionId}/invoice`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading invoice:', error);
      showNotification('error', 'Failed to download invoice');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.back()}
          className="px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-3xl font-bold">Transactions & Invoices</h1>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions ({transactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No transactions found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow key={txn.transactionId}>
                    <TableCell className="font-medium">{txn.invoiceNumber}</TableCell>
                    <TableCell>{txn.client_name}</TableCell>
                    <TableCell>{new Date(txn.transactionDate).toLocaleDateString()}</TableCell>
                    <TableCell>{formatCurrency(txn.totalAmount)}</TableCell>
                    <TableCell>{formatCurrency(txn.amountPaid)}</TableCell>
                    <TableCell>{formatCurrency(txn.amountDue)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(txn.paymentStatus)}`}>
                        {txn.paymentStatus}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fetchTransactionDetail(txn.transactionId)}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          title="View Details"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => downloadInvoice(txn.transactionId, txn.invoiceNumber)}
                          className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                          title="Download Invoice"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        {txn.paymentStatus !== 'paid' && (
                          <button
                            onClick={() => openPaymentDialog(txn)}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Record Payment
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details - {selectedTransaction?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Client</Label>
                  <div className="font-medium">{selectedTransaction.client_name}</div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Date</Label>
                  <div className="font-medium">{new Date(selectedTransaction.transactionDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Payment Status</Label>
                  <div>
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedTransaction.paymentStatus)}`}>
                      {selectedTransaction.paymentStatus}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Payment Method</Label>
                  <div className="font-medium">{selectedTransaction.paymentMethod || 'N/A'}</div>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <Label>Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product/Service</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTransaction.lineItems?.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.lineTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(selectedTransaction.subtotalAmount)}</span>
                </div>
                {selectedTransaction.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount ({selectedTransaction.discountPercentage}%):</span>
                    <span>-{formatCurrency(selectedTransaction.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tax ({selectedTransaction.taxPercentage}%):</span>
                  <span>{formatCurrency(selectedTransaction.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(selectedTransaction.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Amount Paid:</span>
                  <span>{formatCurrency(selectedTransaction.amountPaid)}</span>
                </div>
                <div className="flex justify-between text-orange-600 font-bold">
                  <span>Amount Due:</span>
                  <span>{formatCurrency(selectedTransaction.amountDue)}</span>
                </div>
              </div>

              {selectedTransaction.notes && (
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <div className="p-3 bg-gray-50 rounded border whitespace-pre-wrap">{selectedTransaction.notes}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-[60%]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount Received</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentData.amount_paid}
                onChange={(e) => setPaymentData({ ...paymentData, amount_paid: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentData.payment_method} onValueChange={(value) => setPaymentData({ ...paymentData, payment_method: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Reference</Label>
              <Input
                value={paymentData.payment_reference}
                onChange={(e) => setPaymentData({ ...paymentData, payment_reference: e.target.value })}
                placeholder="Transaction ID / Cheque No."
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentData.payment_date}
                onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setIsPaymentOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Toast Notification */}
      {notification.show && (
        <div
          className={`fixed bottom-4 right-4 z-60 px-6 py-4 rounded-lg shadow-lg transition-all duration-300 ${
            notification.type === 'success'
              ? 'bg-green-500 text-white'
              : notification.type === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-blue-500 text-white'
          }`}
        >
          <div className="flex items-center space-x-3">
            {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {notification.type === 'error' && <X className="w-5 h-5" />}
            {notification.type === 'info' && <DollarSign className="w-5 h-5" />}
            <span className="font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(prev => ({ ...prev, show: false }))}
              className="ml-2 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
