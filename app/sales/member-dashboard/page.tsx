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

interface Client {
  clientId: string;
  clientName: string;
  email: string;
  phone: string;
  industry: string;
  registrationDate: string;
}

interface Analytics {
  totalRevenue: number;
  totalTransactions: number;
  totalProfit: number;
  totalClients: number;
  target: {
    targetRevenue: number;
    achievedRevenue: number;
    revenueAchievementPercentage: number;
  } | null;
}

export default function SalesMemberDashboard() {
  const { token } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [clientsPage, setClientsPage] = useState(1);
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
    localStorage.setItem('sales_user_view', 'member');

    // Fetch all data in parallel for faster loading
    Promise.all([
      fetchClients(),
      fetchAnalytics()
    ]).finally(() => {
      setLoading(false);
    });
  }, [token]);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/sales/clients?view=my', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (response.ok) {
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/sales/analytics?view=member', {
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

  // Pagination for clients
  const clientsTotalPages = Math.ceil(clients.length / itemsPerPage);
  const paginatedClients = clients.slice((clientsPage - 1) * itemsPerPage, clientsPage * itemsPerPage);

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
        <h1 className="text-3xl font-bold">My Sales Dashboard</h1>
        <div className="flex gap-2">
          <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
            <DialogTrigger asChild>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Client
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Register New Client</DialogTitle>
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
                    <Label>Company Size</Label>
                    <Select value={newClient.company_size} onValueChange={(value) => setNewClient({ ...newClient, company_size: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10</SelectItem>
                        <SelectItem value="11-50">11-50</SelectItem>
                        <SelectItem value="51-200">51-200</SelectItem>
                        <SelectItem value="201-500">201-500</SelectItem>
                        <SelectItem value="500+">500+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Terms</Label>
                    <Select value={newClient.payment_terms} onValueChange={(value) => setNewClient({ ...newClient, payment_terms: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NET 30">NET 30</SelectItem>
                        <SelectItem value="NET 60">NET 60</SelectItem>
                        <SelectItem value="NET 90">NET 90</SelectItem>
                        <SelectItem value="Advance">Advance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Address</Label>
                    <Input
                      value={newClient.address}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewClient({ ...newClient, address: e.target.value })}
                    />
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
                <div className="flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => setIsAddClientOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Register Client
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <button 
            onClick={() => router.push('/sales/all-clients')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            All Clients
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalTransactions || 0}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalClients || 0}</div>
            <p className="text-xs text-muted-foreground">Active clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Target Achievement</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.target?.revenueAchievementPercentage.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(analytics?.target?.achievedRevenue || 0)} / {formatCurrency(analytics?.target?.targetRevenue || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clients List */}
      <Card>
        <CardHeader>
          <CardTitle>My Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Registered On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No clients yet. Add your first client to get started!
                  </TableCell>
                </TableRow>
              ) : (
                paginatedClients.map((client) => (
                  <TableRow key={client.clientId}>
                    <TableCell className="font-medium">{client.clientName}</TableCell>
                    <TableCell>{client.email || '-'}</TableCell>
                    <TableCell>{client.phone || '-'}</TableCell>
                    <TableCell>{client.industry || '-'}</TableCell>
                    <TableCell>{new Date(client.registrationDate).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {clients.length > itemsPerPage && (
            <div className="mt-4">
              <Pagination
                currentPage={clientsPage}
                totalPages={clientsTotalPages}
                onPageChange={setClientsPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
