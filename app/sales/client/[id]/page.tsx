'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/app/store/authStore';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Calendar, FileText, Upload, Plus, Trash2, Send, CheckCircle, X } from 'lucide-react';
import { SalesAlert } from '@/app/sales/components/SalesAlert';
import { SalesToast } from '@/app/sales/components/SalesToast';
import { SalesLoader } from '@/app/sales/components/SalesLoader';
import { Pagination } from '@/app/sales/components/Pagination';

interface Client {
  client_id: string;
  client_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  industry: string;
  client_type: string;
  status: string;
  next_interaction_date: string;
  created_at: string;
}

interface Quote {
  quote_id: string;
  quote_number: string;
  quote_title: string;
  quote_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: string;
  valid_until: string;
  quote_items: QuoteItem[];
  terms_conditions: string;
  notes: string;
  created_at: string;
}

interface QuoteItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export default function ClientDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextInteractionDate, setNextInteractionDate] = useState('');
  const [isCreateQuoteOpen, setIsCreateQuoteOpen] = useState(false);
  const [isUploadQuoteOpen, setIsUploadQuoteOpen] = useState(false);
  const [isViewQuoteOpen, setIsViewQuoteOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  const [newQuote, setNewQuote] = useState({
    quote_title: '',
    valid_until: '',
    terms_conditions: '',
    notes: '',
    currency: 'INR',
    tax_percentage: 18
  });

  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([
    { description: '', quantity: 1, rate: 0, amount: 0 }
  ]);

  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    show: boolean;
  }>({ type: 'info', message: '', show: false });

  const [alert, setAlert] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ show: false, type: 'success', title: '', message: '' });

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [quotesPage, setQuotesPage] = useState(1);
  const itemsPerPage = 10;

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message, show: true });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  useEffect(() => {
    if (!token) {
      router.push('/user-login');
      return;
    }

    fetchClientDetails();
    fetchQuotes();
  }, [token, clientId]);

  const fetchClientDetails = async () => {
    try {
      const response = await fetch(`/api/sales/clients/${clientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (response.ok) {
        setClient(data.client);
        setNextInteractionDate(data.client.next_interaction_date || '');
      }
    } catch (error) {
      console.error('Error fetching client:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotes = async () => {
    try {
      const response = await fetch(`/api/sales/quotes?client_id=${clientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (response.ok) {
        setQuotes(data.quotes || []);
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
    }
  };

  const updateNextInteractionDate = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/sales/clients/${clientId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ next_interaction_date: nextInteractionDate })
      });

      const data = await response.json();

      if (response.ok) {
        showNotification('success', 'Next interaction date updated!');
        fetchClientDetails();
      } else {
        showNotification('error', data.error || 'Failed to update date');
      }
    } catch (error) {
      console.error('Error updating date:', error);
      showNotification('error', 'Network error - Please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addQuoteItem = () => {
    setQuoteItems([...quoteItems, { description: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeQuoteItem = (index: number) => {
    setQuoteItems(quoteItems.filter((_, i) => i !== index));
  };

  const updateQuoteItem = (index: number, field: keyof QuoteItem, value: string | number) => {
    const updated = [...quoteItems];
    (updated[index][field] as string | number) = value;
    
    if (field === 'quantity' || field === 'rate') {
      updated[index].amount = updated[index].quantity * updated[index].rate;
    }
    
    setQuoteItems(updated);
  };

  const calculateTotals = () => {
    const subtotal = quoteItems.reduce((sum, item) => sum + item.amount, 0);
    const tax = (subtotal * newQuote.tax_percentage) / 100;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  // Pagination for quotes
  const quotesTotalPages = Math.ceil(quotes.length / itemsPerPage);
  const paginatedQuotes = quotes.slice((quotesPage - 1) * itemsPerPage, quotesPage * itemsPerPage);

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { subtotal, tax, total } = calculateTotals();
    
    setIsLoading(true);
    try {
      const url = editMode && selectedQuote 
        ? `/api/sales/quotes/${selectedQuote.quote_id}` 
        : '/api/sales/quotes';
      const method = editMode && selectedQuote ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          quote_title: newQuote.quote_title,
          quote_amount: subtotal,
          tax_amount: tax,
          total_amount: total,
          currency: newQuote.currency,
          valid_until: newQuote.valid_until,
          quote_items: quoteItems,
          terms_conditions: newQuote.terms_conditions,
          notes: newQuote.notes
        })
      });

      if (response.ok) {
        showNotification('success', editMode ? 'Quote updated successfully!' : 'Quote created successfully!');
        setIsCreateQuoteOpen(false);
        setEditMode(false);
        setSelectedQuote(null);
        fetchQuotes();
        // Reset form
        setNewQuote({
          quote_title: '',
          valid_until: '',
          terms_conditions: '',
          notes: '',
          currency: 'INR',
          tax_percentage: 18
        });
        setQuoteItems([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
      } else {
        const error = await response.json();
        showNotification('error', error.error || 'Failed to create quote');
      }
    } catch (error) {
      console.error('Error creating quote:', error);
      showNotification('error', 'Failed to create quote');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!uploadFile) {
      showNotification('error', 'Please select a file');
      return;
    }

    // TODO: Implement file upload to storage and save URL
    showNotification('info', 'File upload will be implemented with storage integration');
  };

  const loadQuoteForEdit = (quote: Quote) => {
    setSelectedQuote(quote);
    setEditMode(true);
    setNewQuote({
      quote_title: quote.quote_title,
      valid_until: quote.valid_until ? quote.valid_until.split('T')[0] : '',
      terms_conditions: quote.terms_conditions || '',
      notes: quote.notes || '',
      currency: quote.currency || 'INR',
      tax_percentage: quote.tax_amount && quote.quote_amount ? ((quote.tax_amount / quote.quote_amount) * 100) : 18
    });
    setQuoteItems(quote.quote_items || [{ description: '', quantity: 1, rate: 0, amount: 0 }]);
    setIsCreateQuoteOpen(true);
  };

  const loadQuoteForView = (quote: Quote) => {
    setSelectedQuote(quote);
    setEditMode(false);
    setNewQuote({
      quote_title: quote.quote_title,
      valid_until: quote.valid_until ? quote.valid_until.split('T')[0] : '',
      terms_conditions: quote.terms_conditions || '',
      notes: quote.notes || '',
      currency: quote.currency || 'INR',
      tax_percentage: quote.tax_amount && quote.quote_amount ? ((quote.tax_amount / quote.quote_amount) * 100) : 18
    });
    setQuoteItems(quote.quote_items || [{ description: '', quantity: 1, rate: 0, amount: 0 }]);
    setIsViewQuoteOpen(true);
  };

  const sendQuote = async (quoteId: string) => {
    setAlert({
      show: true,
      type: 'warning',
      title: 'Send Quote',
      message: 'Send this quote to client via email?',
      onConfirm: () => confirmSendQuote(quoteId)
    });
  };

  const confirmSendQuote = async (quoteId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sales/quotes/${quoteId}/send`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (response.ok) {
        showNotification('success', 'Quote sent successfully to client!');
        fetchQuotes();
      } else {
        showNotification('error', data.error || 'Failed to send quote');
      }
    } catch (error) {
      console.error('Error sending quote:', error);
      showNotification('error', 'Network error - Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading client details...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Client not found</div>
      </div>
    );
  }

  const { subtotal, tax, total } = calculateTotals();

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
        <h1 className="text-3xl font-bold">{client.client_name}</h1>
        <span className={`px-3 py-1 rounded text-sm ${
          client.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {client.status}
        </span>
      </div>

      {/* Client Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div><strong>Contact Person:</strong> {client.contact_person || 'N/A'}</div>
            <div><strong>Email:</strong> {client.email || 'N/A'}</div>
            <div><strong>Phone:</strong> {client.phone || 'N/A'}</div>
            <div><strong>Industry:</strong> {client.industry || 'N/A'}</div>
            <div><strong>Type:</strong> {client.client_type || 'N/A'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>{client.address || 'N/A'}</div>
            <div>{client.city}, {client.state}</div>
            <div>{client.country}</div>
          </CardContent>
        </Card>
      </div>

      {/* Next Interaction */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Next Interaction Date
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="datetime-local"
              value={nextInteractionDate}
              onChange={(e) => setNextInteractionDate(e.target.value)}
              className="max-w-xs"
            />
            <button
              onClick={updateNextInteractionDate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Update
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Quotes Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Quotes</CardTitle>
            <div className="flex gap-2">
              <Dialog open={isCreateQuoteOpen} onOpenChange={(open) => {
                setIsCreateQuoteOpen(open);
                if (!open) {
                  // Reset form when closing
                  setEditMode(false);
                  setSelectedQuote(null);
                  setNewQuote({
                    quote_title: '',
                    valid_until: '',
                    terms_conditions: '',
                    notes: '',
                    currency: 'INR',
                    tax_percentage: 18
                  });
                  setQuoteItems([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
                }
              }}>
                <DialogTrigger asChild>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create Quote
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editMode ? 'Edit Quote' : 'Create New Quote'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateQuote} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Quote Title *</Label>
                        <Input
                          value={newQuote.quote_title}
                          onChange={(e) => setNewQuote({ ...newQuote, quote_title: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valid Until</Label>
                        <Input
                          type="date"
                          value={newQuote.valid_until}
                          onChange={(e) => setNewQuote({ ...newQuote, valid_until: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Quote Items */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Line Items</Label>
                        <button
                          type="button"
                          onClick={addQuoteItem}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          + Add Item
                        </button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-24">Qty</TableHead>
                            <TableHead className="w-32">Rate</TableHead>
                            <TableHead className="w-32">Amount</TableHead>
                            <TableHead className="w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {quoteItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Input
                                  value={item.description}
                                  onChange={(e) => updateQuoteItem(index, 'description', e.target.value)}
                                  placeholder="Item description"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    updateQuoteItem(index, 'quantity', parseInt(val) || 1);
                                  }}
                                  className="min-w-20"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.rate}
                                  onChange={(e) => updateQuoteItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                  min="0"
                                  step="0.01"
                                />
                              </TableCell>
                              <TableCell>₹{item.amount.toFixed(2)}</TableCell>
                              <TableCell>
                                {quoteItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeQuoteItem(index)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Totals */}
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-semibold">{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Tax ({newQuote.tax_percentage}%):</span>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            value={newQuote.tax_percentage}
                            onChange={(e) => setNewQuote({ ...newQuote, tax_percentage: parseFloat(e.target.value) || 0 })}
                            className="w-20"
                            min="0"
                            max="100"
                          />
                          <span className="font-semibold">{formatCurrency(tax)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Terms & Conditions</Label>
                      <textarea
                        value={newQuote.terms_conditions}
                        onChange={(e) => setNewQuote({ ...newQuote, terms_conditions: e.target.value })}
                        className="w-full min-h-24 p-2 border rounded"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <textarea
                        value={newQuote.notes}
                        onChange={(e) => setNewQuote({ ...newQuote, notes: e.target.value })}
                        className="w-full min-h-20 p-2 border rounded"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsCreateQuoteOpen(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Saving...' : (editMode ? 'Update Quote' : 'Create Quote')}
                      </button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isUploadQuoteOpen} onOpenChange={setIsUploadQuoteOpen}>
                <DialogTrigger asChild>
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Quote
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-[60vw]">
                  <DialogHeader>
                    <DialogTitle>Upload Quote Document</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleUploadQuote} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Select File (PDF, DOCX)</Label>
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsUploadQuoteOpen(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Upload
                      </button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* View Quote Dialog */}
              <Dialog open={isViewQuoteOpen} onOpenChange={setIsViewQuoteOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>View Quote - {selectedQuote?.quote_number}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Quote Title</Label>
                        <div className="p-2 bg-gray-50 rounded border">{selectedQuote?.quote_title}</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Valid Until</Label>
                        <div className="p-2 bg-gray-50 rounded border">
                          {selectedQuote?.valid_until ? new Date(selectedQuote.valid_until).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Quote Items */}
                    <div className="space-y-2">
                      <Label>Line Items</Label>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-24">Qty</TableHead>
                            <TableHead className="w-32">Rate</TableHead>
                            <TableHead className="w-32">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedQuote?.quote_items?.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.description}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>₹{item.rate.toFixed(2)}</TableCell>
                              <TableCell>₹{item.amount.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Totals */}
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-semibold">{formatCurrency(selectedQuote?.quote_amount || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span className="font-semibold">{formatCurrency(selectedQuote?.tax_amount || 0)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(selectedQuote?.total_amount || 0)}</span>
                      </div>
                    </div>

                    {selectedQuote?.terms_conditions && (
                      <div className="space-y-2">
                        <Label>Terms & Conditions</Label>
                        <div className="p-3 bg-gray-50 rounded border whitespace-pre-wrap">{selectedQuote.terms_conditions}</div>
                      </div>
                    )}

                    {selectedQuote?.notes && (
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <div className="p-3 bg-gray-50 rounded border whitespace-pre-wrap">{selectedQuote.notes}</div>
                      </div>
                    )}

                    <div className="flex justify-end pt-4">
                      <button
                        onClick={() => setIsViewQuoteOpen(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No quotes created yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedQuotes.map((quote) => (
                  <TableRow key={quote.quote_id}>
                    <TableCell className="font-medium">{quote.quote_number}</TableCell>
                    <TableCell>{quote.quote_title}</TableCell>
                    <TableCell>{formatCurrency(quote.total_amount)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        quote.status === 'accepted' ? 'bg-green-100 text-green-800' :
                        quote.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                        quote.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {quote.status}
                      </span>
                    </TableCell>
                    <TableCell>{quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell>{new Date(quote.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadQuoteForView(quote)}
                          className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                          View
                        </button>
                        {quote.status === 'draft' && (
                          <>
                            <button
                              onClick={() => loadQuoteForEdit(quote)}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => sendQuote(quote.quote_id)}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                            >
                              <Send className="h-3 w-3" />
                              Send
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {quotes.length > itemsPerPage && (
            <div className="mt-4">
              <Pagination
                currentPage={quotesPage}
                totalPages={quotesTotalPages}
                onPageChange={setQuotesPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

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
