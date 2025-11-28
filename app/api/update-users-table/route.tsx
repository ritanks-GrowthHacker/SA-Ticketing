import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, sql } from '@/lib/db-helper';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting users table update for multiple departments...');

    // SQL commands to update users table
    const sqlCommands = [
      // Add new departments array column
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS departments UUID[]`,
      
      // Create index for performance on departments array  
      `CREATE INDEX IF NOT EXISTS idx_users_departments ON users USING GIN (departments)`,
      
      // Update existing users to move single department to array (if any exist)
      `UPDATE users SET departments = ARRAY[department_id] WHERE department_id IS NOT NULL AND departments IS NULL`,
      
      // Remove old single department columns
      `ALTER TABLE users DROP COLUMN IF EXISTS department_id`,
      `ALTER TABLE users DROP COLUMN IF EXISTS department`
    ];

    const results = [];

    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i];
      console.log(`⚡ Executing command ${i + 1}/${sqlCommands.length}...`);
      
      try {
        await db.execute(sql.raw(command));
        console.log(`✅ Command ${i + 1} executed successfully`);
        results.push({ 
          command: i + 1, 
          status: 'success',
          sql: command.substring(0, 100) + '...'
        });
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
      const result = await db.execute(sql`SELECT * FROM users LIMIT 1`);
      if (result.rows && result.rows.length > 0) {
        tableStructure = Object.keys(result.rows[0]);
      } else {
        tableStructure = 'No data in table';
      }
    } catch (err) {
      console.log('Could not fetch table structure for verification');
    }

    return NextResponse.json({
      success: true,
      message: 'Users table update completed',
      results: results,
      tableStructure: tableStructure
    });

  } catch (error) {
    console.error('❌ Fatal error updating users table:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update users table',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}