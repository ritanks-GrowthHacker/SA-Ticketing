import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdminSales } from '@/app/db/connections';
import { DecodedToken, extractUserAndOrgId } from '../helpers';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    const { userId, organizationId } = extractUserAndOrgId(decoded);

    const { full_name, phone } = await req.json();

    // Check if user already exists in sales_team_hierarchy
    const { data: existingUser } = await supabaseAdminSales
      .from('sales_team_hierarchy')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (existingUser) {
      return NextResponse.json({ 
        message: 'User already synced',
        user: existingUser 
      });
    }

    // Determine sales role from JWT departments array (new format) or department_role (old format)
    let salesRole = 'sales_member'; // default
    if (decoded.departments) {
      const salesDept = decoded.departments.find(d => d.name?.toLowerCase() === 'sales');
      if (salesDept) {
        const role = salesDept.role?.toUpperCase();
        if (role === 'ADMIN') salesRole = 'sales_admin';
        else if (role === 'MANAGER') salesRole = 'sales_manager';
      }
    } else if (decoded.department_role) {
      if (decoded.department_role === 'Admin') salesRole = 'sales_admin';
      else if (decoded.department_role === 'Manager') salesRole = 'sales_manager';
    }

    // Insert user into sales_team_hierarchy
    const { data: newUser, error } = await supabaseAdminSales
      .from('sales_team_hierarchy')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        email: decoded.email,
        full_name: full_name || decoded.email?.split('@')[0] || 'Unknown',
        phone: phone || null,
        sales_role: salesRole,
        manager_id: null, // Will be assigned by admin later
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error syncing user to sales DB:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'User synced successfully',
      user: newUser 
    });

  } catch (error: any) {
    console.error('Sales user sync error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync user',
      details: error.message 
    }, { status: 500 });
  }
}
