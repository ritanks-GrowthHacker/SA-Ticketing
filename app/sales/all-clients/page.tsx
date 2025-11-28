'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/app/store/authStore';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Users } from 'lucide-react';
import { Pagination } from '@/app/sales/components/Pagination';

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

export default function AllClientsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('member');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!token) {
      router.push('/user-login');
      return;
    }

    // Determine view from localStorage (set by dashboards) or default to 'my'
    const savedView = localStorage.getItem('sales_user_view') || 'my';
    setUserRole(savedView === 'admin' ? 'admin' : savedView === 'manager' ? 'manager' : 'member');
    
    fetchClients(savedView);
  }, [token]);

  const fetchClients = async (view: string) => {
    try {
      const response = await fetch(`/api/sales/clients?view=${view}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (response.ok) {
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPageTitle = () => {
    if (userRole === 'admin') return 'All Clients (Organization)';
    if (userRole === 'manager') return 'All Team Clients';
    return 'My Clients';
  };

  // Pagination logic
  const totalPages = Math.ceil(clients.length / itemsPerPage);
  const paginatedClients = clients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.back()}
          className="px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-3xl font-bold">{getPageTitle()}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Clients ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p>No clients found</p>
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
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/sales/client/${client.clientId}`)}
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
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
