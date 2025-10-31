import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

export async function GET(request: NextRequest) {
  try {
    console.log('🔧 DIRECT DB CHECK: Fetching project statuses...');

    // Try multiple approaches to get the data
    
    // Approach 1: Simple select all
    const { data: method1, error: error1 } = await supabase
      .from('project_statuses')
      .select('*');
    
    console.log('🔧 Method 1 (select *):', method1, 'Error:', error1);

    // Approach 2: Select with specific columns
    const { data: method2, error: error2 } = await supabase
      .from('project_statuses')
      .select('id, name, description, color_code, sort_order, is_active, organization_id');
    
    console.log('🔧 Method 2 (specific columns):', method2, 'Error:', error2);

    // Approach 3: Count rows
    const { count, error: error3 } = await supabase
      .from('project_statuses')
      .select('*', { count: 'exact', head: true });
    
    console.log('🔧 Method 3 (count):', count, 'Error:', error3);

    // Check current user/session
    const { data: user, error: userError } = await supabase.auth.getUser();
    console.log('🔧 Current user:', user, 'Error:', userError);

    return NextResponse.json({
      message: 'Direct database check',
      method1: { data: method1, error: error1 },
      method2: { data: method2, error: error2 },
      method3: { count, error: error3 },
      user: user
    });

  } catch (error) {
    console.error('🔥 Direct DB check error:', error);
    return NextResponse.json(
      { error: 'Database check failed', details: error },
      { status: 500 }
    );
  }
}