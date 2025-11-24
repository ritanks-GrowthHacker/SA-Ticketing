'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/app/store/authStore';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, UserPlus, Users, RefreshCw } from 'lucide-react';

interface Manager {
  user_id: string;
  full_name: string;
  email: string;
  sales_role: string;
  members: Member[];
}

interface Member {
  user_id: string;
  full_name: string;
  email: string;
  sales_role: string;
  manager_id: string | null;
}

export default function SalesManageAccess() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [unassignedMembers, setUnassignedMembers] = useState<Member[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [selectedAssignments, setSelectedAssignments] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/user-login');
      return;
    }

    // Auto-sync user first, then fetch hierarchy
    syncCurrentUser();
  }, [token]);

  const syncCurrentUser = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/sales/sync-user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: user?.name || 'Unknown',
          phone: null
        })
      });

      const data = await response.json();
      console.log('User sync result:', data);
      
      // After sync, fetch hierarchy
      fetchHierarchy();
    } catch (error) {
      console.error('Error syncing user:', error);
      // Still try to fetch hierarchy even if sync fails
      fetchHierarchy();
    } finally {
      setSyncing(false);
    }
  };

  const fetchHierarchy = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sales/get-hierarchy?view=admin', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Hierarchy fetch error:', error);
        alert(`Error: ${error.error || 'Failed to fetch hierarchy'}`);
        return;
      }

      const data = await response.json();
      console.log('Hierarchy data:', data);
      
      setManagers(data.managers || []);
      setUnassignedMembers(data.unassignedMembers || []);
      
      // Collect all members from all managers
      const allMembersList: Member[] = [];
      (data.managers || []).forEach((mgr: Manager) => {
        allMembersList.push(...(mgr.members || []));
      });
      setAllMembers(allMembersList);
      
    } catch (error) {
      console.error('Error fetching hierarchy:', error);
      alert('Failed to fetch team hierarchy');
    } finally {
      setLoading(false);
    }
  };

  const syncAllSalesUsers = async () => {
    setSyncingAll(true);
    try {
      const response = await fetch('/api/sales/sync-all-users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      console.log('Bulk sync result:', data);

      if (response.ok) {
        alert(`Sync completed!\nTotal: ${data.total}\nSynced: ${data.synced}\nAlready exists: ${data.alreadyExists}`);
        // Refresh hierarchy after sync
        fetchHierarchy();
      } else {
        alert(`Sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error syncing all users:', error);
      alert('Failed to sync users');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleAssignMember = async (memberId: string, managerId: string) => {
    if (!managerId) {
      alert('Please select a manager');
      return;
    }

    setAssigning(true);
    try {
      const response = await fetch('/api/sales/assign-member', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          member_user_id: memberId,
          manager_user_id: managerId
        })
      });

      if (response.ok) {
        alert('Member assigned successfully!');
        fetchHierarchy(); // Refresh the hierarchy
        
        // Clear selection
        setSelectedAssignments(prev => {
          const newAssignments = { ...prev };
          delete newAssignments[memberId];
          return newAssignments;
        });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to assign member');
      }
    } catch (error) {
      console.error('Error assigning member:', error);
      alert('Failed to assign member');
    } finally {
      setAssigning(false);
    }
  };

  const handleReassignMember = async (memberId: string, newManagerId: string, currentManagerId: string) => {
    if (!newManagerId || newManagerId === currentManagerId) {
      return;
    }

    setAssigning(true);
    try {
      const response = await fetch('/api/sales/assign-member', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          member_user_id: memberId,
          manager_user_id: newManagerId
        })
      });

      if (response.ok) {
        alert('Member reassigned successfully!');
        fetchHierarchy();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to reassign member');
      }
    } catch (error) {
      console.error('Error reassigning member:', error);
      alert('Failed to reassign member');
    } finally {
      setAssigning(false);
    }
  };

  if (loading || syncing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <div className="text-lg">{syncing ? 'Syncing user...' : 'Loading team hierarchy...'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/sales/admin-dashboard')}
            className="px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-3xl font-bold">Manage Sales Team Access</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncAllSalesUsers}
            disabled={syncingAll}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Users className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`} />
            {syncingAll ? 'Syncing...' : 'Sync All Users'}
          </button>
          <button
            onClick={fetchHierarchy}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold">{managers.length}</div>
              <div className="text-sm text-gray-600">Total Managers</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold">{allMembers.length}</div>
              <div className="text-sm text-gray-600">Assigned Members</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-orange-600" />
              <div className="text-2xl font-bold">{unassignedMembers.length}</div>
              <div className="text-sm text-gray-600">Unassigned Members</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* No data message */}
      {managers.length === 0 && unassignedMembers.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No managers or members found</h3>
              <p className="text-gray-600 mb-4">Users will appear here once they access the Sales module.</p>
              <p className="text-sm text-gray-500">
                Make sure users with Manager and Member roles in the Sales department log in to sync their data.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unassigned Members */}
      {unassignedMembers.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="bg-orange-50">
            <CardTitle className="text-orange-700 flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Unassigned Members ({unassignedMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Assign to Manager</TableHead>
                  <TableHead className="w-32">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassignedMembers.map((member) => (
                  <TableRow key={member.user_id}>
                    <TableCell className="font-medium">{member.full_name}</TableCell>
                    <TableCell className="text-gray-600">{member.email}</TableCell>
                    <TableCell>
                      <select
                        value={selectedAssignments[member.user_id] || ''}
                        onChange={(e) => setSelectedAssignments({ ...selectedAssignments, [member.user_id]: e.target.value })}
                        className="w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a manager...</option>
                        {managers.map((manager) => (
                          <option key={manager.user_id} value={manager.user_id}>
                            {manager.full_name} ({manager.members?.length || 0} members)
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleAssignMember(member.user_id, selectedAssignments[member.user_id])}
                        disabled={!selectedAssignments[member.user_id] || assigning}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <UserPlus className="h-4 w-4" />
                        {assigning ? 'Assigning...' : 'Assign'}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Manager Sections */}
      {managers.map((manager) => (
        <Card key={manager.user_id}>
          <CardHeader className="bg-blue-50">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span>Manager: {manager.full_name}</span>
                <span className="text-sm font-normal text-gray-600">({manager.email})</span>
              </div>
              <span className="text-sm font-normal text-gray-600 bg-white px-3 py-1 rounded-full">
                {manager.members?.length || 0} member{(manager.members?.length || 0) !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {!manager.members || manager.members.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No members assigned to this manager yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Reassign to</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manager.members.map((member) => (
                    <TableRow key={member.user_id}>
                      <TableCell className="font-medium">{member.full_name}</TableCell>
                      <TableCell className="text-gray-600">{member.email}</TableCell>
                      <TableCell>
                        <select
                          onChange={(e) => handleReassignMember(member.user_id, e.target.value, manager.user_id)}
                          disabled={assigning}
                          className="w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          defaultValue={manager.user_id}
                        >
                          <option value={manager.user_id}>Current Manager</option>
                          {managers
                            .filter(m => m.user_id !== manager.user_id)
                            .map((otherManager) => (
                              <option key={otherManager.user_id} value={otherManager.user_id}>
                                {otherManager.full_name}
                              </option>
                            ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
