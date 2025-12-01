'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/app/store/authStore';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, TrendingUp, DollarSign, Target, Plus } from 'lucide-react';
import { Pagination } from '@/app/sales/components/Pagination';
import { AttendanceCheckInOut } from '@/components/AttendanceCheckInOut';

interface Member {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
}

interface Analytics {
  totalRevenue: number;
  totalTransactions: number;
  totalProfit: number;
  teamSize?: number;
  totalClients?: number;
  memberPerformance: {
    userId: string;
    revenue: number;
    transactions: number;
    profit: number;
  }[];
}

interface Client {
  clientId: string;
  clientName: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  status: string;
  createdAt: string;
}

interface Transaction {
  transactionId: string;
  invoiceNumber: string;
  client_name: string;
  transactionDate: string;
  totalAmount: number;
  paymentStatus: string;
  createdAt: string;
}

export default function SalesManagerDashboard() {
  const { token } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [viewType, setViewType] = useState<'my' | 'team'>('team');
  const [clientsPage, setClientsPage] = useState(1);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [membersPage, setMembersPage] = useState(1);
  const itemsPerPage = 10;
  const [newClient, setNewClient] = useState({
    client_name: '',
    contact_person: '',
    email: '',
    phone: '',
    industry: '',
    client_type: 'B2B',
    company_size: '',
    payment_terms: 'NET 30',
    address: '',
    city: '',
    state: '',
    country: 'India',
    postal_code: '',
    client_source: 'Direct'
  });

  useEffect(() => {
    if (!token) {
      router.push('/user-login');
      return;
    }

    // Set view type for All Clients page
    localStorage.setItem('sales_user_view', 'manager');

    // Fetch all data in parallel for faster loading
    Promise.all([
      fetchMembers(),
      fetchAnalytics(),
      fetchClients(),
      fetchTransactions()
    ]).catch(error => {
      console.error('Error loading dashboard:', error);
    }).finally(() => {
      setLoading(false);
    });
  }, [token, viewType]); // Re-fetch when viewType changes

  const fetchMembers = async () => {
    try {
      const response = await fetch('/api/sales/get-hierarchy?view=manager', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (response.ok) {
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      // Use 'my' view to get member analytics, 'manager' view to get team analytics
      const apiView = viewType === 'my' ? 'member' : 'manager';
      const response = await fetch(`/api/sales/analytics?view=${apiView}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (response.ok) {
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchClients = async () => {
    try {
      console.log('🔍 Manager Dashboard - Fetching clients with view=manager');
      const response = await fetch('/api/sales/clients?view=manager', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      console.log('📦 Manager clients fetched:', data.clients?.length || 0);
      
      if (response.ok) {
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

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
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/sales/clients', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newClient)
      });

      if (response.ok) {
        alert('Client registered successfully!');
        setIsAddClientOpen(false);
        fetchClients();
        fetchAnalytics();
        
        // Reset form
        setNewClient({
          client_name: '',
          contact_person: '',
          email: '',
          phone: '',
          industry: '',
          client_type: 'B2B',
          company_size: '',
          payment_terms: 'NET 30',
          address: '',
          city: '',
          state: '',
          country: 'India',
          postal_code: '',
          client_source: 'Direct'
        });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to register client');
      }
    } catch (error) {
      console.error('Error registering client:', error);
      alert('Failed to register client');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getMemberPerformance = (userId: string) => {
    return analytics?.memberPerformance?.find(p => p.userId === userId);
  };

  // Pagination logic
  const clientsTotalPages = Math.ceil(clients.length / itemsPerPage);
  const paginatedClients = clients.slice(
    (clientsPage - 1) * itemsPerPage,
    clientsPage * itemsPerPage
  );

  const transactionsTotalPages = Math.ceil(transactions.length / itemsPerPage);
  const paginatedTransactions = transactions.slice(
    (transactionsPage - 1) * itemsPerPage,
    transactionsPage * itemsPerPage
  );

  const membersTotalPages = Math.ceil(members.length / itemsPerPage);
  const paginatedMembers = members.slice(
    (membersPage - 1) * itemsPerPage,
    membersPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading Sales Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Sales Manager Dashboard</h1>
        <div className="flex gap-2">
          <AttendanceCheckInOut />
          <Select value={viewType} onValueChange={(value: 'my' | 'team') => setViewType(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my">My Sales Stats</SelectItem>
              <SelectItem value="team">Team Stats</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
            <DialogTrigger asChild>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer hover:bg-green-700 transition-colors flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Client
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className='cursor-pointer'>Register New Client</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddClient} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Client Name *</Label>
                    <Input
                      value={newClient.client_name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewClient({ ...newClient, client_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input
                      value={newClient.contact_person}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewClient({ ...newClient, contact_person: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newClient.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewClient({ ...newClient, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={newClient.phone}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewClient({ ...newClient, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Input
                      value={newClient.industry}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewClient({ ...newClient, industry: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Type</Label>
                    <Select value={newClient.client_type} onValueChange={(value) => setNewClient({ ...newClient, client_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="B2B">B2B</SelectItem>
                        <SelectItem value="B2C">B2C</SelectItem>
                        <SelectItem value="B2G">B2G</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={newClient.city}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewClient({ ...newClient, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      value={newClient.state}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewClient({ ...newClient, state: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddClientOpen(false)}
                    className="px-4 py-2 border cursor-pointer border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600  cursor-pointer text-white rounded-lg hover:bg-blue-700"
                  >
                    Register Client
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <button 
            onClick={() => router.push('/sales/all-clients')}
            className="px-4 py-2 cursor-pointer bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            All Clients
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {viewType === 'my' ? 'My Revenue' : 'Team Revenue'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {viewType === 'my' ? 'My Transactions' : 'Team Transactions'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalTransactions || 0}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {viewType === 'my' ? 'My Clients' : 'Team Size'}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {viewType === 'my' ? (analytics?.totalClients || 0) : (analytics?.teamSize || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {viewType === 'my' ? 'Total clients' : 'Active members'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {viewType === 'my' ? 'My Profit' : 'Team Profit'}
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics?.totalProfit || 0)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* My Clients Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>My Clients ({clients.length})</CardTitle>
            <button 
              onClick={() => setIsAddClientOpen(true)}
              className="px-3 py-1.5 text-sm cursor-pointer bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              + Add Client
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No clients onboarded yet</p>
              <button 
                onClick={() => setIsAddClientOpen(true)}
                className="mt-4 px-4 py-2 cursor-pointer bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Add Your First Client
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedClients.map((client) => (
                    <TableRow key={client.clientId} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{client.clientName}</TableCell>
                      <TableCell>{client.contactPerson || '-'}</TableCell>
                      <TableCell>{client.email || '-'}</TableCell>
                      <TableCell>{client.phone || '-'}</TableCell>
                      <TableCell>{client.city || '-'}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          client.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {client.status}
                        </span>
                      </TableCell>
                      <TableCell>{new Date(client.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                currentPage={clientsPage}
                totalPages={clientsTotalPages}
                onPageChange={setClientsPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions Table - Accepted Quotes */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Transactions ({transactions.length})</CardTitle>
            <button 
              onClick={() => router.push('/sales/transactions')}
              className="px-3 py-1.5 text-sm cursor-pointer bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              View All
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((txn) => (
                    <TableRow key={txn.transactionId} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{txn.invoiceNumber}</TableCell>
                      <TableCell>{txn.client_name}</TableCell>
                      <TableCell>{new Date(txn.transactionDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(txn.totalAmount)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          txn.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 
                          txn.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {txn.paymentStatus}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                currentPage={transactionsPage}
                totalPages={transactionsTotalPages}
                onPageChange={setTransactionsPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>My Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No team members assigned yet
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMembers.map((member) => {
                  const performance = getMemberPerformance(member.userId);
                  return (
                    <TableRow key={member.userId}>
                      <TableCell className="font-medium">{member.fullName}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.phone || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(performance?.revenue || 0)}</TableCell>
                      <TableCell className="text-right">{performance?.transactions || 0}</TableCell>
                      <TableCell className="text-right">{formatCurrency(performance?.profit || 0)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={membersPage}
            totalPages={membersTotalPages}
            onPageChange={setMembersPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
