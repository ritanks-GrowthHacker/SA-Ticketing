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
import { Users, TrendingUp, DollarSign, Target, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useSalesRealtime } from '@/app/hooks/useSalesRealtime';
import { Pagination } from '@/app/sales/components/Pagination';

interface Manager {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  members: Member[];
}

interface Member {
  userId: string;
  full_name: string;
  email: string;
  phone: string;
  managerId: string;
}

interface Analytics {
  totalRevenue: number;
  totalTransactions: number;
  totalProfit: number;
  totalClients: number;
  managerPerformance: any[];
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

export default function SalesAdminDashboard() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [unassignedMembers, setUnassignedMembers] = useState<Member[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [clientsPage, setClientsPage] = useState(1);
  const [managersPage, setManagersPage] = useState(1);
  const [unassignedPage, setUnassignedPage] = useState(1);
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

  // Connect to sales realtime notifications (60 second polling)
  useSalesRealtime({
    onNotification: (notification) => {
      console.log('🔔 Admin dashboard notification:', notification);
      
      // Refresh analytics if it's a payment or quote acceptance
      if (notification.type === 'payment_received' || notification.type === 'quote_accepted') {
        console.log('♻️ Refreshing analytics and hierarchy...');
        fetchAnalytics();
        fetchHierarchy();
      }
    }
  });

  useEffect(() => {
    if (!token) {
      router.push('/user-login');
      return;
    }

    // Set view type for All Clients page
    localStorage.setItem('sales_user_view', 'admin');

    // Sync user first, then fetch all data in parallel for faster loading
    syncUser().finally(() => {
      Promise.all([
        fetchHierarchy(),
        fetchAnalytics(),
        fetchClients()
      ]).finally(() => {
        setLoading(false);
      });
    });
  }, [token]);

  const syncUser = async () => {
    try {
      await fetch('/api/sales/sync-user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: user?.email?.split('@')[0] || 'User'
        })
      });
    } catch (error) {
      console.error('Error syncing user:', error);
    }
  };

  const fetchHierarchy = async () => {
    try {
      const response = await fetch('/api/sales/get-hierarchy?view=admin', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (response.ok) {
        setManagers(data.managers || []);
        setUnassignedMembers(data.unassignedMembers || []);
      }
    } catch (error) {
      console.error('Error fetching hierarchy:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/sales/analytics?view=admin', {
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
      console.log('🔍 Admin Dashboard - Fetching clients with view=admin');
      const response = await fetch('/api/sales/clients?view=admin', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      console.log('📦 Admin clients fetched:', data.clients?.length || 0);
      
      if (response.ok) {
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
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

  const toggleManager = (managerId: string) => {
    const newExpanded = new Set(expandedManagers);
    if (newExpanded.has(managerId)) {
      newExpanded.delete(managerId);
    } else {
      newExpanded.add(managerId);
    }
    setExpandedManagers(newExpanded);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Pagination logic
  const clientsTotalPages = Math.ceil(clients.length / itemsPerPage);
  const paginatedClients = clients.slice(
    (clientsPage - 1) * itemsPerPage,
    clientsPage * itemsPerPage
  );

  // Pagination for managers
  const managersTotalPages = Math.ceil(managers.length / itemsPerPage);
  const paginatedManagers = managers.slice((managersPage - 1) * itemsPerPage, managersPage * itemsPerPage);

  // Pagination for unassigned members
  const unassignedTotalPages = Math.ceil(unassignedMembers.length / itemsPerPage);
  const paginatedUnassigned = unassignedMembers.slice((unassignedPage - 1) * itemsPerPage, unassignedPage * itemsPerPage);

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
        <h1 className="text-3xl font-bold">Sales Admin Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/sales/transactions')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Transactions
          </button>
          <button
            onClick={() => router.push('/sales/manage-access')}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            Manage Access
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalTransactions || 0}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalClients || 0}</div>
            <p className="text-xs text-muted-foreground">Active clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
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
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
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
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
                    <TableRow 
                      key={client.clientId} 
                      onClick={() => router.push(`/sales/client/${client.clientId}`)}
                      className="cursor-pointer hover:bg-muted/50"
                    >
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

      {/* Team Hierarchy Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Team Hierarchy</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Team Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedManagers.map((manager) => (
                <React.Fragment key={manager.userId}>
                  <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleManager(manager.userId)}>
                    <TableCell>
                      {expandedManagers.has(manager.userId) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{manager.fullName}</TableCell>
                    <TableCell>{manager.email}</TableCell>
                    <TableCell>{manager.phone || '-'}</TableCell>
                    <TableCell><span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Manager</span></TableCell>
                    <TableCell className="text-right">{manager.members.length} members</TableCell>
                  </TableRow>
                  
                  {expandedManagers.has(manager.userId) && manager.members.map((member) => (
                    <TableRow key={member.userId} className="bg-muted/20">
                      <TableCell></TableCell>
                      <TableCell className="pl-8">{member.full_name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.phone || '-'}</TableCell>
                      <TableCell><span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Member</span></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}

              {unassignedMembers.length > 0 && (
                <>
                  <TableRow>
                    <TableCell colSpan={6} className="font-semibold text-orange-600 pt-6">
                      Unassigned Members ({unassignedMembers.length})
                    </TableCell>
                  </TableRow>
                  {paginatedUnassigned.map((member) => (
                    <TableRow key={member.userId} className="bg-orange-50">
                      <TableCell></TableCell>
                      <TableCell>{member.full_name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.phone || '-'}</TableCell>
                      <TableCell><span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">Unassigned</span></TableCell>
                      <TableCell className="text-right">
                        <button 
                          onClick={() => router.push('/sales/manage-access')}
                          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                          Assign
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
          {(managers.length > itemsPerPage || unassignedMembers.length > itemsPerPage) && (
            <div className="mt-4 space-y-2">
              {managers.length > itemsPerPage && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Managers & Members</p>
                  <Pagination
                    currentPage={managersPage}
                    totalPages={managersTotalPages}
                    onPageChange={setManagersPage}
                  />
                </div>
              )}
              {unassignedMembers.length > itemsPerPage && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Unassigned Members</p>
                  <Pagination
                    currentPage={unassignedPage}
                    totalPages={unassignedTotalPages}
                    onPageChange={setUnassignedPage}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Client Dialog */}
      <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register New Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddClient} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="client_name">Company Name *</Label>
                <Input
                  id="client_name"
                  required
                  value={newClient.client_name}
                  onChange={(e) => setNewClient({ ...newClient, client_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  value={newClient.contact_person}
                  onChange={(e) => setNewClient({ ...newClient, contact_person: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  required
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={newClient.industry}
                  onChange={(e) => setNewClient({ ...newClient, industry: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="client_type">Client Type</Label>
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
              <div>
                <Label htmlFor="company_size">Company Size</Label>
                <Select value={newClient.company_size} onValueChange={(value) => setNewClient({ ...newClient, company_size: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
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
              <div>
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <Select value={newClient.payment_terms} onValueChange={(value) => setNewClient({ ...newClient, payment_terms: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Immediate">Immediate</SelectItem>
                    <SelectItem value="NET 15">NET 15</SelectItem>
                    <SelectItem value="NET 30">NET 30</SelectItem>
                    <SelectItem value="NET 45">NET 45</SelectItem>
                    <SelectItem value="NET 60">NET 60</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={newClient.address}
                onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={newClient.city}
                  onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={newClient.state}
                  onChange={(e) => setNewClient({ ...newClient, state: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={newClient.country}
                  onChange={(e) => setNewClient({ ...newClient, country: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  value={newClient.postal_code}
                  onChange={(e) => setNewClient({ ...newClient, postal_code: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="client_source">Client Source</Label>
              <Select value={newClient.client_source} onValueChange={(value) => setNewClient({ ...newClient, client_source: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Direct">Direct</SelectItem>
                  <SelectItem value="Referral">Referral</SelectItem>
                  <SelectItem value="Website">Website</SelectItem>
                  <SelectItem value="Social Media">Social Media</SelectItem>
                  <SelectItem value="Cold Call">Cold Call</SelectItem>
                  <SelectItem value="Event">Event</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setIsAddClientOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Register Client
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
