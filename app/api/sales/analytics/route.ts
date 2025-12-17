import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/db';
import { transactions, clients, salesTeamHierarchy, salesTargets } from '@/db/sales-schema';
import { eq, and, count as drizzleCount, sql } from 'drizzle-orm';

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
      const transactionsData = await db
        .select({
          totalAmount: transactions.totalAmount,
          subtotalAmount: transactions.subtotalAmount,
          taxAmount: transactions.taxAmount,
          clientId: transactions.clientId,
          clientName: clients.clientName
        })
        .from(transactions)
        .leftJoin(clients, eq(transactions.clientId, clients.clientId))
        .where(and(
          eq(transactions.organizationId, organizationId),
          eq(transactions.salesMemberId, userId)
        ));

      const totalRevenue = transactionsData?.reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0) || 0;
      const totalTransactions = transactionsData?.length || 0;
      const totalProfit = transactionsData?.reduce((sum, t) => sum + (Number(t.totalAmount) - Number(t.taxAmount) || 0), 0) || 0;

      // Get total clients
      const clientCountResult = await db
        .select({ count: drizzleCount() })
        .from(clients)
        .where(and(
          eq(clients.assignedSalesMemberId, userId),
          eq(clients.status, 'active')
        ));
      const clientCount = clientCountResult[0]?.count || 0;

      // Get targets
      const targetData = await db
        .select()
        .from(salesTargets)
        .where(and(
          eq(salesTargets.userId, userId),
          eq(salesTargets.targetType, 'monthly'),
          eq(salesTargets.targetYear, currentYear),
          eq(salesTargets.targetMonth, currentMonth)
        ))
        .limit(1);

      // Group by client
      const revenueByClient: any = {};
      transactionsData?.forEach(txn => {
        const clientId = txn.clientId;
        const clientName = txn.clientName || 'Unknown';
        if (!revenueByClient[clientId]) {
          revenueByClient[clientId] = {
            client_name: clientName,
            revenue: 0,
            transactions: 0
          };
        }
        revenueByClient[clientId].revenue += Number(txn.totalAmount) || 0;
        revenueByClient[clientId].transactions += 1;
      });

      return NextResponse.json({
        totalRevenue,
        totalTransactions,
        totalProfit,
        totalClients: clientCount || 0,
        target: targetData[0] || null,
        revenueByClient: Object.values(revenueByClient)
      });

    } else if (viewType === 'manager') {
      // Manager sees their team's aggregated data (including their own transactions)
      console.log('📊 Manager Analytics - User ID:', userId, 'Org ID:', organizationId);
      
      const teamMembersData = await db
        .select({ userId: salesTeamHierarchy.userId })
        .from(salesTeamHierarchy)
        .where(and(
          eq(salesTeamHierarchy.managerId, userId),
          eq(salesTeamHierarchy.organizationId, organizationId),
          eq(salesTeamHierarchy.isActive, true)
        ));

      const memberIds = teamMembersData?.map(m => m.userId) || [];
      console.log('👥 Team Members:', memberIds);
      
      // Include manager's own ID in the list
      const allMemberIds = [...memberIds, userId];
      console.log('📋 All Member IDs (including manager):', allMemberIds);

      // Query transactions directly for team members + manager
      const transactionsData = await db
        .select({
          totalAmount: transactions.totalAmount,
          taxAmount: transactions.taxAmount,
          salesMemberId: transactions.salesMemberId
        })
        .from(transactions)
        .where(and(
          eq(transactions.organizationId, organizationId),
          sql`${transactions.salesMemberId} = ANY(${allMemberIds})`
        ));

      console.log('💰 Transactions found:', transactionsData?.length || 0);
      if (transactionsData) console.log('💵 Sample transaction:', transactionsData[0]);

      const totalRevenue = transactionsData?.reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0) || 0;
      const totalTransactions = transactionsData?.length || 0;
      const totalProfit = transactionsData?.reduce((sum, t) => sum + (Number(t.totalAmount) - Number(t.taxAmount) || 0), 0) || 0;
      
      console.log('📈 Analytics Summary:', { totalRevenue, totalTransactions, totalProfit });

      // Aggregate by member (including manager)
      const memberPerformance = allMemberIds.map(memberId => {
        const memberTxns = transactionsData?.filter(t => t.salesMemberId === memberId) || [];
        return {
          user_id: memberId,
          revenue: memberTxns.reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0),
          transactions: memberTxns.length,
          profit: memberTxns.reduce((sum, t) => sum + (Number(t.totalAmount) - Number(t.taxAmount) || 0), 0)
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
      const transactionsData = await db
        .select({
          totalAmount: transactions.totalAmount,
          subtotalAmount: transactions.subtotalAmount,
          taxAmount: transactions.taxAmount,
          discountAmount: transactions.discountAmount,
          salesMemberId: transactions.salesMemberId
        })
        .from(transactions)
        .where(eq(transactions.organizationId, organizationId));

      const totalRevenue = transactionsData?.reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0) || 0;
      const totalTransactions = transactionsData?.length || 0;
      const totalProfit = transactionsData?.reduce((sum, t) => sum + (Number(t.totalAmount) - Number(t.taxAmount) - Number(t.discountAmount) || 0), 0) || 0;

      // Get total active clients
      const clientCountResult = await db
        .select({ count: drizzleCount() })
        .from(clients)
        .where(and(
          eq(clients.organizationId, organizationId),
          eq(clients.status, 'active')
        ));
      const clientCount = clientCountResult[0]?.count || 0;

      // Get hierarchy for manager grouping
      const hierarchyData = await db
        .select({
          userId: salesTeamHierarchy.userId,
          managerId: salesTeamHierarchy.managerId
        })
        .from(salesTeamHierarchy)
        .where(eq(salesTeamHierarchy.organizationId, organizationId));

      // Revenue by manager
      const managerPerformance: any = {};
      transactionsData?.forEach(txn => {
        const memberHierarchy = hierarchyData?.find(h => h.userId === txn.salesMemberId);
        const managerId = memberHierarchy?.managerId || 'unassigned';
        
        if (!managerPerformance[managerId]) {
          managerPerformance[managerId] = {
            revenue: 0,
            transactions: 0,
            profit: 0
          };
        }
        managerPerformance[managerId].revenue += Number(txn.totalAmount) || 0;
        managerPerformance[managerId].transactions += 1;
        managerPerformance[managerId].profit += Number(txn.totalAmount) - Number(txn.taxAmount) || 0;
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
