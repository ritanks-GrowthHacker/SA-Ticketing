import { supabase } from '../app/db/connections';
import fs from 'fs';
import path from 'path';

async function updateOrganizationTable() {
  try {
    console.log('🔄 Starting organization table updates...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add-organization-enhancements.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL commands by semicolon and filter empty ones
    const sqlCommands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`📝 Found ${sqlCommands.length} SQL commands to execute`);

    // Execute each command
    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i];
      console.log(`⚡ Executing command ${i + 1}/${sqlCommands.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql_query: command 
      });

      if (error) {
        console.error(`❌ Error executing command ${i + 1}:`, error);
        console.error(`Command: ${command}`);
        // Continue with other commands even if one fails
      } else {
        console.log(`✅ Command ${i + 1} executed successfully`);
      }
    }

    // Verify the changes
    console.log('\n🔍 Verifying table structure...');
    const { data: tableInfo, error: infoError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'organizations');

    if (infoError) {
      console.error('❌ Error getting table info:', infoError);
    } else {
      console.log('📊 Organizations table columns:');
      tableInfo?.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });
    }

    console.log('\n✅ Organization table update process completed!');

  } catch (error) {
    console.error('❌ Fatal error updating organization table:', error);
  }
}

// Run the update
updateOrganizationTable();