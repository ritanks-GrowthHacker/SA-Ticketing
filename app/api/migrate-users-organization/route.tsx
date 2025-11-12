import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST() {
  try {
    console.log('Adding organization_id column to users table...');

    // Add organization_id column if it doesn't exist
    const { error: alterError } = await supabase.rpc('sql', {
      query: `
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
      `
    });

    if (alterError) {
      console.error('Error adding organization_id column:', alterError);
      return NextResponse.json({ 
        error: 'Failed to add organization_id column',
        details: alterError 
      }, { status: 500 });
    }

    // Create index if it doesn't exist
    const { error: indexError } = await supabase.rpc('sql', {
      query: `
        CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
      `
    });

    if (indexError) {
      console.error('Error creating index:', indexError);
      return NextResponse.json({ 
        error: 'Failed to create index',
        details: indexError 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Successfully added organization_id column to users table'
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error },
      { status: 500 }
    );
  }
}