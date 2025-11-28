'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, X, FileText, Building2, Mail, Phone, MapPin } from 'lucide-react';
import { SalesAlert } from '@/app/sales/components/SalesAlert';
import { SalesToast } from '@/app/sales/components/SalesToast';
import { SalesLoader } from '@/app/sales/components/SalesLoader';

interface Quote {
  quoteId: string;
  quoteNumber: string;
  quoteTitle: string;
  quoteAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: string;
  validUntil: string;
  quoteItems: {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  termsConditions: string;
  notes: string;
  createdAt: string;
  magicLinkExpiresAt: string;
  organizationName?: string;
  organizationEmail?: string;
  organizationPhone?: string;
  organizationAddress?: string;
  client: {
    clientName: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
  };
}

export default function QuotePreviewPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [hold, setHold] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionTaken, setActionTaken] = useState(false);
  
  const [alert, setAlert] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ show: false, type: 'success', title: '', message: '' });

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    show: boolean;
  }>({ type: 'info', message: '', show: false });

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message, show: true });
  };

  useEffect(() => {
    if (token) {
      fetchQuote();
    } else {
      setError('Invalid link - No token provided');
      setLoading(false);
    }
  }, [token]);

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/sales/quotes/preview?token=${token}`);
      const data = await response.json();

      if (response.ok) {
        setQuote(data.quote);
        if (data.quote.status === 'accepted') {
          setAccepted(true);
          setActionTaken(true);
        } else if (data.quote.status === 'rejected') {
          setRejected(true);
          setActionTaken(true);
        } else if (data.quote.status === 'hold') {
          setHold(true);
          setActionTaken(true);
        }
      } else {
        setError(data.error || 'Failed to load quote');
      }
    } catch (err) {
      console.error('Error fetching quote:', err);
      setError('Network error - Please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptQuote = async () => {
    if (!quote || accepting) return;

    setAlert({
      show: true,
      type: 'warning',
      title: 'Accept Quote',
      message: 'Are you sure you want to accept this quote? An invoice will be generated.',
      onConfirm: confirmAcceptQuote
    });
  };

  const confirmAcceptQuote = async () => {
    if (!quote) return;

    setIsLoading(true);
    setAccepting(true);

    try {
      const response = await fetch(`/api/sales/quotes/${quote.quoteId}/accept-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (response.ok) {
        setAccepted(true);
        setActionTaken(true);
        fetchQuote(); // Refresh quote data
        setAlert({
          show: true,
          type: 'success',
          title: 'Quote Accepted!',
          message: `Invoice ${data.invoice_number} has been generated. You will receive payment details via email.`
        });
      } else {
        showNotification('error', data.error || 'Failed to accept quote');
      }
    } catch (err) {
      console.error('Error accepting quote:', err);
      showNotification('error', 'Network error - Please try again');
    } finally {
      setAccepting(false);
      setIsLoading(false);
    }
  };

  const handleRejectQuote = async () => {
    if (!quote) return;

    setAlert({
      show: true,
      type: 'warning',
      title: 'Reject Quote',
      message: 'Are you sure you want to reject this quote?',
      onConfirm: confirmRejectQuote
    });
  };

  const confirmRejectQuote = async () => {
    if (!quote) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/sales/quotes/${quote.quoteId}/reject-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (response.ok) {
        setRejected(true);
        setActionTaken(true);
        fetchQuote(); // Refresh quote data
        showNotification('info', 'Quote has been rejected');
      } else {
        showNotification('error', data.error || 'Failed to reject quote');
      }
    } catch (err) {
      console.error('Error rejecting quote:', err);
      showNotification('error', 'Network error - Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectRequest = async () => {
    if (!quote) return;

    setAlert({
      show: true,
      type: 'warning',
      title: "Let's Connect",
      message: 'Request a callback from our sales team to discuss this quote?',
      onConfirm: confirmConnectRequest
    });
  };

  const confirmConnectRequest = async () => {
    if (!quote) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/sales/quotes/${quote.quoteId}/hold-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (response.ok) {
        setHold(true);
        setActionTaken(true);
        fetchQuote(); // Refresh quote data
        setAlert({
          show: true,
          type: 'success',
          title: 'Request Sent!',
          message: 'Our sales team will contact you soon to discuss your requirements.'
        });
      } else {
        showNotification('error', data.error || 'Failed to send request');
      }
    } catch (err) {
      console.error('Error sending connect request:', err);
      showNotification('error', 'Network error - Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: quote?.currency || 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const isExpired = () => {
    if (!quote?.magicLinkExpiresAt) return false;
    return new Date(quote.magicLinkExpiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <X className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <p className="text-sm text-gray-500">
                This link may have expired or is invalid. Please contact the sender for a new link.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Quote not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-6">
              {/* Organization Info */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-8 w-8 text-blue-600" />
                  <h1 className="text-3xl font-bold text-gray-900">
                    {quote.organizationName || 'Your Company Name'}
                  </h1>
                </div>
                {quote.organizationEmail && (
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Mail className="h-4 w-4" />
                    <span>{quote.organizationEmail}</span>
                  </div>
                )}
                {quote.organizationPhone && (
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Phone className="h-4 w-4" />
                    <span>{quote.organizationPhone}</span>
                  </div>
                )}
                {quote.organizationAddress && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>{quote.organizationAddress}</span>
                  </div>
                )}
              </div>

              {/* Quote Status Badge */}
              <div className="text-right">
                <span className={`inline-block px-4 py-2 rounded-lg text-sm font-semibold ${
                  quote.status === 'accepted' ? 'bg-green-100 text-green-800' :
                  quote.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                  quote.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  isExpired() ? 'bg-gray-100 text-gray-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {quote.status === 'accepted' ? 'Accepted' :
                   quote.status === 'rejected' ? 'Rejected' :
                   isExpired() ? 'Expired' : 'Pending'}
                </span>
                {isExpired() && quote.status !== 'accepted' && (
                  <p className="text-xs text-red-600 mt-2">This quote has expired</p>
                )}
              </div>
            </div>

            <div className="border-t border-b border-gray-200 py-4 my-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Quote Number</p>
                  <p className="font-semibold text-lg">{quote.quoteNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-semibold">{new Date(quote.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valid Until</p>
                  <p className="font-semibold">
                    {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Quote Title</p>
                  <p className="font-semibold">{quote.quoteTitle}</p>
                </div>
              </div>
            </div>

            {/* Client Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Bill To:</h3>
              <p className="font-medium text-gray-900">{quote.client.clientName}</p>
              {quote.client.contactPerson && (
                <p className="text-gray-600">Attn: {quote.client.contactPerson}</p>
              )}
              {quote.client.email && <p className="text-gray-600">{quote.client.email}</p>}
              {quote.client.phone && <p className="text-gray-600">{quote.client.phone}</p>}
              {quote.client.address && (
                <p className="text-gray-600">
                  {quote.client.address}, {quote.client.city}, {quote.client.state}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quote Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Description</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.quoteItems?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totals */}
            <div className="mt-6 border-t pt-4">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal:</span>
                    <span className="font-semibold">{formatCurrency(quote.quoteAmount)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Tax:</span>
                    <span className="font-semibold">{formatCurrency(quote.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-gray-900 border-t pt-2">
                    <span>Total:</span>
                    <span>{formatCurrency(quote.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms & Notes */}
        {(quote.termsConditions || quote.notes) && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              {quote.termsConditions && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Terms & Conditions</h3>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{quote.termsConditions}</p>
                </div>
              )}
              {quote.notes && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{quote.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {!actionTaken && quote.status !== 'accepted' && quote.status !== 'rejected' && quote.status !== 'hold' && !isExpired() && (
          <div className="flex justify-end gap-3">
            <button
              onClick={handleRejectQuote}
              disabled={accepting || isLoading}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg transition-all"
            >
              Reject
            </button>
            <button
              onClick={handleConnectRequest}
              disabled={accepting || isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg transition-all"
            >
              Let's Connect
            </button>
            <button
              onClick={handleAcceptQuote}
              disabled={accepting || isLoading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg transition-all"
            >
              {accepting ? 'Processing...' : 'Accept Quote'}
            </button>
          </div>
        )}

        {rejected && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <X className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-900 mb-2">Quote Rejected</h2>
            <p className="text-red-700">
              You have rejected this quote. If you change your mind, please contact us directly.
            </p>
          </div>
        )}

        {hold && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <Phone className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-blue-900 mb-2">Connection Request Sent!</h2>
            <p className="text-blue-700">
              Our sales team will contact you soon to discuss your requirements and answer any questions.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 pb-4">
          <p className="text-sm text-gray-500">
            If you have any questions, please contact us at {quote.organizationEmail || 'support@company.com'}
          </p>
        </div>
      </div>

      {/* Common Components */}
      <SalesToast
        type={notification.type}
        message={notification.message}
        show={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />

      <SalesAlert
        isOpen={alert.show}
        onClose={() => setAlert(prev => ({ ...prev, show: false }))}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onConfirm={alert.onConfirm}
      />

      {isLoading && <SalesLoader />}
    </div>
  );
}
