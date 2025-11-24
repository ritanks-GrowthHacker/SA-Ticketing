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
    const { userId: decodedUserId, organizationId } = extractUserAndOrgId(decoded);

    const { searchParams } = new URL(req.url);
    const viewType = searchParams.get('view'); // 'member', 'manager', 'admin'
    const userId = searchParams.get('userId') || decodedUserId;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (viewType === 'member') {
      // Member-level analytics - query transactions directly
      const { data: transactions } = await supabaseAdminSales
        .from('transactions')
        .select('total_amount, subtotal_amount, tax_amount, client_id, clients(client_name)')
        .eq('organization_id', organizationId)
        .eq('sales_member_id', userId);

      const totalRevenue = transactions?.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0) || 0;
      const totalTransactions = transactions?.length || 0;
      const totalProfit = transactions?.reduce((sum, t) => sum + (Number(t.total_amount) - Number(t.tax_amount) || 0), 0) || 0;

      // Get total clients
      const { count: clientCount } = await supabaseAdminSales
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_sales_member_id', userId)
        .eq('status', 'active');

      // Get targets
      const { data: target } = await supabaseAdminSales
        .from('sales_targets')
        .select('*')
        .eq('user_id', userId)
        .eq('target_type', 'monthly')
        .eq('target_year', currentYear)
        .eq('target_month', currentMonth)
        .single();

      // Group by client
      const revenueByClient: any = {};
      transactions?.forEach(txn => {
        const clientId = txn.client_id;
        const clientName = (txn.clients as any)?.client_name || 'Unknown';
        if (!revenueByClient[clientId]) {
          revenueByClient[clientId] = {
            client_name: clientName,
            revenue: 0,
            transactions: 0
          };
        }
        revenueByClient[clientId].revenue += Number(txn.total_amount) || 0;
        revenueByClient[clientId].transactions += 1;
      });

      return NextResponse.json({
        totalRevenue,
        totalTransactions,
        totalProfit,
        totalClients: clientCount || 0,
        target: target || null,
        revenueByClient: Object.values(revenueByClient)
      });

    } else if (viewType === 'manager') {
      // Manager sees their team's aggregated data (including their own transactions)
      console.log('📊 Manager Analytics - User ID:', userId, 'Org ID:', organizationId);
      
      const { data: teamMembers } = await supabaseAdminSales
        .from('sales_team_hierarchy')
        .select('user_id')
        .eq('manager_id', userId)
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      const memberIds = teamMembers?.map(m => m.user_id) || [];
      console.log('👥 Team Members:', memberIds);
      
      // Include manager's own ID in the list
      const allMemberIds = [...memberIds, userId];
      console.log('📋 All Member IDs (including manager):', allMemberIds);

      // Query transactions directly for team members + manager
      const { data: transactions, error: txnError } = await supabaseAdminSales
        .from('transactions')
        .select('total_amount, tax_amount, sales_member_id')
        .eq('organization_id', organizationId)
        .in('sales_member_id', allMemberIds);

      console.log('💰 Transactions found:', transactions?.length || 0);
      if (txnError) console.error('❌ Transaction query error:', txnError);
      if (transactions) console.log('💵 Sample transaction:', transactions[0]);

      const totalRevenue = transactions?.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0) || 0;
      const totalTransactions = transactions?.length || 0;
      const totalProfit = transactions?.reduce((sum, t) => sum + (Number(t.total_amount) - Number(t.tax_amount) || 0), 0) || 0;
      
      console.log('📈 Analytics Summary:', { totalRevenue, totalTransactions, totalProfit });

      // Aggregate by member (including manager)
      const memberPerformance = allMemberIds.map(memberId => {
        const memberTxns = transactions?.filter(t => t.sales_member_id === memberId) || [];
        return {
          user_id: memberId,
          revenue: memberTxns.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0),
          transactions: memberTxns.length,
          profit: memberTxns.reduce((sum, t) => sum + (Number(t.total_amount) - Number(t.tax_amount) || 0), 0)
        };
      });

      return NextResponse.json({
        totalRevenue,
        totalTransactions,
        totalProfit,
        teamSize: memberIds.length, // Team size excludes manager
        memberPerformance
      });

    } else if (viewType === 'admin') {
      // Admin sees organization-wide data - query transactions directly
      const { data: transactions } = await supabaseAdminSales
        .from('transactions')
        .select('total_amount, subtotal_amount, tax_amount, discount_amount, sales_member_id')
        .eq('organization_id', organizationId);

      const totalRevenue = transactions?.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0) || 0;
      const totalTransactions = transactions?.length || 0;
      const totalProfit = transactions?.reduce((sum, t) => sum + (Number(t.total_amount) - Number(t.tax_amount) - Number(t.discount_amount) || 0), 0) || 0;

      // Get total active clients
      const { count: clientCount } = await supabaseAdminSales
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'active');

      // Get hierarchy for manager grouping
      const { data: hierarchy } = await supabaseAdminSales
        .from('sales_team_hierarchy')
        .select('user_id, manager_id')
        .eq('organization_id', organizationId);

      // Revenue by manager
      const managerPerformance: any = {};
      transactions?.forEach(txn => {
        const memberHierarchy = hierarchy?.find(h => h.user_id === txn.sales_member_id);
        const managerId = memberHierarchy?.manager_id || 'unassigned';
        
        if (!managerPerformance[managerId]) {
          managerPerformance[managerId] = {
            revenue: 0,
            transactions: 0,
            profit: 0
          };
        }
        managerPerformance[managerId].revenue += Number(txn.total_amount) || 0;
        managerPerformance[managerId].transactions += 1;
        managerPerformance[managerId].profit += Number(txn.total_amount) - Number(txn.tax_amount) || 0;
      });

      return NextResponse.json({
        totalRevenue,
        totalTransactions,
        totalProfit,
        totalClients: clientCount || 0,
        managerPerformance: Object.entries(managerPerformance).map(([managerId, data]: [string, any]) => ({
          manager_id: managerId,
          ...(data as object)
        }))
      });
    }

    return NextResponse.json({ error: 'Invalid view type' }, { status: 400 });

  } catch (error: any) {
    console.error('Get analytics error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch analytics',
      details: error.message 
    }, { status: 500 });
  }
}
