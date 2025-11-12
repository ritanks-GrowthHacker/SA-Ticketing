import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting organization table updates...');

    // List of SQL commands to execute
    const sqlCommands = [
      // Add username column
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE`,
      
      // Add password hash column
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`,
      
      // Add org email column
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_email VARCHAR(255) UNIQUE`,
      
      // Add mobile number column
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20)`,
      
      // Add OTP columns
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS otp VARCHAR(6)`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS otp_expiry TIMESTAMP`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE`,
      
      // Add associated departments as UUID array
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS associated_departments UUID[]`,
      
      // Update existing records
      `UPDATE organizations SET otp_verified = FALSE WHERE otp_verified IS NULL`
    ];

    const results = [];

    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i];
      console.log(`⚡ Executing command ${i + 1}/${sqlCommands.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: command });
        
        if (error) {
          console.error(`❌ Error executing command ${i + 1}:`, error);
          results.push({ 
            command: i + 1, 
            status: 'error', 
            error: error.message,
            sql: command.substring(0, 100) + '...'
          });
        } else {
          console.log(`✅ Command ${i + 1} executed successfully`);
          results.push({ 
            command: i + 1, 
            status: 'success',
            sql: command.substring(0, 100) + '...'
          });
        }
      } catch (err) {
        console.error(`❌ Exception in command ${i + 1}:`, err);
        results.push({ 
          command: i + 1, 
          status: 'exception', 
          error: (err as Error).message,
          sql: command.substring(0, 100) + '...'
        });
      }
    }

    // Try to get table structure to verify
    let tableStructure = null;
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .limit(1);
      
      if (!error && data) {
        tableStructure = data.length > 0 ? Object.keys(data[0]) : 'No data in table';
      }
    } catch (err) {
      console.log('Could not fetch table structure for verification');
    }

    return NextResponse.json({
      success: true,
      message: 'Organization table update completed',
      results: results,
      tableStructure: tableStructure
    });

  } catch (error) {
    console.error('❌ Fatal error updating organization table:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update organization table',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}